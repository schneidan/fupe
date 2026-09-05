import {
  CanActivate,
  ExecutionContext,
  HttpException,
  HttpStatus,
  Injectable,
  UnauthorizedException,
} from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import {
  REQUIRE_API_KEY_KEY,
  SKIP_API_KEY_KEY,
} from './api-key.decorators';
import { ApiKeysService, AuthenticatedApiKey } from './api-keys.service';

type IncomingRequest = {
  header(name: string): string | undefined;
  path?: string;
  url?: string;
  method: string;
  apiKey?: AuthenticatedApiKey;
};

export type RequestWithApiKey = IncomingRequest;

@Injectable()
export class ApiKeyGuard implements CanActivate {
  constructor(
    private readonly reflector: Reflector,
    private readonly apiKeys: ApiKeysService,
  ) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const skip = this.reflector.getAllAndOverride<boolean>(SKIP_API_KEY_KEY, [
      context.getHandler(),
      context.getClass(),
    ]);
    if (skip) return true;

    const requireKey = this.reflector.getAllAndOverride<boolean>(
      REQUIRE_API_KEY_KEY,
      [context.getHandler(), context.getClass()],
    );
    const forceRequire =
      process.env.REQUIRE_API_KEY === 'true' || requireKey === true;

    const req = context.switchToHttp().getRequest<RequestWithApiKey>();
    const raw = this.extractKey(req);

    if (!raw) {
      if (forceRequire) {
        throw new UnauthorizedException(
          'API key required. Pass X-API-Key or Authorization: Bearer fupe_…',
        );
      }
      // First-party web/mobile: no key yet.
      return true;
    }

    const key = await this.apiKeys.findByRawKey(raw);
    if (!key) {
      throw new UnauthorizedException('Invalid or revoked API key');
    }

    const { allowed } = await this.apiKeys.tryConsumeDailyQuota(
      key.id,
      key.rateLimitDaily,
    );
    if (!allowed) {
      // Guards throw before interceptors run — log 429 here so usage admin can see hits.
      await this.apiKeys
        .logUsage({
          apiKeyId: key.id,
          endpoint: req.path ?? req.url ?? '',
          method: req.method,
          statusCode: HttpStatus.TOO_MANY_REQUESTS,
        })
        .catch(() => undefined);
      throw new HttpException(
        `Daily rate limit exceeded (${key.rateLimitDaily}/day for ${key.tier} tier). Upgrade at /developers.`,
        HttpStatus.TOO_MANY_REQUESTS,
      );
    }

    req.apiKey = key;
    await this.apiKeys.touchLastUsed(key.id);
    return true;
  }

  private extractKey(req: IncomingRequest): string | null {
    const header = req.header('x-api-key')?.trim();
    if (header) return header;

    const auth = req.header('authorization');
    if (!auth) return null;
    const m = auth.match(/^Bearer\s+(fupe_[A-Za-z0-9_-]+)\s*$/i);
    return m?.[1] ?? null;
  }
}
