# NOKTOS AUTH - ARCHITECTURE DECISIONS V2

Este archivo es autoridad para Claude Architect y Codex.

Si aparece una decision no cubierta que cambie seguridad, contratos publicos o limites Auth/Core, detener con HUMAN_GATE.

## D-001 - Repo y stack

Noktos Auth es un repo nuevo.

Stack:

- NestJS
- TypeScript
- Node.js
- npm
- Prisma

## D-002 - Core privado

Core aun no existe. Se construira despues teniendo como referencia los contratos definidos por Auth.

Nada externo podra llamar a Core. Auth sera su unica puerta.

## D-003 - Transporte Auth -> Core

HTTP/REST privado.

`CORE_BASE_URL` se obtiene de configuracion/env.

## D-004 - Auth -> Core sin token en V1

V1 no usa credencial interna Auth -> Core.

No se permite acoplar esa decision al resto del codigo. Toda llamada pasa por `CoreClient`/`AppClient` y una estrategia de autenticacion saliente inyectable.

La implementacion inicial es un `NoopCoreRequestAuthStrategy`.

Una futura assertion JWT firmada reemplazara esa estrategia sin modificar consumidores de `CoreClient`.

## D-005 - AppClient

Debe existir una abstraccion central de HTTP saliente denominada conceptualmente `AppClient`.

Responsabilidades esperadas:

- base URL/config por aplicacion
- timeout
- request/correlation ID
- serializacion/deserializacion comun
- normalizacion de errores de transporte
- hook/strategy para credenciales internas

`CoreClient` compone/usa `AppClient`.

No crear llamadas ad-hoc con axios/fetch/HttpService fuera de esta capa para Core.

## D-006 - Supabase

Se reutiliza el proyecto actual de Supabase.

Supabase Auth sigue siendo el proveedor de login para usuarios humanos.

El mismo Postgres alojara datos de seguridad de Noktos Auth, separados logicamente de la DB de negocio/Core.

## D-007 - user_info existente

Tabla: `public.user_info`.

`id_user` = `auth.users.id`.

Columnas conocidas:

- id uuid PK unique not null
- created_at timestamptz not null
- id_user uuid unique nullable FK
- id_viajero varchar nullable
- id_agente varchar nullable
- rol varchar nullable

Roles informados literalmente:

- administrador
- reservante
- viajero

`id_agente` e `id_viajero` pueden coexistir en la misma fila. No modelarlos como union exclusiva.

La tabla ya existe y NO es propiedad de migrations de Noktos Auth.

## D-008 - Prisma ownership

Nuevas tablas de Noktos Auth viven en schema `noktos_auth`.

`public.user_info` se consulta desde Prisma pero debe quedar protegida de migrations destructivas (externally managed cuando sea tecnicamente adecuado para la version seleccionada de Prisma).

No aplicar migrations al Supabase real automaticamente.

## D-009 - Principal

Principal interno normalizado:

```ts
interface Principal {
  type: 'agent_user' | 'traveler_user' | 'api_key' | 'service';
  userId?: string;
  agentId?: string;
  travelerId?: string;
  credentialId?: string;
  roles: string[];
  scopes: string[];
}
```

Puede contener simultaneamente `agentId` y `travelerId`.

## D-010 - Supabase access token

El cliente envia el access token/JWT de Supabase a Auth.

Auth valida esa identidad y usa el user id/sub resultante para leer `public.user_info`.

No reenviar el JWT de Supabase a Core como mecanismo de confianza.

## D-011 - API Key cardinality

Cada API Key pertenece exactamente a un `agentId`.

No aceptar `agentId` externo como sustituto de la identidad derivada de la key.

## D-012 - API Key environments

Soportar desde V1:

- `nok_test_...`
- `nok_live_...`

Revocacion obligatoria.

## D-013 - Error propagation

Auth preserva status HTTP y public error code/message de errores esperados de Core, sanitizando el body.

Nunca reenviar stack traces, SQL errors, hosts, secrets ni datos internos.

Errores de transporte Auth-Core se convierten a errores gateway.

Un 401 originado por la futura autenticacion interna Core NO debe hacerse pasar por 401 del usuario.

## D-014 - Request ID

Auth genera/captura un requestId, lo envia a Core y lo devuelve en errores/respuestas segun contrato.

## D-015 - MCP

MCP es servicio externo a este repo.

Ruta obligatoria:

```text
ChatGPT -> MCP -> Auth -> Core
```

## D-016 - Migraciones reales

Cualquier comando que aplique cambios a Supabase real requiere HUMAN_GATE.

Los agentes no ejecutan `migrate reset`, `db push` ni `migrate deploy` contra esa DB.

## D-017 - Politica de calidad/costo del loop

No hay test suite obligatoria en esta V1 del loop.

Se conserva reviewer independiente de Codex.

Los checks deterministas baratos (`npm run build`, `prisma validate`) se ejecutan si estan disponibles porque no consumen tokens de modelo.

El loop termina como `READY_FOR_HUMAN_REVIEW`, nunca `PRODUCTION_READY`.

## D-018 - Clasificacion de Principal.type para identidades humanas

Decision humana registrada el 2026-09-10, en respuesta a un HUMAN_GATE del Architect.

`Principal.type` para un usuario humano se deriva EXCLUSIVAMENTE de `public.user_info.rol`,
nunca de que IDs esten presentes:

- `administrador` -> `agent_user`
- `reservante` -> `agent_user`
- `viajero` -> `traveler_user`
- rol nulo, vacio o no reconocido -> RECHAZAR la autenticacion. No hay tipo por defecto.

`agentId` y `travelerId` se conservan SIEMPRE en el Principal cuando existen en la fila,
independientemente del tipo resuelto. La clasificacion no borra contexto.

Razon de rechazar en lugar de usar un valor por defecto: una identidad que no se puede
clasificar con certeza no debe obtener ningun tipo ni permiso implicito.

`administrador` y `reservante` comparten tipo porque ambos actuan a nombre de terceros. La
diferencia funcional entre ellos (p. ej. `reservante` crea reservas pero no crea viajeros) es
una diferencia de SCOPES, no de tipo, y queda fuera de esta decision.

Esta decision NO define la matriz rol -> scopes. Q-001 permanece abierta.

Nota factual asociada: el valor real del rol intermedio es `reservante`. Los documentos
autoritativos decian `reservan` por error hasta esta fecha; se corrigio en D-007, en Q-001 y en
`GOAL.md` junto con esta decision.

## D-019 - Transporte publico de credenciales de API Key

Decision humana registrada el 2026-09-10, en respuesta a un HUMAN_GATE del Architect.

Las API Keys de socios viajan en el mismo header estandar que las sesiones humanas:

```text
Authorization: Bearer <credencial>
```

Reglas de desambiguacion, obligatorias y deterministas:

- Si el valor del Bearer empieza con `nok_test_` o `nok_live_` -> se trata EXCLUSIVAMENTE como
  API Key.
- En cualquier otro caso -> se trata EXCLUSIVAMENTE como access token de Supabase.
- Una misma credencial NUNCA se intenta por ambas vias. La via se decide una sola vez, por forma,
  ANTES de validar.
- Si la credencial falla en su via, la peticion se rechaza. NO se reintenta por la otra via.

Razon: permitir fallback entre vias convertiria un fallo de validacion en un oraculo para
adivinar credenciales y abriria confusion de identidades. La via se decide por forma, nunca por
resultado.

El prefijo `nok_test_`/`nok_live_` queda como parte del CONTRATO PUBLICO: cambiarlo rompe la
desambiguacion y rompe a los integradores existentes.

## D-020 - Destino de despliegue serverless (Vercel) y sus consecuencias

Decision humana registrada el 2026-09-10.

Noktos Auth se desplegara en **Vercel (serverless)**. Consecuencia estructural: **no existe
estado compartido en memoria entre peticiones**. Cada invocacion puede ejecutarse en una
instancia distinta y las instancias se reciclan solas.

Por lo tanto, queda PROHIBIDO para el loop implementar funcionalidad que dependa de estado
en memoria del proceso entre peticiones. En concreto y sin limitarse a ello:

- rate limiting con contadores en memoria
- cache en memoria del proceso
- cualquier acumulador, sesion o contador que deba sobrevivir entre invocaciones

Si una tarea requiere ese tipo de estado, el Architect debe devolver **HUMAN_GATE** en lugar de
elegir un backend por su cuenta. La eleccion del almacen compartido (Upstash/Redis, Vercel KV u
otro) es una decision humana pendiente.

### Efecto sobre AUTH-015

`AUTH-015` tenia dos mitades:

- **logging seguro de credenciales** -> COMPLETADO en `AUTH-015-A` (`78b0141`). Es compatible con
  serverless, no requiere estado compartido.
- **rate limiting** -> DIFERIDO. La implementacion producida se aparto sin aprobar en la rama
  `deferred/rate-limiting` (commit `2fea86b`); ver `PENDIENTES.md` y `RAMA_RATE_LIMITING.md`.

A efectos de dependencias del backlog, **`AUTH-015` se considera satisfecho por `AUTH-015-A`**,
de modo que `AUTH-016` (audit events) NO queda bloqueado. `AUTH-016` persiste en base de datos,
lo cual si es compatible con serverless.

**No volver a despachar rate limiting** hasta que exista la decision humana del backend de estado
compartido.

### Pendiente asociado, no resuelto aqui

En serverless, cada invocacion puede abrir su propia conexion a Postgres y agotar el limite de
conexiones de Supabase. Existe un endpoint de connection pooler para ese escenario. No se ha
investigado ni configurado; queda anotado en `PENDIENTES.md` como verificacion previa al primer
despliegue real, no como tarea del loop.

## OPEN - solo cuando la implementacion llegue a estas piezas

### Q-001 - Permisos exactos por rol humano

Conocemos roles (`administrador`, `reservante`, `viajero`) pero no su matriz completa de scopes.

El loop puede crear la infraestructura de scopes, pero no inventar permisos definitivos por rol. HUMAN_GATE antes de hardcodear/sembrar una matriz permanente.

### Q-002 - OAuth especifico MCP/ChatGPT

La integracion MCP final puede requerir OAuth. No diseñar silenciosamente issuer/client registration/redirect flow sin confirmar el escenario real cuando llegue esa fase.

### Q-003 - Assertion Auth -> Core futura

La V1 usa Noop strategy. Algoritmo, key management, TTL, issuer/audience y JWKS del futuro JWT interno quedan fuera de V1 y requieren HUMAN_GATE antes de implementarse.
