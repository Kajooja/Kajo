import assert from 'node:assert/strict';
import test from 'node:test';
import { verifyCiPostgresImage } from './ci-supabase-stack.mjs';

test('CI accepts verified Supabase registry aliases but rejects changed content, version or registry', () => {
  const digest = 'sha256:66089200353d90686fe9b252a47d17d078364bf47c50190852c33dc850a0191f';
  for (const registry of ['public.ecr.aws', 'ghcr.io']) {
    assert.doesNotThrow(() => verifyCiPostgresImage(`${registry}/supabase/postgres:17.6.1.167 ${digest}`));
  }
  assert.throws(() => verifyCiPostgresImage(`public.ecr.aws/supabase/postgres:17.6.1.167 ${digest.replace('660892', '000000')}`), /content changed/);
  assert.throws(() => verifyCiPostgresImage(`ghcr.io/supabase/postgres:latest ${digest}`), /Unreviewed/);
  assert.throws(() => verifyCiPostgresImage(`unreviewed.invalid/supabase/postgres:17.6.1.167 ${digest}`), /Unreviewed/);
});
