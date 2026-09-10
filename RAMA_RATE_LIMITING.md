# Rama `deferred/rate-limiting` — trabajo diferido

**Qué es esta rama:** una foto del trabajo de rate limiting (`AUTH-015-B`) que el loop produjo
el 2026-09-10 y que se apartó **antes de aprobarse**, cuando el humano indicó que el destino de
despliegue es **Vercel (serverless)**.

**No fusionar tal cual.** Ver "Por qué no sirve como está".

---

## Estado exacto

- **Nunca pasó por review.** El Reviewer independiente jamás lo evaluó, así que no cuenta como
  trabajo aprobado bajo las reglas del loop.
- **No compila.** Declara `@nestjs/throttler@^6.5.0` en `package.json`/`package-lock.json`, pero
  la dependencia **no está instalada** (el Implementer no tiene red). El build falla con
  `Cannot find module '@nestjs/throttler'`.
- Se separó de `loop/noktos-auth` en el commit `78b0141`
  (`loop(AUTH-015-A): Add credential-safe HTTP request logging`).

## Qué contiene

| Archivo | Qué hace | ¿Reutilizable? |
| --- | --- | --- |
| `src/security/security.module.ts` | Cablea `ThrottlerModule` con almacenamiento **en memoria** y un guard global | **No** en serverless, ver abajo |
| `src/config/environment.validation.ts` | Añade `RATE_LIMIT_WINDOW_MS` y `RATE_LIMIT_REQUEST_COUNT`, y **refactoriza** la validación de enteros positivos a un helper `requirePositiveInteger` reutilizable | El refactor **sí** es aprovechable y es independiente del rate limiting |
| `.env.example` | Documenta las dos variables nuevas | Sí, si se conserva el enfoque de config |
| `package.json` / `package-lock.json` | Declara `@nestjs/throttler` | Depende del backend que se elija |

## Por qué no sirve como está (serverless)

1. **Estado en memoria.** `ThrottlerModule` por defecto guarda los contadores en la memoria del
   proceso. En Vercel cada petición puede caer en una instancia distinta y las instancias se
   apagan solas, así que los contadores ni se comparten ni sobreviven. El límite sería, en la
   práctica, inexistente e impredecible.
2. **Identificación del cliente equivocada.** Usa `socket.remoteAddress` como identificador. Detrás
   del proxy de Vercel eso devuelve la IP del proxy, no la del cliente real — todos los usuarios
   compartirían el mismo contador. Necesitaría leer `X-Forwarded-For` con una política explícita
   de en cuál proxy confiar.

## Qué haría falta para retomarlo

1. **Decisión humana pendiente:** elegir el backend de estado compartido (Upstash/Redis,
   Vercel KV, u otro). El loop tiene prohibido elegirlo por su cuenta — debe frenar con
   HUMAN_GATE si lo necesita.
2. Cambiar el almacenamiento del throttler a ese backend.
3. Definir la política de `X-Forwarded-For` (cuántos proxies de confianza saltar).
4. Instalar las dependencias desde el host (el sandbox del Implementer no tiene red).
5. Volver a pasarlo por el loop completo (Architect → Implementer → guards → verify → Reviewer),
   **no** fusionar este diff a mano.

## Idea suelta

El refactor de `requirePositiveInteger` en `environment.validation.ts` es útil por sí solo y no
tiene nada que ver con serverless. Si en algún momento se quiere, se puede rescatar como una
tarea propia y pequeña del loop, sin arrastrar nada del throttler.
