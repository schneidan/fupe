import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import nodemailer = require('nodemailer');
import type { Transporter } from 'nodemailer';
import {
  escapeHtml,
  renderBrandedEmail,
  siteBaseUrl,
} from './email-layout';
import { resolveJwtSecret } from '../common/security';
import { signEmailUpdatesUnsubscribeToken } from '../common/email-unsubscribe';

export interface OutboundEmail {
  to: string;
  subject: string;
  text: string;
  html: string;
  /** Extra SMTP / Resend headers (e.g. List-Unsubscribe). */
  headers?: Record<string, string>;
}

/**
 * Outbound mail.
 * - EMAIL_PROVIDER=console (default): log the message (dev)
 * - EMAIL_PROVIDER=smtp (or SMTP_HOST set): nodemailer SMTP
 * - EMAIL_PROVIDER=resend: Resend HTTP API (https://resend.com)
 */
@Injectable()
export class MailService {
  private readonly logger = new Logger(MailService.name);
  private transporter: Transporter | null = null;

  constructor(private readonly config: ConfigService) {}

  async sendVerificationEmail(to: string, verifyUrl: string): Promise<void> {
    const site = this.siteUrl();
    await this.send({
      to,
      subject: 'Verify your FUPE email',
      text: [
        'Verify your FUPE account to submit ownership edits.',
        '',
        `Open this link: ${verifyUrl}`,
        '',
        'If you did not create an account, you can ignore this email.',
        '',
        `Support: support@fupe.app · ${site}`,
      ].join('\n'),
      html: renderBrandedEmail(
        {
          preheader: 'Confirm your email to contribute ownership edits.',
          headline: 'Verify your email',
          bodyHtml: `<p style="margin:0 0 12px">Thanks for joining FUPE. Confirm your address so you can submit ownership edits and manage your account.</p>`,
          cta: { label: 'Verify email', url: verifyUrl },
          footnoteHtml:
            'If you did not create a FUPE account, you can ignore this email.',
        },
        { siteUrl: site },
      ),
    });
  }

  async sendPasswordResetEmail(to: string, resetUrl: string): Promise<void> {
    const site = this.siteUrl();
    await this.send({
      to,
      subject: 'Reset your FUPE password',
      text: [
        'We received a request to reset your FUPE password.',
        '',
        `Open this link to choose a new password: ${resetUrl}`,
        '',
        'This link expires in one hour. If you did not request a reset, you can ignore this email.',
        '',
        `Support: support@fupe.app · ${site}`,
      ].join('\n'),
      html: renderBrandedEmail(
        {
          preheader: 'Choose a new password — link expires in one hour.',
          headline: 'Reset your password',
          bodyHtml: `<p style="margin:0 0 12px">We received a request to reset the password for this FUPE account.</p>`,
          cta: { label: 'Choose a new password', url: resetUrl },
          footnoteHtml:
            'This link expires in one hour. If you did not request a reset, you can ignore this email.',
        },
        { siteUrl: site },
      ),
    });
  }

  async sendEmailChangeConfirmEmail(
    to: string,
    confirmUrl: string,
    params: { currentEmail: string },
  ): Promise<void> {
    const site = this.siteUrl();
    await this.send({
      to,
      subject: 'Confirm your new FUPE email',
      text: [
        'Confirm this address to finish changing your FUPE account email.',
        `Current email: ${params.currentEmail}`,
        '',
        `Open this link: ${confirmUrl}`,
        '',
        'This link expires in 24 hours. If you did not request this, ignore this email.',
        '',
        `Support: support@fupe.app · ${site}`,
      ].join('\n'),
      html: renderBrandedEmail(
        {
          preheader: 'Confirm your new email address for FUPE.',
          headline: 'Confirm your new email',
          bodyHtml: `<p style="margin:0 0 12px">Someone (hopefully you) asked to change a FUPE account email from <strong style="color:#ffffff">${escapeHtml(params.currentEmail)}</strong> to this address.</p>`,
          cta: { label: 'Confirm new email', url: confirmUrl },
          footnoteHtml:
            'This link expires in 24 hours. If you did not request this, you can ignore this email.',
        },
        { siteUrl: site },
      ),
    });
  }

  async sendEmailChangeNoticeEmail(
    to: string,
    pendingEmail: string,
  ): Promise<void> {
    const site = this.siteUrl();
    await this.send({
      to,
      subject: 'FUPE email change requested',
      text: [
        'A request was made to change the email on your FUPE account.',
        `Pending new email: ${pendingEmail}`,
        '',
        'If you did not request this, sign in and cancel the change from your account page, or contact support@fupe.app.',
        '',
        `Account: ${site}/account`,
      ].join('\n'),
      html: renderBrandedEmail(
        {
          preheader: 'Email change requested on your FUPE account.',
          headline: 'Email change requested',
          bodyHtml: `<p style="margin:0 0 12px">A request was made to change your FUPE account email to <strong style="color:#ffffff">${escapeHtml(pendingEmail)}</strong>. A confirmation link was sent to that address.</p><p style="margin:0 0 12px">If this wasn&apos;t you, cancel the pending change on your account page or contact support.</p>`,
          cta: { label: 'Open account', url: `${site}/account` },
        },
        { siteUrl: site },
      ),
    });
  }

  async sendProductUpdateEmail(
    to: string,
    params: {
      subject: string;
      bodyText: string;
      bodyHtml: string;
      userId: string;
    },
  ): Promise<void> {
    const site = this.siteUrl();
    const token = signEmailUpdatesUnsubscribeToken(
      params.userId,
      resolveJwtSecret(this.config),
    );
    const unsubPage = `${site}/unsubscribe?token=${encodeURIComponent(token)}`;
    // One-click POST target (RFC 8058) — Nest auth route via web rewrite.
    const unsubApi = `${site}/api/v1/auth/email-updates/unsubscribe?token=${encodeURIComponent(token)}`;

    await this.send({
      to,
      subject: params.subject,
      text: [
        params.bodyText,
        '',
        '—',
        'You’re receiving this because you opted in to occasional FUPE updates.',
        `Unsubscribe: ${unsubPage}`,
        `Manage preferences: ${site}/account`,
        `Support: support@fupe.app`,
      ].join('\n'),
      html: renderBrandedEmail(
        {
          preheader: params.subject,
          headline: params.subject.replace(/^FUPE:\s*/i, '') || 'FUPE update',
          bodyHtml: params.bodyHtml,
          cta: { label: 'Manage email preferences', url: `${site}/account` },
          footnoteHtml: `You’re receiving this because you opted in to occasional FUPE product updates. <a href="${escapeHtml(unsubPage)}" style="color:#d4d4d4">Unsubscribe</a> anytime, or manage preferences on your account page.`,
        },
        { siteUrl: site },
      ),
      headers: {
        'List-Unsubscribe': `<${unsubApi}>`,
        'List-Unsubscribe-Post': 'List-Unsubscribe=One-Click',
      },
    });
  }

  async sendEditReceivedEmail(
    to: string,
    params: { status: 'queued' | 'committed'; summary?: string },
  ): Promise<void> {
    const site = this.siteUrl();
    const queued = params.status === 'queued';
    const headline = queued
      ? 'We got your suggestion'
      : 'Your suggestion was applied';
    const detail = params.summary?.trim();
    const body = queued
      ? `<p style="margin:0 0 12px">Thanks for contributing to FUPE. Your suggestion is in the review queue — we&apos;ll email you when a moderator decides.</p>`
      : `<p style="margin:0 0 12px">Thanks for contributing. Your trust score was high enough that this ownership edit was applied to the graph immediately.</p>`;
    const detailHtml = detail
      ? `<p style="margin:0 0 12px;padding:12px;background:#1c1c1c;border:1px solid #3a3a3a;border-radius:8px;color:#d4d4d4">${escapeHtml(detail)}</p>`
      : '';

    await this.send({
      to,
      subject: queued
        ? 'FUPE: we got your suggestion'
        : 'FUPE: your suggestion was applied',
      text: [
        headline + '.',
        detail || '',
        '',
        `Track your edits: ${site}/account/edits`,
        `Support: support@fupe.app`,
      ]
        .filter(Boolean)
        .join('\n'),
      html: renderBrandedEmail(
        {
          preheader: headline,
          headline,
          bodyHtml: body + detailHtml,
          cta: { label: 'View my edits', url: `${site}/account/edits` },
        },
        { siteUrl: site },
      ),
    });
  }

  async sendEditReviewEmail(
    to: string,
    params: {
      decision: 'APPROVED' | 'REJECTED';
      reviewNote?: string | null;
    },
  ): Promise<void> {
    const site = this.siteUrl();
    const approved = params.decision === 'APPROVED';
    const headline = approved
      ? 'Your edit was approved'
      : 'Your edit was not approved';
    const note = params.reviewNote?.trim();
    const body = approved
      ? `<p style="margin:0 0 12px">A moderator accepted your ownership contribution. Thank you for helping keep the graph accurate.</p>`
      : `<p style="margin:0 0 12px">A moderator reviewed your ownership contribution and did not approve it this time.</p>${
          note
            ? `<p style="margin:0 0 12px;padding:12px;background:#1c1c1c;border:1px solid #3a3a3a;border-radius:8px;color:#d4d4d4"><strong style="color:#ffffff">Note:</strong> ${escapeHtml(note)}</p>`
            : ''
        }`;

    await this.send({
      to,
      subject: approved
        ? 'FUPE: your edit was approved'
        : 'FUPE: your edit was not approved',
      text: [
        headline + '.',
        note ? `Note: ${note}` : '',
        '',
        `View your edits: ${site}/account/edits`,
        `Support: support@fupe.app`,
      ]
        .filter(Boolean)
        .join('\n'),
      html: renderBrandedEmail(
        {
          preheader: headline,
          headline,
          bodyHtml: body,
          cta: { label: 'View my edits', url: `${site}/account/edits` },
        },
        { siteUrl: site },
      ),
    });
  }

  async sendSubscriptionStartedEmail(
    to: string,
    tier: string,
  ): Promise<void> {
    const site = this.siteUrl();
    const tierLabel = tier.charAt(0).toUpperCase() + tier.slice(1);
    await this.send({
      to,
      subject: `Welcome to FUPE ${tierLabel}`,
      text: [
        `Your ${tierLabel} subscription is active.`,
        '',
        `Manage billing: ${site}/developers`,
        `Support: support@fupe.app`,
      ].join('\n'),
      html: renderBrandedEmail(
        {
          preheader: `${tierLabel} subscription is active.`,
          headline: `${tierLabel} is active`,
          bodyHtml: `<p style="margin:0 0 12px">Thanks for supporting FUPE. Your API keys now use the ${escapeHtml(tierLabel)} rate limits${tier !== 'free' ? ' (including image lookup where applicable)' : ''}.</p>`,
          cta: { label: 'Open Developers', url: `${site}/developers` },
        },
        { siteUrl: site },
      ),
    });
  }

  async sendSubscriptionCanceledEmail(to: string): Promise<void> {
    const site = this.siteUrl();
    await this.send({
      to,
      subject: 'Your FUPE subscription ended',
      text: [
        'Your paid FUPE subscription has ended. Your account is back on the Free tier.',
        '',
        `Resubscribe anytime: ${site}/developers`,
        `Support: support@fupe.app`,
      ].join('\n'),
      html: renderBrandedEmail(
        {
          preheader: 'Your account is back on the Free tier.',
          headline: 'Subscription ended',
          bodyHtml: `<p style="margin:0 0 12px">Your paid FUPE subscription has ended. Active API keys are on the Free tier limits. You can upgrade again anytime from Developers.</p>`,
          cta: { label: 'Manage subscription', url: `${site}/developers` },
        },
        { siteUrl: site },
      ),
    });
  }

  async sendPaymentFailedEmail(to: string): Promise<void> {
    const site = this.siteUrl();
    await this.send({
      to,
      subject: 'FUPE payment failed — action needed',
      text: [
        'We could not process a payment for your FUPE subscription.',
        'Update your payment method to keep Developer/Pro access.',
        '',
        `Billing portal: ${site}/developers`,
        `Support: support@fupe.app`,
      ].join('\n'),
      html: renderBrandedEmail(
        {
          preheader: 'Update your payment method to keep your plan.',
          headline: 'Payment failed',
          bodyHtml: `<p style="margin:0 0 12px">We could not process a payment for your FUPE subscription. Please update your payment method so you don’t lose paid-tier access.</p>`,
          cta: { label: 'Update billing', url: `${site}/developers` },
        },
        { siteUrl: site },
      ),
    });
  }

  async sendComplimentaryTierEmail(
    to: string,
    tier: string,
    note?: string | null,
  ): Promise<void> {
    const site = this.siteUrl();
    const tierLabel = tier.charAt(0).toUpperCase() + tier.slice(1);
    const noteHtml = note?.trim()
      ? `<p style="margin:12px 0 0;color:#737373">${escapeHtml(note.trim())}</p>`
      : '';
    await this.send({
      to,
      subject: `FUPE ${tierLabel} access granted`,
      text: [
        `An admin granted you complimentary ${tierLabel} access on FUPE.`,
        note?.trim() ? `Note: ${note.trim()}` : '',
        '',
        `Open Developers: ${site}/developers`,
      ]
        .filter(Boolean)
        .join('\n'),
      html: renderBrandedEmail(
        {
          preheader: `Complimentary ${tierLabel} access.`,
          headline: `${tierLabel} access granted`,
          bodyHtml: `<p style="margin:0 0 12px">An admin granted you complimentary <strong style="color:#ffffff">${escapeHtml(tierLabel)}</strong> access on FUPE.${noteHtml}</p>`,
          cta: { label: 'Open Developers', url: `${site}/developers` },
        },
        { siteUrl: site },
      ),
    });
  }

  /** Soft-fail wrapper — never break the primary action if mail fails. */
  async sendSafe(
    label: string,
    fn: () => Promise<void>,
  ): Promise<void> {
    try {
      await fn();
    } catch (err) {
      this.logger.warn(
        `Email ${label} failed: ${err instanceof Error ? err.message : err}`,
      );
    }
  }

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
        headers: message.headers,
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

  private siteUrl(): string {
    return siteBaseUrl(
      this.config.get<string>('NEXT_PUBLIC_SITE_URL') ??
        this.config.get<string>('SITE_URL'),
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
        ...(message.headers
          ? {
              headers: Object.entries(message.headers).map(([name, value]) => ({
                name,
                value,
              })),
            }
          : {}),
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
      tls: {
        rejectUnauthorized: process.env.NODE_ENV === 'production',
      },
    });

    this.logger.log(`SMTP transport ready → ${host}:${port}`);
    return this.transporter;
  }
}
