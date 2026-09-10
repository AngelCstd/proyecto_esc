import type { ApiKeyEnvironment } from './api-key-generation.contracts';
import type { SafeApiCredentialRecord } from './api-credential.repository';

export interface CreateApiCredentialInput {
  readonly agentId: string;
  readonly name: string;
  readonly environment: ApiKeyEnvironment;
  readonly createdByUserId?: string | null;
  readonly expiresAt?: Date | null;
  readonly scopes: readonly string[];
}

export interface CreateApiCredentialResult {
  readonly rawKey: string;
  readonly credential: SafeApiCredentialRecord;
}

export interface ListApiCredentialsInput {
  readonly agentId: string;
}

export type ListApiCredentialsResult = SafeApiCredentialRecord[];

export interface RevokeApiCredentialInput {
  readonly credentialId: string;
}

export interface RevokeApiCredentialResult {
  readonly transitioned: boolean;
}
