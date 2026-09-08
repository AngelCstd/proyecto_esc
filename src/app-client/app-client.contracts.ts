import type { RequestContext } from '../common';

export const APP_CLIENT_REQUEST_ID_HEADER = 'x-request-id';

export type AppClientMethod =
  | 'GET'
  | 'POST'
  | 'PUT'
  | 'PATCH'
  | 'DELETE'
  | 'HEAD'
  | 'OPTIONS';

export interface AppClientConfig {
  baseUrl: string;
  timeoutMs: number;
}

export interface AppClientRequest {
  method: AppClientMethod;
  path: string;
  context: RequestContext;
  body?: unknown;
}

export interface AppClientResponse<TBody = unknown> {
  status: number;
  headers: Readonly<Record<string, string>>;
  body: TBody | string | undefined;
}

