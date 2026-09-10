import type { Principal } from '../identity/principal';

export interface AuthenticateApiKeyInput {
  readonly rawKey: string | null | undefined;
  readonly usedAt: Date;
}

export type AuthenticateApiKeyResult = Principal & {
  readonly type: 'api_key';
  readonly credentialId: string;
  readonly agentId: string;
  readonly roles: [];
  readonly scopes: string[];
};

export class ApiKeyAuthenticationError extends Error {
  constructor() {
    super('API key authentication failed.');
    this.name = 'ApiKeyAuthenticationError';
  }
}
