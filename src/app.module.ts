import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';

import { validateEnvironment } from './config/environment.validation';
import { CoreModule } from './core';
import { IdentityModule } from './identity/identity.module';
import { SecurityModule } from './security/security.module';

@Module({
  imports: [
    ConfigModule.forRoot({
      cache: true,
      isGlobal: true,
      validate: validateEnvironment,
    }),
    CoreModule,
    IdentityModule,
    SecurityModule,
  ],
})
export class AppModule {}
