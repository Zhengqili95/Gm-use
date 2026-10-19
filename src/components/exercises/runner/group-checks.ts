// 把檢查分組、依序跑完。跑每個 case 的函式是傳進來的，所以這個檔案可以直接用 Node 測。
import type { Files, PageCheck, Step } from '../types';
import type { CaseOutcome } from './run-case';

export interface CheckOutcome {
  passed: Map<string, boolean>; // 每條檢查有沒有通過
  errors: string[]; // 學習者的程式丟出的錯誤（去掉重複）
  timedOut: boolean;
}

export type CaseRunner = (files: Files, steps: Step[], checks: PageCheck[]) => Promise<CaseOutcome>;

// steps 完全相同的檢查放在同一個 case；每個 case 都從重新載入的頁面開始，前一個 case 的操作不會影響下一個
export function groupBySteps(checks: PageCheck[]): Array<{ steps: Step[]; checks: PageCheck[] }> {
  const groups = new Map<string, { steps: Step[]; checks: PageCheck[] }>();
  for (const check of checks) {
    const steps = ('steps' in check && check.steps ? check.steps : []) as Step[];
    const key = JSON.stringify(steps);
    const group = groups.get(key) ?? { steps, checks: [] };
    group.checks.push(check);
    groups.set(key, group);
  }
  return [...groups.values()];
}

export async function collectOutcomes(files: Files, checks: PageCheck[], run: CaseRunner): Promise<CheckOutcome> {
  const passed = new Map<string, boolean>();
  const errors = new Set<string>();
  let timedOut = false;
  const groups = groupBySteps(checks);
  for (const [index, group] of groups.entries()) {
    const outcome = await run(files, group.steps, group.checks);
    for (const result of outcome.results) passed.set(result.id, result.passed);
    for (const message of outcome.errors) errors.add(message);
    if (outcome.timedOut) {
      timedOut = true;
      // 沒有任何操作就卡住，代表程式一載入就停不下來，後面的 case 一定也一樣，不用再各等一次逾時
      if (group.steps.length === 0) {
        for (const rest of groups.slice(index + 1)) for (const check of rest.checks) passed.set(check.id, false);
        break;
      }
    }
  }
  return { passed, errors: [...errors], timedOut };
}
