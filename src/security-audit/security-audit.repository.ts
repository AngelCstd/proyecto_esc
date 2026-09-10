import {
  RecordedSecurityAuditEvent,
  RecordSecurityAuditEventInput,
} from './security-audit.contracts';

export abstract class SecurityAuditRepository {
  abstract append(
    event: RecordSecurityAuditEventInput,
  ): Promise<RecordedSecurityAuditEvent>;
}
