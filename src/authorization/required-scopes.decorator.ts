import { SetMetadata } from '@nestjs/common';

export const REQUIRED_SCOPES_METADATA = Symbol('required-scopes');

export const RequireScopes = (...requiredScopes: string[]): MethodDecorator =>
  SetMetadata(REQUIRED_SCOPES_METADATA, requiredScopes);
