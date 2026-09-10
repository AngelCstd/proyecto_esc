# HANDOFF — Noktos Auth Engineering Loop

**Para:** la próxima sesión de Claude Code que actúe como Supervisor/Orchestrator de este repositorio.
**Escrito:** 2026-09-10, al cerrar una sesión sana (el humano pidió subir todo y dejar todo listo).
**Estado del loop:** PAUSADO limpio. Sin HUMAN_GATE, sin BLOCKED, worktree limpio, nada pendiente de decisión.

> **Para arrancar rápido sin leer todo esto primero:** usa `NEXT_SESSION_PROMPT.md` — es el
> mensaje literal para pegar al abrir una sesión nueva. Este archivo es el detalle de respaldo.

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

Esta sesión (y la anterior) ocurrieron íntegramente en **Windows**. El humano mencionó en algún
momento que pensaba continuar desde su Mac — no llegó a pasar en esta sesión, pero puede pasar
en la próxima. Revalida versiones (`codex --version`, `node --version`, `jq --version`) y no
asumas que el entorno es el mismo si cambia de máquina — ver §3.1.

---

## 1. Tu rol

Eres **Supervisor/Orchestrator**, no ingeniero de este proyecto. `CLAUDE.md` es autoritativo y
persistente: administras el harness en `.loop/`, corres sus scripts, supervisas sesiones de
Codex, reportas con fidelidad. No implementas código de producto, no decides como Architect o
Reviewer, no corriges a mano un diff rechazado, no debilitas guards.

---

## 2. Estado del repositorio

| | |
| --- | --- |
| Rama | `loop/noktos-auth` |
| HEAD local | `b6a46dd` — `loop(AUTH-010-A): Implement API key generation and hashing primitive` |
| Worktree | limpio |
| `.loop/HUMAN_GATE.md` | no existe |
| Remote | `origin` → `https://github.com/AngelCstd/proyecto_esc.git` — **con push hecho** (ver nota abajo) |

**Nota sobre el push:** esta sesión terminó con `origin/loop/noktos-auth` ya sincronizado hasta
`a9b46fe` por una vía externa a esta conversación (no fue esta sesión de Claude) — no se investigó
quién/qué lo hizo, solo se constató el hecho vía `git fetch`. Después de esto se pusheó el resto
(`b6a46dd` en adelante, incluyendo el commit de este mismo handoff). **Verifica con
`git fetch && git status -sb`** al arrancar para confirmar que tu copia local coincide con
`origin/loop/noktos-auth` antes de asumir nada sobre qué está publicado.

`.loop/STATE.json`: `status=RUNNING`, `iteration=14`, `blocked_tasks=[]`, `last_review` de
`AUTH-010-A` en `approve`.

Versiones usadas esta sesión (Windows): `codex-cli 0.153.0`, `node v22.15.0`, `npm 10.9.2`,
`jq 1.8.2` vía `winget`. **Revalida las tuyas si cambia la máquina.**

Config del harness sin cambios: `CLAUDE_REVIEW_EVERY=0`, `REVIEWER_MODE=rotate`,
`ARCHITECT_PROVIDER=codex`, `MAX_ATTEMPTS_PER_TASK=2`. Architect, Implementer y Reviewer
siguen siendo Codex exclusivamente. Claude CLI no está instalado y no hace falta.

### 3.1 Si cambias de máquina (p. ej. a Mac)

```bash
cd <ruta-del-repo>
git status                        # si hay algo sucio, para y revísalo primero
git fetch origin
git log --oneline -1 origin/loop/noktos-auth   # compara contra el HEAD de arriba
git checkout loop/noktos-auth
git merge --ff-only origin/loop/noktos-auth    # debe ser fast-forward; si no, algo diverge - para
npm install                       # node_modules/ no viaja con git
```

`.loop/runs/` de sesiones anteriores y `.env` tampoco viajan — no los busques, es normal.

---

## 3. Qué se logró en total (14 tareas aprobadas)

En términos de negocio, no de tickets:

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
- **Nuevo:** servicio de generación de API keys (`nok_test_`/`nok_live_`, 256 bits de entropía,
  hash SHA-256 determinístico para persistencia futura, sin guardar la key en texto plano, sin
  estado). Es solo la pieza de generación — todavía no hay persistencia, endpoints ni
  autenticación real por key.

Detalle técnico completo: `git log --oneline` desde `caacda2` hasta `b6a46dd`.

Todas pasaron por el flujo completo: Architect → Implementer (Codex, sandbox workspace-write)
→ guards de scope/DB → `npm run build` + `prisma validate` → Reviewer independiente → commit.
Ninguna se aprobó ni se commiteó a mano.

---

## 4. Incidentes de esta sesión y qué se corrigió

### 4.1 Bug de `jq` con CRLF en Windows (RESUELTO, harness corregido)

El `jq` instalado vía `winget` (build nativo de Windows, `jqlang.jq`) emite `\r\n` en su salida
incluso con `-r`. Nada en `loop.sh` recortaba ese `\r`, y eso rompía silenciosamente el matching
de `allowed_paths`/`forbidden_paths` — produjo un `exit 6` falso ("Task scope violation") sobre
un diff de `AUTH-001-B` que en realidad era válido.

Fix commiteado (`b93c191 fix: normalize jq output across platforms`): un helper único
`jq_run()` en `loop.sh` por el que pasa **toda** invocación a `jq` — usa `-b/--binary` cuando
está disponible y recorta un `\r` final por línea como respaldo, preservando el exit code real
de `jq` vía `PIPESTATUS`. Validado con 24 checks de regresión sin invocar modelos.

Nota de precisión: en este bash de MSYS, la sustitución de comandos `$(...)` ya recortaba el
`\r` por su cuenta; solo la sustitución de procesos (`<(...)`) y los pipes/redirects directos lo
preservaban. El fix cubre ambos casos igual.

En Mac (jq de Homebrew) este bug simplemente no existe — el fix es inofensivo ahí, no hace
falta revertirlo.

### 4.2 `core.autocrlf=true` dejaba los `.sh` del harness en CRLF (RESUELTO)

Mismo tipo de riesgo que 4.1 pero en los propios scripts. Fix
(`7a4ec5c fix: enforce portable script line endings`): `.gitattributes` en la raíz
(`*.sh text eol=lf`, `*.ps1 text eol=crlf`), añadido a `PROTECTED_PATHS`, documentado en
`README_LOOP.md`. `core.autocrlf` del usuario no se tocó.

### 4.3 El Implementer no tiene red (SIN RESOLVER DE FONDO — mitigado tres veces)

El sandbox `workspace-write` de Codex no tiene acceso a red; cualquier tarea que necesite una
dependencia nueva se bloquea. Pasó dos veces con dependencias reales (Prisma y
`@prisma/adapter-pg`), resuelto ambas veces con el humano corriendo `npm install` desde el host
y commiteando, dejando que el loop trabajara offline desde ahí. La investigación de fondo
(permission profiles de Codex con allowlist de red) sigue sin retomarse — ver §6.

### 4.4 `TaskStop` no mata el árbol de procesos completo en Windows (NUEVO, sin arreglar — cuidado operativo, no del harness)

Al intentar pausar un batch a mitad de camino con la herramienta `TaskStop` del propio Claude
Code, el proceso wrapper de `loop.sh` pareció detenerse, pero **un hijo de Codex siguió vivo y
terminó una implementación completa (`AUTH-010-A`) sin supervisión del harness** — escribió
archivos en el working tree pero nunca pasó por guards/verify/reviewer porque el wrapper que
haría esas llamadas ya estaba "muerto" desde la perspectiva de la herramienta.

Encima, mientras ese proceso zombie seguía vivo, el propio Supervisor (yo) hizo un commit normal
y no relacionado (`a9b46fe`, este mismo handoff). Cuando el zombie finalmente reaccionó, comparó
el HEAD actual contra su referencia vieja, vio que había cambiado, y concluyó incorrectamente
**"el Implementer creó un commit, prohibido"** — escribió un `HUMAN_GATE.md` real pero con
diagnóstico falso. Se verificó con `git reflog` y `git fsck --unreachable` que **nunca existió
tal commit** — el historial estaba limpio. Se descartó el diff huérfano (nunca revisado, código
de manejo de secretos) y se corrigió el gate.

Después, ese mismo run (relanzado limpio) quedó **~40 horas suspendido** porque la laptop se fue
a dormir con el proceso corriendo — al despertar la máquina, el proceso retomó exactamente donde
iba y terminó normal (`AUTH-010-A` aprobado y commiteado como `b6a46dd`).

**Lección operativa, no un bug del harness:** si vas a pausar un batch en Windows, no confíes en
que `TaskStop` mate todo el árbol de procesos. Antes de hacer cualquier commit propio mientras
un batch podría seguir vivo en segundo plano, confirma con `Get-Process` (PowerShell, no `ps aux`
de Git Bash — no ve todos los procesos de Windows) que de verdad no queda nada corriendo.

---

## 5. Qué falta

Backlog restante (`AUTH-010` en adelante en `.loop/BACKLOG.yaml`), agrupado:

- **API Keys**: ya existe la generación (`AUTH-010-A`); falta persistencia (crear/listar/
  revocar), autenticación real por key, y scopes/permisos de la key.
- **Acceso humano autenticado**: conectar la verificación de Supabase ya lista con guards/
  contexto reales de la API.
- **Partner API**: ingreso para integraciones externas vía API Key.
- **Seguridad de borde**: rate limiting, logging sin secretos.
- **Auditoría**: eventos de seguridad (login fallido, alta/revocación de keys) sin guardar
  secretos.
- **MCP**: boundary de compatibilidad para que una futura integración tipo ChatGPT entre por el
  mismo camino de identidad (sin construir el servidor MCP ni el flujo OAuth específico).
- **Cierre**: Swagger/documentación pública, checklist final de `READY_FOR_HUMAN_REVIEW`.

Próxima tarea esperable si se retoma el loop: la siguiente porción de `AUTH-010` (persistencia
de credenciales, usando los modelos Prisma de `AUTH-009-A`).

---

## 6. Decisiones arquitectónicas abiertas (sin cambios esta sesión)

En `.loop/ARCHITECTURE_DECISIONS.md`, sección `OPEN`. Ninguna bloquea el trabajo actual:

- **Q-001** — matriz exacta de permisos por rol humano. Relevante desde `AUTH-012`.
- **Q-002** — OAuth específico MCP/ChatGPT. Relevante en `AUTH-017`.
- **Q-003** — assertion interna Auth→Core futura (JWT firmado). Relevante más allá de `AUTH-007`.

Una decisión ausente se escala, nunca se inventa.

---

## 7. Cosas a mejorar / vigilar (no urgentes)

- **§4.3**: si los bloqueos de red por dependencias nuevas se vuelven frecuentes, retomar la
  investigación de permission profiles de Codex en Windows en vez de seguir con instalación
  manual caso por caso. Dato de la sesión anterior: `codex sandbox` en Windows falla con
  `CreateProcessAsUserW... Windows error 5` para cuentas no Administradoras — mecanismo
  completamente distinto al `SIGABRT` de macOS 0.150.1 documentado en un handoff más viejo (no
  mezclar ambos hallazgos si se retoma en otra máquina).
- **§4.4**: evitar pausar batches a medias con `TaskStop` en Windows si se puede evitar; si hay
  que hacerlo, verificar con `Get-Process` que no quede nada vivo antes de hacer cualquier otro
  commit.
- Los `.ps1` en `.loop/scripts/` (harness V2, sin usar desde el port a `.sh`) siguen sin
  borrarse — pendiente desde hace dos handoffs, sigue sin ser urgente.
- Fricción menor: cuando Codex ejecuta comandos propios vía PowerShell, a veces `git`/`rg` no
  están en ese PATH y falla con "comando no reconocido". No ha bloqueado ninguna tarea.

---

## 8. Cuándo detenerte y devolver el control

Sin cambios respecto al contrato de `CLAUDE.md`: HUMAN_GATE real, BLOCKED, guard failure, scope
violation, intento de modificar rutas protegidas, decisión arquitectónica OPEN necesaria,
migration real a Supabase, necesidad de secretos/credenciales reales, operación de producción,
push/deploy/release, trabajo de Core o MCP, dos intentos fallidos de la misma tarea,
inconsistencia entre Git/STATE.json/artefactos, comportamiento inesperado del harness, o
`COMPLETE`/`READY_FOR_HUMAN_REVIEW`.

La autorización para encadenar batches sin pedir aprobación **no está escrita en `CLAUDE.md`** —
es de conversación, no dura entre sesiones. La próxima sesión debe pedirla de nuevo explícitamente
antes de operar así (ver `NEXT_SESSION_PROMPT.md`).

---

## 9. Resumen en una línea

14 tareas aprobadas hasta `AUTH-010-A` (generación de API keys); dos bugs de line-endings
corregidos de raíz (`jq` y los scripts); el pendiente real de fondo sigue siendo que el
Implementer no tiene red (mitigado tres veces a mano); y esta sesión dejó una lección operativa
concreta sobre no confiar en `TaskStop` para matar procesos de Windows a medias.
