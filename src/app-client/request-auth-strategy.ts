import type { RequestContext } from '../common';
import type { AppClientMethod } from './app-client.contracts';

export interface AppClientAuthRequest {
  method: AppClientMethod;
  path: string;
  context: RequestContext;
}

export type AppClientAuthHeaders = Readonly<Record<string, string>>;

export interface RequestAuthStrategy {
  getHeaders(
    request: AppClientAuthRequest,
  ): AppClientAuthHeaders | Promise<AppClientAuthHeaders>;
}

