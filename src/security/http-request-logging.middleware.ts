import { Injectable, Logger, NestMiddleware } from '@nestjs/common';
import { IncomingMessage, ServerResponse } from 'node:http';

type NextFunction = () => void;

@Injectable()
export class HttpRequestLoggingMiddleware implements NestMiddleware {
  private readonly logger = new Logger(HttpRequestLoggingMiddleware.name);

  use(
    request: IncomingMessage,
    response: ServerResponse,
    next: NextFunction,
  ): void {
    const startedAt = process.hrtime.bigint();
    const method = request.method ?? 'UNKNOWN';
    const pathname = this.getPathname(request.url);

    response.once('finish', () => {
      const elapsedNanoseconds = process.hrtime.bigint() - startedAt;
      const durationMs = Math.max(0, Number(elapsedNanoseconds) / 1_000_000);

      this.logger.log({
        method,
        pathname,
        statusCode: response.statusCode,
        durationMs,
      });
    });

    next();
  }

  private getPathname(url: string | undefined): string {
    const separatorIndex = url?.indexOf('?') ?? -1;

    if (!url) {
      return '/';
    }

    return separatorIndex >= 0 ? url.slice(0, separatorIndex) : url;
  }
}
