import { Module } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';

import { HUMAN_IDENTITY_VERIFIER } from './human-identity-verifier';
import {
  createSupabaseClient,
  SUPABASE_CLIENT,
} from './supabase-client.provider';
import { SupabaseHumanIdentityVerifier } from './supabase-human-identity-verifier.service';

@Module({
  providers: [
    {
      provide: SUPABASE_CLIENT,
      inject: [ConfigService],
      useFactory: createSupabaseClient,
    },
    SupabaseHumanIdentityVerifier,
    {
      provide: HUMAN_IDENTITY_VERIFIER,
      useExisting: SupabaseHumanIdentityVerifier,
    },
  ],
  exports: [HUMAN_IDENTITY_VERIFIER, SupabaseHumanIdentityVerifier],
})
export class IdentityModule {}
