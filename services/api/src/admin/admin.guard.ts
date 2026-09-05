import {
  CanActivate,
  ExecutionContext,
  ForbiddenException,
  Injectable,
  UnauthorizedException,
} from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import { ConfigService } from '@nestjs/config';
import { UsersRepository } from '../auth/users.repository';

export interface AdminJwtUser {
  id: string;
  email: string;
  role: string;
}

/**
 * Guards routes to live DB `role === 'admin'` (not JWT claim alone).
 * Demotion / disable take effect immediately.
 */
@Injectable()
export class AdminGuard implements CanActivate {
  constructor(
    private readonly jwt: JwtService,
    private readonly config: ConfigService,
    private readonly users: UsersRepository,
  ) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
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
      const secret =
        this.config.get<string>('JWT_SECRET') ?? 'fupe-dev-secret-change-me';
      raw = this.jwt.verify(token, { secret });
    } catch {
      throw new UnauthorizedException('Invalid or expired token');
    }

    const id = raw.id ?? raw.sub;
    if (!id) {
      throw new ForbiddenException('Admin role required');
    }

    const user = await this.users.findById(id);
    if (!user || user.disabled_at) {
      throw new UnauthorizedException('Invalid or disabled account');
    }
    if (user.role !== 'admin') {
      throw new ForbiddenException('Admin role required');
    }

    req.adminUser = {
      id: user.id,
      email: user.email,
      role: user.role,
    };
    return true;
  }
}
