export { AuthorizationModule } from './authorization.module';
export {
  REQUIRED_SCOPES_METADATA,
  RequireScopes,
} from './required-scopes.decorator';
export {
  evaluateScopeAuthorization,
  type ScopeAuthorizationResult,
} from './scope-authorization';
export { ScopeAuthorizationGuard } from './scope-authorization.guard';
