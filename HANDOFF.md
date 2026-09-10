# HANDOFF — Noktos Auth Engineering Loop

**Estado:** ✅ **LOOP TERMINADO** — `READY_FOR_HUMAN_REVIEW` (2026-09-10).
**Para:** quien retome este repositorio, sea una sesión nueva de Claude Code o una persona.

El backlog se completó: **29 tareas**, todas aprobadas por un Reviewer independiente antes de
commitearse. `STATE.json` está en `READY_FOR_HUMAN_REVIEW`, `blocked_tasks` vacío, worktree
limpio, sin `HUMAN_GATE.md`.

> **Esto NO significa listo para producción.** Es el estado máximo que el loop puede declarar
> por diseño. Falta revisión humana real. Ver §2.

---

## 1. Qué hacer ahora (lo primero)

El entregable de cierre es **`docs/human-review-checklist.md`** — un checklist producido por el
loop enumerando exactamente qué debe verificar un humano antes de confiar en esto. Empieza por
ahí. El otro documento relevante es `docs/integration-contracts.md` (contratos de integración).

Después, lee **`PENDIENTES.md`** (cosas conscientemente diferidas) y **`.loop/ARCHITECTURE_DECISIONS.md`**
sección `OPEN` (decisiones que siguen sin tomarse).

---

## 2. Límites honestos de lo construido

- **No hay tests automatizados.** Decisión explícita de costo (`D-017`). Solo se verificó que
  compila y que el esquema de Prisma es válido. Nadie ejecutó el sistema.
- **Nunca se conectó a una base de datos real.** El esquema es válido sintácticamente; que las
  tablas existan en Supabase es otra cosa, y aplicar migraciones sigue requiriendo intervención
  humana con respaldo previo.
- **No hay rutas públicas.** El repositorio contiene los cimientos (identidad, API keys, scopes,
  cliente hacia Core, auditoría) pero **ningún controlador**. Nada está expuesto todavía.
- **Fue IA revisando IA.** El Reviewer independiente rechazó trabajo 6 veces a lo largo del
  proyecto y encontró un hueco real de seguridad (ver §4), así que no es un sello automático —
  pero no equivale a revisión humana.
- **Rate limiting no existe.** Diferido a propósito por el destino serverless (`D-020`).

---

## 3. Qué se construyó

Fundación de Noktos Auth como única puerta hacia Noktos Core:

- Servicio NestJS/TypeScript compilando, con configuración validada al arrancar.
- Prisma multi-schema: `public.user_info` como tabla externa de solo lectura, `noktos_auth` como
  schema propio.
- Identidad humana: verificación de access token de Supabase → consulta de `user_info` →
  `Principal` normalizado (clasificación por `rol` según `D-018`).
- API Keys completas: generación con 256 bits de entropía, persistencia solo-hash, ciclo de vida
  (crear/listar/revocar), y autenticación de peticiones entrantes.
- Autorización por scopes (infraestructura; la matriz por rol sigue abierta, `Q-001`).
- Frontera hacia Core: `AppClient` → `CoreClient` → `CoreRequestAuthStrategy` (Noop en V1, con el
  hueco listo para el JWT interno futuro), con mapeo sanitizado de errores.
- Auditoría de eventos de seguridad, y logging que censura credenciales.
- Boundary de compatibilidad para una futura integración MCP.

Historial completo: `git log --oneline` desde `caacda2` hasta `33b57cf`.

---

## 4. Incidentes del proyecto y cómo se resolvieron

1. **Bug de `jq` con CRLF en Windows** (`b93c191`). Un `jq` nativo de Windows emitía `\r\n`, lo
   que rompía silenciosamente el matching de rutas de los guards y produjo un `exit 6` falso.
   Corregido de raíz con un wrapper único `jq_run()`. 24 checks de regresión.
2. **Line endings de los propios scripts** (`7a4ec5c`). `.gitattributes` fijando `*.sh` a LF,
   protegido para que ningún implementador lo relaje.
3. **El Implementer no tiene red.** Tres veces bloqueó una tarea que necesitaba instalar una
   dependencia. Mitigado a mano (el humano instala desde el host); **sin resolver de fondo**.
   Ver `PENDIENTES.md`.
4. **`TaskStop` no mata el árbol de procesos en Windows.** Un proceso huérfano siguió vivo y luego
   produjo un `HUMAN_GATE` con diagnóstico falso ("el Implementer commiteó"), verificado como
   falso con `git reflog`/`fsck`. Lección: en Windows, confirmar con `Get-Process` (no `ps aux`)
   antes de asumir que algo murió.
5. **El guard de comandos destructivos bloqueaba documentación** (`3176b6b`). El checklist final
   mencionaba `prisma migrate reset` para *prohibirlo*, y el guard lo leyó como una violación.
   Se hizo el guard sensible al tipo de archivo: solo `*.md`/`*.txt` quedan excluidos, todo lo
   demás se sigue escaneando, y lo no clasificable falla en cerrado. 20 checks de regresión.
6. **El Reviewer encontró un hueco real de seguridad** (`e8306b4`). Al revisar el checklist final,
   detectó que el documento afirmaba "logging seguro implementado" cuando el logger escribía la
   ruta de la petición tal cual — una credencial en la URL habría quedado en los logs. En vez de
   suavizar el documento, el humano decidió cerrar el hueco: `AUTH-020-A` añadió censura de
   valores con forma de API key y de JWT. **Este es el ejemplo más claro de que la revisión
   independiente sirve.**

Nota: en ese mismo rechazo, el Reviewer también emitió un hallazgo **incorrecto** (afirmó que el
path humano no rechazaba prefijos `nok_`, cuando `HumanAuthenticationService` sí lo hace antes de
validar). Se verificó contra el código y se descartó. El Reviewer se equivoca a veces.

---

## 5. Si quieres seguir trabajando

El loop está en su estado terminal. Para agregar trabajo nuevo hay que **añadir items a
`.loop/BACKLOG.yaml`** y volver a correr `./.loop/scripts/loop.sh`. El Architect volverá a
declarar `complete` si el backlog no tiene nada pendiente.

Candidatos naturales, todos documentados en `PENDIENTES.md`: tests automatizados, rate limiting
con estado compartido, y los endpoints/controladores públicos que hoy no existen.

Para arrancar una sesión nueva, usa **`NEXT_SESSION_PROMPT.md`**.

---

## 6. Reglas que siguen vigentes

`CLAUDE.md` no cambia: el Supervisor administra el harness y no implementa código de producto,
no actúa como Architect ni Reviewer, no debilita guards, no corre migraciones reales, no usa
secretos de producción y no hace push sin autorización.

La autorización para operar en batches autónomos es **de conversación, no permanente** — una
sesión nueva debe pedirla otra vez.
