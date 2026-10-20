import type { Exercise } from '../../../lib/schemas';

export type SqlExercise = Extract<Exercise, { type: 'sql' }>;
export type Cell = string | number | null;
export interface SqlResultSet { columns: string[]; rows: Cell[][]; truncated: boolean }
export interface SqlRunResult {
  status: 'ok' | 'error' | 'timeout';
  error?: string;
  resultSet?: SqlResultSet;
}
export interface SqlCheckResult extends SqlRunResult {
  checks: Array<{ id: string; passed: boolean }>;
}
export interface SqlTable { name: string; columns: string[]; rows: Cell[][] }
export interface SqlClient {
  runSql(setup: string, learnerSql: string): Promise<SqlRunResult>;
  checkSqlExercise(exercise: SqlExercise, learnerSql: string): Promise<SqlCheckResult>;
  describeTables(setup: string): Promise<SqlTable[]>;
}
