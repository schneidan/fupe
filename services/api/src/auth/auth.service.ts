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
    const isBootstrap =
      Boolean(bootstrap) && email.toLowerCase() === bootstrap;
    const autoVerify =
      isBootstrap || this.config.get<string>('AUTO_VERIFY_EMAIL') === 'true';

    const verifyToken = autoVerify ? null : randomBytes(32).toString('hex');
    const verifyExpires = autoVerify
      ? null
      : new Date(Date.now() + 1000 * 60 * 60 * 24);

    const user = await this.usersRepo.create({
      email,
      passwordHash: hash,
      trustScore: isBootstrap ? 100 : 0,
      role: isBootstrap ? 'moderator' : 'user',
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

    const valid = await bcrypt.compare(password, user.password_hash);
    if (!valid) {
      throw new UnauthorizedException('Invalid credentials');
    }

    return this.issueToken(user);
  }

  async validateUser(userId: string): Promise<AuthUser | null> {
    const user = await this.usersRepo.findById(userId);
    if (!user) return null;
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

  private bootstrapModeratorEmail(): string | null {
    const raw = this.config.get<string>('BOOTSTRAP_MODERATOR_EMAIL');
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
