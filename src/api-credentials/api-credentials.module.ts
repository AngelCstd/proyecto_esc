import { Module } from '@nestjs/common';

import { DatabaseModule } from '../database/database.module';
import { ApiCredentialRepository } from './api-credential.repository';
import { ApiKeyAuthGuard } from './api-key-auth.guard';
import { ApiKeyAuthenticationService } from './api-key-authentication.service';
import { PrismaApiCredentialRepository } from './prisma-api-credential.repository';

@Module({
  imports: [DatabaseModule],
  providers: [
    PrismaApiCredentialRepository,
    {
      provide: ApiCredentialRepository,
      useExisting: PrismaApiCredentialRepository,
    },
    ApiKeyAuthenticationService,
    ApiKeyAuthGuard,
  ],
  exports: [ApiKeyAuthenticationService, ApiKeyAuthGuard],
})
export class ApiCredentialsModule {}
