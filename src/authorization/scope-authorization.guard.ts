import {
  CanActivate,
  ExecutionContext,
  ForbiddenException,
  Injectable,
  UnauthorizedException,
} from '@nestjs/common';
import { Reflector } from '@nestjs/core';

import type { Principal } from '../identity/principal';
import { REQUIRED_SCOPES_METADATA } from './required-scopes.decorator';
import { evaluateScopeAuthorization } from './scope-authorization';

const AUTHENTICATION_REQUIRED = {
  error: {
    code: 'AUTHENTICATION_REQUIRED',
    message: 'Authentication required',
  },
} as const;

const INSUFFICIENT_SCOPE = {
  error: {
    code: 'INSUFFICIENT_SCOPE',
    message: 'Insufficient scope',
  },
} as const;

interface PrincipalRequest {
  principal?: Principal;
}

@Injectable()
export class ScopeAuthorizationGuard implements CanActivate {
  constructor(private readonly reflector: Reflector) {}

  canActivate(context: ExecutionContext): boolean {
    const requiredScopes =
      this.reflector.get<readonly string[]>(
        REQUIRED_SCOPES_METADATA,
        context.getHandler(),
      ) ?? [];
    const request = context.switchToHttp().getRequest<PrincipalRequest>();

    if (request.principal === undefined) {
      throw new UnauthorizedException(AUTHENTICATION_REQUIRED);
    }

    const result = evaluateScopeAuthorization(
      request.principal,
      requiredScopes,
    );

    if (!result.authorized) {
      throw new ForbiddenException(INSUFFICIENT_SCOPE);
    }

    return true;
  }
}
