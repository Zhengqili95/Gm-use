import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { checkContent } from './index.mjs';

const args = process.argv.slice(2);
const defaultRoot = fileURLToPath(new URL('../../../', import.meta.url));
try {
  if (args.length && (args.length !== 2 || args[0] !== '--root' || !args[1] || args[1].startsWith('--'))) {
    throw new Error('用法：check:content [--root <包含 src/ 的專案根目錄>]');
  }
  const errors = await checkContent(args.length ? path.resolve(args[1]) : defaultRoot);
  for (const { file, reason } of errors) console.log('錯誤 ' + file + '：' + reason);
  if (errors.length) process.exitCode = 1;
  else console.log('內容檢查通過');
} catch (e) {
  console.log('錯誤 check:content：' + String(e.message).replace(/[\r\n\u2028\u2029]+/g, ' '));
  process.exitCode = 1;
}
