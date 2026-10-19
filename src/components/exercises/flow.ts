// 答題流程的狀態機（docs/CONTRACT.md B2）：檢查 → 三層提示 → 看答案。
// 只管狀態，不碰畫面，所以可以直接用 Node 測。

export type Status = 'todo' | 'attempted' | 'passed' | 'revealed';

export interface Flow {
  status: Status;
  failedAttempts: number; // 檢查沒通過的次數
  hintsShown: 0 | 1 | 2 | 3; // 已經展開到第幾層提示
  revealShown: boolean; // 學習者按過「看答案」
}

export type FlowAction = { type: 'check'; passed: boolean } | { type: 'hint' } | { type: 'reveal' };

export const initialFlow: Flow = { status: 'todo', failedAttempts: 0, hintsShown: 0, revealShown: false };

// 三層提示都看過，或檢查失敗滿 3 次，才可以選擇「看答案」（規格書：先給提示，再讓學習者選要不要看答案）
export function canReveal(flow: Flow): boolean {
  return flow.hintsShown >= 3 || flow.failedAttempts >= 3;
}

export function reduce(flow: Flow, action: FlowAction): Flow {
  switch (action.type) {
    case 'check': {
      if (action.passed) {
        // 看過答案之後才通過，算 revealed（不算 passed）；兩者都算完成
        return { ...flow, status: flow.revealShown ? 'revealed' : 'passed' };
      }
      const done = flow.status === 'passed' || flow.status === 'revealed';
      return { ...flow, status: done ? flow.status : 'attempted', failedAttempts: flow.failedAttempts + 1 };
    }
    case 'hint':
      return flow.hintsShown >= 3 ? flow : { ...flow, hintsShown: (flow.hintsShown + 1) as 1 | 2 | 3 };
    case 'reveal':
      return canReveal(flow) ? { ...flow, revealShown: true } : flow;
  }
}

export function isDone(flow: Flow): boolean {
  return flow.status === 'passed' || flow.status === 'revealed';
}
