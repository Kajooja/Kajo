import assert from 'node:assert/strict';
import { spawn } from 'node:child_process';
import { randomBytes } from 'node:crypto';

// A trusted, isolated psql process only. SQL and result bodies never enter a
// shell command or an error message. The caller owns BEGIN/COMMIT and must await
// each query before sending the next one; one connection spans JS computation.
export async function withIsolatedSqlSession(command, args, options, work) {
  const { cwd, env, stage = 'persistent-sql', timeoutMs = 60_000 } = options;
  assert.match(stage, /^[a-zA-Z0-9][a-zA-Z0-9_.:-]{0,95}$/);
  assert.ok(Number.isInteger(timeoutMs) && timeoutMs >= 100 && timeoutMs <= 120_000,
    'Invalid isolated SQL session deadline');
  assert.equal(typeof work, 'function');
  const child = spawn(command, args, { cwd, env, stdio: ['pipe', 'pipe', 'pipe'] });
  let pending, failure, closed = false, closing = false, sequence = 0;
  let buffer = '', stderrTail = '', sqlstate, totalBytes = 0, rejectFailure, resolveClosed;
  const failed = new Promise((_, reject) => { rejectFailure = reject; });
  // A child may fail before work's first awaited query.
  failed.catch(() => {});
  const completion = new Promise(resolve => { resolveClosed = resolve; });
  const fail = message => {
    if (failure) return;
    failure = new Error(`Isolated SQL ${stage}${pending?.stage ? '/' + pending.stage : ''}: ${message}`
      + (sqlstate ? ` (SQLSTATE ${sqlstate})` : ''));
    pending?.reject(failure); pending = undefined;
    rejectFailure(failure);
  };
  child.stdout.setEncoding('utf8');
  child.stdout.on('data', data => {
    totalBytes += Buffer.byteLength(data);
    if (totalBytes > 64 * 1024 * 1024) { fail('session output limit exceeded'); return; }
    buffer += data;
    if (Buffer.byteLength(buffer) > 16 * 1024 * 1024) { fail('row output limit exceeded'); return; }
    let end;
    while ((end = buffer.indexOf('\n')) !== -1 && !failure) {
      const line = buffer.slice(0, end).replace(/\r$/, ''); buffer = buffer.slice(end + 1);
      if (!line) continue;
      if (!pending) { fail('unexpected output outside a query'); break; }
      if (line === pending.marker) {
        const current = pending; pending = undefined; current.resolve(current.rows);
      } else {
        pending.bytes += Buffer.byteLength(line);
        if (pending.bytes > 16 * 1024 * 1024 || pending.rows.length >= 16_384) {
          fail('query output limit exceeded'); break;
        }
        try { pending.rows.push(JSON.parse(line)); }
        catch { fail('invalid JSON acknowledgement'); }
      }
    }
  });
  // psql's sqlstate verbosity supplies a useful fixed diagnostic without SQL,
  // values or arbitrary server exception text appearing in the thrown error.
  child.stderr.setEncoding('utf8');
  child.stderr.on('data', data => {
    stderrTail = (stderrTail + data).slice(-256);
    sqlstate = /(?:ERROR|FATAL):\s+([0-9A-Z]{5})(?:\s|$)/.exec(stderrTail)?.[1] ?? sqlstate;
  });
  child.stdin.on('error', () => fail('input transport failed'));
  child.on('error', () => fail('process could not start'));
  child.on('close', (code, signal) => {
    closed = true;
    if (code !== 0 || signal || !closing || pending || buffer.trim()) {
      fail('process exited before a clean acknowledgement');
    }
    resolveClosed();
  });
  const deadline = setTimeout(() => fail(`deadline exceeded (${timeoutMs}ms)`), timeoutMs);
  const exec = async (sql, queryOptions = {}) => {
    if (failure) throw failure;
    if (closed || closing) throw new Error('Isolated SQL session is closed');
    if (pending) throw new Error('Isolated SQL session requires sequential awaited queries');
    const queryStage = typeof queryOptions === 'string' ? queryOptions : queryOptions.stage;
    if (queryStage !== undefined) assert.match(queryStage, /^[a-zA-Z0-9][a-zA-Z0-9_.:-]{0,95}$/);
    assert.ok(typeof sql === 'string' && sql.trim() && Buffer.byteLength(sql) <= 16 * 1024 * 1024,
      'Invalid isolated SQL query size');
    assert.ok(++sequence <= 256, 'Isolated SQL session query limit exceeded');
    const marker = `__KAJO_SQL_${randomBytes(16).toString('hex')}_${sequence}__`;
    return new Promise((resolve, reject) => {
      pending = { marker, resolve, reject, rows: [], bytes: 0, stage: queryStage };
      // psql executes \echo even while an unterminated SQL statement remains
      // in its query buffer. Terminate on a separate line (also after -- comments)
      // before acknowledging; an extra empty statement is harmless.
      child.stdin.write(`${sql}\n;\n\\echo ${marker}\n`);
    });
  };
  try {
    const result = await Promise.race([Promise.resolve().then(() => work(exec)), failed]);
    if (pending) throw new Error('Isolated SQL callback left an unfinished query');
    closing = true;
    // psql closes any uncommitted transaction; successful callbacks do not
    // implicitly commit. On errors, EOF likewise makes the connection roll back.
    child.stdin.end('\\q\n');
    await Promise.race([completion, failed]);
    return result;
  } finally {
    clearTimeout(deadline);
    closing = true;
    if (!closed) {
      child.stdin.end();
      // Only this owned child is terminated. The Docker integration additionally
      // terminates its exact database backend on failure to release held locks.
      const kill = setTimeout(() => child.kill('SIGKILL'), 1000);
      await completion;
      clearTimeout(kill);
    }
  }
}
