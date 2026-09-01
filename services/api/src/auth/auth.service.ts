import { Injectable, UnauthorizedException } from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import * as bcrypt from 'bcrypt';
import { UsersRepository } from './users.repository';

export interface AuthUser {
  id: string;
  email: string;
  trust_score: number;
}

@Injectable()
export class AuthService {
  constructor(
    private readonly usersRepo: UsersRepository,
    private readonly jwtService: JwtService,
  ) {}

  async register(email: string, password: string): Promise<{ token: string; user: AuthUser }> {
    const existing = await this.usersRepo.findByEmail(email);
    if (existing) {
      throw new UnauthorizedException('Email already registered');
    }

    const hash = await bcrypt.hash(password, 10);
    const user = await this.usersRepo.create(email, hash);
    return this.issueToken(user);
  }

  async login(email: string, password: string): Promise<{ token: string; user: AuthUser }> {
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
    return { id: user.id, email: user.email, trust_score: user.trust_score };
  }

  private issueToken(user: { id: string; email: string; trust_score: number }) {
    const payload: AuthUser = {
      id: user.id,
      email: user.email,
      trust_score: user.trust_score,
    };
    return {
      token: this.jwtService.sign(payload),
      user: payload,
    };
  }
}
