# PRISMA / SUPABASE SAFETY POLICY

## Existing production data

`public.user_info` already exists and contains live identity mapping.

The engineering loop must never assume it owns this table.

## Allowed

- define a Prisma model mapped to `public.user_info`
- read from it at runtime
- use Prisma multi-schema for `public` and `noktos_auth`
- mark `public.user_info` as external to Prisma Migrate when supported/configured safely
- create migrations/files for new `noktos_auth` objects locally
- run `prisma validate`
- run `prisma generate`

## Forbidden in autonomous loop

- `prisma migrate reset`
- `prisma db push` against Supabase real
- `prisma migrate deploy` against Supabase real
- DROP/ALTER of `public.user_info`
- changing its existing constraints without HUMAN_GATE
- deleting/truncating any Supabase table

## Live DB credentials

Do not commit them.

Prefer that the autonomous loop runs without production Supabase DB credentials in its process environment. Applying real migrations is a human-controlled operation after backup/review.

## Before first real migration

Human checklist:

1. Verify backup/snapshot exists.
2. Review generated SQL.
3. Confirm it only creates/changes `noktos_auth` objects intended by the change.
4. Confirm `public.user_info` is untouched.
5. Apply manually or via approved CI path.
