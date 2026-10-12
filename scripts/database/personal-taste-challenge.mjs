import { readFile } from 'node:fs/promises';
import { personalTasteSessionFixtureSql } from './personal-taste-session.mjs';
const read=name=>readFile(new URL(name,import.meta.url),'utf8');
export async function personalTasteChallengeFixtureSql(){
  return `${await personalTasteSessionFixtureSql()}\n${await read('personal-taste-challenge-fixture.sql')}`;
}
export async function personalTasteChallengeSmokeSql(){
  return `begin;\n${await personalTasteChallengeFixtureSql()}\n${await read('personal-taste-challenge-smoke.sql')}\nrollback;`;
}
