import { Module } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';

import { DatabaseModule } from '../database/database.module';
import { HUMAN_IDENTITY_VERIFIER } from './human-identity-verifier';
import { HumanPrincipalResolver } from './human-principal-resolver.service';
import { PrismaUserInfoRepository } from './prisma-user-info.repository';
import {
  createSupabaseClient,
  SUPABASE_CLIENT,
} from './supabase-client.provider';
import { SupabaseHumanIdentityVerifier } from './supabase-human-identity-verifier.service';
import { UserInfoRepository } from './user-info.repository';

@Module({
  imports: [DatabaseModule],
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
    HumanPrincipalResolver,
    PrismaUserInfoRepository,
    {
      provide: UserInfoRepository,
      useExisting: PrismaUserInfoRepository,
    },
  ],
  exports: [
    HUMAN_IDENTITY_VERIFIER,
    HumanPrincipalResolver,
    SupabaseHumanIdentityVerifier,
    UserInfoRepository,
  ],
})
export class IdentityModule {}
