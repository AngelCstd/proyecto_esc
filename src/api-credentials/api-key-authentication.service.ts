import { Injectable } from '@nestjs/common';
import { createHash } from 'node:crypto';

import type { ApiKeyEnvironment } from './api-key-generation.contracts';
import {
  ApiKeyAuthenticationError,
  AuthenticateApiKeyInput,
  AuthenticateApiKeyResult,
} from './api-key-authentication.contracts';
import {
  ApiCredentialAuthenticationRecord,
  ApiCredentialRepository,
} from './api-credential.repository';

const API_KEY_PATTERN = /^nok_(test|live)_[A-Za-z0-9_-]{43}$/;

@Injectable()
export class ApiKeyAuthenticationService {
  constructor(
    private readonly credentialRepository: ApiCredentialRepository,
  ) {}

  async authenticate(
    input: AuthenticateApiKeyInput,
  ): Promise<AuthenticateApiKeyResult> {
    const rawKey = input.rawKey;
    const environment = this.parseEnvironment(rawKey);
    if (
      typeof rawKey !== 'string' ||
      environment === null ||
      !this.isValidUsageTime(input.usedAt)
    ) {
      throw new ApiKeyAuthenticationError();
    }

    const keyHash = createHash('sha256')
      .update(rawKey, 'utf8')
      .digest('hex');
    const credential = await this.credentialRepository.findByKeyHash(keyHash);

    if (!this.isUsable(credential, environment, input.usedAt)) {
      throw new ApiKeyAuthenticationError();
    }

    const markedUsed = await this.credentialRepository.markUsedIfUsable(
      credential.id,
      input.usedAt,
    );
    if (!markedUsed) {
      throw new ApiKeyAuthenticationError();
    }

    return {
      type: 'api_key',
      credentialId: credential.id,
      agentId: credential.agentId,
      roles: [],
      scopes: [...credential.scopes],
    };
  }

  private parseEnvironment(
    rawKey: string | null | undefined,
  ): ApiKeyEnvironment | null {
    if (typeof rawKey !== 'string') {
      return null;
    }

    const match = API_KEY_PATTERN.exec(rawKey);
    return (match?.[1] as ApiKeyEnvironment | undefined) ?? null;
  }

  private isValidUsageTime(usedAt: Date): boolean {
    return usedAt instanceof Date && !Number.isNaN(usedAt.getTime());
  }

  private isUsable(
    credential: ApiCredentialAuthenticationRecord | null,
    environment: ApiKeyEnvironment,
    usedAt: Date,
  ): credential is ApiCredentialAuthenticationRecord {
    return (
      credential !== null &&
      credential.environment === environment &&
      credential.status === 'active' &&
      credential.revokedAt === null &&
      (credential.expiresAt === null || credential.expiresAt > usedAt)
    );
  }
}
