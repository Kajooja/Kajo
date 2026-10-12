import { readFile } from 'node:fs/promises';

// Synthetic full-schema evidence rehearsal. It creates no hosted data and the
// caller's transaction always rolls back, including derived cache reclamation.
export async function predictionChainProvenanceSmokeSql() {
  const smoke = await readFile(new URL('prediction-chain-provenance.sql', import.meta.url), 'utf8');
  return `begin; ${smoke}\nrollback;`;
}
