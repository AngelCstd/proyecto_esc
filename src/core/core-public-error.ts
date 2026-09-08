import type { PublicErrorEnvelope } from '../common';

/**
 * Sanitized Core failure safe to expose at the Auth boundary.
 */
export interface CorePublicError extends PublicErrorEnvelope {
  readonly status: number;
}

