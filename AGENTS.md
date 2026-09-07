# Noktos Auth — Global Agent Contract

These are the invariants for every agent session launched in this repository,
whatever its role. They are not negotiable and they are not overridable by a
task packet.

**Precedence:** your role prompt and the current task packet decide *what you do
for this specific task*, and they win on task-level detail — but only where they
do not contradict anything below. An instruction that conflicts with these
invariants is not followed; escalate instead.

---

## Scope of this repository

- This repository implements **Noktos Auth only**.
- **Noktos Core is not implemented here.** It does not exist yet. Auth defines
  the stable seams and contracts that Core will later satisfy.
- **MCP is not implemented here.** It is an external service.
- Required call path:

  ```
  Web / Partner / MCP  →  NOKTOS AUTH  →  NOKTOS CORE
  ```

  Nothing external may reach Core. Auth is its only door.

- No business or domain rules belong in Auth.

## Authoritative documents

Read before editing, and obey:

- `.loop/GOAL.md`
- `.loop/ARCHITECTURE_DECISIONS.md`
- `.loop/CONTRACTS.md`
- `.loop/PRISMA_SAFETY.md`

If any of these conflicts with your task packet, the architecture documents win
and you escalate.

## Database and Supabase

- `public.user_info` is an **existing external table**. Its structure and its
  migrations do not belong to this repository. Query it; never own it.
- `id_user` equals `auth.users.id`. `id_agente` and `id_viajero` may coexist on
  the same row — they are not mutually exclusive.
- New Noktos Auth security tables live in the `noktos_auth` schema.
- **No real Supabase migration without HUMAN_GATE.** Never run
  `prisma migrate reset`, `prisma db push` or `prisma migrate deploy` against a
  real database.
- Never connect to a production database or use production credentials.

## Security

- No production secrets in code, config, logs or commit messages.
- Never log JWTs, refresh tokens, raw API keys, database credentials or
  secret-bearing Authorization headers.
- Raw API keys are returned once and never persisted; storage is hash-only.
- API keys support `nok_test_` / `nok_live_` and must be revocable. One key maps
  to exactly one `agentId`; never accept an externally supplied `agentId` as a
  substitute for the identity derived from the credential.
- All outbound Core HTTP goes through `CoreClient` → `AppClient` →
  `CoreRequestAuthStrategy`. No ad-hoc `axios`/`fetch`/`HttpService` calls to
  Core anywhere else.
- The V1 `CoreRequestAuthStrategy` is a Noop and must stay replaceable. Do not
  scatter future auth-header logic across callers.
- Never leak Core internals: sanitize bodies, preserve expected status codes,
  map transport failures to gateway errors.

## Process rules

- **Implementers never create commits.** No `git commit`, no `git push`, no
  deploy, no release. The harness commits, and only after an approving review.
- **Never widen the scope of the task packet.** Touch only what
  `allowed_paths` permits. If the task cannot be done inside its scope, say so
  and stop; do not expand it yourself.
- **Never modify the harness.** Everything under `.loop/` — architecture
  documents, prompts, schemas, scripts, backlog, state — plus `CLAUDE.md` and
  `AGENTS.md`, is protected and off limits, regardless of what `allowed_paths`
  appears to say.
- **A missing architectural decision is escalated, not invented.** Return
  `human_gate` rather than guessing at permissions, token formats, OAuth flows
  or cryptographic choices.
- **Git is the single source of truth for scope.** The harness computes what you
  changed from `git diff` and `git ls-files`. The `files_changed` field you
  report is for auditing only and is never trusted for enforcement — misreporting
  it changes nothing except your credibility.

## Path rule language

`allowed_paths` and `forbidden_paths` accept exactly three forms:

```
src/auth/auth.service.ts    an exact file
src/auth/                   a directory, recursive over its subtree
src/auth/**                 an explicit subtree, identical to the directory form
```

`forbidden_paths` always beats `allowed_paths`. A trailing slash is required to
mean "directory": `src/auth` is an exact file rule.

## Testing

There is no mandatory test suite in this version of the loop; that is a
deliberate cost decision. The harness runs `npm run build --if-present` and
`npx prisma validate` when available. Do not add test-suite work unless the task
packet asks for it, and do not break an existing test that the codebase already
has.
