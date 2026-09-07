# Noktos Auth Engineering Loop V2

Este paquete crea el **harness**, no Noktos Auth directamente.

La intencion es:

```text
Bash loop (loop.sh es el supervisor; no hay sesion de modelo persistente)
   |
   +-> Architect   (Codex, sesion fresca, read-only)
   |
   +-> Implementer (Codex, sesion fresca, workspace-write)
   |
   +-> diff.patch precomputado + guardas de scope + checks baratos sin tests
   |
   +-> Reviewer    (sesion fresca, provider rotativo, read-only)
   |
   +-> commit local si aprueba
   +-> HUMAN_GATE si falta una decision
```

Cada agente es una invocacion one-shot y efimera de un CLI. El supervisor es
`loop.sh`, no un modelo.

## Arquitectura congelada para V1

```text
Web / Partner / MCP
        |
        v
   NOKTOS AUTH
        |
        | CoreClient
        v
     AppClient
        |
        | CoreRequestAuthStrategy
        |   Noop V1
        v
   NOKTOS CORE (futuro/private)
```

Core aun no existe.

La costura `CoreRequestAuthStrategy` existe desde el inicio para que mas adelante se pueda agregar un JWT interno Auth->Core sin modificar todos los callers.

## Supabase

Se usa el proyecto existente:

- Supabase Auth -> login/token humano
- `public.user_info` -> mapping actual user -> agent/traveler/role
- nuevas tablas de seguridad -> schema `noktos_auth`

`public.user_info` es externa/read-only para migrations de este repo.

El loop no debe conectarse con credenciales de produccion ni aplicar migrations a Supabase real.

## Requisitos locales

Obligatorios:

- Git
- Node/npm
- `jq`
- Bash 3.2+ (el que trae macOS sirve; los scripts son 3.2-compatibles)
- Codex CLI autenticado

Opcional:

- Claude Code CLI. **No es necesario** con la configuracion por defecto
  (`CLAUDE_REVIEW_EVERY=0`). `bootstrap.sh` avisa si falta pero no falla, y
  `loop.sh` no lo comprueba mientras la configuracion no pueda seleccionarlo.

Codex usa `codex exec --ephemeral`, con `--sandbox workspace-write` solo para
implementacion y `--sandbox read-only` para arquitecto y reviewer. Claude, si
se activa, usa print mode + plan mode + structured JSON, siempre read-only.

`danger-full-access` no se usa nunca. Claude nunca implementa codigo.

## Configuracion

Los defaults viven en `.loop/scripts/loop.config.sh` (dentro de `.loop/scripts/`
a proposito: es una ruta protegida, los agentes no pueden reescribir su propia
politica de sandbox). Precedencia: flags de `loop.sh` > variables de entorno >
defaults del fichero.

| Variable | Default | Que hace |
| --- | --- | --- |
| `CLAUDE_REVIEW_EVERY` | `0` | Cada N tareas revisa Claude. `0` = nunca. `4` = codex,codex,codex,claude |
| `REVIEWER_MODE` | `rotate` | `rotate` \| `codex` \| `claude` |
| `ARCHITECT_PROVIDER` | `codex` | `codex` \| `claude` |
| `CODEX_BIN` / `CLAUDE_BIN` | `codex` / `claude` | Ruta al binario |
| `CODEX_MODEL` / `CLAUDE_MODEL` | vacio | Override de modelo |
| `MAX_ITERATIONS` | `20` | Iteraciones del arquitecto |
| `MAX_ATTEMPTS_PER_TASK` | `2` | Intentos de implementacion por tarea |
| `DIFF_MAX_LINES` | `4000` | Corte del `diff.patch` entregado al reviewer |

No existe `IMPLEMENTER_PROVIDER`: el implementer es siempre Codex y
`invoke_agent` aborta si alguien intenta lo contrario.

### Lenguaje de rutas (allowed_paths / forbidden_paths)

El harness acepta **exactamente tres formas**. Cualquier otra cosa se rechaza
antes de ejecutar el implementer, con HUMAN_GATE y exit code 6:

```text
src/auth/auth.service.ts    archivo exacto
src/auth/                   directorio, recursivo sobre todo el subarbol
src/auth/**                 subarbol explicito, identico a la forma anterior
```

Invalidos: `src/auth/*.ts`, `src/*/foo`, `foo/**/bar`, `**`, rutas absolutas,
componentes `..`, separadores `\`.

La barra final es **obligatoria** para significar "directorio": `src/auth` es
una regla de archivo exacto y no cubre lo que hay dentro de `src/auth/`.

Reglas de enforcement:

- `forbidden_paths` siempre gana sobre `allowed_paths`.
- Las rutas protegidas (`.loop/GOAL.md`, `.loop/ARCHITECTURE_DECISIONS.md`,
  `.loop/CONTRACTS.md`, `.loop/PRISMA_SAFETY.md`, `.loop/BACKLOG.yaml`,
  `.loop/STATE.json`, `.loop/prompts/`, `.loop/schemas/`, `.loop/scripts/`) son
  prohibidas siempre, digan lo que digan los `allowed_paths`.
- La comparacion es case-insensitive y **literal**: no se hace globbing sobre el
  texto de la regla, asi que una regla no puede ensancharse sola.
- El scope se calcula **solo** desde Git (`git diff` + `git ls-files`).
  `worker.files_changed` lo reporta el propio agente y nunca se usa para
  enforcement; queda en los artefactos del run solo para auditoria.
- Toda ruta que venga de Git pasa antes por una sanitizacion fail-closed: se
  rechazan rutas absolutas, con componente `..`, con componente vacio, con
  forma de directorio o entrecomilladas por Git. Una violacion termina en
  HUMAN_GATE preservando el diff, nunca en un crash generico.

### Rotacion del reviewer

El provider del reviewer se elige **una sola vez por tarea** y se persiste en
`.loop/runs/reviewer-current.json`. Los reintentos de la misma tarea reusan ese
provider y no avanzan la rotacion; un resume despues de un HUMAN_GATE tampoco
desplaza la cadencia. El contador vive en `.loop/runs/reviewer-rotation.count`,
que esta en `.git/info/exclude` y por tanto nunca ensucia el worktree ni activa
la guarda de scope. `STATE.json` recibe un espejo de solo auditoria en
`reviewer_rotation` en el mismo momento en que ya se commitea.

Con `CLAUDE_REVIEW_EVERY=0` el contador sigue avanzando pero siempre resuelve a
`codex`, de modo que activar la rotacion mas adelante es cambiar un numero.

Si alguna vez se selecciona `claude` y el binario no existe, el loop se detiene
**antes** de ejecutar ese agente con un HUMAN_GATE y exit code 10. Nunca instala
nada automaticamente.

## Instalacion inicial (repo nuevo)

1. Crea una carpeta vacia, por ejemplo:

```bash
mkdir noktos-auth
cd noktos-auth
```

2. Copia el contenido de este paquete dentro de esa carpeta, de modo que exista:

```text
noktos-auth/.loop/GOAL.md
```

3. Da permisos de ejecucion e inicializa Git validando las CLIs:

```bash
chmod +x .loop/scripts/*.sh
./.loop/scripts/bootstrap.sh --init-repo
```

4. Haz el commit inicial del harness:

```bash
git add .
git commit -m "chore: initialize Noktos Auth engineering loop"
```

Si `git init` no pudo crear la rama directamente:

```bash
git switch -c loop/noktos-auth
```

## Primer paso recomendado

NO corras todo el loop primero.

Ejecuta solo el arquitecto:

```bash
./.loop/scripts/plan-next.sh
```

Esto crea un task packet pero no deja a Codex programar.

Revisa el resultado en:

```text
.loop/runs/<run>/task.md
```

Si la primera tarea tiene sentido, entonces:

```bash
./.loop/scripts/loop.sh --max-iterations 10
```

## Coste/token

Por tarea normal:

1. una llamada Codex Architect
2. una llamada Codex Implementer
3. una llamada Reviewer (Codex por defecto)

Max intentos por defecto: 2.

No hay agente de security-review separado ni adjudicador adicional. El
supervisor es Bash, asi que no consume tokens. Los checks deterministas y el
`diff.patch` los produce el harness, no un modelo.

## Scripts

| Script | Uso |
| --- | --- |
| `bootstrap.sh [--init-repo] [--check-only]` | Valida dependencias, inicializa el repo, configura excludes |
| `plan-next.sh` | Solo arquitecto: escribe un task packet y para |
| `loop.sh [opciones]` | El loop completo. `--help` lista los flags |
| `verify.sh [--run-dir DIR]` | Checks deterministas sin tokens |

Los `.ps1` originales se conservan temporalmente como referencia del port. No
se usan.

### Exit codes de loop.sh

```text
0   complete / plan-only correcto
1   error fatal del harness
2   HUMAN_GATE del arquitecto
3   arquitecto blocked
4   el implementer creo commits (prohibido)
5   el implementer devolvio human_gate/blocked
6   violacion de scope o comando de base de datos prohibido
7   HUMAN_GATE del reviewer
8   la tarea no paso tras MAX_ATTEMPTS_PER_TASK intentos
9   MAX_ITERATIONS alcanzado sin completar
10  el CLI del provider seleccionado no esta instalado
```

## No tests en V2

Por decision de costo/velocidad, el loop no exige suite de tests.

Sin gastar tokens, el harness intenta ejecutar cuando existan:

```text
npm run build --if-present
npx prisma validate
```

Por eso el resultado final es solamente:

```text
READY_FOR_HUMAN_REVIEW
```

## HUMAN_GATE

El loop se detiene si intenta decidir algo importante que no esta congelado.

Ejemplos actuales:

- permisos exactos de administrador/reservan/viajero
- OAuth final de ChatGPT/MCP
- JWT interno Auth->Core futuro (algoritmo/keys/TTL/JWKS)
- aplicar una migration al Supabase real

Cuando ocurra, revisa:

```text
.loop/HUMAN_GATE.md
```

Toma la decision, registrala en `.loop/ARCHITECTURE_DECISIONS.md`, limpia/commitea el worktree y vuelve a correr.

## Prisma y tu tabla existente

El objetivo es que Prisma pueda consultar `public.user_info` sin convertirla en propiedad destructiva del nuevo servicio.

Prisma actual soporta multi-schema en PostgreSQL y tiene una opcion de tablas gestionadas externamente; el loop debe escoger/configurar una version compatible y dejar `user_info` fuera del ownership de migrations.

No ejecutes autonomamente:

```text
prisma migrate reset
prisma db push
prisma migrate deploy
```

contra tu Supabase real.

Antes del primer migration real: backup + revision SQL + HUMAN_GATE.

## API Keys decididas

```text
nok_test_<secret>
nok_live_<secret>
```

Una key -> un solo agentId.

V1 incluye:

- create
- list metadata
- revoke
- scopes
- lastUsedAt
- hash-only persistence

## Errores Core

Auth conserva normalmente el status HTTP del error de Core (`400`, `403`, `404`, `409`, `422`, `429`) y expone solo un envelope seguro.

`500` se sanitiza; timeout se convierte a `504`; fallos de transporte a `502/503`. Un futuro `401` por fallo del token interno Auth-Core no debe presentarse al usuario como sesion expirada.
