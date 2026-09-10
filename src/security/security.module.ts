import {
  MiddlewareConsumer,
  Module,
  NestModule,
  RequestMethod,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { APP_GUARD } from '@nestjs/core';
import { ThrottlerGuard, ThrottlerModule } from '@nestjs/throttler';

import { EnvironmentConfig } from '../config/environment.validation';
import { HttpRequestLoggingMiddleware } from './http-request-logging.middleware';

function getConnectionAddress(request: Record<string, unknown>): string {
  const socket = request.socket;

  if (typeof socket === 'object' && socket !== null) {
    const remoteAddress = Reflect.get(socket, 'remoteAddress');

    if (typeof remoteAddress === 'string' && remoteAddress.length > 0) {
      return remoteAddress;
    }
  }

  return 'unknown-client-address';
}

@Module({
  imports: [
    ThrottlerModule.forRootAsync({
      inject: [ConfigService],
      useFactory: (configService: ConfigService<EnvironmentConfig, true>) => ({
        throttlers: [
          {
            ttl: configService.get('RATE_LIMIT_WINDOW_MS', { infer: true }),
            limit: configService.get('RATE_LIMIT_REQUEST_COUNT', {
              infer: true,
            }),
          },
        ],
        getTracker: getConnectionAddress,
      }),
    }),
  ],
  providers: [
    {
      provide: APP_GUARD,
      useClass: ThrottlerGuard,
    },
  ],
})
export class SecurityModule implements NestModule {
  configure(consumer: MiddlewareConsumer): void {
    consumer.apply(HttpRequestLoggingMiddleware).forRoutes({
      path: '{*path}',
      method: RequestMethod.ALL,
    });
  }
}
