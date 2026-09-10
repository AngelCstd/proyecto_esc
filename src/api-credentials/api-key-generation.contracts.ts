export type ApiKeyEnvironment = 'test' | 'live';

export interface GeneratedApiKey {
  readonly rawKey: string;
  readonly environment: ApiKeyEnvironment;
  readonly keyHash: string;
  readonly keyPrefix: string;
}
