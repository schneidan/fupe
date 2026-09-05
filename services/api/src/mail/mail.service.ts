import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import nodemailer = require('nodemailer');
import type { Transporter } from 'nodemailer';

export interface OutboundEmail {
  to: string;
  subject: string;
  text: string;
  html: string;
}

/**
 * Outbound mail.
 * - EMAIL_PROVIDER=console (default): log the message (dev)
 * - EMAIL_PROVIDER=smtp (or SMTP_HOST set): nodemailer SMTP
 * - EMAIL_PROVIDER=resend: Resend HTTP API (https://resend.com)
 *
 * Resend:
 *   EMAIL_PROVIDER=resend
 *   RESEND_API_KEY=re_...
 *   EMAIL_FROM=FUPE <noreply@fupe.app>   # domain must be verified in Resend
 *
 * Resend via SMTP (alternative): EMAIL_PROVIDER=smtp,
 *   SMTP_HOST=smtp.resend.com SMTP_PORT=465 SMTP_SECURE=true
 *   SMTP_USER=resend SMTP_PASS=$RESEND_API_KEY
 */
@Injectable()
export class MailService {
  private readonly logger = new Logger(MailService.name);
  private transporter: Transporter | null = null;

  constructor(private readonly config: ConfigService) {}

  async sendVerificationEmail(to: string, verifyUrl: string): Promise<void> {
    await this.send({
      to,
      subject: 'Verify your FUPE email',
      text: [
        'Verify your FUPE account to submit ownership edits.',
        '',
        `Open this link: ${verifyUrl}`,
        '',
        'If you did not create an account, you can ignore this email.',
      ].join('\n'),
      html: `
      <p>Verify your FUPE account to submit ownership edits.</p>
      <p><a href="${verifyUrl}">Verify email</a></p>
      <p style="color:#666;font-size:12px">Or paste: ${verifyUrl}</p>
    `,
    });
  }

  async sendPasswordResetEmail(to: string, resetUrl: string): Promise<void> {
    await this.send({
      to,
      subject: 'Reset your FUPE password',
      text: [
        'We received a request to reset your FUPE password.',
        '',
        `Open this link to choose a new password: ${resetUrl}`,
        '',
        'This link expires in one hour. If you did not request a reset, you can ignore this email.',
      ].join('\n'),
      html: `
      <p>We received a request to reset your FUPE password.</p>
      <p><a href="${resetUrl}">Choose a new password</a></p>
      <p style="color:#666;font-size:12px">Or paste: ${resetUrl}</p>
      <p style="color:#666;font-size:12px">This link expires in one hour. If you did not request a reset, ignore this email.</p>
    `,
    });
  }

  /** Shared send path for verification, password reset, etc. */
  async send(message: OutboundEmail): Promise<void> {
    const provider = this.resolveProvider();
    const from = this.fromAddress();

    if (provider === 'console') {
      this.logger.log(
        `[email:console] to=${message.to} subject=${message.subject}\n${message.text}`,
      );
      return;
    }

    if (provider === 'resend') {
      await this.sendViaResend(from, message);
      return;
    }

    if (provider === 'smtp') {
      const transport = this.getSmtpTransport();
      const info = await transport.sendMail({
        from,
        to: message.to,
        subject: message.subject,
        text: message.text,
        html: message.html,
      });
      this.logger.log(
        `[email:smtp] to=${message.to} subject=${message.subject} messageId=${info.messageId}`,
      );
      return;
    }

    this.logger.warn(
      `Unknown EMAIL_PROVIDER=${provider}; falling back to console for ${message.to}`,
    );
    this.logger.log(
      `[email:console] to=${message.to} subject=${message.subject}\n${message.text}`,
    );
  }

  private fromAddress(): string {
    return (
      this.config.get<string>('EMAIL_FROM')?.trim() ||
      'FUPE <noreply@fupe.app>'
    );
  }

  private resolveProvider(): string {
    const explicit = this.config.get<string>('EMAIL_PROVIDER')?.toLowerCase();
    if (explicit) {
      if (
        explicit === 'console' &&
        process.env.NODE_ENV === 'production'
      ) {
        throw new Error(
          'EMAIL_PROVIDER=console is not allowed when NODE_ENV=production',
        );
      }
      return explicit;
    }
    if (this.config.get<string>('RESEND_API_KEY')?.trim()) return 'resend';
    if (this.config.get<string>('SMTP_HOST')) return 'smtp';
    if (process.env.NODE_ENV === 'production') {
      throw new Error(
        'No email provider configured in production (set EMAIL_PROVIDER=resend or smtp)',
      );
    }
    return 'console';
  }

  private async sendViaResend(
    from: string,
    message: OutboundEmail,
  ): Promise<void> {
    const apiKey = this.config.get<string>('RESEND_API_KEY')?.trim();
    if (!apiKey) {
      throw new Error(
        'EMAIL_PROVIDER=resend requires RESEND_API_KEY (https://resend.com/api-keys)',
      );
    }

    const res = await fetch('https://api.resend.com/emails', {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${apiKey}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        from,
        to: [message.to],
        subject: message.subject,
        text: message.text,
        html: message.html,
      }),
    });

    const bodyText = await res.text();
    let parsed: { id?: string; message?: string } = {};
    try {
      parsed = JSON.parse(bodyText) as { id?: string; message?: string };
    } catch {
      /* non-JSON error body */
    }

    if (!res.ok) {
      this.logger.error(
        `[email:resend] Failed to=${message.to} status=${res.status} body=${bodyText.slice(0, 500)}`,
      );
      throw new Error(
        parsed.message ||
          `Resend API error ${res.status}: ${bodyText.slice(0, 200)}`,
      );
    }

    this.logger.log(
      `[email:resend] to=${message.to} subject=${message.subject} id=${parsed.id ?? 'ok'}`,
    );
  }

  private getSmtpTransport(): Transporter {
    if (this.transporter) return this.transporter;

    const host = this.config.get<string>('SMTP_HOST') ?? '127.0.0.1';
    const port = Number(this.config.get<string>('SMTP_PORT') ?? 1025);
    const user = this.config.get<string>('SMTP_USER');
    const pass = this.config.get<string>('SMTP_PASS');
    const secure =
      this.config.get<string>('SMTP_SECURE') === 'true' || port === 465;

    this.transporter = nodemailer.createTransport({
      host,
      port,
      secure,
      auth: user ? { user, pass: pass ?? '' } : undefined,
      tls: { rejectUnauthorized: false },
    });

    this.logger.log(`SMTP transport ready → ${host}:${port}`);
    return this.transporter;
  }
}
