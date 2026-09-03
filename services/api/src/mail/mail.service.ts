import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import nodemailer = require('nodemailer');
import type { Transporter } from 'nodemailer';

/**
 * Outbound mail.
 * - EMAIL_PROVIDER=console (default): log the link
 * - EMAIL_PROVIDER=smtp (or SMTP_HOST set): send via SMTP
 *
 * Mailpit: SMTP 127.0.0.1:1025, UI http://localhost:8025
 * Production: any SMTP (Resend SMTP, Postmark, SES, etc.)
 */
@Injectable()
export class MailService {
  private readonly logger = new Logger(MailService.name);
  private transporter: Transporter | null = null;

  constructor(private readonly config: ConfigService) {}

  async sendVerificationEmail(to: string, verifyUrl: string): Promise<void> {
    const provider = this.resolveProvider();
    const subject = 'Verify your FUPE email';
    const text = [
      'Verify your FUPE account to submit ownership edits.',
      '',
      `Open this link: ${verifyUrl}`,
      '',
      'If you did not create an account, you can ignore this email.',
    ].join('\n');
    const html = `
      <p>Verify your FUPE account to submit ownership edits.</p>
      <p><a href="${verifyUrl}">Verify email</a></p>
      <p style="color:#666;font-size:12px">Or paste: ${verifyUrl}</p>
    `;

    if (provider === 'console') {
      this.logger.log(
        `[email:console] Verification for ${to}\n  Open: ${verifyUrl}`,
      );
      return;
    }

    if (provider === 'smtp') {
      const transport = this.getSmtpTransport();
      const from =
        this.config.get<string>('EMAIL_FROM') ?? 'FUPE <noreply@fupe.local>';
      const info = await transport.sendMail({ from, to, subject, text, html });
      this.logger.log(
        `[email:smtp] Sent verification to ${to} messageId=${info.messageId}`,
      );
      return;
    }

    this.logger.warn(
      `Unknown EMAIL_PROVIDER=${provider}; falling back to console for ${to}`,
    );
    this.logger.log(
      `[email:console] Verification for ${to}\n  Open: ${verifyUrl}`,
    );
  }

  private resolveProvider(): string {
    const explicit = this.config.get<string>('EMAIL_PROVIDER')?.toLowerCase();
    if (explicit) return explicit;
    if (this.config.get<string>('SMTP_HOST')) return 'smtp';
    return 'console';
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
