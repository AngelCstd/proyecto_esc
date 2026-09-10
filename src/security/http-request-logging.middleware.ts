import { Injectable, Logger, NestMiddleware } from '@nestjs/common';
import { IncomingMessage, ServerResponse } from 'node:http';

type NextFunction = () => void;

const REDACTED_CREDENTIAL = '[REDACTED_CREDENTIAL]';
const INVALID_PATHNAME = '[INVALID_PATHNAME]';
const API_KEY_PATTERN = /nok_(?:test|live)_[A-Za-z0-9_-]+/g;
const COMPACT_JWT_PATTERN =
  /[A-Za-z0-9_-]+\.[A-Za-z0-9_-]+\.[A-Za-z0-9_-]+/g;
const URL_BASE = 'http://localhost';

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
    if (!url) {
      return '/';
    }

    try {
      const encodedPathname = new URL(url, URL_BASE).pathname;
      const pathname = decodeURIComponent(encodedPathname);

      return pathname
        .replace(API_KEY_PATTERN, REDACTED_CREDENTIAL)
        .replace(COMPACT_JWT_PATTERN, REDACTED_CREDENTIAL);
    } catch {
      return INVALID_PATHNAME;
    }
  }
}
