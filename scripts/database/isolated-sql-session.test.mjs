import assert from 'node:assert/strict';
import test from 'node:test';
import { withIsolatedSqlSession } from './isolated-sql-session.mjs';

// Actual child process/pipe framing; this fixture deliberately does not pretend
// to execute SQL. PostgreSQL transaction/locking semantics are tested natively.
const fixture = String.raw`
  import { createInterface } from 'node:readline';
  const input = createInterface({ input: process.stdin });
  let text = '', sequence = 0;
  const emit = (marker, command) => {
    if (command === 'EXIT') {
      process.stderr.write('ERROR: synthetic-private-sql-secret');process.exit(1);
    }
    if (command === 'STATE_ERROR') {
      process.stderr.write('ERROR:  55000\n');process.exit(1);
    }
    if (command === 'BAD') { process.stdout.write('synthetic-private-json-secret\n' + marker + '\n');return; }
    if (command === 'HOLD') return;
    const rows = command === 'EMPTY' ? [] : [{ pid:process.pid, sequence:++sequence, value:'Åä漢字' }];
    if (command === 'MULTI') rows.push({ second:true });
    const output = Buffer.from(rows.map(row=>JSON.stringify(row)+'\n').join('') + marker + '\n');
    const send = () => {
      // Split both UTF-8 codepoints and the unpredictable marker across chunks.
      let at = 0;
      const part = () => { if (at < output.length) {
        process.stdout.write(output.subarray(at, at+1));at++;setImmediate(part);
      }};part();
    };
    if (command === 'DELAY') setTimeout(send, 75);else send();
  };
  input.on('line', line => {
    if (line === '\\q') process.exit(0);
    else if (line.startsWith('\\echo ')) {
      // Match psql's relevant buffering behavior: the meta-command can print
      // before unterminated SQL executes. Keep that unexecuted query buffered.
      const command=text.trim();
      if (!command.endsWith(';')) { process.stdout.write(line.slice(6)+'\n');return; }
      text='';emit(line.slice(6),command.replace(/(?:;\s*)+$/,'').trim());
    }
    else text += line+'\n';
  });
  input.on('close', () => process.exit(0));
`;
const session = (work, options = {}) => withIsolatedSqlSession(process.execPath,
  ['--input-type=module', '-e', fixture], { stage:'process-test', timeoutMs:5000, ...options }, work);
const gone = pid => assert.throws(() => process.kill(pid, 0), { code:'ESRCH' });

test('persistent process keeps one connection across awaited JS and fragmented UTF-8/markers', async () => {
  let pid;
  const result = await session(async exec => {
    const [first] = await exec('FIRST', 'first');pid=first.pid;
    assert.equal(first.value, 'Åä漢字');assert.equal(first.sequence, 1);
    const calculated = first.sequence + 1;
    const [second, extra] = await exec('MULTI', {stage:'second'});
    assert.equal(second.pid,pid);assert.equal(second.sequence,calculated);assert.deepEqual(extra,{second:true});
    assert.deepEqual(await exec('EMPTY'),[]);
    return calculated;
  });
  assert.equal(result,2);gone(pid);
});

test('overlapping queries are rejected without corrupting the active response', async () => {
  await session(async exec => {
    const first=exec('DELAY');
    await assert.rejects(exec('SECOND'),/sequential awaited/);
    assert.equal((await first)[0].sequence,1);
    assert.equal((await exec('THIRD'))[0].sequence,2);
  });
});

test('semicolon-free and comment-terminated queries execute before their own acknowledgement', async () => {
  await session(async exec => {
    assert.equal((await exec('WITHOUT_SEMICOLON'))[0].sequence,1);
    assert.equal((await exec('WITH_COMMENT -- semicolon belongs on the next line'))[0].sequence,2);
    assert.equal((await exec('ALREADY_TERMINATED;'))[0].sequence,3);
  });
});

test('callback failure closes only its owned child and retains original error', async () => {
  let pid;
  const original=new Error('caller computation failed');
  await assert.rejects(session(async exec => {
    [{pid}]=await exec('FIRST');throw original;
  }),error=>error===original);
  gone(pid);
});

test('SQL process failure and malformed acknowledgement fail closed without printing private output', async () => {
  for (const command of ['EXIT','BAD']) {
    let pid;
    await assert.rejects(session(async exec => {
      [{pid}]=await exec('FIRST');await exec(command);
    }),error=>/Isolated SQL/.test(error.message)&&!/secret/.test(error.message));
    gone(pid);
  }
});

test('deadline aborts an unacknowledged query and closes its process', async () => {
  let pid;
  await assert.rejects(session(async exec => {
    [{pid}]=await exec('FIRST');await exec('HOLD');
  },{timeoutMs:200}),/deadline exceeded/);
  gone(pid);
});

test('SQLSTATE and declared stage identify a failed query without server text', async () => {
  await assert.rejects(session(async exec => exec('STATE_ERROR','finalize')),
    /process-test\/finalize:.*SQLSTATE 55000/);
});

test('unawaited pending query cannot be reported as a successful session', async () => {
  let pid;
  await assert.rejects(session(async exec => {
    [{pid}]=await exec('FIRST');exec('DELAY').catch(()=>{});
  }),/unfinished query/);
  gone(pid);
});

test('missing process reports a sanitized startup failure', async () => {
  await assert.rejects(withIsolatedSqlSession('/kajo-not-a-command',[],
    {stage:'missing-command',timeoutMs:500},async exec=>exec('FIRST')),/process could not start|input transport failed/);
});
