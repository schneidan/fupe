import {
  BadRequestException,
  Inject,
  Injectable,
  Logger,
  UnauthorizedException,
  forwardRef,
} from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import { ConfigService } from '@nestjs/config';
import * as bcrypt from 'bcrypt';
import { MailService } from '../mail/mail.service';
import { BillingService } from '../billing/billing.service';
import {
  hashOpaqueToken,
  newOpaqueToken,
} from '../common/security';
import { UsersRepository, UserRole, UserRow } from './users.repository';

/** Precomputed bcrypt of a random string — used only to equalize login timing. */
const DUMMY_PASSWORD_HASH =
  '$2b$10$N9qo8uLOickgx2ZMRZoMyeIjZAgcfl7p92ldGxad68LJZdL17lhWy';

export interface AuthUser {
  id: string;
  email: string;
  trust_score: number;
  role: UserRole;
  email_verified: boolean;
  display_name?: string | null;
  organization?: string | null;
  location?: string | null;
  pending_email?: string | null;
  email_updates_opt_in?: boolean;
  subscription_tier?: 'free' | 'developer' | 'business';
  subscription_status?: string | null;
  subscription_current_period_end?: string | null;
}

@Injectable()
export class AuthService {
  private readonly logger = new Logger(AuthService.name);

  constructor(
    private readonly usersRepo: UsersRepository,
    private readonly jwtService: JwtService,
    private readonly mail: MailService,
    private readonly config: ConfigService,
    @Inject(forwardRef(() => BillingService))
    private readonly billing: BillingService,
  ) {}

  async register(
    email: string,
    password: string,
    opts: { emailUpdatesOptIn?: boolean } = {},
  ): Promise<{ token: string; user: AuthUser }> {
    const existing = await this.usersRepo.findByEmail(email);
    if (existing) {
      // Match happy-path cost so timing doesn’t reveal whether the email exists.
      await bcrypt.hash(password, 10);
      throw new UnauthorizedException('Unable to create account');
    }

    const hash = await bcrypt.hash(password, 10);
    const bootstrap = await this.resolveBootstrapRole(email);
    const autoVerify =
      Boolean(bootstrap) ||
      this.config.get<string>('AUTO_VERIFY_EMAIL') === 'true';

    const rawVerify = autoVerify ? null : newOpaqueToken();
    const verifyExpires = autoVerify
      ? null
      : new Date(Date.now() + 1000 * 60 * 60 * 24);

    const user = await this.usersRepo.create({
      email,
      passwordHash: hash,
      trustScore: bootstrap ? 100 : 0,
      role: bootstrap ?? 'user',
      emailVerifiedAt: autoVerify ? new Date() : null,
      verifyToken: rawVerify ? hashOpaqueToken(rawVerify) : null,
      verifyExpiresAt: verifyExpires,
      emailUpdatesOptIn: opts.emailUpdatesOptIn,
    });

    if (rawVerify) {
      await this.sendVerification(user.email, rawVerify);
    }

    if (bootstrap === 'admin') {
      this.logger.warn(
        `Bootstrap admin granted to ${user.email}. Unset BOOTSTRAP_ADMIN_EMAIL now.`,
      );
    }

    return this.issueToken(user);
  }

  async login(
    email: string,
    password: string,
  ): Promise<{ token: string; user: AuthUser }> {
    const user = await this.usersRepo.findByEmail(email);
    // Always bcrypt so missing users don’t fail faster than bad passwords.
    const valid = await bcrypt.compare(
      password,
      user?.password_hash ?? DUMMY_PASSWORD_HASH,
    );

    if (!user || !valid || user.disabled_at) {
      throw new UnauthorizedException('Invalid credentials');
    }

    const promoted = await this.applyBootstrapRole(user);
    return this.issueToken(promoted);
  }

  async validateUser(
    userId: string,
    tokenVersion?: number,
  ): Promise<AuthUser | null> {
    const user = await this.usersRepo.findById(userId);
    if (!user || user.disabled_at) return null;
    const current = user.token_version ?? 0;
    if (tokenVersion !== undefined && tokenVersion !== current) {
      return null;
    }
    return this.toAuthUser(user);
  }

  async verifyEmail(token: string): Promise<AuthUser> {
    const user = await this.usersRepo.findByVerifyToken(hashOpaqueToken(token));
    if (!user) {
      throw new BadRequestException('Invalid or expired verification link');
    }
    const updated = await this.usersRepo.markEmailVerified(user.id);
    return this.toAuthUser(updated);
  }

  async resendVerification(user: AuthUser): Promise<{ message: string }> {
    if (user.email_verified) {
      return { message: 'Email already verified' };
    }
    const raw = newOpaqueToken();
    const expires = new Date(Date.now() + 1000 * 60 * 60 * 24);
    await this.usersRepo.setVerifyToken(user.id, hashOpaqueToken(raw), expires);
    await this.sendVerification(user.email, raw);
    return { message: 'Verification email sent' };
  }

  /**
   * Always returns the same message whether or not the email exists
   * (avoids account enumeration).
   */
  async forgotPassword(email: string): Promise<{ message: string }> {
    const message =
      'If an account exists for that email, we sent a password reset link.';
    const user = await this.usersRepo.findByEmail(email);
    if (!user || user.disabled_at) {
      return { message };
    }

    const raw = newOpaqueToken();
    const expires = new Date(Date.now() + 1000 * 60 * 60); // 1 hour
    await this.usersRepo.setPasswordResetToken(
      user.id,
      hashOpaqueToken(raw),
      expires,
    );

    const site =
      this.config.get<string>('NEXT_PUBLIC_SITE_URL') ??
      this.config.get<string>('SITE_URL') ??
      'http://localhost:3001';
    const url = `${site.replace(/\/$/, '')}/reset-password?token=${raw}`;
    await this.mail.sendPasswordResetEmail(user.email, url);
    return { message };
  }

  async resetPassword(
    token: string,
    newPassword: string,
  ): Promise<{ message: string }> {
    const user = await this.usersRepo.findByPasswordResetToken(
      hashOpaqueToken(token),
    );
    if (!user) {
      throw new BadRequestException('Invalid or expired reset link');
    }
    const hash = await bcrypt.hash(newPassword, 10);
    await this.usersRepo.updatePasswordHash(user.id, hash);
    return {
      message: 'Password updated. You can sign in with your new password.',
    };
  }

  async exportMyData(user: AuthUser) {
    const data = await this.usersRepo.exportPersonalData(user.id);
    if (!data) throw new BadRequestException('Account not found');
    return data;
  }

  async deleteMyAccount(
    user: AuthUser,
    password: string,
  ): Promise<{ deleted: true }> {
    if (!password?.trim()) {
      throw new BadRequestException('Password is required to delete your account');
    }
    const row = await this.usersRepo.findById(user.id);
    if (!row) {
      throw new UnauthorizedException('Account not found');
    }
    const valid = await bcrypt.compare(password, row.password_hash);
    if (!valid) {
      throw new UnauthorizedException('Incorrect password');
    }

    await this.billing.tearDownForAccountDeletion(row);
    await this.usersRepo.deleteAccount(user.id);
    return { deleted: true };
  }

  isModerator(user: AuthUser): boolean {
    return user.role === 'moderator' || user.role === 'admin';
  }

  isAdmin(user: AuthUser): boolean {
    return user.role === 'admin';
  }

  private async sendVerification(email: string, rawToken: string) {
    const site =
      this.config.get<string>('NEXT_PUBLIC_SITE_URL') ??
      this.config.get<string>('SITE_URL') ??
      'http://localhost:3001';
    const url = `${site.replace(/\/$/, '')}/verify-email?token=${rawToken}`;
    await this.mail.sendVerificationEmail(email, url);
  }

  /**
   * Bootstrap admin only when no active admin exists (one-shot).
   * Moderator bootstrap is email-match only (still log to unset).
   */
  private async resolveBootstrapRole(
    email: string,
  ): Promise<UserRole | null> {
    const normalized = email.toLowerCase();
    const wantAdmin = this.bootstrapAdminEmail() === normalized;
    const wantMod = this.bootstrapModeratorEmail() === normalized;

    if (wantAdmin) {
      const admins = await this.usersRepo.countAdmins();
      if (admins === 0) return 'admin';
      this.logger.warn(
        `BOOTSTRAP_ADMIN_EMAIL matches ${normalized} but an admin already exists — ignoring. Unset BOOTSTRAP_ADMIN_EMAIL.`,
      );
      return wantMod ? 'moderator' : null;
    }
    if (wantMod) return 'moderator';
    return null;
  }

  private async applyBootstrapRole(user: UserRow): Promise<UserRow> {
    const next = await this.resolveBootstrapRole(user.email);
    if (!next) return user;
    if (user.role === 'admin') return user;
    if (next === 'moderator' && user.role !== 'user') return user;
    if (next === user.role) return user;

    const updated = await this.usersRepo.setRole(user.id, next);
    if (next === 'admin') {
      this.logger.warn(
        `Bootstrap admin granted to ${user.email} on login. Unset BOOTSTRAP_ADMIN_EMAIL now.`,
      );
    }
    return updated;
  }

  private bootstrapModeratorEmail(): string | null {
    const raw = this.config.get<string>('BOOTSTRAP_MODERATOR_EMAIL');
    return raw ? raw.toLowerCase().trim() : null;
  }

  private bootstrapAdminEmail(): string | null {
    const raw = this.config.get<string>('BOOTSTRAP_ADMIN_EMAIL');
    return raw ? raw.toLowerCase().trim() : null;
  }

  private issueToken(user: UserRow) {
    const payload = this.toAuthUser(user);
    return {
      token: this.jwtService.sign({
        id: payload.id,
        email: payload.email,
        trust_score: payload.trust_score,
        role: payload.role,
        email_verified: payload.email_verified,
        token_version: user.token_version ?? 0,
      }),
      user: payload,
    };
  }

  private toAuthUser(user: UserRow): AuthUser {
    return {
      id: user.id,
      email: user.email,
      trust_score: user.trust_score,
      role: user.role ?? 'user',
      email_verified: Boolean(user.email_verified_at),
      display_name: user.display_name ?? null,
      organization: user.organization ?? null,
      location: user.location ?? null,
      pending_email: user.pending_email ?? null,
      email_updates_opt_in: Boolean(user.email_updates_opt_in),
      subscription_tier: user.subscription_tier ?? 'free',
      subscription_status: user.subscription_status ?? null,
      subscription_current_period_end: user.subscription_current_period_end
        ? new Date(user.subscription_current_period_end).toISOString()
        : null,
    };
  }

  async getMe(userId: string): Promise<AuthUser> {
    const user = await this.usersRepo.findById(userId);
    if (!user || user.disabled_at) {
      throw new UnauthorizedException('Not authenticated');
    }
    return this.toAuthUser(user);
  }

  async updateMe(
    userId: string,
    patch: {
      display_name?: string | null;
      organization?: string | null;
      location?: string | null;
      email_updates_opt_in?: boolean;
    },
  ): Promise<AuthUser> {
    const user = await this.usersRepo.updateAccountPrefs(userId, patch);
    return this.toAuthUser(user);
  }

  async requestEmailChange(
    userId: string,
    newEmail: string,
    password: string,
  ): Promise<{ message: string; user: AuthUser }> {
    const user = await this.usersRepo.findById(userId);
    if (!user || user.disabled_at) {
      throw new UnauthorizedException('Not authenticated');
    }

    const valid = await bcrypt.compare(password, user.password_hash);
    if (!valid) {
      throw new UnauthorizedException('Incorrect password');
    }

    const normalized = newEmail.toLowerCase().trim();
    if (!normalized || !normalized.includes('@')) {
      throw new BadRequestException('Enter a valid email address');
    }
    if (normalized === user.email) {
      throw new BadRequestException('That is already your email address');
    }

    const taken = await this.usersRepo.findByEmail(normalized);
    if (taken) {
      throw new BadRequestException('That email is already in use');
    }
    const pendingTaken = await this.usersRepo.findByPendingEmail(normalized);
    if (pendingTaken && pendingTaken.id !== userId) {
      throw new BadRequestException('That email is already in use');
    }

    const raw = newOpaqueToken();
    const expires = new Date(Date.now() + 1000 * 60 * 60 * 24);
    const updated = await this.usersRepo.setPendingEmailChange(
      userId,
      normalized,
      hashOpaqueToken(raw),
      expires,
    );

    const site =
      this.config.get<string>('NEXT_PUBLIC_SITE_URL') ??
      this.config.get<string>('SITE_URL') ??
      'http://localhost:3001';
    const confirmUrl = `${site.replace(/\/$/, '')}/confirm-email-change?token=${raw}`;

    await this.mail.sendEmailChangeConfirmEmail(normalized, confirmUrl, {
      currentEmail: user.email,
    });
    await this.mail.sendSafe('email_change_notice', () =>
      this.mail.sendEmailChangeNoticeEmail(user.email, normalized),
    );

    return {
      message: `Confirmation link sent to ${normalized}. Open it to finish the change.`,
      user: this.toAuthUser(updated),
    };
  }

  async cancelEmailChange(userId: string): Promise<AuthUser> {
    const user = await this.usersRepo.clearPendingEmailChange(userId);
    return this.toAuthUser(user);
  }

  async confirmEmailChange(token: string): Promise<AuthUser> {
    const user = await this.usersRepo.findByEmailChangeToken(
      hashOpaqueToken(token),
    );
    if (!user?.pending_email) {
      throw new BadRequestException('Invalid or expired email change link');
    }

    const taken = await this.usersRepo.findByEmail(user.pending_email);
    if (taken && taken.id !== user.id) {
      await this.usersRepo.clearPendingEmailChange(user.id);
      throw new BadRequestException('That email is already in use');
    }

    const updated = await this.usersRepo.confirmEmailChange(user.id);
    if (!updated) {
      throw new BadRequestException('Unable to confirm email change');
    }
    return this.toAuthUser(updated);
  }
}
