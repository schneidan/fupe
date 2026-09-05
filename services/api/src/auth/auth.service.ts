import {
  BadRequestException,
  Injectable,
  UnauthorizedException,
} from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import { ConfigService } from '@nestjs/config';
import { randomBytes } from 'crypto';
import * as bcrypt from 'bcrypt';
import { MailService } from '../mail/mail.service';
import { UsersRepository, UserRole, UserRow } from './users.repository';

export interface AuthUser {
  id: string;
  email: string;
  trust_score: number;
  role: UserRole;
  email_verified: boolean;
}

@Injectable()
export class AuthService {
  constructor(
    private readonly usersRepo: UsersRepository,
    private readonly jwtService: JwtService,
    private readonly mail: MailService,
    private readonly config: ConfigService,
  ) {}

  async register(
    email: string,
    password: string,
  ): Promise<{ token: string; user: AuthUser }> {
    const existing = await this.usersRepo.findByEmail(email);
    if (existing) {
      throw new UnauthorizedException('Email already registered');
    }

    const hash = await bcrypt.hash(password, 10);
    const bootstrap = this.bootstrapModeratorEmail();
    const bootstrapAdmin = this.bootstrapAdminEmail();
    const isBootstrapMod =
      Boolean(bootstrap) && email.toLowerCase() === bootstrap;
    const isBootstrapAdmin =
      Boolean(bootstrapAdmin) && email.toLowerCase() === bootstrapAdmin;
    const isBootstrap = isBootstrapMod || isBootstrapAdmin;
    const autoVerify =
      isBootstrap || this.config.get<string>('AUTO_VERIFY_EMAIL') === 'true';

    const verifyToken = autoVerify ? null : randomBytes(32).toString('hex');
    const verifyExpires = autoVerify
      ? null
      : new Date(Date.now() + 1000 * 60 * 60 * 24);

    const role: UserRole = isBootstrapAdmin
      ? 'admin'
      : isBootstrapMod
        ? 'moderator'
        : 'user';

    const user = await this.usersRepo.create({
      email,
      passwordHash: hash,
      trustScore: isBootstrap ? 100 : 0,
      role,
      emailVerifiedAt: autoVerify ? new Date() : null,
      verifyToken,
      verifyExpiresAt: verifyExpires,
    });

    if (verifyToken) {
      await this.sendVerification(user.email, verifyToken);
    }

    return this.issueToken(user);
  }

  async login(
    email: string,
    password: string,
  ): Promise<{ token: string; user: AuthUser }> {
    const user = await this.usersRepo.findByEmail(email);
    if (!user) {
      throw new UnauthorizedException('Invalid credentials');
    }

    if (user.disabled_at) {
      throw new UnauthorizedException('This account has been disabled');
    }

    const valid = await bcrypt.compare(password, user.password_hash);
    if (!valid) {
      throw new UnauthorizedException('Invalid credentials');
    }

    const promoted = await this.applyBootstrapRole(user);
    return this.issueToken(promoted);
  }

  async validateUser(userId: string): Promise<AuthUser | null> {
    const user = await this.usersRepo.findById(userId);
    if (!user || user.disabled_at) return null;
    return this.toAuthUser(user);
  }

  async verifyEmail(token: string): Promise<AuthUser> {
    const user = await this.usersRepo.findByVerifyToken(token);
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
    const token = randomBytes(32).toString('hex');
    const expires = new Date(Date.now() + 1000 * 60 * 60 * 24);
    await this.usersRepo.setVerifyToken(user.id, token, expires);
    await this.sendVerification(user.email, token);
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

    const token = randomBytes(32).toString('hex');
    const expires = new Date(Date.now() + 1000 * 60 * 60); // 1 hour
    await this.usersRepo.setPasswordResetToken(user.id, token, expires);

    const site =
      this.config.get<string>('NEXT_PUBLIC_SITE_URL') ??
      this.config.get<string>('SITE_URL') ??
      'http://localhost:3001';
    const url = `${site.replace(/\/$/, '')}/reset-password?token=${token}`;
    await this.mail.sendPasswordResetEmail(user.email, url);
    return { message };
  }

  async resetPassword(
    token: string,
    newPassword: string,
  ): Promise<{ message: string }> {
    const user = await this.usersRepo.findByPasswordResetToken(token);
    if (!user) {
      throw new BadRequestException('Invalid or expired reset link');
    }
    const hash = await bcrypt.hash(newPassword, 10);
    await this.usersRepo.updatePasswordHash(user.id, hash);
    return { message: 'Password updated. You can sign in with your new password.' };
  }

  async exportMyData(user: AuthUser) {
    const data = await this.usersRepo.exportPersonalData(user.id);
    if (!data) throw new BadRequestException('Account not found');
    return data;
  }

  async deleteMyAccount(user: AuthUser): Promise<{ deleted: true }> {
    await this.usersRepo.deleteAccount(user.id);
    return { deleted: true };
  }

  isModerator(user: AuthUser): boolean {
    return user.role === 'moderator' || user.role === 'admin';
  }

  private async sendVerification(email: string, token: string) {
    const site =
      this.config.get<string>('NEXT_PUBLIC_SITE_URL') ??
      this.config.get<string>('SITE_URL') ??
      'http://localhost:3001';
    const url = `${site.replace(/\/$/, '')}/verify-email?token=${token}`;
    await this.mail.sendVerificationEmail(email, url);
  }

  /**
   * Promote an existing account when env bootstrap emails match.
   * Admin wins over moderator. Never demotes an admin.
   */
  private async applyBootstrapRole(user: UserRow): Promise<UserRow> {
    const email = user.email.toLowerCase();
    const wantAdmin = this.bootstrapAdminEmail() === email;
    const wantMod = this.bootstrapModeratorEmail() === email;

    let next: UserRole | null = null;
    if (wantAdmin && user.role !== 'admin') next = 'admin';
    else if (wantMod && user.role === 'user') next = 'moderator';

    if (!next) return user;
    return this.usersRepo.setRole(user.id, next);
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
    };
  }
}
