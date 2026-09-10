import { Injectable } from '@nestjs/common';

import {
  RecordedSecurityAuditEvent,
  RecordSecurityAuditEventInput,
} from './security-audit.contracts';
import { SecurityAuditRepository } from './security-audit.repository';

@Injectable()
export class SecurityAuditRecordingService {
  constructor(private readonly repository: SecurityAuditRepository) {}

  record(
    event: RecordSecurityAuditEventInput,
  ): Promise<RecordedSecurityAuditEvent> {
    return this.repository.append(event);
  }
}
