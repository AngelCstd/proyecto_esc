import { Injectable } from '@nestjs/common';

import type {
  CreateApiCredentialInput,
  CreateApiCredentialResult,
  ListApiCredentialsInput,
  ListApiCredentialsResult,
  RevokeApiCredentialInput,
  RevokeApiCredentialResult,
} from './api-credential-lifecycle.contracts';
import { ApiCredentialRepository } from './api-credential.repository';
import { ApiKeyGenerationService } from './api-key-generation.service';

@Injectable()
export class ApiCredentialLifecycleService {
  constructor(
    private readonly keyGenerationService: ApiKeyGenerationService,
    private readonly credentialRepository: ApiCredentialRepository,
  ) {}

  async create(
    input: CreateApiCredentialInput,
  ): Promise<CreateApiCredentialResult> {
    const generatedKey = this.keyGenerationService.generate(input.environment);

    const credential = await this.credentialRepository.create({
      agentId: input.agentId,
      name: input.name,
      environment: generatedKey.environment,
      keyPrefix: generatedKey.keyPrefix,
      keyHash: generatedKey.keyHash,
      createdByUserId: input.createdByUserId,
      expiresAt: input.expiresAt,
      scopes: input.scopes,
    });

    return {
      rawKey: generatedKey.rawKey,
      credential,
    };
  }

  listByAgentId(
    input: ListApiCredentialsInput,
  ): Promise<ListApiCredentialsResult> {
    return this.credentialRepository.listByAgentId(input.agentId);
  }

  async revoke(
    input: RevokeApiCredentialInput,
  ): Promise<RevokeApiCredentialResult> {
    const transitioned = await this.credentialRepository.revokeActive(
      input.credentialId,
    );

    return { transitioned };
  }
}
