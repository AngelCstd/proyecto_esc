import { Module } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';

import { AppClient } from '../app-client';
import type { EnvironmentConfig } from '../config/environment.validation';
import { CoreClient } from './core-client';
import {
  CORE_REQUEST_AUTH_STRATEGY,
  type CoreRequestAuthStrategy,
} from './core-request-auth-strategy';
import { NoopCoreRequestAuthStrategy } from './noop-core-request-auth-strategy';

@Module({
  providers: [
    {
      provide: CORE_REQUEST_AUTH_STRATEGY,
      useClass: NoopCoreRequestAuthStrategy,
    },
    {
      provide: AppClient,
      inject: [ConfigService, CORE_REQUEST_AUTH_STRATEGY],
      useFactory: (
        configService: ConfigService<EnvironmentConfig, true>,
        requestAuthStrategy: CoreRequestAuthStrategy,
      ): AppClient =>
        new AppClient(
          {
            baseUrl: configService.get('CORE_BASE_URL', { infer: true }),
            timeoutMs: configService.get('CORE_REQUEST_TIMEOUT_MS', {
              infer: true,
            }),
          },
          requestAuthStrategy,
        ),
    },
    CoreClient,
  ],
  exports: [CoreClient],
})
export class CoreModule {}
