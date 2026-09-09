-- Per-schema REVOKE cannot remove PostgreSQL's global PUBLIC EXECUTE default.
-- This changes FUTURE functions created by postgres, not any existing function.
-- The global control also applies outside application schemas; explicit defaults
-- in other schemas and defaults belonging to platform creator roles stay intact.
-- Future postgres-created platform/extension functions need their intended grants.
alter default privileges for role postgres
  revoke execute on functions from public, anon, authenticated, service_role;

-- Clear schema-level additions as well, including defaults on a fresh Supabase
-- stack. Every new application RPC/helper must grant its intended callers.
alter default privileges for role postgres in schema public, private
  revoke execute on functions from public, anon, authenticated, service_role;
