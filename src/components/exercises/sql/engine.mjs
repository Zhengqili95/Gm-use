import initSqlJs from 'sql.js';

// Keep only enough rows to display or compare, but step every statement to
// completion (including INSERT/UPDATE RETURNING). The parent enforces time.
function execute(db, sql, limit) {
  let last;
  for (const statement of db.iterateStatements(sql)) {
    try {
      const columns = statement.getColumnNames();
      const rows = [];
      let count = 0;
      while (statement.step()) {
        count++;
        if (rows.length < limit) {
          const row = statement.get();
          if (row.some(v => v !== null && typeof v !== 'number' && typeof v !== 'string')) {
            throw new Error('SQL 結果含有不支援的 BLOB；請轉成文字或數字。');
          }
          rows.push(row);
        }
      }
      if (columns.length) last = { columns, rows, count };
    } finally {
      statement.free();
    }
  }
  return last;
}

function equalRows(actual, check) {
  if (!actual || actual.count !== check.equals.length) return false;
  if (check.columns && JSON.stringify(check.columns) !== JSON.stringify(actual.columns)) return false;
  // Tag values before serializing: SQLite can return Infinity, which JSON
  // alone would turn into null. String(number) also normalizes 1.0 and -0.
  // Sorting retains multiplicity, unlike Set-based comparison.
  const key = row => JSON.stringify(row.map(v => [typeof v, v === null ? null : String(v)]));
  const left = actual.rows.map(key);
  const right = check.equals.map(key);
  if (!check.ordered) { left.sort(); right.sort(); }
  return left.every((row, index) => row === right[index]);
}

const quoteIdentifier = name => '"' + name.replaceAll('"', '""') + '"';

/** Runs only inside a disposable Worker. */
export async function executeRequest(request, { onReady, ...sqlOptions } = {}) {
  let db;
  try {
    const SQL = await initSqlJs(sqlOptions);
    onReady?.(); // sql.js is loaded; the parent's 3 s run budget starts here.
    db = new SQL.Database();
    execute(db, request.setup, 0);
    if (request.action === 'describe') {
      const names = db.exec("SELECT name FROM sqlite_schema WHERE type='table' AND name NOT GLOB 'sqlite_*' ORDER BY name")[0]?.values ?? [];
      const tables = names.map(([name]) => {
        const result = execute(db, `SELECT * FROM ${quoteIdentifier(name)} LIMIT 5`, 5);
        return { name, columns: result.columns, rows: result.rows };
      });
      return { status: 'ok', tables };
    }
    const checks = request.checks ?? [];
    const limit = Math.max(100, ...checks.filter(c => c.type === 'rows').map(c => c.equals.length));
    const actual = execute(db, request.learnerSql, limit);
    const result = { status: 'ok' };
    if (actual) result.resultSet = {
      columns: actual.columns, rows: actual.rows.slice(0, 100), truncated: actual.count > 100,
    };
    if (request.action === 'check') {
      result.checks = checks.map(check => ({
        id: check.id,
        passed: equalRows(check.type === 'state'
          ? execute(db, check.query, check.equals.length) : actual, check),
      }));
    }
    return result;
  } catch (error) {
    return { status: 'error', error: error instanceof Error ? error.message : String(error) };
  } finally {
    db?.close();
  }
}
