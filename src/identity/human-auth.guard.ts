import {
  CanActivate,
  ExecutionContext,
  Inject,
  Injectable,
  UnauthorizedException,
} from '@nestjs/common';

import {
  HUMAN_IDENTITY_VERIFIER,
  HumanIdentityVerifier,
} from './human-identity-verifier';
import { HumanPrincipalResolver } from './human-principal-resolver.service';
import { HumanPrincipalRequest } from './human-principal.request';

const API_KEY_PREFIXES = ['nok_test_', 'nok_live_'] as const;

const AUTHENTICATION_FAILURE = {
  error: {
    code: 'INVALID_ACCESS_TOKEN',
    message: 'Invalid or missing access token',
  },
} as const;

@Injectable()
export class HumanAuthGuard implements CanActivate {
  constructor(
    @Inject(HUMAN_IDENTITY_VERIFIER)
    private readonly identityVerifier: HumanIdentityVerifier,
    private readonly principalResolver: HumanPrincipalResolver,
  ) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const request = context.switchToHttp().getRequest<HumanPrincipalRequest>();
    const accessToken = this.extractBearerToken(request.headers.authorization);

    if (API_KEY_PREFIXES.some((prefix) => accessToken.startsWith(prefix))) {
      throw this.authenticationFailure();
    }

    const identity = await this.identityVerifier.verifyAccessToken(accessToken);

    request.principal = await this.principalResolver.resolve(identity);

    return true;
  }

  private extractBearerToken(header: string | string[] | undefined): string {
    if (typeof header !== 'string') {
      throw this.authenticationFailure();
    }

    const match = /^Bearer[ \t]+([^\s]+)$/i.exec(header);

    if (match === null) {
      throw this.authenticationFailure();
    }

    return match[1];
  }

  private authenticationFailure(): UnauthorizedException {
    return new UnauthorizedException(AUTHENTICATION_FAILURE);
  }
}
