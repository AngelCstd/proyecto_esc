export {
  CORE_REQUEST_AUTH_STRATEGY,
  type CoreRequestAuthStrategy,
} from './core-request-auth-strategy';
export { CoreClient } from './core-client';
export {
  mapCoreFailure,
  type CoreFailure,
  type CoreSafeErrorDeclaration,
  type CoreSafeErrorStatus,
} from './core-failure.mapper';
export { CoreModule } from './core.module';
export type { CorePublicError } from './core-public-error';
export { NoopCoreRequestAuthStrategy } from './noop-core-request-auth-strategy';
