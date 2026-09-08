import {
  APP_CLIENT_REQUEST_ID_HEADER,
  type AppClientConfig,
  type AppClientRequest,
  type AppClientResponse,
} from './app-client.contracts';
import {
  AppClientRequestError,
  AppClientTransportError,
} from './app-client.errors';
import type { RequestAuthStrategy } from './request-auth-strategy';

export class AppClient {
  private readonly baseUrl: URL;
  private readonly timeoutMs: number;

  constructor(
    config: AppClientConfig,
    private readonly requestAuthStrategy: RequestAuthStrategy,
  ) {
    this.baseUrl = AppClient.parseBaseUrl(config.baseUrl);

    if (!Number.isFinite(config.timeoutMs) || config.timeoutMs <= 0) {
      throw new TypeError('AppClient timeoutMs must be a positive number.');
    }

    this.timeoutMs = config.timeoutMs;
  }

  async request<TBody = unknown>(
    request: AppClientRequest,
  ): Promise<AppClientResponse<TBody>> {
    const target = this.resolvePath(request.path);

    if (
      request.body !== undefined &&
      (request.method === 'GET' || request.method === 'HEAD')
    ) {
      throw new AppClientRequestError('BODY_NOT_ALLOWED');
    }

    const authHeaders = await this.requestAuthStrategy.getHeaders({
      method: request.method,
      path: request.path,
      context: request.context,
    });
    const headers = this.createHeaders(authHeaders, request);
    const body = this.serializeBody(request.body);
    const controller = new AbortController();
    let timedOut = false;
    const timeout = setTimeout(() => {
      timedOut = true;
      controller.abort();
    }, this.timeoutMs);

    try {
      const response = await fetch(target, {
        method: request.method,
        headers,
        body,
        signal: controller.signal,
      });
      const responseBody = await this.parseResponseBody(response);

      return {
        status: response.status,
        headers: this.readHeaders(response.headers),
        body: responseBody as TBody | string | undefined,
      };
    } catch {
      throw new AppClientTransportError(
        timedOut ? 'TIMEOUT' : 'NETWORK_ERROR',
      );
    } finally {
      clearTimeout(timeout);
    }
  }

  private static parseBaseUrl(baseUrl: string): URL {
    let parsed: URL;

    try {
      parsed = new URL(baseUrl);
    } catch {
      throw new TypeError('AppClient baseUrl must be an absolute HTTP(S) URL.');
    }

    if (
      (parsed.protocol !== 'http:' && parsed.protocol !== 'https:') ||
      parsed.username !== '' ||
      parsed.password !== ''
    ) {
      throw new TypeError('AppClient baseUrl must be an absolute HTTP(S) URL.');
    }

    parsed.hash = '';
    parsed.search = '';
    if (!parsed.pathname.endsWith('/')) {
      parsed.pathname += '/';
    }

    return parsed;
  }

  private resolvePath(path: string): URL {
    if (
      path.length === 0 ||
      path.includes('\\') ||
      /^[a-z][a-z\d+.-]*:/i.test(path) ||
      path.startsWith('/')
    ) {
      throw new AppClientRequestError('INVALID_PATH');
    }

    const target = new URL(path, this.baseUrl);
    if (
      target.origin !== this.baseUrl.origin ||
      !target.pathname.startsWith(this.baseUrl.pathname)
    ) {
      throw new AppClientRequestError('INVALID_PATH');
    }

    return target;
  }

  private createHeaders(
    authHeaders: Readonly<Record<string, string>>,
    request: AppClientRequest,
  ): Headers {
    let headers: Headers;

    try {
      headers = new Headers(authHeaders);
    } catch {
      throw new AppClientRequestError('INVALID_AUTH_HEADERS');
    }

    headers.set('accept', 'application/json');
    headers.set(APP_CLIENT_REQUEST_ID_HEADER, request.context.requestId);
    if (request.body !== undefined) {
      headers.set('content-type', 'application/json');
    } else {
      headers.delete('content-type');
    }

    return headers;
  }

  private serializeBody(body: unknown): string | undefined {
    if (body === undefined) {
      return undefined;
    }

    try {
      const serialized = JSON.stringify(body);
      if (serialized === undefined) {
        throw new Error();
      }
      return serialized;
    } catch {
      throw new AppClientRequestError('INVALID_JSON_BODY');
    }
  }

  private async parseResponseBody(
    response: Response,
  ): Promise<unknown | string | undefined> {
    const text = await response.text();
    if (text.length === 0) {
      return undefined;
    }

    const contentType = response.headers.get('content-type')?.toLowerCase();
    if (
      contentType?.includes('application/json') ||
      contentType?.includes('+json')
    ) {
      try {
        return JSON.parse(text) as unknown;
      } catch {
        return text;
      }
    }

    return text;
  }

  private readHeaders(headers: Headers): Readonly<Record<string, string>> {
    const result: Record<string, string> = {};
    headers.forEach((value, key) => {
      result[key] = value;
    });
    return result;
  }
}
