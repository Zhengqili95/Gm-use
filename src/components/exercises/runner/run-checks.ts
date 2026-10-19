import type { Files, PageCheck } from '../types';
import { collectOutcomes, type CheckOutcome } from './group-checks';
import { runCase } from './run-case';

export type { CheckOutcome };

export function runChecks(files: Files, checks: PageCheck[]): Promise<CheckOutcome> {
  return collectOutcomes(files, checks, (f, steps, group) => runCase(f, steps, group));
}
