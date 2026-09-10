import { Inject, Injectable, UnauthorizedException } from '@nestjs/common';

import {
  HUMAN_IDENTITY_VERIFIER,
  HumanIdentityVerifier,
} from './human-identity-verifier';
import { HumanPrincipalResolver } from './human-principal-resolver.service';
import { Principal } from './principal';

const API_KEY_PREFIXES = ['nok_test_', 'nok_live_'] as const;

const AUTHENTICATION_FAILURE = {
  error: {
    code: 'INVALID_ACCESS_TOKEN',
    message: 'Invalid or missing access token',
  },
} as const;

@Injectable()
export class HumanAuthenticationService {
  constructor(
    @Inject(HUMAN_IDENTITY_VERIFIER)
    private readonly identityVerifier: HumanIdentityVerifier,
    private readonly principalResolver: HumanPrincipalResolver,
  ) {}

  async authenticate(accessToken: string): Promise<Principal> {
    if (API_KEY_PREFIXES.some((prefix) => accessToken.startsWith(prefix))) {
      throw this.authenticationFailure();
    }

    const identity = await this.identityVerifier.verifyAccessToken(accessToken);

    return this.principalResolver.resolve(identity);
  }

  private authenticationFailure(): UnauthorizedException {
    return new UnauthorizedException(AUTHENTICATION_FAILURE);
  }
}
