import {
  AppClientTransportError,
  type AppClientResponse,
} from '../app-client';
import type { CorePublicError } from './core-public-error';

export type CoreSafeErrorStatus = 400 | 403 | 404 | 409 | 422 | 429;

/**
 * Trusted public details for a Core error. Declarations belong at the caller
 * boundary; the mapper never treats an upstream message as safe.
 */
export interface CoreSafeErrorDeclaration {
  readonly status: CoreSafeErrorStatus;
  readonly code: string;
  readonly message: string;
}

export type CoreFailure = AppClientResponse<unknown> | AppClientTransportError;

const GENERIC_FAILURES = {
  internal: {
    status: 500,
    code: 'CORE_INTERNAL_ERROR',
    message: 'Core service failed to process the request.',
  },
  gateway: {
    status: 502,
    code: 'CORE_BAD_GATEWAY',
    message: 'Core service returned an invalid response.',
  },
  network: {
    status: 502,
    code: 'CORE_UNAVAILABLE',
    message: 'Core service is unavailable.',
  },
  timeout: {
    status: 504,
    code: 'CORE_TIMEOUT',
    message: 'Core service timed out.',
  },
} as const;

const SAFE_ERROR_STATUSES: ReadonlySet<number> = new Set([
  400, 403, 404, 409, 422, 429,
]);

export function mapCoreFailure(
  failure: CoreFailure,
  requestId: string,
  safeErrors: readonly CoreSafeErrorDeclaration[] = [],
): CorePublicError {
  if (failure instanceof AppClientTransportError) {
    return failure.code === 'TIMEOUT'
      ? createPublicError(GENERIC_FAILURES.timeout, requestId)
      : createPublicError(GENERIC_FAILURES.network, requestId);
  }

  if (SAFE_ERROR_STATUSES.has(failure.status)) {
    const upstreamCode = readUpstreamErrorCode(failure.body);
    const declaration = safeErrors.find(
      (candidate) =>
        candidate.status === failure.status && candidate.code === upstreamCode,
    );

    if (declaration !== undefined) {
      return createPublicError(declaration, requestId);
    }
  }

  // An internal Core 401 must never be confused with user authentication.
  // Unknown, malformed, and undeclared responses are gateway failures too.
  if (failure.status === 500) {
    return createPublicError(GENERIC_FAILURES.internal, requestId);
  }

  return createPublicError(GENERIC_FAILURES.gateway, requestId);
}

function readUpstreamErrorCode(body: unknown): string | undefined {
  if (!isRecord(body) || !isRecord(body.error)) {
    return undefined;
  }

  return typeof body.error.code === 'string' ? body.error.code : undefined;
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

function createPublicError(
  details: Readonly<{ status: number; code: string; message: string }>,
  requestId: string,
): CorePublicError {
  return {
    status: details.status,
    error: {
      code: details.code,
      message: details.message,
      requestId,
    },
  };
}

