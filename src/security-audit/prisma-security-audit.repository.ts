import { Injectable } from '@nestjs/common';

import { PrismaService } from '../database/prisma.service';
import {
  RecordedSecurityAuditEvent,
  RecordSecurityAuditEventInput,
} from './security-audit.contracts';
import { SecurityAuditRepository } from './security-audit.repository';

@Injectable()
export class PrismaSecurityAuditRepository extends SecurityAuditRepository {
  constructor(private readonly prisma: PrismaService) {
    super();
  }

  async append(
    event: RecordSecurityAuditEventInput,
  ): Promise<RecordedSecurityAuditEvent> {
    return this.prisma.securityAuditEvent.create({
      data: {
        eventType: event.eventType,
        outcome: event.outcome,
        occurredAt: event.occurredAt,
        requestId: event.requestId,
        principalType: event.principalType,
        userId: event.userId,
        agentId: event.agentId,
        credentialId: event.credentialId,
      },
      select: {
        id: true,
        occurredAt: true,
      },
    });
  }
}
