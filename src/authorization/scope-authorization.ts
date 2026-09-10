import type { Principal } from '../identity/principal';

export type ScopeAuthorizationResult =
  | { readonly authorized: true }
  | {
      readonly authorized: false;
      readonly missingScopes: readonly string[];
    };

const AUTHORIZED_RESULT: ScopeAuthorizationResult = Object.freeze({
  authorized: true,
});

export function evaluateScopeAuthorization(
  principal: Principal,
  requiredScopes: readonly string[],
): ScopeAuthorizationResult {
  const grantedScopes = new Set(principal.scopes);
  const uniqueRequiredScopes = new Set(requiredScopes);
  const missingScopes: string[] = [];

  for (const requiredScope of uniqueRequiredScopes) {
    if (!grantedScopes.has(requiredScope)) {
      missingScopes.push(requiredScope);
    }
  }

  if (missingScopes.length === 0) {
    return AUTHORIZED_RESULT;
  }

  return {
    authorized: false,
    missingScopes,
  };
}
