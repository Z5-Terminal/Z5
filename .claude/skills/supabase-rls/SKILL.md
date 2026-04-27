---
name: supabase-rls
description: "Generate Supabase migration SQL files with proper Row Level Security (RLS) policies for the Z5 project. Use this skill whenever creating new tables, adding columns, writing RLS policies, creating storage policies, or when the user mentions 'RLS', 'migration', 'policy', 'schema', 'security', or 'DELETE policy'. Also trigger when adding any delete functionality to the frontend — Supabase silently returns 0 rows when a DELETE policy is missing, which is the most common bug pattern in this project."
---

# Z5 Supabase RLS Migration Skill

This skill helps you write correct Supabase migration SQL for the Z5 project. The most dangerous bug pattern in this codebase is a **missing DELETE policy** — Supabase RLS silently returns 0 affected rows instead of raising an error, so the app looks like it works but nothing actually gets deleted. This skill exists to prevent that.

## Project context

The Z5 app uses Supabase (PostgreSQL + Auth + RLS + Realtime + Storage). Key facts:

- Auth uses `auth.uid()` to identify the current user
- Profiles table links `auth.uid()` to a role and squad
- Helper functions already exist — reuse them:
  - `public.current_role()` — returns the user's role string (`'admin'`, `'officer'`, `'squad_leader'`, `'instructor'`, `'sniper'`)
  - `public.squad_can_edit_knowledge()` — returns boolean, checks if user's squad has `can_edit_knowledge = true`
- Roles hierarchy (most → least privileged): `admin`, `officer`, `squad_leader`, `instructor`, `sniper`
- Schema migration files are named `schema_v{N}.sql` in the project root
- Schema files should NOT be committed to the public git repo

## Migration file template

Every migration file follows this structure:

```sql
-- ============================================================
-- Z5 SCHEMA v{N} — {Brief description}
-- Run in Supabase SQL Editor after schema_v{N-1}.
--
-- IMPORTANT: Run this ENTIRE script each time you update it.
-- ============================================================

-- 1. {First change description}
{SQL statements}

-- 2. {Second change description}
{SQL statements}
```

Number each logical section. Keep comments terse but clear.

## RLS policy checklist

When creating or modifying a table, ensure you have policies for **every operation the app performs**. Go through each CRUD operation:

1. **SELECT** — Who can read rows? Usually all authenticated users, sometimes scoped to squad or role.
2. **INSERT** — Who can create rows? Check the UI — which roles see the "create" button?
3. **UPDATE** — Who can modify rows? Usually the row owner + admin/officer.
4. **DELETE** — Who can delete rows? **This is the one people forget.** If the UI has a delete button, you need a DELETE policy. Without it, deletes silently return 0 rows — no error, no deletion.

### Policy naming convention

Use descriptive names: `{table}_{operation}_{who}`, e.g.:
- `missions_select_authenticated`
- `missions_delete_admin_officer`
- `knowledge_write_admin` (when using `for all`)

### Common policy patterns

**Read access for all authenticated users:**
```sql
create policy {table}_select_authenticated on {table} for select
  to authenticated using (true);
```

**Write access for privileged roles:**
```sql
create policy {table}_write_privileged on {table} for all
  to authenticated
  using (public.current_role() in ('admin', 'officer'))
  with check (public.current_role() in ('admin', 'officer'));
```

**Squad-scoped access:**
```sql
create policy {table}_select_squad on {table} for select
  to authenticated
  using (
    squad_id in (select squad_id from profiles where id = auth.uid())
    or public.current_role() in ('admin', 'officer')
  );
```

**Owner + admin access:**
```sql
create policy {table}_update_owner on {table} for update
  to authenticated
  using (
    created_by = auth.uid()
    or public.current_role() in ('admin', 'officer')
  )
  with check (
    created_by = auth.uid()
    or public.current_role() in ('admin', 'officer')
  );
```

### The `for all` shortcut

`for all` covers SELECT, INSERT, UPDATE, and DELETE in a single policy. Convenient but be careful — it means the same permission applies to all four operations. If read permissions differ from write/delete permissions, use separate policies.

### Storage bucket policies

When creating storage policies for `storage.objects`, always include all three:

```sql
-- Upload
create policy {bucket}_storage_insert on storage.objects for insert
  to authenticated
  with check (
    bucket_id = '{bucket_name}'
    and public.current_role() in ('admin', 'officer')
  );

-- Download / view
create policy {bucket}_storage_select on storage.objects for select
  to authenticated
  using (bucket_id = '{bucket_name}');

-- Remove files
create policy {bucket}_storage_delete on storage.objects for delete
  to authenticated
  using (
    bucket_id = '{bucket_name}'
    and public.current_role() in ('admin', 'officer')
  );
```

## SECURITY DEFINER functions

When you need to bypass RLS (e.g., an RPC that reads across squads), use `security definer`:

```sql
create or replace function public.my_function(args)
returns {type}
language sql stable security definer set search_path = public as $$
  {query}
$$;
```

The `set search_path = public` prevents search path injection — always include it.

## Generating a migration

When the user asks for a new migration or new table:

1. Determine the next version number — check existing `schema_v*.sql` files
2. Write the SQL following the template above
3. **Explicitly check for DELETE policies** — if the table has any delete functionality in the UI, ensure there's a DELETE policy or a `for all` policy that covers it
4. If modifying existing policies, use `drop policy if exists` before `create policy`
5. For new columns, use `add column if not exists` for idempotency
6. Save the file as `schema_v{N}.sql` in the project root
7. Remind the user: "Run this in the Supabase SQL Editor. Don't commit schema files to the public repo."

## DELETE policy warning

Any time you see delete functionality being added to the frontend (a delete button, a "remove" action, a trash icon), immediately check whether the corresponding DELETE RLS policy exists. If it doesn't, warn prominently:

> ⚠ **Missing DELETE policy**: The `{table}` table has no DELETE policy. Supabase will silently return 0 rows on delete attempts — the UI will show no error but nothing will be removed. Add a DELETE policy before shipping this feature.

This is the single most common RLS bug in this project. Always check for it.
