import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import { guardInlineScripts, guardLoops } from './guard-loops.ts';

// 用 new Function 跑改寫前、改寫後的程式（只在這個測試裡用；程式碼用 return 回傳結果）
function run(code, guard = () => {}) {
  return new Function('__vlLoop', code)(guard);
}

describe('迴圈保護：改寫的結果', () => {
  it('在迴圈本體的最前面插入呼叫，其他地方一個字都不動', () => {
    assert.equal(guardLoops('while (true) {}'), 'while (true) {__vlLoop();}');
    assert.equal(guardLoops('for (let i = 0; i < 3; i++) { x(); }'), 'for (let i = 0; i < 3; i++) {__vlLoop(); x(); }');
    assert.equal(guardLoops('do { n++; } while (n < 3);'), 'do {__vlLoop(); n++; } while (n < 3);');
  });

  it('沒有大括號的迴圈本體：補上大括號', () => {
    assert.equal(guardLoops('while (x) y++;'), 'while (x) {__vlLoop();y++;}');
    assert.equal(guardLoops('for (;;);'), 'for (;;){__vlLoop();;}');
  });

  it('每個迴圈都有一個呼叫，巢狀的迴圈也是', () => {
    const out = guardLoops('while (a) { while (b) {} }\nfor (const c of d) {}');
    assert.equal(out, 'while (a) {__vlLoop(); while (b) {__vlLoop();} }\nfor (const c of d) {__vlLoop();}');
  });

  it('沒有迴圈的程式、字串、註解、樣板字串裡的 while 和 for 都不會被動到', () => {
    const source = 'const s = "while (true) {}"; // for (;;) {}\nconst t = `do { } while (0) ${1 + 1}`; /* while (1) {} */ const re = /for\\s*\\(/;';
    assert.equal(guardLoops(source), source);
  });

  it('語法有錯的程式照原樣交出去（它本來就跑不起來，不會有迴圈）', () => {
    for (const broken of ['while (', 'const x = ;', 'for (;;) { ', 'function (){']) assert.equal(guardLoops(broken), broken);
  });

  it('新一點的語法也解析得了', () => {
    const source = 'class A { #x = 1; static y = 2; m() { return this.#x ?? 0; } }\nconst o = { a: { b: 1 } }; let v = o?.a?.b; while (v < 3) { v **= 2; v++; }';
    assert.match(guardLoops(source), /while \(v < 3\) \{__vlLoop\(\);/);
  });

  it('module 的程式要指定 sourceType，script 解析不了 import 就照原樣交出去', () => {
    const source = 'import x from "y"; while (true) {}';
    assert.equal(guardLoops(source), source);
    assert.match(guardLoops(source, 'module'), /while \(true\) \{__vlLoop\(\);\}/);
  });
});

describe('迴圈保護：行為不變', () => {
  const programs = {
    'while': ['let i = 0, sum = 0; while (i < 5) { sum += i; i++; } return sum;', 5],
    'while 沒有大括號': ['let i = 0; while (i < 5) i++; return i;', 5],
    'do-while': ['let n = 0; do { n += 2; } while (n < 7); return n;', 4],
    'for': ['let s = 0; for (let i = 1; i <= 4; i++) s += i; return s;', 4],
    'for-of': ['let s = ""; for (const c of "abc") { s += c.toUpperCase(); } return s;', 3],
    'for-in': ['const o = { a: 1, b: 2 }; const k = []; for (const key in o) k.push(key); return k.join();', 2],
    '巢狀、break、continue、標籤': [
      'const out = []; outer: for (let i = 0; i < 3; i++) { for (let j = 0; j < 3; j++) { if (j === 1) continue; if (i === 2) break outer; out.push(i * 10 + j); } } return out.join();',
      10,
    ],
    '函式裡的迴圈': ['function f(n) { let r = 1; while (n > 1) { r *= n--; } return r; } return f(5);', 4],
    '箭頭函式和類別方法': [
      'const g = (n) => { let t = 0; for (let i = 0; i < n; i++) t += i; return t; }; class A { m(n) { let c = 0; while (c < n) c++; return c; } } return g(4) + new A().m(3);',
      7,
    ],
    '空的迴圈本體': ['let i = 0; for (; i < 3; i++); return i;', 3],
    '迴圈裡有字串和註解': ['const s = "while (true) {}"; // for (;;) {}\nlet n = 0; while (n < 2) { n++; /* do { } while (0) */ } return s + n;', 2],
    'if/else 裡沒有大括號的迴圈': ['let a = 0; if (true) for (let i = 0; i < 3; i++) a += i; else a = -1; return a;', 3],
  };

  for (const [name, [code, iterations]] of Object.entries(programs)) {
    it(`${name}：結果和改寫前一樣，每圈呼叫一次`, () => {
      let calls = 0;
      assert.equal(run(guardLoops(code), () => calls++), run(code));
      assert.equal(calls, iterations);
    });
  }

  it('改寫後的程式不會變成語法錯誤（每個範例都再解析一次）', () => {
    for (const [code] of Object.values(programs)) assert.doesNotThrow(() => new Function('__vlLoop', guardLoops(code)));
  });
});

describe('迴圈保護：無窮迴圈會被中止', () => {
  const infinite = ['while (true) {}', 'for (;;);', 'do {} while (true);', 'while (1) if (true) {}', 'for (let i = 0; ; i++) {}', 'outer: while (true) { for (;;) { continue outer; } }'];
  for (const code of infinite) {
    it(code, () => {
      let calls = 0;
      const guard = () => {
        if (++calls > 100) throw new Error('stop');
      };
      assert.throws(() => run(guardLoops(code), guard), /stop/);
    });
  }

  it('try/catch 包在整個迴圈外面，錯誤丟得出來；程式可以接著往下跑', () => {
    let calls = 0;
    const guard = () => {
      if (++calls > 10) throw new Error('stop');
    };
    assert.equal(run(guardLoops('let r = "沒中止"; try { while (true) {} } catch (e) { r = "中止了"; } return r;'), guard), '中止了');
  });
});

describe('index.html 裡的 <script>', () => {
  it('沒有 src 的 <script> 要保護；有 src 的、不是程式的（JSON）不動', () => {
    const html = [
      '<script>while (true) {}</script>',
      '<script src="script.js"></script>',
      '<script type="application/json">{"a": [1]}</script>',
      '<SCRIPT type="text/javascript">for (;;);</SCRIPT>',
      '<script type="module">while (true) {}</script>',
    ].join('\n');
    const out = guardInlineScripts(html);
    assert.ok(out.includes('<script>while (true) {__vlLoop();}</script>'));
    assert.ok(out.includes('<script src="script.js"></script>'));
    assert.ok(out.includes('<script type="application/json">{"a": [1]}</script>'));
    assert.ok(out.includes('<SCRIPT type="text/javascript">for (;;){__vlLoop();;}</SCRIPT>'));
    assert.ok(out.includes('<script type="module">while (true) {__vlLoop();}</script>'));
  });

  it('語法有錯的 <script> 原樣保留', () => {
    const html = '<script>while (</script>';
    assert.equal(guardInlineScripts(html), html);
  });
});
