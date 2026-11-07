// Only for the disposable synthetic acquisition fixture. Never use this
// diagnostic executor for hosted SQL or application rows.
export function createNativeAcquisitionPgliteExecutor(db, diagnostic) {
  return async (sql, { stage = 'native-acquisition-fixture' } = {}) => {
    const report = (error, phase) => diagnostic(JSON.stringify({ stage, phase,
      message: error.message, code: error.code, detail: error.detail,
      where: error.where, stack: error.stack }));
    try {
      // Match psql's omitted blank SQL-NULL row as well as its JSON values.
      return (await db.exec(sql)).flatMap(result => result.rows
        .map(row => Object.values(row)[0])).filter(value => value !== null);
    } catch (error) {
      // Capture the query failure before attempting recovery: PGlite recovery
      // can itself reject with "cannot drop active portal".
      report(error, 'query');
      try { await db.exec('rollback;'); }
      catch (rollbackError) {
        report(rollbackError, 'rollback');
        throw new AggregateError([error, rollbackError],
          'Synthetic acquisition query and rollback both failed', { cause: error });
      }
      throw error;
    }
  };
}
