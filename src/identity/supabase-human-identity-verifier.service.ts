import { Inject, Injectable, UnauthorizedException } from '@nestjs/common';

import {
  HumanIdentityVerifier,
  TrustedHumanIdentity,
} from './human-identity-verifier';
import {
  SUPABASE_CLIENT,
  SupabaseVerificationClient,
} from './supabase-client.provider';

const AUTHENTICATION_FAILURE = {
  error: {
    code: 'INVALID_ACCESS_TOKEN',
    message: 'Invalid or missing access token',
  },
} as const;

@Injectable()
export class SupabaseHumanIdentityVerifier implements HumanIdentityVerifier {
  constructor(
    @Inject(SUPABASE_CLIENT)
    private readonly supabaseClient: SupabaseVerificationClient,
  ) {}

  async verifyAccessToken(
    accessToken: string | null | undefined,
  ): Promise<TrustedHumanIdentity> {
    if (typeof accessToken !== 'string' || accessToken.trim().length === 0) {
      throw this.authenticationFailure();
    }

    try {
      const { data, error } = await this.supabaseClient.auth.getUser(accessToken);

      if (error || !data.user || !data.user.id) {
        throw this.authenticationFailure();
      }

      return { userId: data.user.id };
    } catch {
      throw this.authenticationFailure();
    }
  }

  private authenticationFailure(): UnauthorizedException {
    return new UnauthorizedException(AUTHENTICATION_FAILURE);
  }
}
