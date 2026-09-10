import { Module } from '@nestjs/common';

import { ScopeAuthorizationGuard } from './scope-authorization.guard';

@Module({
  providers: [ScopeAuthorizationGuard],
  exports: [ScopeAuthorizationGuard],
})
export class AuthorizationModule {}
