# HANDOFF — Noktos Auth Engineering Loop

**Para:** la próxima sesión de Claude Code que actúe como Supervisor/Orchestrator de este repositorio.
**Escrito:** 2026-09-08, al pausar voluntariamente una sesión sana (el humano se retiraba, no un bloqueo).
**Estado del loop:** PAUSADO limpio. Sin HUMAN_GATE, sin BLOCKED, worktree limpio, nada pendiente de decisión.

---

## 0. Cómo usar este documento

Prioridad de fuentes, no cambia:

```
estado actual del repo > documentos versionados > STATE.json/Git > este handoff > contexto de conversación
```

Si este handoff contradice el repositorio, **gana el repositorio**. Antes de proponer cualquier
acción, sigue el protocolo de arranque de `CLAUDE.md`: lee `.loop/GOAL.md`,
`.loop/ARCHITECTURE_DECISIONS.md`, `.loop/CONTRACTS.md`, `.loop/PRISMA_SAFETY.md`,
`.loop/STATE.json`, luego `git status` y comprueba si existe `.loop/HUMAN_GATE.md`.

Esta sesión ocurrió íntegramente en **Windows** (no macOS, a diferencia del handoff anterior).
Revalida versiones (`codex --version`, `node --version`, `jq --version`) si esta continuación
ocurre en otra máquina.

---

## 1. Tu rol

Eres **Supervisor/Orchestrator**, no ingeniero de este proyecto. `CLAUDE.md` es autoritativo y
persistente: administras el harness en `.loop/`, corres sus scripts, supervisas sesiones de
Codex, reportas con fidelidad. No implementas código de producto, no decides como Architect o
Reviewer, no corriges a mano un diff rechazado, no debilitas guards.

---

## 2. Prompt sugerido para arrancar la próxima sesión

Copia y pega esto tal cual al abrir una sesión nueva:

```
Lee HANDOFF.md completo, luego el protocolo de arranque de CLAUDE.md
(.loop/GOAL.md, .loop/ARCHITECTURE_DECISIONS.md, .loop/CONTRACTS.md,
.loop/PRISMA_SAFETY.md, .loop/STATE.json, git status, y si existe
.loop/HUMAN_GATE.md). Dame un resumen de en qué quedamos y pregúntame
si quieres que retome el loop en modo autónomo (batches encadenados
sin pedirme aprobación entre cada uno, deteniéndote solo ante las
condiciones reales de CLAUDE.md) o si prefieres ir paso a paso.
```

La autorización de batches encadenados sin preguntar que usé en esta sesión fue
**de esta conversación, no está escrita en CLAUDE.md** — por diseño del propio `CLAUDE.md`
("una aprobación no aplica a todos los contextos futuros"), la próxima sesión debe
**volver a pedirla explícitamente**, no asumirla del historial.

---

## 3. Estado del repositorio

| | |
| --- | --- |
| Rama | `loop/noktos-auth` |
| HEAD | `8be3427` — `loop(AUTH-009-A): Define API credential and scope Prisma models` |
| Worktree | limpio |
| `.loop/HUMAN_GATE.md` | no existe |
| `.loop/MAX_ITERATIONS_REACHED.md` | existe (recibo informativo del último batch sano, no es un gate) |
| Remote | `origin` → `https://github.com/AngelCstd/proyecto_esc.git` — **rama 14 commits por delante, sin push hecho** |
| Artefacto suelto | `.loop/runs/20260908-152040-003/` solo tiene `architect.prompt.txt` — quedó a medias porque interrumpí el batch ahí a propósito (ver §5). Es git-ignored, inofensivo, no hace falta limpiarlo; el próximo `loop.sh` crea su propio directorio nuevo. |

`.loop/STATE.json`: `status=RUNNING`, `iteration=13`, `blocked_tasks=[]`, `last_review` de
`AUTH-009-A` en `approve`.

Versiones usadas esta sesión: `codex-cli 0.153.0`, `node v22.15.0`, `npm 10.9.2`, `jq 1.8.2`
(instalado vía `winget`, ver §5.1 — importante si cambia de máquina).

Config del harness sin cambios: `CLAUDE_REVIEW_EVERY=0`, `REVIEWER_MODE=rotate`,
`ARCHITECT_PROVIDER=codex`, `MAX_ATTEMPTS_PER_TASK=2`. Architect, Implementer y Reviewer
siguen siendo Codex exclusivamente. Claude CLI no está instalado y no hace falta.

---

## 4. Qué se logró en esta sesión

13 tareas completadas y aprobadas de forma independiente (arrancando desde 2, quedaron 11
nuevas). En términos de negocio, no de tickets:

- Servicio NestJS base, compilando.
- Configuración validada al arrancar (puerto, entorno).
- Prisma configurado en modo multi-schema: `public.user_info` como externally-managed/solo
  lectura, `noktos_auth` como schema propio.
- Verificación de identidad vía access token de Supabase.
- Repositorio de solo lectura de `user_info` (mapea id_agente/id_viajero/rol sin perderlos).
- Modelo `Principal` (identidad interna normalizada).
- `AppClient` (HTTP saliente genérico) + `CoreClient` (única puerta hacia Core) +
  `NoopCoreRequestAuthStrategy` (V1 sin token interno, con el seam listo para JWT futuro).
- Mapeo sanitizado de errores de Core → Auth (sin filtrar detalles internos).
- Modelos Prisma de `ApiCredential`/`ApiCredentialScope` en `noktos_auth` (test/live,
  hash-only, revocación, sin migración real ejecutada).

Detalle técnico completo: `git log --oneline` desde `caacda2` hasta `8be3427`.

Todas pasaron por el flujo completo: Architect → Implementer (Codex, sandbox workspace-write)
→ guards de scope/DB → `npm run build` + `prisma validate` → Reviewer independiente → commit.
Ninguna se aprobó ni se commiteó a mano.

---

## 5. Incidentes de esta sesión y qué se corrigió

### 5.1 Bug de `jq` con CRLF en Windows (RESUELTO, harness corregido)

El `jq` instalado vía `winget` (build nativo de Windows, `jqlang.jq`) emite `\r\n` en su salida
incluso con `-r`. Nada en `loop.sh` recortaba ese `\r`, y eso rompía silenciosamente el matching
de `allowed_paths`/`forbidden_paths` — produjo un `exit 6` falso ("Task scope violation") sobre
un diff de `AUTH-001-B` que en realidad era válido y estaba perfectamente dentro de scope.

Fix aplicado y commiteado (`b93c191 fix: normalize jq output across platforms`): un helper
único `jq_run()` en `loop.sh` por el que pasa **toda** invocación a `jq` — usa `-b/--binary`
cuando está disponible y además recorta un `\r` final por línea como respaldo, preservando el
exit code real de `jq` (no el de `sed`) vía `PIPESTATUS`, igual que ya hacía `verify.sh`.
Validado con una suite de regresión de 24 checks sin invocar modelos, incluyendo una repetición
exacta del caso real que había fallado. **No fue necesario instalar un jq distinto ni depender
de configuración especial del sistema.**

Corrección a un análisis previo mío: pensé inicialmente que esto también rompía el veredicto del
Reviewer (`$(jq -r '.verdict...')`), pero en este bash de MSYS la sustitución de comandos
`$(...)` ya recortaba el `\r` por su cuenta — solo la sustitución de procesos (`<(...)`, usada en
`read_lines_into_reply`) y los pipes/redirects directos lo preservaban. El fix cubre ambos casos
igual, pero quiero que quede clara la imprecisión de mi reporte original.

### 5.2 `core.autocrlf=true` dejaba los `.sh` del harness en CRLF (RESUELTO)

Mismo tipo de riesgo que 5.1 pero a nivel de los propios scripts, no de `jq`. Fix
(`7a4ec5c fix: enforce portable script line endings`): `.gitattributes` en la raíz con
`*.sh text eol=lf` y `*.ps1 text eol=crlf`, `.gitattributes` añadido a `PROTECTED_PATHS` en
`loop.sh`, documentado en `README_LOOP.md`. Renormalización **solo** de los 5 scripts afectados,
no del repo completo. `core.autocrlf` del usuario **no se tocó**.

### 5.3 El Implementer no tiene red (SIN RESOLVER DE FONDO — mitigado dos veces, no arreglado)

Ya documentado en la versión anterior de este handoff: el sandbox `workspace-write` de Codex no
tiene acceso a red, así que cualquier tarea que necesite instalar una dependencia nueva se
bloquea. Pasó dos veces esta sesión:

1. **Prisma inicial** (`AUTH-002`): resuelto con el humano corriendo
   `npm install prisma @prisma/client` manualmente y commiteando `package.json`/`lock`
   (`6419786`), dejando que el loop trabajara offline desde ahí.
2. **`@prisma/adapter-pg`** (`AUTH-004-A`): el Implementer devolvió `blocked` correctamente
   (no buscó la dependencia en otro lado del disco — comportamiento correcto). Recuperación
   autorizada explícitamente por el humano: `npm install --ignore-scripts` desde el host para
   precargar `node_modules`/cache, descarte completo del diff no aprobado, borrado puntual de
   ese `HUMAN_GATE.md`, y reintento con una sesión fresca de Codex que sí pasó completo.

**Esto va a volver a pasar** en cualquier tarea futura que necesite una dependencia nueva no
instalada todavía. La investigación de fondo (permission profiles de Codex con allowlist de red
+ aislamiento de lectura de disco, la decisión "B+C" que quedaba pendiente en el handoff
anterior) **no se retomó esta sesión** — quedó aparcada porque cada bloqueo puntual se resolvió
más rápido con la instalación manual. Si esto se vuelve frecuente, vale la pena retomar esa
investigación en vez de seguir parcheando caso por caso. Dato nuevo de esta sesión: en
`codex-cli 0.153.0` en Windows, `codex sandbox` (el mecanismo de permission profiles) falla
directamente con `CreateProcessAsUserW... Windows error 5 (Acceso denegado)` para una cuenta no
Administradora — un fallo distinto y más temprano que el `SIGABRT` de macOS 0.150.1 documentado
antes. `codex doctor` reporta `sandbox backend: elevated` de todos modos, lo cual no se
reconcilió; sigue siendo una pregunta abierta si el `codex exec` real (el que usa el Implementer)
necesita o no que la sesión que lo invoca esté elevada.

---

## 6. Qué falta

Backlog restante (`AUTH-010` en adelante en `.loop/BACKLOG.yaml`), agrupado:

- **API Keys**: generación (`nok_test_`/`nok_live_`), revocación, autenticación por key,
  scopes/permisos de la key.
- **Acceso humano autenticado**: conectar la verificación de Supabase ya lista con guards/
  contexto reales de la API.
- **Partner API**: ingreso para integraciones externas vía API Key.
- **Seguridad de borde**: rate limiting, logging sin secretos.
- **Auditoría**: eventos de seguridad (login fallido, alta/revocación de keys) sin guardar
  secretos.
- **MCP**: boundary de compatibilidad para que una futura integración tipo ChatGPT entre por el
  mismo camino de identidad (sin construir el servidor MCP ni el flujo OAuth específico).
- **Cierre**: Swagger/documentación pública, checklist final de `READY_FOR_HUMAN_REVIEW`.

Próxima tarea esperable si se retoma el loop: algo bajo `AUTH-010` (generación/lifecycle de API
keys), ya que `AUTH-009` (el modelo de datos) quedó aprobado.

---

## 7. Decisiones arquitectónicas abiertas (sin cambios esta sesión)

En `.loop/ARCHITECTURE_DECISIONS.md`, sección `OPEN`. Ninguna bloquea el trabajo actual:

- **Q-001** — matriz exacta de permisos por rol humano (`administrador`, `reservan`, `viajero`).
  Relevante desde `AUTH-012`.
- **Q-002** — OAuth específico MCP/ChatGPT. Relevante en `AUTH-017`.
- **Q-003** — assertion interna Auth→Core futura (JWT firmado). Relevante más allá de `AUTH-007`
  (que ya usa el `NoopCoreRequestAuthStrategy` como estaba previsto).

Una decisión ausente se escala, nunca se inventa.

---

## 8. Cosas a mejorar / vigilar (no urgentes)

- **§5.3**: si los bloqueos de red por dependencias nuevas se vuelven frecuentes, retomar la
  investigación de permission profiles de Codex en Windows en vez de seguir con instalación
  manual caso por caso.
- Los `.ps1` en `.loop/scripts/` (harness V2, sin usar desde el port a `.sh`) siguen sin
  borrarse — pendiente desde el handoff anterior, sigue sin ser urgente.
- Fricción menor observada: cuando Codex ejecuta comandos propios vía PowerShell (no vía esta
  sesión de Claude), a veces `git`/`rg` no están en el PATH de esa PowerShell y falla con
  "comando no reconocido". No ha bloqueado ninguna tarea (el agente se recupera leyendo archivos
  directo), pero podría eventualmente.
- Nunca se ha hecho `git push`. Cuando se decida compartir el trabajo, alguien tiene que
  autorizarlo explícitamente.

---

## 9. Cuándo detenerte y devolver el control

Sin cambios respecto al contrato de `CLAUDE.md`: HUMAN_GATE real, BLOCKED, guard failure, scope
violation, intento de modificar rutas protegidas, decisión arquitectónica OPEN necesaria,
migration real a Supabase, necesidad de secretos/credenciales reales, operación de producción,
push/deploy/release, trabajo de Core o MCP, dos intentos fallidos de la misma tarea,
inconsistencia entre Git/STATE.json/artefactos, comportamiento inesperado del harness, o
`COMPLETE`/`READY_FOR_HUMAN_REVIEW`.

---

## 10. Resumen en una línea

El loop funciona bien en Windows tras corregir dos bugs de line-endings (`jq` y los propios
scripts); lleva 13 tareas aprobadas hasta `AUTH-009-A` (modelo de datos de API Keys) y se
detuvo limpio, sin gate, solo porque el humano se iba — el pendiente real de fondo sigue siendo
que el Implementer no tiene red, mitigado dos veces a mano pero no resuelto de raíz.
