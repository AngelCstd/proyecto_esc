# HANDOFF — Noktos Auth Engineering Loop

**Para:** la próxima sesión de Claude Code que actúe como Orchestrator de este repositorio.
**Escrito:** 2026-09-07, al cierre de la sesión anterior.
**Estado del loop:** DETENIDO por una decisión humana pendiente sobre el sandbox del Implementer.

---

## 0. Cómo usar este documento

La **prioridad de fuentes** es, y no cambia:

```
estado actual del repo > documentos versionados > STATE.json/Git > este handoff > contexto de conversación
```

Si este handoff contradice el repositorio, **gana el repositorio**. Este documento es contexto
suplementario, no autoridad.

Antes de proponer cualquier acción, haz el protocolo de arranque de `CLAUDE.md`: lee
`.loop/GOAL.md`, `.loop/ARCHITECTURE_DECISIONS.md`, `.loop/CONTRACTS.md`,
`.loop/PRISMA_SAFETY.md`, `.loop/STATE.json`, luego `git status` y comprueba si existe
`.loop/HUMAN_GATE.md`.

> **AVISO DE MÁQUINA NUEVA**
> Este handoff se escribió en la laptop personal (macOS, rutas bajo `/Users/angelcstd/`).
> La sesión siguiente se abrirá en la **laptop de trabajo**. Todas las rutas absolutas,
> versiones de CLI y resultados de sondas de este documento son **de la máquina anterior**.
> **Revalida todo en la máquina nueva antes de concluir nada.** En particular, la versión de
> Codex CLI puede ser distinta allí.

---

## 1. Tu rol

Eres **Supervisor / Orchestrator**, no ingeniero de este proyecto. `CLAUDE.md` y `AGENTS.md`
son autoritativos y persistentes.

**Haces:** administrar el harness en `.loop/`, ejecutar sus scripts, supervisar sesiones de
Codex, leer task packets/reviews/`STATE.json`/artefactos de `.loop/runs/`, reportar con
fidelidad incluyendo fallos.

**No haces:** implementar código de producto, actuar como Architect o Reviewer, corregir a
mano un diff rechazado, inventar decisiones arquitectónicas, debilitar guards, construir
Noktos Core o MCP, correr migrations reales contra Supabase, usar secretos de producción,
`git push`/deploy/release, instalar dependencias automáticamente, o cambiar
`CLAUDE_REVIEW_EVERY=0`.

Todo criterio de ingeniería se delega a Codex vía el harness:
Architect → Codex read-only · Implementer → Codex workspace-write (no configurable) ·
Reviewer → Codex read-only · retries → sesiones frescas de Codex.

---

## 2. Puesta en marcha en la laptop de trabajo

El repo se subirá a `https://github.com/AngelCstd/proyecto_esc.git` (remote `origin` ya
configurado en la máquina anterior; el push lo hace el humano).

```bash
git clone https://github.com/AngelCstd/proyecto_esc.git
cd proyecto_esc
git checkout loop/noktos-auth     # o la rama en la que aterrizó el push
```

**Prerrequisitos a verificar en la máquina nueva** (no instales nada automáticamente; si
falta algo, dilo y para):

- `node` y `npm`
- `jq` — el harness lo usa intensivamente
- `git` con `user.name` / `user.email` configurados (el harness commitea)
- `codex` en PATH y con sesión iniciada (`codex login`)

**Tres trampas conocidas al clonar:**

1. **`.git/info/exclude` NO viaja en un clon.** En la máquina anterior contenía
   `.loop/runs/`, `.loop/HUMAN_GATE.md` y `.loop/MAX_ITERATIONS_REACHED.md`. `loop.sh` los
   regenera al arrancar (`ensure_local_excludes`), pero **antes del primer arranque** esos
   artefactos aparecerían como untracked y ensuciarían el worktree.
2. **`.loop/runs/` no viaja.** Los artefactos de los runs anteriores (task packets, diffs,
   reviews) se quedan en la máquina vieja. No los busques; no están.
3. **`node_modules/` no viaja.** Haz `npm install` antes de esperar que
   `npm run build` funcione. El harness ejecuta `verify.sh`, que corre
   `npm run build --if-present`.

---

## 3. Estado del repositorio

| | |
| --- | --- |
| Rama | `loop/noktos-auth` |
| HEAD | `2004089` — `loop(AUTH-001-A): Add validated application runtime configuration` |
| Worktree | limpio |
| `.loop/HUMAN_GATE.md` | **no existe** |
| Remote | `origin` → `https://github.com/AngelCstd/proyecto_esc.git` (sin push hecho aún al escribir esto) |

Commits, del más reciente al más antiguo:

```
2004089  loop(AUTH-001-A): Add validated application runtime configuration
44ba0eb  fix: separate batch limits from human gates
caacda2  loop(AUTH-000-A): Bootstrap minimal NestJS application
4a491d7  chore: add persistent loop orchestration contracts
cb17ac0  chore: initialize Noktos Auth engineering loop
```

`.loop/STATE.json`:

```json
{ "status": "RUNNING", "iteration": 2,
  "completed_tasks": ["AUTH-000-A", "AUTH-001-A"],
  "blocked_tasks": [],
  "last_review": { "task_id": "AUTH-001-A", "verdict": "approve", "provider": "codex" },
  "reviewer_rotation": { "slot": 2, "last_provider": "codex", "claude_review_every": 0 } }
```

Configuración del harness (`.loop/scripts/loop.config.sh`, ruta protegida):
`CLAUDE_REVIEW_EVERY=0` · `REVIEWER_MODE=rotate` · `ARCHITECT_PROVIDER=codex` ·
`MAX_ITERATIONS=20` · `MAX_ATTEMPTS_PER_TASK=2` · `DIFF_MAX_LINES=4000`.

**Claude CLI no está instalado y no debe instalarse.** Con `CLAUDE_REVIEW_EVERY=0` nunca se
selecciona. Cambiar ese `0` es decisión humana.

---

## 4. Qué pasó en la sesión anterior

### 4.1 Tareas completadas por el loop

```
AUTH-000-A  Bootstrap minimal NestJS application            approved   caacda2
AUTH-001-A  Add validated application runtime configuration approved   2004089
```

`AUTH-001-A` añadió `@nestjs/config`, `src/config/environment.validation.ts`, `.env.example`
y el cableado de `PORT`/`NODE_ENV` vía `ConfigService`. Reviewer independiente: `approve`.
`npm run build` pasó.

### 4.2 Mantenimiento del harness (commit `44ba0eb`)

Con **autorización humana explícita y limitada**, se corrigió una confusión semántica:
agotar `MAX_ITERATIONS` escribía `.loop/HUMAN_GATE.md`, lo que hacía indistinguible un
límite de presupuesto de una petición real de decisión.

Ahora:

- **exit 9** = *batch boundary*. Escribe `.loop/MAX_ITERATIONS_REACHED.md` (recibo
  informativo, git-ignored, borrado al empezar el siguiente batch). **No** escribe
  `HUMAN_GATE.md`. Por sí solo **no requiere humano**.
- `.loop/HUMAN_GATE.md` queda reservado a exit 2–8 y 10. Su presencia siempre significa parar.
- `loop.sh` **se niega a arrancar** (exit 1) si `HUMAN_GATE.md` existe.

Validado offline con un stub de `codex` en repos desechables: 22/22 checks (approve→exit 9
sin gate; scope violation→exit 6 con gate y diff preservado; comando de DB prohibido→exit 6;
gate preexistente→rechaza arrancar). **Esos tests no están persistidos en el repo.**

Las seis condiciones para encadenar batches automáticamente tras un exit 9 están escritas en
`CLAUDE.md`, sección *"Exit 9 is a batch boundary, not a gate"*. Léelas ahí; son la
autoridad.

### 4.3 El incidente que detuvo el loop

Durante el primer batch autónomo (`--max-iterations 3`), en la iteración 2 el Architect
despachó **`AUTH-002-A — Configure Prisma with externally managed user_info`**.

El Implementer no pudo instalar Prisma: **el sandbox de Codex no tiene red**
(`ENOTFOUND registry.npmjs.org`, luego `ENOTCACHED` con `--offline`). Como fallback,
**se puso a recorrer el disco del usuario buscando Prisma en otros proyectos**:

```
find /Users/angelcstd -path '*/node_modules/prisma/package.json' ...
find /Users/angelcstd/Documents -path '*/node_modules/prisma/package.json' ...
→ .../presupuestos/node_modules/prisma        5.22.0
→ .../extras/backend/node_modules/prisma      7.8.0
```

Eso disparó diálogos de permisos de macOS que el humano notó. El supervisor **detuvo el
batch**.

Lo que sí funcionó: el sandbox `workspace-write` **bloqueó las escrituras** fuera del
workspace (npm no pudo ni escribir sus logs en `~/.npm/_logs`). **No se copió nada** de los
otros repos: el lockfile parcial apuntaba a `registry.npmjs.org` y la versión pedida
(`6.19.1`) no coincidía con las encontradas fuera.

El diff parcial (`package.json`, `package-lock.json`) fue **descartado con autorización
humana** vía `git restore`. Los artefactos del run interrumpido se conservaron en
`.loop/runs/20260907-143800-002/` (en la máquina anterior).

---

## 5. EL BLOQUEO ACTUAL — decisión humana tomada, implementación bloqueada

### 5.1 La decisión del humano (vigente)

Se eligió **B + C combinadas**, como autorización humana explícita y limitada para modificar
el harness y su configuración de permisos:

- El Implementer **necesita red** para instalar dependencias.
- Esa red **NO** debe ser acceso abierto: debe usar **allowlist**.
- El Implementer **NO** debe poder leer `$HOME`, `~/Documents` ni otros repositorios.
- Escritura solo al workspace necesario.
- **Nunca** `danger-full-access`.

Perfil objetivo para el Implementer: workspace actual `write`; runtime mínimo `read`; resto
del filesystem `deny`; otros proyectos y `$HOME/Documents` `deny`; network `enabled` con
proxy y allowlist inicial **únicamente**:

```
registry.npmjs.org
binaries.prisma.sh
```

Sin allowlist global `*`. Si en un smoke aparece otro dominio legítimamente necesario,
**detente y pregunta antes de ampliarla**.

Architect y Reviewer conservan su comportamiento read-only actual.

### 5.2 Por qué está bloqueado (hallazgos en codex-cli **0.150.1**)

Se investigó solo con comandos read-only y sondas sin modelo. **El mecanismo existe y su
esquema se descifró, pero aplicar cualquier perfil aborta el CLI.**

Esquema real descubierto:

```toml
default_permissions = "nombre"

[permissions.nombre]
filesystem = { "/ruta" = "read" | "write" | "deny" | "none" }
network    = { enabled = true, mode = "limited" | "full" }
```

Resultados observados en 0.150.1:

| Perfil aplicado | Resultado |
| --- | --- |
| `filesystem = { "/tmp" = "write" }` | **rc=134 (SIGABRT), sin salida** |
| `filesystem = { "/tmp" = "read" }` | **rc=134, sin salida** |
| `network = { enabled = false }` | **rc=134, sin salida** |
| `network = { enabled = true, mode = "full" }` | **rc=134, sin salida** |
| `network = { enabled = true, mode = "limited" }` | **rc=134, sin salida** |
| *sin `[permissions]`* | rc=0, funciona |

El abort era **silencioso**: sin stderr, sin panic, ni con `RUST_BACKTRACE=1`. Ocurría igual
con `-P <perfil>`, con `default_permissions`, en el `.codex/config.toml` del proyecto y en un
`CODEX_HOME` aislado.

Baseline medido del sandbox por defecto en 0.150.1:

| Operación | Resultado |
| --- | --- |
| Leer el repo | permitido |
| Leer `~/Documents` | **permitido** |
| Leer otro repo del usuario | **permitido** |
| Leer `~/.ssh` | **permitido** |
| Escribir fuera del workspace | bloqueado |
| Red | bloqueada |

Otros hechos verificados en 0.150.1:

- **`codex exec` no expone** `--permission-profile` ni `--sandbox-state-*`. Su único control
  de sandbox es `-s read-only|workspace-write|danger-full-access`. **El harness lanza al
  Implementer con `codex exec`**, así que cualquier mecanismo que solo exista en
  `codex sandbox` no sirve para el Implementer.
- `--sandbox-state-readable-root` existe solo en `codex sandbox` y exige
  `--sandbox-state-json`.
- La allowlist de dominios depende de la feature **experimental `network_proxy`**, que está
  **desactivada**; su esquema no era alcanzable ni con `--enable network_proxy`. Lo único
  disponible era red on/off (`sandbox_workspace_write.network_access`) — es decir, acceso
  abierto, que el humano rechazó explícitamente.
- El **`.codex/config.toml` del proyecto SÍ se carga**. Esa parte del plan funciona; lo que
  falla es el motor de perfiles.

**Conclusión en 0.150.1:** ni B (allowlist) ni C (denegar lectura) eran imponibles. Se
reportó el gap y se paró, sin habilitar red abierta y sin sustituir enforcement por
instrucciones de prompt.

### 5.3 Qué cambió desde entonces

**El humano actualizó Codex CLI.** En la máquina anterior `codex doctor` reportaba
`0.153.4 available (current 0.150.1)`. **No se ha verificado nada sobre la versión nueva.**

---

## 6. TU TAREA — instrucciones del humano para esta sesión

Literalmente lo que pidió, para ejecutar en la laptop de trabajo:

> **No modifiques todavía el harness ni el código del producto. No invoques modelos.**
>
> Primero confirma `codex --version`.
>
> Si es 0.153.4, repite exactamente las sondas model-free usadas para diagnosticar 0.150.1.
>
> Comprobar de nuevo:
> - perfil mínimo con `filesystem` **read**
> - perfil mínimo con `filesystem` **write**
> - network **disabled**
> - network **enabled**
> - lectura del workspace
> - lectura de `~/Documents`
> - lectura de otro repo
> - lectura de `~/.ssh`
> - escritura fuera del workspace
> - comportamiento de network profiles / **limited** network si ahora es funcional
>
> Usa un `CODEX_HOME` temporal y **no modifiques la configuración real del usuario**.
>
> **No asumas que por ser una versión nueva el bug está corregido.**
>
> Necesito resultados **observados**: comando/prueba · exit code · allowed/denied · si hubo
> SIGABRT · si la política **realmente se aplicó**.
>
> Si los permission profiles siguen abortando o no restringen lectura de manera verificable,
> **detente**. No habilites red abierta y no sustituyas enforcement por instrucciones de
> prompt.
>
> Si funcionan, entonces **propón** cómo implementar B+C, pero **no modifiques todavía el
> harness** hasta mostrarle la política efectiva.

### 6.1 Sondas listas para copiar

Ajusta `REPO` y `OTRO_REPO` a las rutas reales de la máquina nueva. Ninguna gasta tokens de
modelo.

```bash
# --- 0. Versión y features -------------------------------------------------
codex --version
codex features list | grep -iE "network_proxy|permission"

# --- 1. Preparar CODEX_HOME temporal (NO tocar ~/.codex) -------------------
export SP="$(mktemp -d)"           # CODEX_HOME desechable
export REPO="$PWD"                 # el repo clonado
export OTRO_REPO="$HOME/Documents" # algo fuera del workspace que exista

# --- 2. Baseline SIN [permissions] ----------------------------------------
p(){ out=$(codex sandbox -- /bin/sh -c "$1" 2>&1); rc=$?; printf 'rc=%-4s %s\n' "$rc" "$(echo "$out"|head -1)"; }
echo -n "leer repo:        "; p "ls '$REPO/src' >/dev/null && echo OK"
echo -n "leer ~/Documents: "; p "ls '$HOME/Documents' >/dev/null && echo LEIDO"
echo -n "leer otro repo:   "; p "ls '$OTRO_REPO' >/dev/null && echo LEIDO"
echo -n "leer ~/.ssh:      "; p "ls -a '$HOME/.ssh' >/dev/null && echo LEIDO"
echo -n "escribir HOME:    "; p "touch '$HOME/.noktos-probe' && echo ESCRITO"
echo -n "red npm:          "; p 'curl -s -m 8 -o /dev/null -w "%{http_code}" https://registry.npmjs.org/prisma'

# --- 3. ¿Sigue abortando al aplicar un perfil? ----------------------------
t(){ printf 'default_permissions = "p"\n\n[permissions.p]\n%s\n' "$1" > "$SP/config.toml"
     out=$(CODEX_HOME="$SP" codex sandbox -- /bin/echo ok 2>&1); rc=$?
     printf '  %-52s rc=%-4s out=%s\n' "$1" "$rc" "${out:-<vacio>}"; }
t 'filesystem = { "'"$REPO"'" = "write" }'
t 'filesystem = { "'"$REPO"'" = "read" }'
t 'network = { enabled = false }'
t 'network = { enabled = true, mode = "full" }'
t 'network = { enabled = true, mode = "limited" }'
# rc=134 y out vacío == SIGABRT == el bug SIGUE. rc=0 con "ok" == el perfil se aplicó.

# --- 4. Si NO aborta: ¿la política se aplica DE VERDAD? -------------------
# Perfil que solo permite el workspace; todo lo demás debe quedar denegado.
cat > "$SP/config.toml" <<TOML
default_permissions = "impl"

[permissions.impl]
filesystem = { "$REPO" = "write" }
network = { enabled = true, mode = "limited" }
TOML
q(){ out=$(CODEX_HOME="$SP" codex sandbox -- /bin/sh -c "$1" 2>&1); rc=$?; printf 'rc=%-4s %s\n' "$rc" "$(echo "$out"|head -1)"; }
echo -n "leer repo (OK esperado):        "; q "ls '$REPO/src' >/dev/null && echo OK"
echo -n "escribir repo (OK esperado):    "; q "touch '$REPO/.probe' && rm -f '$REPO/.probe' && echo ESCRITO"
echo -n "leer ~/Documents (DENY):        "; q "ls '$HOME/Documents' >/dev/null && echo LEIDO"
echo -n "leer otro repo (DENY):          "; q "ls '$OTRO_REPO' >/dev/null && echo LEIDO"
echo -n "leer ~/.ssh (DENY):             "; q "ls -a '$HOME/.ssh' >/dev/null && echo LEIDO"
echo -n "escribir fuera (DENY):          "; q "touch '$HOME/.noktos-probe' && echo ESCRITO"
echo -n "npm allowlisted (OK):           "; q 'curl -s -m 10 -o /dev/null -w "%{http_code}" https://registry.npmjs.org/prisma'
echo -n "prisma binaries (OK):           "; q 'curl -s -m 10 -o /dev/null -w "%{http_code}" https://binaries.prisma.sh/'
echo -n "dominio NO allowlisted (DENY):  "; q 'curl -s -m 10 -o /dev/null -w "%{http_code}" https://example.com'

# --- 5. Limpieza ----------------------------------------------------------
rm -rf "$SP"; rm -f "$HOME/.noktos-probe" "$REPO/.probe"
```

**Interpretación honesta obligatoria:** `rc=134` con salida vacía = SIGABRT = el bug sigue.
Que un comando "no falle" **no** prueba que la política se aplicó — hay que ver **denegación
observada** donde se espera DENY. Si `~/Documents` se sigue leyendo con el perfil activo, la
política **no** está imponiendo nada, aunque el CLI no aborte.

### 6.2 Árbol de decisión

- **Si siguen abortando, o no restringen lectura de forma verificable** → **PARA**. Reporta
  con la tabla de resultados observados. No habilites red abierta. No sustituyas enforcement
  por prompt. Presenta las opciones (abajo) sin elegir por el humano.
- **Si funcionan** → **propón** el diseño de B+C y **muestra la política efectiva
  primero**. No toques el harness hasta que el humano lo apruebe.

### 6.3 Cuando se autorice implementar B+C (no antes)

Lo que el humano ya especificó para esa fase:

1. **Solo el Implementer** migra a permission profile. Architect y Reviewer siguen read-only
   igual que hoy.
2. **Config versionada en `.codex/config.toml`** del proyecto (verificado: el proyecto la
   carga). Añadir `.codex/` a las rutas protegidas del harness para que ningún Implementer
   pueda editar su propia política.
3. **Cuidado con la interacción de flags:** no dejar `--sandbox workspace-write` en la
   invocación del Implementer si eso hace que Codex ignore el permission profile. El adapter
   `invoke_agent` debe aplicar el mecanismo correcto según el rol. Conservar las guardas
   fail-closed existentes (`invoke_agent` aborta ante `danger-full-access`, ante implementer
   ≠ codex, y ante roles read-only con sandbox de escritura).
4. **Política de dependencias** — añadir al contrato/prompt del Implementer:
   - nunca buscar dependencias o código en otros repos del usuario;
   - nunca recorrer `$HOME` ni `~/Documents` como fallback;
   - nunca copiar `node_modules` de proyectos vecinos;
   - si una dependencia no se obtiene por los canales de red autorizados, devolver
     **BLOCKED** en vez de reutilizar archivos externos.
5. **npm cache**: no depender de escritura en `~/.npm`. Configurar el entorno del Implementer
   para usar un cache temporal permitido por el sandbox, fuera de los archivos trackeados.
   **No** ampliar lectura a `$HOME` solo para reutilizar el cache existente.
6. **Validación sin modelos** antes de reanudar, demostrando: lectura del repo OK; escritura
   en workspace OK; lectura de `~/Documents` DENIED; lectura de otro repo DENIED;
   `registry.npmjs.org` OK; `binaries.prisma.sh` OK; dominio no allowlisted DENIED;
   `npm view prisma` funcionando con el cache temporal; `bash -n` pasando.
7. **Commit** (solo si todo pasa): `fix: isolate implementer filesystem and network access`.
   Sin push.
8. **Canary real**: `./.loop/scripts/loop.sh --max-iterations 1 --max-attempts 2`.
   Se espera que el Architect vuelva a seleccionar AUTH-002. Se considera validado si:
   instala dependencias solo desde hosts autorizados, no intenta salir del workspace, pasa
   guards, pasa verificación determinista, obtiene `approve`, crea commit y deja Git limpio.
   Si vuelve a leer fuera del workspace, si necesita dominios no autorizados, o si el perfil
   no se aplica de verdad → **parar y devolver el control**.
9. Tras el canary validado, se puede volver a batches de 3 y luego de 5, según el contrato de
   orquestación de `CLAUDE.md`.

### 6.4 Opciones si el bug persiste

Presentarlas sin elegir por el humano:

1. **Aislamiento a nivel de SO** (contenedor Docker/Lima, o usuario macOS dedicado al loop).
   Garantía más fuerte e independiente de bugs del CLI: los otros repos no existen dentro.
   Coste: montaje considerable, cambia cómo se ejecuta el loop.
2. **Seguir offline con preinstalación humana**: el humano instala las dependencias con red y
   las commitea; el loop trabaja offline. No arregla la lectura del disco y se repite en cada
   tarea con dependencias nuevas.
3. **Pausar el loop** hasta que haya una versión de Codex con perfiles funcionales.

---

## 7. Decisiones arquitectónicas OPEN

En `.loop/ARCHITECTURE_DECISIONS.md`, sección `OPEN`. Ninguna bloquea AUTH-002:

- **Q-001** — matriz exacta de permisos por rol humano (`administrador`, `reservan`,
  `viajero`). Se puede construir la infraestructura de scopes; sembrar una matriz permanente
  requiere HUMAN_GATE. Relevante desde AUTH-012.
- **Q-002** — OAuth específico MCP/ChatGPT. No diseñar issuer/client registration/redirect en
  silencio. Relevante en AUTH-017.
- **Q-003** — assertion interna Auth→Core futura (algoritmo, key management, TTL,
  issuer/audience, JWKS). V1 usa `NoopCoreRequestAuthStrategy`. Relevante más allá de
  AUTH-007.

**Una decisión ausente se escala, nunca se inventa.**

---

## 8. Contexto de sesión NO persistido en el repo

Cosas que el repositorio no puede contarte:

- El harness V3 (`*.sh`) es un **port desde PowerShell**. Los cuatro `.ps1` de
  `.loop/scripts/` son el original V2, **sin usar**; su borrado quedó pendiente para un commit
  aparte. Nada en el repo dice que los `.sh` son nuevos ni que los `.ps1` están obsoletos.
- Se corrigió un **fail-open heredado**: `verify.ps1` leía el exit code después de `tee`, lo
  que dejaba pasar builds rotos como verdes. `verify.sh` usa `PIPESTATUS`.
- El lenguaje estricto de rutas nació de findings reales: el matcher V2 permitía que `*`
  cruzara `/` y que rutas con `..` escaparan del scope.
- Se ejecutaron **95 casos de dry-run** (78 sobre `select_reviewer_provider`,
  `validate_path_rule`, `path_matches_rule`, `assert_paths_normalized`; 17 de protección) y
  un **smoke E2E de 22 checks** con stub de codex. **Nada de eso está persistido.** Si alguien
  toca esas funciones, no hay red de seguridad.
- `plan-next.sh` **no traspasa su packet a `loop.sh`**: cada uno llama al Architect por
  separado. En el canary consumió ~28.600 tokens de Architect en un packet descartado.
  **No usar `plan-next.sh` en operación normal.**
- El contador de rotación vive en `.loop/runs/` y no en `STATE.json` a propósito: en un
  fichero trackeado rompería el resume y provocaría falsas violaciones de scope acusando al
  implementer de una escritura del harness.
- Modelo real usado por Codex en la máquina anterior: `gpt-5.6-sol`, `approval: never`.
- El ruido de `[verify]` duplicado en los logs es el Reviewer haciendo `cat` de
  `verification.txt`. No es un bug.
- Observación factual pendiente de AUTH-000-A, sin juicio de ingeniería: el build script es
  `tsc -p tsconfig.build.json` y existe `nest-cli.json`, pero `@nestjs/cli` no estaba en
  `devDependencies` mientras un criterio de aceptación mencionaba "Nest CLI configuration".
  El Reviewer independiente lo aprobó. Si merece seguimiento, lo decide el Architect vía
  backlog.

---

## 9. Cuándo detenerte y devolver el control

Operación autónoma por batches autorizada según `CLAUDE.md`. **Para y devuelve el control**
ante cualquiera de estos:

HUMAN_GATE real · BLOCKED · guard failure · scope violation · intento de modificar rutas
protegidas · decisión arquitectónica OPEN necesaria para continuar · migration real a
Supabase · necesidad de secretos o credenciales reales · operación de producción ·
push/deploy/release · trabajo que exija construir Noktos Core o MCP · dos intentos fallidos
de la misma task · inconsistencia entre Git, `STATE.json` y artefactos del run ·
comportamiento inesperado del harness · `COMPLETE` / `READY_FOR_HUMAN_REVIEW`.

No resuelvas un HUMAN_GATE por tu cuenta. No debilites guards para lograr progreso. No
cambies decisiones arquitectónicas congeladas.

---

## 10. Resumen en una línea

El loop funciona y lleva dos tareas aprobadas; está **parado antes de AUTH-002** porque el
Implementer necesita red con allowlist y aislamiento de lectura, el humano ya decidió que así
sea (**B+C**), y en codex-cli 0.150.1 eso era imposible de imponer. **Codex ya se actualizó:
la tarea inmediata es revalidar con sondas sin modelo si los permission profiles ahora
funcionan de verdad — y no dar por hecho que sí.**
