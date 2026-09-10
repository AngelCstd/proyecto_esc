# NOKTOS AUTH - GOAL V1

## Mission

Construir desde cero **Noktos Auth**, un servicio NestJS/TypeScript que funciona como la unica puerta autorizada hacia Noktos Core.

Esta V1 desarrolla exclusivamente la capa de Auth/Gateway. Noktos Core y Noktos MCP no se implementan dentro de este loop.

## Invariante principal

Ningun consumidor externo puede conectarse directamente a Noktos Core.

Flujos permitidos:

```text
Web / App      -> Noktos Auth -> Noktos Core
Partner API    -> Noktos Auth -> Noktos Core
ChatGPT -> MCP -> Noktos Auth -> Noktos Core
```

En infraestructura final, Core debe quedar privado y Auth debe ser el unico servicio con acceso de red permitido.

## Stack decidido

- Node.js + TypeScript
- NestJS
- Prisma ORM
- PostgreSQL de Supabase para datos de identidad/seguridad
- Supabase Auth para usuarios humanos
- HTTP/REST privado entre Auth y Core
- npm como package manager por defecto, salvo HUMAN_GATE antes del bootstrap si el humano cambia la decision

## Auth es responsable de

- aceptar y verificar el access token/JWT de Supabase
- resolver la identidad existente desde `public.user_info`
- normalizar identidades a `Principal`
- autenticacion por API Key para integraciones server-to-server
- API Keys `test` y `live`
- revocacion de API Keys
- scopes/permisos generales
- rate limiting y seguridad de borde
- correlation/request IDs
- audit trail de seguridad
- exponer endpoints publicos de Auth/Gateway
- ser la unica ruta a Core
- normalizar y sanitizar errores de Core
- mantener un cliente HTTP central hacia Core

## Core es responsable de

Auth NO debe implementar reglas de dominio como:

- pertenencia de reservas, viajes, hoteles o viajeros
- reglas de convenios/tarifas
- creacion/cancelacion de reservaciones
- integraciones de negocio como Nemogroup
- autorizacion sobre un recurso concreto de negocio

Auth puede decidir que un actor tiene un scope como `bookings:read`; Core decide si ese actor puede leer ESA reserva concreta.

## Principal

Toda autenticacion valida debe producir un objeto conceptual equivalente a:

```ts
export interface Principal {
  type: 'agent_user' | 'traveler_user' | 'api_key' | 'service';
  userId?: string;
  agentId?: string;
  travelerId?: string;
  credentialId?: string;
  roles: string[];
  scopes: string[];
}
```

`agentId` y `travelerId` NO son mutuamente excluyentes. La tabla actual puede contener ambos para un mismo usuario.

La identidad confiable nunca se toma de headers/body enviados por el cliente si puede derivarse del token/API Key.

## Supabase user mapping existente

La fuente de verdad actual para mapear un usuario de Supabase al contexto Noktos es `public.user_info`.

Estructura conocida:

```text
id          uuid         PK, unique, not null
created_at  timestamptz  not null
id_user     uuid         unique, nullable, FK -> auth.users.id
id_viajero  varchar      nullable
id_agente   varchar      nullable
rol         varchar      nullable
```

`id_user` corresponde a `auth.users.id`.

Valores de `rol` informados actualmente:

- `administrador`
- `reservante`
- `viajero`

El loop debe tratar esos valores literalmente mientras no exista una decision humana distinta.

`public.user_info` es una tabla existente y debe tratarse como **externally managed / no destructiva** desde este repo.

## Datos nuevos de seguridad

Las tablas nuevas propiedad de Noktos Auth deben vivir en el schema PostgreSQL:

```text
noktos_auth
```

Ejemplos esperados:

- api_credentials
- api_credential_scopes
- security_audit_events
- permission/scope metadata si se requiere

No almacenar datos de negocio de Core en este schema.

## Regla Prisma / Supabase

El loop NO debe ejecutar cambios destructivos contra el Supabase real.

Prohibido para agentes durante el loop:

```text
prisma migrate reset
prisma db push
prisma migrate deploy
DROP TABLE/SCHEMA sobre Supabase real
```

El loop puede:

- crear/editar Prisma schema y prisma.config
- modelar `public.user_info` para lectura
- usar multi-schema (`public`, `noktos_auth`)
- marcar `public.user_info` como externally managed si la version de Prisma elegida lo soporta de forma segura
- generar artefactos/migrations localmente cuando no toquen una DB real

Aplicar migrations a Supabase real requiere HUMAN_GATE.

## Supabase JWT

Usuarios humanos usan el access token/JWT emitido por Supabase.

Flujo:

```text
Supabase Auth -> access token -> cliente -> Noktos Auth
```

Auth valida la identidad y resuelve `public.user_info` usando `sub/id` del usuario autenticado.

Core NO debe conocer ni validar tokens de Supabase.

## Auth -> Core V1

En esta V1, la llamada privada Auth -> Core se implementa **sin token interno**.

Sin embargo, la arquitectura debe evitar acoplamiento para que agregar un JWT/assertion interno mas adelante NO obligue a modificar todos los servicios/controladores.

Debe existir una unica abstraccion de cliente saliente:

```text
Core-facing service/controller
          |
          v
      CoreClient
          |
          v
       AppClient
          |
          +--> CoreRequestAuthStrategy
                    |
                    +--> NoopCoreRequestAuthStrategy   (V1)
                    +--> SignedJwtCoreAuthStrategy     (futuro)
```

Ningun otro modulo debe llamar a `CORE_BASE_URL` directamente.

La estrategia inicial devuelve cero credenciales internas. La futura estrategia podra agregar el token firmado en un solo punto.

## Contrato de errores Core -> Auth -> Cliente

Por defecto, Auth conserva la semantica/status HTTP de los errores esperados de Core, pero nunca reenvia ciegamente datos internos.

Reglas base:

```text
Core 400 -> Auth 400 sanitizado
Core 403 -> Auth 403 sanitizado
Core 404 -> Auth 404 sanitizado
Core 409 -> Auth 409 sanitizado
Core 422 -> Auth 422 sanitizado
Core 429 -> Auth 429 sanitizado
Core 500 -> Auth 500 generico/sanitizado
Core timeout -> Auth 504
Core unreachable/connection failure -> Auth 502/503 segun contrato implementado
Core 401 interno -> NO debe forzar logout del usuario; tratar como fallo Auth<->Core (5xx)
```

Contrato publico deseado:

```json
{
  "error": {
    "code": "TRAVELER_NOT_FOUND",
    "message": "Traveler not found",
    "requestId": "req_..."
  }
}
```

Auth conserva `status`, `error.code` y `error.message` solo cuando forman parte del contrato seguro. Stack traces, SQL errors, hosts, headers internos y detalles no declarados nunca se exponen.

Auth crea `requestId` y lo reenvia a Core.

## API Keys

Una API Key representa exactamente un solo `agentId`.

Ambientes:

```text
nok_test_<secret>
nok_live_<secret>
```

Requisitos:

- secreto generado criptograficamente
- minimo 256 bits de entropia
- secret completo se muestra solo una vez al crear
- DB guarda hash + prefix/metadata, nunca secret en texto plano
- `agentId` obligatorio
- scopes por credencial
- estado activo/revocado
- `revokedAt`
- `lastUsedAt`
- nombre/label de la credencial
- `expiresAt` puede existir como opcional, pero expiracion no es obligatoria en V1

## MCP

El servidor MCP es un servicio separado y esta fuera de este repo.

Regla:

```text
ChatGPT -> MCP -> Noktos Auth -> Core
```

El MCP nunca accede a Core ni DB directamente.

La parte Auth debe poder aceptar la identidad autorizada del usuario (p.ej. token Supabase/OAuth segun la integracion final) y producir el mismo `Principal` que el Web.

La configuracion OAuth especifica de ChatGPT puede quedar para una fase posterior y debe usar HUMAN_GATE si requiere decisiones no documentadas.

## Definition of Done del loop

Esta version del loop NO ejecuta suites de tests y NO puede declarar production readiness.

El estado final maximo es:

```text
READY_FOR_HUMAN_REVIEW
```

Para llegar ahi debe existir, al menos:

- repo NestJS funcional y compilable
- configuracion/env centralizada
- Prisma seguro respecto a `public.user_info`
- verificacion de Supabase identity
- resolver `user_info` -> Principal
- abstraccion `AppClient/CoreClient`
- `NoopCoreRequestAuthStrategy` V1 y contrato listo para strategy JWT futura
- manejo/correlation de errores Core
- API Keys test/live con hash y revocacion
- scopes basicos de API Key
- middleware/guards correspondientes
- logging sin secretos
- rate limiting base
- audit trail base
- documentacion de arquitectura y variables de entorno
- reviewer independiente aprueba cada tarea
- `npm run build` pasa cuando el proyecto ya exista
- `prisma validate` pasa cuando Prisma ya exista

No se requiere implementar Core ni MCP.
