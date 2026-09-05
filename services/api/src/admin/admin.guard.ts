import {
  CanActivate,
  ExecutionContext,
  ForbiddenException,
  Injectable,
  UnauthorizedException,
} from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import { ConfigService } from '@nestjs/config';
import { resolveJwtSecret } from '../common/security';
import { UsersRepository } from '../auth/users.repository';

export interface AdminJwtUser {
  id: string;
  email: string;
  role: string;
}

/**
 * Guards routes to live DB `role === 'admin'` (not JWT claim alone).
 * Demotion / disable / token_version bump take effect immediately.
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

    let raw: {
      id?: string;
      sub?: string;
      email?: string;
      role?: string;
      token_version?: number;
    };
    try {
      raw = this.jwt.verify(token, {
        secret: resolveJwtSecret(this.config),
      });
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
    if ((raw.token_version ?? 0) !== (user.token_version ?? 0)) {
      throw new UnauthorizedException('Session expired — please sign in again');
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
