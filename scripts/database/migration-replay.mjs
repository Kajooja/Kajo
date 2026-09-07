// Offline diagnostic only: PGlite is not the Supabase platform/Auth stack.
// Execute whole migration files unchanged, in order, stopping at the first error.
import { readdir, readFile } from 'node:fs/promises';
import { PGlite } from '@electric-sql/pglite';

const db = new PGlite();
const migrations = new URL('../../supabase/migrations/', import.meta.url);
let applied = 0;
try {
  await db.exec(`
    create role anon;
    create role authenticated;
    create role service_role;
    create schema auth;
    create table auth.users (
      id uuid primary key, email text, raw_user_meta_data jsonb default '{}'
    );
    create function auth.uid() returns uuid language sql stable as $$
      select nullif(current_setting('request.jwt.claim.sub', true), '')::uuid;
    $$;
    -- Signature-only platform fixture. No claim of platform RLS-trigger testing.
    create function public.rls_auto_enable() returns event_trigger
      language plpgsql as $$ begin return; end; $$;
  `);
  const names = (await readdir(migrations)).filter(name => /^\d{14}_.+\.sql$/.test(name)).sort();
  if (names.length === 0) throw new Error('No migration files found');
  for (const name of names) {
    const sql = await readFile(new URL(name, migrations), 'utf8');
    try {
      await db.exec('begin');
      await db.exec(sql);
      await db.exec('commit');
      applied++;
    } catch (error) {
      await db.exec('rollback');
      console.error(JSON.stringify({ status: 'BLOCKED', engine: 'PGlite offline fixture', applied,
        migration: name, code: error.code, message: error.message }, null, 2));
      process.exitCode = 1;
      break;
    }
  }
  if (!process.exitCode) console.log(JSON.stringify({ status: 'PASS', applied,
    scope: 'Unmodified SQL replay in PGlite fixtures; Supabase platform acceptance still required' }));
} finally {
  await db.close();
}
