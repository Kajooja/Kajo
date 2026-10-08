import assert from 'node:assert/strict';
import test from 'node:test';
import { execFileSync, spawnSync } from 'node:child_process';
import { chmod, copyFile, mkdir, mkdtemp, readFile, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { classifySupabaseStartFailure, verifyCiPostgresImage, verifyLocalPostgresImage,
  inspectOwnedSupabaseStack, withLocalSupabaseStack, runIsolatedSqlProbe } from './ci-supabase-stack.mjs';

async function mockedStackLifecycle(fixture) {
  const directory = await mkdtemp(join(tmpdir(), 'kajo-stack-lifecycle-'));
  try {
    const bin = join(directory, 'bin');
    await mkdir(bin);
    for (const name of ['ci-supabase-stack.mjs', 'buffered-sql-command.mjs']) {
      await copyFile(new URL(name, import.meta.url), join(directory, name));
    }
    const configuration = join(directory, 'fixture.json');
    const stateFile = join(directory, 'state.json'), logFile = join(directory, 'commands.jsonl');
    await writeFile(configuration, JSON.stringify({ startExit: 1, stopExit: 0, ...fixture }));
    await writeFile(stateFile, JSON.stringify({ owned: fixture.preexisting === true }));
    const stub = `#!${process.execPath}
      import fs from 'node:fs'; import path from 'node:path';
      const fixture=JSON.parse(fs.readFileSync(process.env.KAJO_STACK_FIXTURE,'utf8'));
      const stateFile=process.env.KAJO_STACK_STATE,logFile=process.env.KAJO_STACK_LOG;
      const state=JSON.parse(fs.readFileSync(stateFile,'utf8'));
      const args=process.argv.slice(2),command=path.basename(process.argv[1]);
      if(process.env.SUPABASE_ENV)throw new Error('Inherited Supabase dotenv must be cleared');
      fs.appendFileSync(logFile,JSON.stringify({command,args})+'\\n');
      const project='kajo_ci_unit_test';
      if(command==='npx'){
        const workspace=args[args.indexOf('--workdir')+1];
        if(args.includes('--version')) console.log('2.117.0');
        else if(args.includes('init')){
          if(fixture.initExit)process.exit(fixture.initExit);
          fs.mkdirSync(path.join(workspace,'supabase'),{recursive:true});
          fs.writeFileSync(path.join(workspace,'supabase/config.toml'),'project_id = "fixture"\\nmajor_version = 17\\n');
        }else if(args.includes('start')){
          fs.writeFileSync(stateFile,JSON.stringify({owned:true}));
          process.stdout.write(fixture.output??'');process.exit(fixture.startExit);
        }else if(args.includes('stop')){
          if(!fixture.stopResidual&&!fixture.stopExit)fs.writeFileSync(stateFile,JSON.stringify({owned:false}));
          process.stderr.write('synthetic-stop-private-secret');process.exit(fixture.stopExit);
        }else process.exit(90);
      }else if(command==='docker'){
        const labelled=args.includes('--filter');
        const ownedName=fixture.labelledName??('supabase_db_'+project);
        if(args.includes('ps')){
          if(fixture.listExit&&state.owned)process.exit(fixture.listExit);
          if(!labelled)console.log('supabase_db_kajo_ci_unrelated');
          if(state.owned)console.log(ownedName);
        }else if(args.includes('volume')){
          if(!labelled)console.log('supabase_db_kajo_ci_unrelated');if(state.owned)console.log(ownedName);
        }else if(args.includes('network')){
          if(!labelled)console.log('supabase_network_kajo_ci_unrelated');if(state.owned)console.log(fixture.labelledName??('supabase_network_'+project));
        }else if(args.includes('inspect')){
          const format=args[args.indexOf('--format')+1];
          if(format.includes('.Config.Image')) console.log('public.ecr.aws/supabase/postgres:17.6.1.167 sha256:66089200353d90686fe9b252a47d17d078364bf47c50190852c33dc850a0191f');
          else if(format==='{{.Id}}')console.log('synthetic-container-id');
          else console.log(JSON.stringify({status:'created',exitCode:125,oomKilled:false,error:'Bind for 0.0.0.0:54322 failed: port is already allocated synthetic-docker-private-secret',health:'unhealthy',bindings:{},requestedBindings:{'5432/tcp':[{HostIp:'127.0.0.1',HostPort:'54322'}]},Env:['synthetic-env-private-secret']}));
        }else process.exit(91);
      }else process.exit(92);
    `;
    for (const name of ['docker', 'npx']) {
      await writeFile(join(bin, name), stub);
      await chmod(join(bin, name), 0o700);
    }
    const driver = `import {withCiSupabaseStack} from './ci-supabase-stack.mjs';
      let workCalled=false;try{const result=await withCiSupabaseStack('kajo_ci_unit_test',()=>{
        workCalled=true;${fixture.workFailure ? "throw new Error('owned-work-error')" : "return 'owned-work-result'"}
      });console.log('RESULT '+JSON.stringify({ok:true,workCalled,result}));}
      catch(error){console.log('RESULT '+JSON.stringify({ok:false,workCalled,message:error.message,
        errors:error.errors?.map(e=>e.message),diagnostic:error.startDiagnostic??error.cause?.startDiagnostic}));}`;
    const output = execFileSync(process.execPath, ['--input-type=module', '-e', driver], {
      cwd: directory, encoding: 'utf8',
      env: { ...process.env, CI: 'true', GITHUB_ACTIONS: 'true', PATH: `${bin}:${process.env.PATH}`,
        SUPABASE_ENV: '/synthetic/external/environment',
        KAJO_STACK_FIXTURE: configuration, KAJO_STACK_STATE: stateFile, KAJO_STACK_LOG: logFile },
    });
    const commands = (await readFile(logFile, 'utf8')).trim().split('\n').map(line => JSON.parse(line));
    const workspaces = [...new Set(commands.filter(c => c.command === 'npx')
      .map(c => c.args[c.args.indexOf('--workdir') + 1]))];
    for (const workspace of workspaces) await assert.rejects(readFile(join(workspace, 'supabase/config.toml')), { code: 'ENOENT' });
    return { output, commands, result: JSON.parse(output.split('\n').find(line => line.startsWith('RESULT ')).slice(7)) };
  } finally { await rm(directory, { recursive: true, force: true }); }
}

test('CI accepts verified Supabase registry aliases but rejects changed content, version or registry', () => {
  const digest = 'sha256:66089200353d90686fe9b252a47d17d078364bf47c50190852c33dc850a0191f';
  for (const registry of ['public.ecr.aws', 'ghcr.io']) {
    assert.doesNotThrow(() => verifyCiPostgresImage(`${registry}/supabase/postgres:17.6.1.167 ${digest}`));
  }
  assert.throws(() => verifyCiPostgresImage(`public.ecr.aws/supabase/postgres:17.6.1.167 ${digest.replace('660892', '000000')}`), /content changed/);
  assert.throws(() => verifyCiPostgresImage(`ghcr.io/supabase/postgres:latest ${digest}`), /Unreviewed/);
  assert.throws(() => verifyCiPostgresImage(`unreviewed.invalid/supabase/postgres:17.6.1.167 ${digest}`), /Unreviewed/);
});

test('failed startup reports bounded symptoms without echoing CLI credentials', () => {
  const privateOutput = 'postgresql://postgres:synthetic-secret@localhost/postgres key=synthetic-key';
  assert.deepEqual(classifySupabaseStartFailure(`failed to pull image: connection reset ${privateOutput}`), ['image-download', 'network']);
  assert.deepEqual(classifySupabaseStartFailure(`port is already allocated ${privateOutput}`), ['port-binding']);
  assert.deepEqual(classifySupabaseStartFailure(`container is unhealthy: no space left ${privateOutput}`), ['container-health', 'resource-pressure']);
  assert.deepEqual(classifySupabaseStartFailure(privateOutput), ['unclassified']);
  assert.deepEqual(classifySupabaseStartFailure(''), ['unclassified']);
});

test('pinned CLI pull warnings and fatal port conflicts stay distinct; startup is never replayed', async () => {
  const { output, result, commands } = await mockedStackLifecycle({
    output: 'failed to pull image: synthetic-cli-private-secret\nRetry succeeded\n'
      + 'failed to start docker container "supabase_db_kajo_ci_unit_test": '
      + 'Error response from daemon: Bind for 0.0.0.0:54322 failed: port is already allocated\n',
  });
  assert.equal(result.ok, false);
  assert.equal(result.workCalled, false, 'No application SQL/work can follow failed startup');
  assert.deepEqual(result.diagnostic.outputSignals, ['image-download', 'port-binding']);
  assert.deepEqual(result.diagnostic.terminalFailures, [{ stage: 'container-start', condition: 'port-conflict' }]);
  assert.equal(result.diagnostic.terminalStatus, 'SINGLE');
  assert.equal(result.diagnostic.cause, 'UNCONFIRMED');
  assert.equal(result.diagnostic.recovery, 'NOT_RETRIED');
  assert.equal(result.diagnostic.attemptCount, 1);
  assert.equal(result.diagnostic.deadlineMs, 720_000);
  assert.equal(result.diagnostic.exitCode, 1);
  assert.deepEqual(result.diagnostic.ownedDocker, {
    containerCount: 1, volumeCount: 1, networkCount: 1, truncated: false, inspectionFailures: [],
    containers: [{ service: 'db', status: 'created', health: 'unhealthy', exitCode: 125, oomKilled: false,
      errorSignals: ['port-binding'], bindings: [],
      requestedBindings: [{ containerPort: 5432, protocol: 'tcp', hostPort: 54322, hostAddress: 'loopback' }] }],
  });
  assert.equal(commands.filter(c => c.command === 'npx' && c.args.includes('start')).length, 1);
  assert.equal(commands.filter(c => c.command === 'npx' && c.args.includes('stop')).length, 1);
  assert.ok(commands.filter(c => c.command === 'npx' && c.args.includes('stop'))
    .every(c => c.args[c.args.indexOf('--project-id') + 1] === 'kajo_ci_unit_test'));
  assert.ok(commands.filter(c => c.command === 'docker' && c.args.includes('--filter'))
    .every(c => c.args[c.args.indexOf('--filter') + 1] === 'label=com.supabase.cli.project=kajo_ci_unit_test'));
  assert.ok(commands.filter(c => c.command === 'docker' && c.args.includes('inspect'))
    .every(c => c.args.at(-1) === 'supabase_db_kajo_ci_unit_test'));
  assert.ok(commands.every(c => !c.args.includes('--all') && !c.args.includes('--ignore-health-check')));
  assert.doesNotMatch(output, /synthetic-(?:cli|docker|env|health|stop)-private-secret/);
});

test('ambiguous/permanent/unclassified startup errors stay failed, sanitized and single-attempt', async () => {
  for (const [output, terminalFailures, terminalStatus] of [
    ['failed to pull docker image from all registries: pull access denied synthetic-cli-private-secret',
      [{ stage: 'image-pull', condition: 'all-registries-failed' }], 'SINGLE'],
    ['failed to pull docker image from all registries: manifest unknown\n'
      + 'failed to start docker container "private-name": exit 1',
    [{ stage: 'image-pull', condition: 'all-registries-failed' }, { stage: 'container-start', condition: 'unspecified' }], 'MULTIPLE'],
    ['failed to pull: connection reset\nBind for unrelated-service failed: port is already allocated\n'
      + 'failed to start docker container "private-name": exit 1',
    [{ stage: 'container-start', condition: 'unspecified' }], 'SINGLE'],
    ['postgresql://postgres:synthetic-cli-private-secret@localhost/postgres', [], 'UNCLASSIFIED'],
    ['failed to start docker container "private-name"', [{ stage: 'container-start', condition: 'unspecified' }], 'SINGLE'],
    ['', [], 'UNCLASSIFIED'],
  ]) {
    const run = await mockedStackLifecycle({ output });
    assert.deepEqual(run.result.diagnostic.terminalFailures, terminalFailures);
    assert.equal(run.result.diagnostic.terminalStatus, terminalStatus);
    assert.equal(run.result.diagnostic.recovery, 'NOT_RETRIED');
    assert.equal(run.result.workCalled, false);
    assert.equal(run.commands.filter(c => c.command === 'npx' && c.args.includes('start')).length, 1);
    assert.doesNotMatch(run.output, /synthetic-cli-private-secret|private-name/);
  }
});

test('startup and cleanup failures are both retained and the owned workspace is always removed', async () => {
  const run = await mockedStackLifecycle({ output: 'failed to pull image: synthetic-cli-private-secret', stopExit: 2 });
  assert.equal(run.result.ok, false);
  assert.equal(run.result.errors.length, 3, 'Primary startup, failed stop and observed residuals are separate');
  assert.match(run.result.errors[0], /Supabase startup failed/);
  assert.match(run.result.errors[1], /npx stop failed with exit 2/);
  assert.match(run.result.errors[2], /cleanup resource check failed.*"containerCount":1/);
  assert.match(run.result.message, /primary=.*startup failed.*cleanup=.*stop failed.*cleanup=.*resource check failed/);
  assert.doesNotMatch(run.output, /synthetic-(?:cli|docker|stop)-private-secret/);
});

test('successful stop must prove absence, and work failures survive a cleanup failure', async () => {
  const residual = await mockedStackLifecycle({ startExit: 0, stopResidual: true });
  assert.equal(residual.result.workCalled, true);
  assert.equal(residual.result.ok, false);
  assert.match(residual.result.message, /cleanup resource check failed/);
  const work = await mockedStackLifecycle({ startExit: 0, workFailure: true, stopExit: 2 });
  assert.equal(work.result.workCalled, true);
  assert.match(work.result.errors[0], /^owned-work-error$/);
  assert.match(work.result.errors[1], /npx stop failed/);
  const success = await mockedStackLifecycle({ startExit: 0 });
  assert.equal(success.result.ok, true);
  assert.equal(success.result.result.cleanup, 'PASS');
});

test('setup failures remove only a created workspace; preexisting labelled resources are never reused or stopped', async () => {
  const init = await mockedStackLifecycle({ initExit: 3 });
  assert.match(init.result.message, /npx init failed with exit 3/);
  assert.ok(init.commands.every(c => !c.args.includes('start') && !c.args.includes('stop')));
  const existing = await mockedStackLifecycle({ preexisting: true, labelledName: 'synthetic-owned-private-name' });
  assert.match(existing.result.message, /preflight resource check failed.*"containerCount":1/);
  assert.ok(existing.commands.every(c => c.command !== 'npx'));
  assert.doesNotMatch(existing.output, /synthetic-owned-private-name/);
});

test('failed Docker observation does not replace startup failure or fabricate empty owned state', async () => {
  const run = await mockedStackLifecycle({ output: 'synthetic-cli-private-secret', listExit: 4 });
  assert.equal(run.result.ok, false);
  assert.equal(run.result.diagnostic.ownedDocker.containerCount, null);
  assert.deepEqual(run.result.diagnostic.ownedDocker.inspectionFailures, ['container-list']);
  assert.match(run.result.message, /startup failed/);
  assert.doesNotMatch(run.output, /synthetic-cli-private-secret/);
});

test('owned Docker diagnostics are bounded, sanitize unknown values and ignore unrelated project resources', () => {
  const project = 'kajo_ci_unit_test';
  const docker = (args, options) => {
    assert.ok(options.timeout <= 5000);
    if (args.includes('inspect')) return JSON.stringify({ status: 'synthetic-private-secret',
      health: 'synthetic-private-secret', exitCode: 999, error: 'synthetic-private-secret',
      bindings: { '5432/tcp': [{ HostIp: 'synthetic-private-secret', HostPort: '54322' }],
        'private-secret/tcp': [{ HostIp: '127.0.0.1', HostPort: 'invalid' }] } });
    return args.includes('--filter') ? 'unusual-owned-private-name' : `supabase_db_${project}\nsupabase_db_kajo_ci_unrelated`;
  };
  const value = inspectOwnedSupabaseStack(project, docker);
  assert.equal(value.containerCount, 2);
  assert.equal(value.containers[0].status, 'unknown');
  assert.equal(value.containers[0].health, 'unknown');
  assert.equal(value.containers[0].exitCode, null);
  assert.equal(value.containers[0].bindings[0].hostAddress, 'other');
  assert.equal(value.containers[1].service, 'unknown');
  assert.doesNotMatch(JSON.stringify(value), /synthetic-private-secret|unusual-owned-private-name|kajo_ci_unrelated/);
  const large = inspectOwnedSupabaseStack(project, args => args.includes('inspect') ? '{}'
    : args.includes('--filter') ? Array.from({ length: 30 }, (_, index) => `private-owned-${index}`).join('\n') : '');
  assert.equal(large.containerCount, 30);
  assert.equal(large.containers.length, 24);
  assert.equal(large.truncated, true);
  assert.doesNotMatch(JSON.stringify(large), /private-owned/);
});

test('local installation requires a new absolute workspace and the reviewed architecture image', async () => {
  await assert.rejects(withLocalSupabaseStack('relative-path', () => {}), /absolute path/);
  const mac = 'public.ecr.aws/supabase/postgres:17.6.1.167 sha256:6942962433a569e87f228b4d4ab7e11db5deca64e43babb3a038443ad6c4f1bb';
  assert.doesNotThrow(() => verifyLocalPostgresImage(mac, 'darwin', 'arm64'));
  assert.throws(() => verifyLocalPostgresImage(mac, 'linux', 'x64'), /content changed/);
  assert.throws(() => verifyLocalPostgresImage(mac, 'linux', 'arm64'), /No reviewed/);
});

test('platform-only stack lifecycle loads without application source modules or npm dependencies', async () => {
  const directory = await mkdtemp(join(tmpdir(), 'kajo-platform-module-'));
  try {
    for (const name of ['ci-supabase-stack.mjs', 'buffered-sql-command.mjs']) {
      await copyFile(new URL(name, import.meta.url), join(directory, name));
    }
    execFileSync(process.execPath, ['--input-type=module', '-e', "await import('./ci-supabase-stack.mjs')"],
      { cwd: directory, stdio: 'pipe' });
  } finally { await rm(directory, { recursive: true, force: true }); }
});

test('named SQL probes preserve input, bound both server and client, and retain SQL failures', async () => {
  const directory = await mkdtemp(join(tmpdir(), 'kajo-sql-budget-'));
  try {
    const receiver = join(directory, 'receiver.mjs');
    await writeFile(receiver, `import {readFileSync} from 'node:fs';
      const sql=readFileSync(process.argv.find(a=>a.startsWith('--file=')).slice(7),'utf8');
      console.log(JSON.stringify({sql}));`);
    const sql = "begin; -- äö $() ` ' \n rollback;";
    let requested;
    const docker = (args, options) => {
      requested = { args, options };
      const command = args.slice(args.indexOf('sh'));
      command.splice(command.indexOf('psql'), 1, process.execPath, receiver);
      return execFileSync(command[0], command.slice(1), { input: options.input, timeout: options.timeout, encoding: 'utf8' });
    };
    assert.deepEqual(await runIsolatedSqlProbe(docker, 'owned-container', sql,
      { stage: 'catalog-chain-upgrade', timeoutMs: 360_000 }), [{ sql }]);
    assert.equal(requested.options.timeout, 360_000);
    assert.ok(requested.args.includes('PGOPTIONS=-c statement_timeout=355000 -c lock_timeout=30000'));
    assert.ok(requested.args.includes('owned-container'));
    await runIsolatedSqlProbe(docker, 'owned-container', sql);
    assert.equal(requested.options.timeout, 120_000, 'Existing probes retain the original bounded default');
    assert.ok(requested.args.includes('PGOPTIONS=-c statement_timeout=115000 -c lock_timeout=30000'));
    await assert.rejects(runIsolatedSqlProbe(() => { throw new Error('ERROR: source hash guard rejected'); },
      'owned-container', sql, { stage: 'catalog-chain-upgrade' }), /catalog-chain-upgrade failed: ERROR: source hash guard rejected/);
  } finally { await rm(directory, { recursive: true, force: true }); }
});

test('a real SQL client deadline identifies its stage without leaking input or process diagnostics', async () => {
  const sql = 'synthetic-private-sql';
  const docker = (_args, options) => {
    assert.ok(_args.includes('PGOPTIONS=-c statement_timeout=500 -c lock_timeout=30000'));
    const result = spawnSync(process.execPath, ['-e', 'setTimeout(() => {}, 5000)'],
      { input: options.input, timeout: options.timeout, encoding: 'utf8' });
    if (result.error) throw result.error;
    return result.stdout;
  };
  await assert.rejects(runIsolatedSqlProbe(docker, 'owned-container', sql,
    { stage: 'catalog-chain-upgrade', timeoutMs: 1000 }), error => {
    assert.equal(error.message, 'Isolated SQL catalog-chain-upgrade exceeded Docker deadline 1000ms');
    assert.equal(error.cause.code, 'ETIMEDOUT');
    assert.ok(!error.message.includes(sql));
    return true;
  });
  for (const options of [{ stage: 'secret query text' }, { timeoutMs: 600_001 }, { timeoutMs: Infinity }, { timeoutMs: 0 }]) {
    await assert.rejects(runIsolatedSqlProbe(() => assert.fail('Invalid options must not start a process'),
      'owned-container', sql, options));
  }
});
