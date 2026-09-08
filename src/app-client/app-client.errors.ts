export type AppClientTransportErrorCode = 'TIMEOUT' | 'NETWORK_ERROR';

export class AppClientTransportError extends Error {
  constructor(public readonly code: AppClientTransportErrorCode) {
    super(
      code === 'TIMEOUT'
        ? 'The outbound request timed out.'
        : 'The outbound request could not be completed.',
    );
    this.name = 'AppClientTransportError';

    // Transport diagnostics can contain target URLs or other private details.
    this.stack = undefined;
  }
}

export type AppClientRequestErrorCode =
  | 'INVALID_PATH'
  | 'INVALID_JSON_BODY'
  | 'BODY_NOT_ALLOWED'
  | 'INVALID_AUTH_HEADERS';

export class AppClientRequestError extends Error {
  constructor(public readonly code: AppClientRequestErrorCode) {
    super('The outbound request is invalid.');
    this.name = 'AppClientRequestError';
    this.stack = undefined;
  }
}

