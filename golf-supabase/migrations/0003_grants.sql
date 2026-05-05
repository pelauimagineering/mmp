-- 0003_grants.sql — explicit role grants.
--
-- Apply AFTER 0002_rpc.sql.
--
-- In newer Supabase projects (especially those using the
-- sb_publishable_* / sb_secret_* key format) the service_role and
-- anon roles do NOT automatically inherit privileges on user-created
-- tables, so the seed script and SPA both fail with 42501 (permission
-- denied) until these GRANTs run.
--
-- RLS still gates row-level access — these grants only open the
-- door at the table level. anon can still only SELECT (RLS allows
-- nothing else), and service_role bypasses RLS as designed.

-- service_role: full DML on every table for the seed script and any
-- future admin tooling. Bypasses RLS.
grant select, insert, update, delete on all tables in schema public to service_role;
grant usage, select, update on all sequences in schema public to service_role;

-- anon: read-only on the public-facing tables. RLS in 0002_rpc.sql
-- already declared SELECT policies; these GRANTs make sure the role
-- can actually reach the table to apply them.
grant select on public.players, public.seasons, public.rounds, public.results to anon;

-- anon must also be able to call the write RPC. The function is
-- SECURITY DEFINER so it runs with definer privileges — the GRANT
-- below just lets anon invoke it.
grant execute on function public.enter_round(text, jsonb) to anon;

-- _secret stays unreachable for anon (no GRANT). The enter_round()
-- function reads it via SECURITY DEFINER.

-- Make future tables in this schema follow the same pattern, so a
-- later migration that adds, say, a `notes` table doesn't trip the
-- same 42501 again.
alter default privileges in schema public
  grant select, insert, update, delete on tables to service_role;
alter default privileges in schema public
  grant usage, select, update on sequences to service_role;
