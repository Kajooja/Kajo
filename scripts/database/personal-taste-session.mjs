import { readFile } from 'node:fs/promises';
const read = name => readFile(new URL(name, import.meta.url), 'utf8');
export const personalTasteSessionFixtureSql = () => read('personal-taste-session-fixture.sql');
export async function personalTasteSessionSmokeSql() {
  return `begin;\n${await personalTasteSessionFixtureSql()}\n${await read('personal-taste-session-smoke.sql')}\nrollback;`;
}
