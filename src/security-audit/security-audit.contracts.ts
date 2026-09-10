export type SecurityAuditOutcome = 'success' | 'failure';

export type SecurityAuditPrincipalType =
  | 'agent_user'
  | 'traveler_user'
  | 'api_key'
  | 'service';

export interface RecordSecurityAuditEventInput {
  readonly eventType: string;
  readonly outcome: SecurityAuditOutcome;
  readonly occurredAt: Date;
  readonly requestId?: string | null;
  readonly principalType?: SecurityAuditPrincipalType | null;
  readonly userId?: string | null;
  readonly agentId?: string | null;
  readonly credentialId?: string | null;
}

export interface RecordedSecurityAuditEvent {
  readonly id: string;
  readonly occurredAt: Date;
}
