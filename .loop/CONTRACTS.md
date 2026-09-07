# NOKTOS AUTH - INTERNAL CONTRACTS V1

## 1. Principal

```ts
export type PrincipalType =
  | 'agent_user'
  | 'traveler_user'
  | 'api_key'
  | 'service';

export interface Principal {
  type: PrincipalType;
  userId?: string;
  agentId?: string;
  travelerId?: string;
  credentialId?: string;
  roles: string[];
  scopes: string[];
}
```

Rules:

- no asumir exclusividad entre agentId y travelerId
- valores ausentes permanecen undefined/null segun convencion Nest decidida en implementacion
- nunca aceptar identity facts del cliente cuando ya vienen de credenciales confiables

## 2. public.user_info mapping

Supabase user id -> `public.user_info.id_user`.

Resultado -> Principal humano.

La clasificacion exacta `agent_user` vs `traveler_user` debe basarse en reglas explicitas y no borrar contexto. Si una fila contiene agente y viajero, Principal puede llevar ambos IDs.

## 3. AppClient/CoreClient

```text
Controller/Application Service
           |
           v
       CoreClient
           |
           v
        AppClient
           |
           +-> request-id
           +-> timeout
           +-> error mapper
           +-> CoreRequestAuthStrategy
                    |
                    +-> Noop (V1)
                    +-> Signed JWT (future)
```

No llamar `CORE_BASE_URL` fuera de esta frontera.

## 4. Error response publico

```json
{
  "error": {
    "code": "SOME_STABLE_CODE",
    "message": "Safe public message",
    "requestId": "req_..."
  }
}
```

Los errores generados por Auth usan el mismo envelope.

## 5. Core error handling

- preserve 4xx expected status when safe
- preserve stable public code/message only
- sanitize 5xx
- timeout -> 504
- transport/unreachable -> 502/503 according to implemented mapper
- future internal-auth 401 -> 5xx outward, never user-session 401

## 6. API Key conceptual model

```text
ApiCredential
- id uuid
- agentId varchar
- name varchar
- environment test|live
- keyPrefix varchar
- keyHash varchar unique
- status active|revoked
- createdByUserId uuid nullable
- createdAt timestamptz
- revokedAt timestamptz nullable
- lastUsedAt timestamptz nullable
- expiresAt timestamptz nullable

ApiCredentialScope
- credentialId
- scope
```

The raw secret is never persisted.
