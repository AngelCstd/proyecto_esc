# Noktos Auth integration contracts

This document describes the integration boundaries currently implemented by Noktos Auth. It does not define business operations or public business endpoint paths; none are currently implemented.

## System boundary

Noktos Auth is the only permitted gateway to Noktos Core:

```text
Web / Partner / external MCP service
                -> Noktos Auth
                -> CoreClient
                -> AppClient
                -> CoreRequestAuthStrategy
                -> Noktos Core
```

Code that communicates with Core must use `CoreClient`, which delegates transport to `AppClient`. `AppClient` applies the injected `CoreRequestAuthStrategy`; the V1 implementation is `NoopCoreRequestAuthStrategy` and adds no internal authentication credentials. Direct Core HTTP calls outside this path are not permitted.

Noktos Core and the MCP service are external systems and are not implemented in this repository. The final MCP OAuth flow and a future signed Auth-to-Core authentication strategy are deferred architectural decisions. No OAuth protocol details, signing algorithm, token format, key management, issuer, audience, or lifetime are defined here.

## Public credential dispatch

Clients send credentials using the standard header:

```http
Authorization: Bearer <credential>
```

Routing is determined once from the credential's form before validation:

- A Bearer value beginning with `nok_test_` or `nok_live_` is exclusively an API key.
- Every other Bearer value is exclusively a Supabase access token.
- If validation fails on the selected route, authentication fails. Validation never falls back to the other route.

An API key identifies exactly one `agentId`; a client-supplied `agentId` cannot replace or override the identity derived from the key. A valid API-key Principal receives its `credentialId`, `agentId`, and stored credential scopes.

## Principal contract

Successful authentication produces this normalized shape:

```ts
type PrincipalType =
  | 'agent_user'
  | 'traveler_user'
  | 'api_key'
  | 'service';

interface Principal {
  type: PrincipalType;
  userId?: string;
  agentId?: string;
  travelerId?: string;
  credentialId?: string;
  roles: string[];
  scopes: string[];
}
```

For a human Supabase identity, `userId` is the verified Supabase user ID and the remaining human context is read from the existing `public.user_info` row. Human `type` is determined only by the literal role value:

| `public.user_info.rol` | `Principal.type` |
| --- | --- |
| `administrador` | `agent_user` |
| `reservante` | `agent_user` |
| `viajero` | `traveler_user` |

A missing, empty, or unrecognized role rejects authentication; there is no default type. When present, both `id_agente` and `id_viajero` are preserved as `agentId` and `travelerId`, even when they coexist on the same row and regardless of the classified type. The recognized role is retained in `roles`.

Permanent human role-to-scope mappings remain undecided and must not be invented. The current human Principal resolver therefore returns an empty `scopes` array.

## Public errors and request IDs

Public errors use this envelope:

```json
{
  "error": {
    "code": "STABLE_PUBLIC_CODE",
    "message": "Safe public message",
    "requestId": "req_..."
  }
}
```

The request ID associated with the request context is forwarded to Core in the `x-request-id` header and the same value is included in mapped public errors.

Core failures are handled as follows:

- Expected Core statuses `400`, `403`, `404`, `409`, `422`, and `429` are preserved only when the caller boundary has declared the matching status and stable public error code as safe. The public message comes from that safe declaration, not blindly from the Core response.
- Core `500` becomes a sanitized `500` with a generic public error.
- A timeout becomes `504` (`CORE_TIMEOUT`).
- A network or connection failure becomes `502` (`CORE_UNAVAILABLE`).
- Unknown, malformed, or undeclared Core responses become `502` (`CORE_BAD_GATEWAY`).
- A Core `401` is an internal Auth-to-Core failure and becomes a gateway failure; it is never exposed as a user-session `401` or used to force user logout.

Stack traces, SQL errors, internal hosts, headers, credentials, arbitrary upstream bodies, and other undeclared details are not exposed.

## Validated environment variables

The application validates these variables at startup. Values below describe purpose only; real credentials must not be committed or logged.

| Variable | Purpose and validation |
| --- | --- |
| `NODE_ENV` | Runtime environment. Optional; defaults to `development` and accepts only `development`, `test`, or `production`. |
| `PORT` | HTTP listening port. Optional; defaults to `3000` and must be an integer from 1 through 65535. |
| `DATABASE_URL` | Non-empty PostgreSQL connection URL used by Prisma. |
| `SUPABASE_URL` | Supabase project URL used for human identity verification; must be an absolute HTTP or HTTPS URL. |
| `SUPABASE_ANON_KEY` | Non-empty Supabase anonymous/publishable key used by the verification client. It is configuration-sensitive and must not be logged. |
| `CORE_BASE_URL` | Base URL used only by the centralized Core client; must be an absolute HTTP or HTTPS URL. |
| `CORE_REQUEST_TIMEOUT_MS` | Core outbound request timeout in milliseconds; required and must be a positive integer. |

## Current public surface and deferred work

No public business endpoints are currently implemented. Consequently, this document does not specify route paths, Core operations, or business authorization rules. Core remains responsible for resource-specific business authorization; Auth handles identity, general scopes, the gateway boundary, and safe transport behavior.

Swagger/OpenAPI runtime wiring is outside this task and is not added here. Automated tests are likewise not introduced by this documentation unit.
