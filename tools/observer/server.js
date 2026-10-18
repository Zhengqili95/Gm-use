// vibe-learn 觀察房：唯讀顯示 team/ 的討論內容。
// 只用 Node.js 內建模組，不需要 npm install。
// 用法：node tools/observer/server.js [--open]
const http = require('node:http');
const fs = require('node:fs');
const path = require('node:path');
const { spawn } = require('node:child_process');

const PORT = Number(process.env.PORT) || 5180;
const HOST = '127.0.0.1'; // 只開放給這台電腦，不對區域網路公開
const ROOT = path.resolve(__dirname, '..', '..');
const TEAM_DIR = process.env.TEAM_DIR || path.join(ROOT, 'team');
const FILES = {
  board: path.join(TEAM_DIR, 'BOARD.md'),
  tasks: path.join(TEAM_DIR, 'TASKS.md'),
  decisions: path.join(TEAM_DIR, 'DECISIONS.md'),
  spec: path.join(ROOT, 'docs', 'SPEC.md'),
};

function readFiles() {
  const files = {};
  for (const [key, file] of Object.entries(FILES)) {
    try {
      files[key] = { text: fs.readFileSync(file, 'utf8'), mtime: fs.statSync(file).mtimeMs };
    } catch {
      files[key] = { text: '', mtime: 0, missing: true };
    }
  }
  return files;
}

function send(res, status, type, body) {
  res.writeHead(status, { 'Content-Type': type, 'Cache-Control': 'no-store' });
  res.end(body);
}

const server = http.createServer((req, res) => {
  const { pathname } = new URL(req.url, `http://${HOST}`);
  if (req.method !== 'GET') return send(res, 405, 'text/plain; charset=utf-8', 'Read only');
  if (pathname === '/api/state') {
    return send(res, 200, 'application/json; charset=utf-8',
      JSON.stringify({ teamDir: TEAM_DIR, files: readFiles() }));
  }
  if (pathname === '/' || pathname === '/index.html') {
    return send(res, 200, 'text/html; charset=utf-8', fs.readFileSync(path.join(__dirname, 'index.html')));
  }
  send(res, 404, 'text/plain; charset=utf-8', 'Not found');
});

const URL_ = `http://${HOST}:${PORT}`;

function openBrowser() {
  if (!process.argv.includes('--open')) return;
  const [cmd, args] = process.platform === 'win32' ? ['cmd', ['/c', 'start', '', URL_]]
    : process.platform === 'darwin' ? ['open', [URL_]] : ['xdg-open', [URL_]];
  spawn(cmd, args, { stdio: 'ignore', detached: true }).unref();
}

function portTaken() {
  console.error(`埠號 ${PORT} 被別的程式占用了。可以設定環境變數 PORT 換一個號碼再執行。`);
  process.exit(1);
}

server.on('error', (err) => {
  if (err.code !== 'EADDRINUSE') {
    console.error(err);
    process.exit(1);
  }
  // 埠號被占用時，先確認是不是觀察房已經在執行；是的話直接打開它
  http.get({ host: HOST, port: PORT, path: '/api/state', timeout: 1500 }, (res) => {
    res.resume();
    if (res.statusCode !== 200) return portTaken();
    console.log(`觀察房已經在執行了：${URL_}`);
    openBrowser();
    setTimeout(() => process.exit(0), 300);
  }).on('error', portTaken).on('timeout', portTaken);
});

server.listen(PORT, HOST, () => {
  console.log(`vibe-learn 觀察房：${URL_}`);
  console.log(`讀取的資料夾：${TEAM_DIR}`);
  console.log('要關掉觀察房，關掉這個視窗就好。');
  openBrowser();
});
