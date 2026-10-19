import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import { buildBody, buildSrcdoc, CSP } from './build-srcdoc.ts';

describe('組 srcdoc', () => {
  it('把 <link href="style.css"> 換成 <style>', () => {
    const html = buildBody({
      'index.html': '<link rel="stylesheet" href="style.css">\n<p>hi</p>',
      'style.css': 'p { color: red; }',
    });
    assert.ok(html.includes('<style>p { color: red; }</style>'));
    assert.ok(!html.includes('<link'));
  });

  it('把 <script src="script.js"></script> 換成內嵌的 <script>', () => {
    const html = buildBody({
      'index.html': '<p id="x"></p>\n<script src="script.js"></script>',
      'script.js': 'document.title = "a";',
    });
    assert.ok(html.includes('<script>document.title = "a";</script>'));
    assert.ok(!html.includes('src="script.js"'));
  });

  it('檔案內容裡的 </script> 和 </style> 會被跳脫，不會讓標籤提早結束', () => {
    const html = buildBody({
      'index.html': '<link rel="stylesheet" href="style.css"><script src="script.js"></script>',
      'style.css': '/* </style> */',
      'script.js': 'var s = "</script>";',
    });
    assert.ok(!html.includes('</style> */'));
    assert.ok(html.includes('<\\/style>'));
    assert.ok(html.includes('<\\/script>'));
  });

  it('內容裡的 $& 這類字元不會被當成取代字串的特殊符號', () => {
    const html = buildBody({
      'index.html': '<script src="script.js"></script>',
      'script.js': 'var price = "$&";',
    });
    assert.ok(html.includes('var price = "$&";'));
  });

  it('沒有提供的檔案：標籤原樣保留', () => {
    const html = buildBody({ 'index.html': '<link rel="stylesheet" href="style.css">' });
    assert.ok(html.includes('<link'));
  });

  it('srcdoc：有內容安全政策、執行器在學習者的程式之前、本文在最後', () => {
    const doc = buildSrcdoc({ 'index.html': '<p id="mine">x</p>' }, 'window.__runner = 1;');
    assert.ok(doc.includes(`content="${CSP}"`));
    assert.ok(doc.indexOf('window.__runner = 1;') < doc.indexOf('id="mine"'));
    assert.ok(!CSP.includes('connect-src'), '不寫 connect-src，連線才會退回 default-src none');
    assert.ok(CSP.startsWith("default-src 'none'"));
  });
});