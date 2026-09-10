import type { ApiKeyEnvironment } from './api-key-generation.contracts';

export type ApiCredentialStatus = 'active' | 'revoked';

export interface CreateApiCredentialRecord {
  readonly agentId: string;
  readonly name: string;
  readonly environment: ApiKeyEnvironment;
  readonly keyPrefix: string;
  readonly keyHash: string;
  readonly createdByUserId?: string | null;
  readonly expiresAt?: Date | null;
  readonly scopes: readonly string[];
}

export interface SafeApiCredentialRecord {
  readonly id: string;
  readonly agentId: string;
  readonly name: string;
  readonly environment: ApiKeyEnvironment;
  readonly keyPrefix: string;
  readonly status: ApiCredentialStatus;
  readonly createdByUserId: string | null;
  readonly createdAt: Date;
  readonly revokedAt: Date | null;
  readonly lastUsedAt: Date | null;
  readonly expiresAt: Date | null;
  readonly scopes: readonly string[];
}

export interface ApiCredentialAuthenticationRecord {
  readonly id: string;
  readonly agentId: string;
  readonly environment: ApiKeyEnvironment;
  readonly status: ApiCredentialStatus;
  readonly createdAt: Date;
  readonly revokedAt: Date | null;
  readonly lastUsedAt: Date | null;
  readonly expiresAt: Date | null;
  readonly scopes: readonly string[];
}

export abstract class ApiCredentialRepository {
  abstract create(
    credential: CreateApiCredentialRecord,
  ): Promise<SafeApiCredentialRecord>;

  abstract listByAgentId(agentId: string): Promise<SafeApiCredentialRecord[]>;

  abstract findByKeyHash(
    keyHash: string,
  ): Promise<ApiCredentialAuthenticationRecord | null>;

  abstract markUsedIfUsable(
    credentialId: string,
    usedAt: Date,
  ): Promise<boolean>;

  abstract revokeActive(credentialId: string): Promise<boolean>;
}
