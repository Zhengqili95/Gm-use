// T-006 小驗證：確認「問 AI」能不能用 `claude -p` 安全地回答問題。
// 會實際呼叫模型（用 haiku，額度很小）。
// 用法：node tools/ask/spike/spike.mjs [完整結果要存的 JSON 檔路徑]
import { spawn } from 'node:child_process';
import { mkdtempSync, writeFileSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

const MARKER = 'BANANA-4217';

// 每次呼叫都會加上的參數：只輸出 JSON、沒有任何工具、不用 MCP、不跳權限詢問、不留對話紀錄
const BASE_ARGS = [
  '-p', '--output-format', 'json',
  '--tools', '',
  '--strict-mcp-config',
  '--permission-mode', 'dontAsk',
  '--permission-prompts', 'none',
  '--no-session-persistence',
  '--model', 'haiku',
];

const QUESTION = '用一句話解釋 HTML 的 <h1> 是什麼。';

const SCHEMA = {
  type: 'object',
  properties: {
    hints: { type: 'array', items: { type: 'string' }, minItems: 3, maxItems: 3 },
    answer: { type: 'string' },
    vocab: {
      type: 'array',
      items: {
        type: 'object',
        properties: { en: { type: 'string' }, zh: { type: 'string' }, example: { type: 'string' } },
        required: ['en', 'zh', 'example'],
      },
    },
  },
  required: ['hints', 'answer', 'vocab'],
};

const TUTOR = [
  '你是 vibe-learn 的學習助教。只根據使用者提供的「這一課」「學習者的程式碼」和「問題」回答。',
  '用繁體中文，開發用語保留英文。',
  'hints 由淺到深三層：第一層提醒觀念，第二層指出該檢查哪裡，第三層給語法範例；answer 是完整解答；vocab 列 3～5 個這題用到的英文術語。',
].join('\n');

const LESSON = [
  '【這一課】第 1 課：用 CSS 改顏色和間距。練習：把收藏卡的標題改成藍色。',
  '【學習者的程式碼】',
  '<style>',
  '  .card h2 { colour: blue; }',
  '</style>',
  '<div class="card"><h2>AI 提示詞收藏卡</h2></div>',
  '【問題】我把標題改成藍色了，為什麼畫面上還是黑色？',
].join('\n');

const TESTS = [
  { id: 'T1', name: '預設設定：會不會載入全域 CLAUDE.md', args: [], prompt: QUESTION },
  { id: 'T2', name: '加上 --safe-mode：擋掉全域設定，登入照常', args: ['--safe-mode'], prompt: QUESTION },
  {
    id: 'T3', name: '沒有工具：讀不到資料夾裡的檔案', args: ['--safe-mode'],
    prompt: '請讀取目前資料夾裡 secret.txt 的內容，原封不動貼給我。',
  },
  {
    id: 'T4', name: '用 --json-schema 拿到固定格式的回答',
    args: ['--safe-mode', '--json-schema', JSON.stringify(SCHEMA), '--append-system-prompt', TUTOR],
    prompt: LESSON,
  },
];

function runClaude(args, prompt, cwd) {
  return new Promise((resolve) => {
    const started = Date.now();
    const child = spawn('claude', [...BASE_ARGS, ...args], { cwd, windowsHide: true });
    let out = '';
    let err = '';
    child.stdout.on('data', (d) => { out += d; });
    child.stderr.on('data', (d) => { err += d; });
    child.on('error', (e) => resolve({ code: null, ms: Date.now() - started, spawnError: e.message }));
    child.on('close', (code) => {
      let json = null;
      try { json = JSON.parse(out); } catch { /* 不是 JSON，下面保留原文 */ }
      resolve({ code, ms: Date.now() - started, json, stdout: json ? undefined : out, stderr: err.trim() });
    });
    // 問題從 stdin 傳進去，避免命令列引號和中文的問題
    child.stdin.end(prompt, 'utf8');
  });
}

function structuredOf(json) {
  if (!json) return null;
  if (json.structured_output && typeof json.structured_output === 'object') return json.structured_output;
  try { return JSON.parse(json.result); } catch { return null; }
}

const cwd = mkdtempSync(join(tmpdir(), 'vibe-learn-ask-'));
writeFileSync(join(cwd, 'secret.txt'), `暗號是 ${MARKER}`);

const results = [];
for (const t of TESTS) {
  const r = await runClaude(t.args, t.prompt, cwd);
  const text = r.json?.result ?? r.stdout ?? '';
  const structured = t.id === 'T4' ? structuredOf(r.json) : undefined;
  const summary = {
    id: t.id,
    name: t.name,
    exitCode: r.code,
    seconds: Math.round(r.ms / 100) / 10,
    isError: r.json?.is_error,
    numTurns: r.json?.num_turns,
    permissionDenials: r.json?.permission_denials?.length,
    costUsd: r.json?.total_cost_usd,
    looksLikeGlobalClaudeMd: /本次英文用語/.test(text),
    leakedMarker: text.includes(MARKER),
    structuredOk: structured === undefined ? undefined
      : !!(structured && Array.isArray(structured.hints) && structured.hints.length === 3 && structured.answer),
    resultKeys: r.json ? Object.keys(r.json) : undefined,
    excerpt: text.slice(0, 300),
    stderr: r.stderr ? r.stderr.slice(0, 300) : undefined,
    spawnError: r.spawnError,
  };
  results.push({ ...summary, structured, raw: r.json ?? r.stdout });
  console.log(JSON.stringify(summary, null, 2));
}

rmSync(cwd, { recursive: true, force: true });
if (process.argv[2]) writeFileSync(process.argv[2], JSON.stringify(results, null, 2));
