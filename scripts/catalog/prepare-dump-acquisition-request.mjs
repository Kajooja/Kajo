#!/usr/bin/env node
// Local key custody and recovery. Never invoke key generation on a public runner.
import { generateKeyPairSync } from 'node:crypto';
import { lstat, mkdir, open, writeFile } from 'node:fs/promises';
import { join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { parseArgs } from 'node:util';
import { ACQUISITION_RELEASE, validateAcquisitionRoster } from './acquire-open-library-dumps.mjs';
import { validateDumpTargets } from './open-library-dump-descriptions.mjs';
import { digest, requireValue } from './open-library-descriptions.mjs';
import { MAX_PLAINTEXT_BYTES, REQUEST_CONTRACT, REQUEST_LIMITS, recipientFingerprint,
  unsealAcquisition, validateAcquisitionRequest } from './seal-dump-acquisition.mjs';

export async function readLocalFile(path, maximum, privateFile = false) {
  const info = await lstat(path);
  requireValue(info.isFile() && !info.isSymbolicLink() && info.size <= maximum
    && (!privateFile || (info.mode & 0o077) === 0), 'invalid-acquisition-local-file');
  const handle = await open(path, 'r');
  try {
    const buffer = Buffer.alloc(maximum + 1);
    let bytes = 0;
    while (bytes < buffer.length) {
      const chunk = await handle.read(buffer, bytes, buffer.length - bytes, null);
      if (!chunk.bytesRead) break;
      bytes += chunk.bytesRead;
    }
    requireValue(bytes <= maximum, 'invalid-acquisition-local-file');
    return new TextDecoder('utf-8', { fatal: true }).decode(buffer.subarray(0, bytes));
  } finally { await handle.close(); }
}

export async function prepareRecipient(directory) {
  requireValue(!process.env.GITHUB_ACTIONS, 'acquisition-local-operation-only');
  await mkdir(directory, { mode: 0o700 });
  const keys = generateKeyPairSync('rsa', { modulusLength: 3072,
    publicKeyEncoding: { type: 'spki', format: 'pem' }, privateKeyEncoding: { type: 'pkcs8', format: 'pem' } });
  const fingerprint = recipientFingerprint(keys.publicKey);
  await writeFile(join(directory, 'recipient-private.pem'), keys.privateKey, { flag: 'wx', mode: 0o600 });
  await writeFile(join(directory, 'recipient-public.pem'), keys.publicKey, { flag: 'wx', mode: 0o600 });
  await writeFile(join(directory, 'recipient-fingerprint.json'), JSON.stringify({ fingerprint }) + '\n',
    { flag: 'wx', mode: 0o600 });
  return { status: 'prepared', recipientFingerprint: fingerprint };
}

export function prepareAcquisitionRequest(snapshot, sourceHead, recipientPublicKey) {
  const roster = validateAcquisitionRoster(validateDumpTargets(snapshot).map(({ workId, editionId }) => ({ workId, editionId })));
  const body = { contract: REQUEST_CONTRACT, release: ACQUISITION_RELEASE, sourceHead, roster,
    limits: { ...REQUEST_LIMITS }, recipientPublicKey, recipientFingerprint: recipientFingerprint(recipientPublicKey) };
  return validateAcquisitionRequest({ ...body, requestSha256: digest(body) });
}

export async function runPrepareCli(args = process.argv.slice(2)) {
  requireValue(!process.env.GITHUB_ACTIONS, 'acquisition-local-operation-only');
  const { positionals, values } = parseArgs({ args, allowPositionals: true, options:
    Object.fromEntries(['out', 'snapshot', 'source-head', 'key-dir', 'request', 'input'].map(key => [key, { type: 'string' }])) });
  const command = positionals[0];
  const required = { keys: ['out'], request: ['snapshot', 'source-head', 'key-dir', 'out'],
    unseal: ['request', 'key-dir', 'input', 'out'] }[command];
  requireValue(positionals.length === 1 && required && required.every(key => values[key])
    && Object.keys(values).every(key => required.includes(key)), 'invalid-acquisition-local-command');
  let result;
  if (command === 'keys') result = await prepareRecipient(values.out);
  if (command === 'request') {
    const snapshot = JSON.parse(await readLocalFile(values.snapshot, 2 * 1024 * 1024));
    const publicKey = await readLocalFile(join(values['key-dir'], 'recipient-public.pem'), 2048);
    const request = prepareAcquisitionRequest(snapshot, values['source-head'], publicKey);
    await writeFile(values.out, JSON.stringify(request, null, 2) + '\n', { flag: 'wx', mode: 0o600 });
    result = { status: 'prepared', requestSha256: request.requestSha256,
      recipientFingerprint: request.recipientFingerprint, targets: request.roster.length };
  }
  if (command === 'unseal') {
    const request = JSON.parse(await readLocalFile(values.request, 256 * 1024));
    const envelope = JSON.parse(await readLocalFile(values.input, 2 * MAX_PLAINTEXT_BYTES));
    const privatePem = await readLocalFile(join(values['key-dir'], 'recipient-private.pem'), 4096, true);
    const collected = unsealAcquisition(envelope, request, privatePem);
    await mkdir(values.out, { mode: 0o700 });
    await writeFile(join(values.out, 'collected.json'), JSON.stringify(collected), { flag: 'wx', mode: 0o600 });
    result = { status: 'recovered', payloadKind: envelope.header.payloadKind, requestSha256: request.requestSha256,
      plaintextSha256: envelope.header.plaintextSha256, targets: request.roster.length,
      ...(collected.coverage ? { coverage: collected.coverage } : {}) };
  }
  console.log(JSON.stringify(result));
}

if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  runPrepareCli().catch(() => { console.error(JSON.stringify({ status: 'failed', code: 'acquisition-local-operation-failed' })); process.exitCode = 1; });
}
