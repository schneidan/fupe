import {
  CanActivate,
  ExecutionContext,
  ForbiddenException,
  Injectable,
  UnauthorizedException,
} from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import { ConfigService } from '@nestjs/config';

export interface AdminJwtUser {
  id: string;
  email: string;
  role: string;
}

/**
 * Guards routes to `role === 'admin'` only.
 * Reads the Bearer JWT from Authorization header directly (no Passport
 * dependency) so it can be used standalone on the AdminModule.
 */
@Injectable()
export class AdminGuard implements CanActivate {
  constructor(
    private readonly jwt: JwtService,
    private readonly config: ConfigService,
  ) {}

  canActivate(context: ExecutionContext): boolean {
    const req = context.switchToHttp().getRequest<{
      headers: Record<string, string | undefined>;
      adminUser?: AdminJwtUser;
    }>();

    const auth = req.headers['authorization'] ?? '';
    const token = auth.startsWith('Bearer ') ? auth.slice(7) : '';

    if (!token) {
      throw new UnauthorizedException('Admin endpoints require a Bearer JWT');
    }

    let raw: { id?: string; sub?: string; email?: string; role?: string };
    try {
      raw = this.jwt.verify(token, {
        secret: this.config.get<string>('JWT_SECRET'),
      });
    } catch {
      throw new UnauthorizedException('Invalid or expired token');
    }

    const id = raw.id ?? raw.sub;
    if (!id || raw.role !== 'admin') {
      throw new ForbiddenException('Admin role required');
    }

    req.adminUser = {
      id,
      email: raw.email ?? '',
      role: raw.role,
    };
    return true;
  }
}
