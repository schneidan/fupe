import {
  CallHandler,
  ExecutionContext,
  Injectable,
  NestInterceptor,
} from '@nestjs/common';
import { Observable, tap } from 'rxjs';
import { ApiKeysService } from './api-keys.service';
import { RequestWithApiKey } from './api-key.guard';

@Injectable()
export class ApiUsageInterceptor implements NestInterceptor {
  constructor(private readonly apiKeys: ApiKeysService) {}

  intercept(context: ExecutionContext, next: CallHandler): Observable<unknown> {
    const http = context.switchToHttp();
    const req = http.getRequest<RequestWithApiKey>();
    const res = http.getResponse<{ statusCode: number }>();

    return next.handle().pipe(
      tap({
        next: () => {
          void this.log(req, res.statusCode);
        },
        error: (err: { status?: number }) => {
          void this.log(req, err?.status ?? 500);
        },
      }),
    );
  }

  private async log(req: RequestWithApiKey, statusCode: number) {
    if (!req.apiKey) return;
    try {
      await this.apiKeys.logUsage({
        apiKeyId: req.apiKey.id,
        endpoint: req.path ?? req.url ?? '',
        method: req.method,
        statusCode,
      });
    } catch {
      // Don't fail the request if usage logging fails.
    }
  }
}
