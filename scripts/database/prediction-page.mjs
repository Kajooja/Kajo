import { readFile } from 'node:fs/promises';

export async function predictionPageSmokeSql() {
  const fixture = await readFile(new URL('candidate-pool-fixture.sql', import.meta.url), 'utf8');
  const smoke = await readFile(new URL('prediction-page-smoke.sql', import.meta.url), 'utf8');
  return `begin; ${fixture}\n${smoke}\nrollback;`;
}
