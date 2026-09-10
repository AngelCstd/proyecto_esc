import {
  CanActivate,
  ExecutionContext,
  Injectable,
  UnauthorizedException,
} from '@nestjs/common';

import type { Principal } from '../identity/principal';
import { ApiKeyAuthenticationError } from './api-key-authentication.contracts';
import { ApiKeyAuthenticationService } from './api-key-authentication.service';

const API_KEY_PREFIXES = ['nok_test_', 'nok_live_'] as const;

const AUTHENTICATION_FAILURE = {
  error: {
    code: 'INVALID_API_KEY',
    message: 'Invalid or missing API key',
  },
} as const;

interface ApiKeyPrincipalRequest {
  headers: {
    authorization?: string | string[];
  };
  principal?: Principal;
}

@Injectable()
export class ApiKeyAuthGuard implements CanActivate {
  constructor(
    private readonly apiKeyAuthenticationService: ApiKeyAuthenticationService,
  ) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const request = context.switchToHttp().getRequest<ApiKeyPrincipalRequest>();
    const rawKey = this.extractApiKey(request.headers.authorization);

    try {
      request.principal = await this.apiKeyAuthenticationService.authenticate({
        rawKey,
        usedAt: new Date(),
      });
    } catch (error: unknown) {
      if (error instanceof ApiKeyAuthenticationError) {
        throw this.authenticationFailure();
      }

      throw error;
    }

    return true;
  }

  private extractApiKey(header: string | string[] | undefined): string {
    if (typeof header !== 'string') {
      throw this.authenticationFailure();
    }

    const match = /^Bearer[ \t]+([^\s]+)$/i.exec(header);
    const credential = match?.[1];

    if (
      credential === undefined ||
      !API_KEY_PREFIXES.some((prefix) => credential.startsWith(prefix))
    ) {
      throw this.authenticationFailure();
    }

    return credential;
  }

  private authenticationFailure(): UnauthorizedException {
    return new UnauthorizedException(AUTHENTICATION_FAILURE);
  }
}
