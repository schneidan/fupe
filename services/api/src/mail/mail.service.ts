import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';

/**
 * Outbound mail. Default provider is `console` (logs the link) so local
 * Phase 5.2 works without SMTP. Set EMAIL_PROVIDER=smtp later if needed.
 */
@Injectable()
export class MailService {
  private readonly logger = new Logger(MailService.name);

  constructor(private readonly config: ConfigService) {}

  async sendVerificationEmail(to: string, verifyUrl: string): Promise<void> {
    const provider = (
      this.config.get<string>('EMAIL_PROVIDER') ?? 'console'
    ).toLowerCase();

    if (provider === 'console') {
      this.logger.log(
        `[email] Verification for ${to}\n  Open: ${verifyUrl}`,
      );
      return;
    }

    // Placeholder for real providers — keep console until SMTP/Resend is wired.
    this.logger.warn(
      `EMAIL_PROVIDER=${provider} is not implemented; logging link for ${to}`,
    );
    this.logger.log(`[email] Verification for ${to}\n  Open: ${verifyUrl}`);
  }
}
