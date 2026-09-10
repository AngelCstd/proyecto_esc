import { Injectable } from '@nestjs/common';

import { PrismaService } from '../database/prisma.service';
import {
  ApiCredentialAuthenticationRecord,
  ApiCredentialRepository,
  CreateApiCredentialRecord,
  SafeApiCredentialRecord,
} from './api-credential.repository';

const safeCredentialSelect = {
  id: true,
  agentId: true,
  name: true,
  environment: true,
  keyPrefix: true,
  status: true,
  createdByUserId: true,
  createdAt: true,
  revokedAt: true,
  lastUsedAt: true,
  expiresAt: true,
  scopes: {
    select: { scope: true },
    orderBy: { scope: 'asc' as const },
  },
} as const;

const authenticationCredentialSelect = {
  id: true,
  agentId: true,
  environment: true,
  status: true,
  createdAt: true,
  revokedAt: true,
  lastUsedAt: true,
  expiresAt: true,
  scopes: {
    select: { scope: true },
    orderBy: { scope: 'asc' as const },
  },
} as const;

type SafeCredentialQueryResult = {
  id: string;
  agentId: string;
  name: string;
  environment: 'test' | 'live';
  keyPrefix: string;
  status: 'active' | 'revoked';
  createdByUserId: string | null;
  createdAt: Date;
  revokedAt: Date | null;
  lastUsedAt: Date | null;
  expiresAt: Date | null;
  scopes: Array<{ scope: string }>;
};

@Injectable()
export class PrismaApiCredentialRepository extends ApiCredentialRepository {
  constructor(private readonly prisma: PrismaService) {
    super();
  }

  async create(
    credential: CreateApiCredentialRecord,
  ): Promise<SafeApiCredentialRecord> {
    const created = await this.prisma.apiCredential.create({
      data: {
        agentId: credential.agentId,
        name: credential.name,
        environment: credential.environment,
        keyPrefix: credential.keyPrefix,
        keyHash: credential.keyHash,
        createdByUserId: credential.createdByUserId,
        expiresAt: credential.expiresAt,
        scopes: {
          create: credential.scopes.map((scope) => ({ scope })),
        },
      },
      select: safeCredentialSelect,
    });

    return this.toSafeRecord(created);
  }

  async listByAgentId(agentId: string): Promise<SafeApiCredentialRecord[]> {
    const credentials = await this.prisma.apiCredential.findMany({
      where: { agentId },
      orderBy: { createdAt: 'desc' },
      select: safeCredentialSelect,
    });

    return credentials.map((credential) => this.toSafeRecord(credential));
  }

  async findByKeyHash(
    keyHash: string,
  ): Promise<ApiCredentialAuthenticationRecord | null> {
    const credential = await this.prisma.apiCredential.findUnique({
      where: { keyHash },
      select: authenticationCredentialSelect,
    });

    if (credential === null) {
      return null;
    }

    return {
      ...credential,
      scopes: credential.scopes.map(({ scope }) => scope),
    };
  }

  async revokeActive(credentialId: string): Promise<boolean> {
    const result = await this.prisma.apiCredential.updateMany({
      where: {
        id: credentialId,
        status: 'active',
      },
      data: {
        status: 'revoked',
        revokedAt: new Date(),
      },
    });

    return result.count === 1;
  }

  private toSafeRecord(
    credential: SafeCredentialQueryResult,
  ): SafeApiCredentialRecord {
    return {
      ...credential,
      scopes: credential.scopes.map(({ scope }) => scope),
    };
  }
}
