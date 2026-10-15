import { readFile } from 'node:fs/promises';
import { personalTasteSessionFixtureSql } from './personal-taste-session.mjs';

export async function personalEvaluationSmokeSql(){
  return `begin;\n${await personalTasteSessionFixtureSql()}\n${await readFile(new URL('personal-evaluation-scoring-smoke.sql',import.meta.url),'utf8')}\nrollback;`;
}
