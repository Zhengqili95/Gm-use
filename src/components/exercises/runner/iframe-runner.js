// 在沙箱 iframe 裡執行的檢查執行器（docs/CONTRACT.md B3）。
// 這份檔案會被當成文字塞進 srcdoc，所以不能 import 任何東西，也不能用 TypeScript。
// 流程：頁面載入完成後通知父頁 → 收到 run 訊息 → 先做 steps → 逐條檢查 → 把結果傳回去。
(function () {
  'use strict';

  var parentWin = window.parent;
  var jsErrors = [];
  var stepErrors = [];
  var loaded = false; // 頁面載入完成（和 ready 同一個時間點）之後才回應 ping

  function post(message) {
    message.source = 'vibe';
    // 沙箱 iframe 的來源是 "null"，只能用 '*'；父頁靠 event.source 確認身分
    parentWin.postMessage(message, '*');
  }

  function describeError(value) {
    if (value && typeof value === 'object' && 'message' in value) return String(value.message);
    return String(value);
  }

  window.addEventListener('error', function (event) {
    var message = event.message || describeError(event.error);
    jsErrors.push(message);
    post({ type: 'error', message: message });
  });
  window.addEventListener('unhandledrejection', function (event) {
    var message = describeError(event.reason);
    jsErrors.push(message);
    post({ type: 'error', message: message });
  });
  window.addEventListener('load', function () {
    // load 之後再等 100 毫秒，讓學習者程式裡的初始化跑完
    setTimeout(function () {
      loaded = true;
      post({ type: 'ready' });
    }, 100);
  });

  // 迴圈保護（docs/CONTRACT.md B3）：學習者的每個迴圈在送進來之前，已經被改寫成每跑一圈先呼叫 __vlLoop()（guard-loops.ts）。
  // 一次不間斷的執行（一個「任務」，中間沒有讓出給瀏覽器）如果在迴圈裡已經跑超過 1 秒，就丟出錯誤把它中止。
  // 不然跑它的瀏覽器程序會一直空轉，而且同一頁所有沙箱 iframe 共用同一個程序，
  // 一個卡住，整頁的預覽和檢查都會跟著卡死，要重新整理頁面才會恢復。
  // 計時用「任務」而不是「單一迴圈」：巢狀迴圈、或把錯誤吞掉的 try/catch，都躲不掉。
  // 任務結束的訊號用 MessageChannel：背景分頁裡的 setTimeout 會被拉長，MessageChannel 不會。
  var LOOP_LIMIT_MS = 1000;
  var taskStart = 0;
  var boundary = typeof MessageChannel === 'function' ? new MessageChannel() : null;
  function resetTask() {
    taskStart = 0;
  }
  if (boundary) boundary.port1.onmessage = resetTask;
  window.__vlLoop = function () {
    var now = Date.now();
    if (taskStart === 0) {
      taskStart = now;
      if (boundary) boundary.port2.postMessage(0);
      else setTimeout(resetTask, 0);
      return;
    }
    if (now - taskStart > LOOP_LIMIT_MS) {
      throw new Error('迴圈跑太久了，已經中止。是不是寫成了永遠不會結束的迴圈？');
    }
  };

  function sleep(ms) {
    return new Promise(function (resolve) {
      setTimeout(resolve, ms);
    });
  }

  // 比對前：連續空白壓成一個空格、去掉頭尾
  function norm(text) {
    return String(text).replace(/\s+/g, ' ').trim();
  }

  function textMatches(actual, check) {
    var a = norm(actual);
    var ci = check.ignoreCase === true;
    function fold(value) {
      return ci ? value.toLowerCase() : value;
    }
    if (check.equals !== undefined) return fold(a) === fold(norm(check.equals));
    if (check.includes !== undefined) return fold(a).indexOf(fold(norm(check.includes))) !== -1;
    if (check.matches !== undefined) return new RegExp(check.matches, ci ? 'i' : '').test(a);
    return false;
  }

  function countMatches(count, spec) {
    if (spec === undefined) return count >= 1;
    if (typeof spec === 'number') return count === spec;
    return (spec.min === undefined || count >= spec.min) && (spec.max === undefined || count <= spec.max);
  }

  // 把「寫在檢查規則裡的樣式值」換算成瀏覽器實際會算出的值：
  // 在暫時的探針元素上設定看看，再讀它算出來的樣式。
  // 這樣 lightyellow、#ffffe0、rgb(255,255,224) 會得到同一個值。
  // 探針用完立刻拿掉：留在 body 裡的話，同一個 case 後面的檢查（選擇器是 span、body > *、:last-child 之類）會被它影響。
  // 注意：百分比這類跟外層有關的長度，在探針上算出來的值會和目標元素不同，檢查規則不要用（約定 3.3）。
  function computedFor(property, value) {
    var probe = document.createElement('span');
    probe.style.cssText = 'position:absolute;visibility:hidden;pointer-events:none';
    probe.style.setProperty(property, value);
    if (probe.style.getPropertyValue(property) === '') {
      // 瀏覽器不認得這個值：不換算，照字面比
      return norm(value).toLowerCase();
    }
    (document.body || document.documentElement).appendChild(probe);
    try {
      return norm(getComputedStyle(probe).getPropertyValue(property)).toLowerCase();
    } finally {
      probe.remove();
    }
  }

  async function runStep(step) {
    if (step.click !== undefined) {
      var target = document.querySelector(step.click);
      if (!target) {
        stepErrors.push('找不到要點擊的元素：' + step.click);
        return;
      }
      target.click();
      await sleep(0);
      await sleep(0);
      return;
    }
    if (step.input) {
      var field = document.querySelector(step.input.selector);
      if (!field) {
        stepErrors.push('找不到要輸入的元素：' + step.input.selector);
        return;
      }
      field.value = step.input.value;
      field.dispatchEvent(new Event('input', { bubbles: true }));
      field.dispatchEvent(new Event('change', { bubbles: true }));
      await sleep(0);
      return;
    }
    if (step.wait !== undefined) {
      await sleep(Math.min(1000, step.wait));
    }
  }

  function evaluate(check) {
    switch (check.type) {
      case 'exists':
        return countMatches(document.querySelectorAll(check.selector).length, check.count);
      case 'text': {
        var nodes = Array.prototype.slice.call(document.querySelectorAll(check.selector));
        if (nodes.length === 0) return false;
        if (check.all === true) {
          return nodes.every(function (node) {
            return textMatches(node.textContent || '', check);
          });
        }
        return textMatches(nodes[0].textContent || '', check);
      }
      case 'attr': {
        var element = document.querySelector(check.selector);
        if (!element) return false;
        if (check.present !== undefined) return element.hasAttribute(check.name) === check.present;
        var value = element.getAttribute(check.name);
        return value !== null && textMatches(value, check);
      }
      case 'style': {
        var styled = document.querySelector(check.selector);
        if (!styled) return false;
        var actual = norm(getComputedStyle(styled).getPropertyValue(check.property)).toLowerCase();
        var wanted = check.oneOf !== undefined ? check.oneOf : [check.equals];
        return wanted.some(function (candidate) {
          return computedFor(check.property, String(candidate)) === actual;
        });
      }
      case 'noError':
        return jsErrors.length === 0;
      default:
        stepErrors.push('這個執行器還不支援檢查類型：' + check.type);
        return false;
    }
  }

  window.addEventListener('message', function (event) {
    if (event.source !== parentWin) return;
    var data = event.data;
    if (!data || data.source !== 'vibe') return;
    // 預覽的看門狗：父頁每秒問一次，載入完成的頁面會回 ready。卡在無窮迴圈的頁面回不了，父頁就知道它卡住了
    if (data.type === 'ping') {
      if (loaded) post({ type: 'ready' });
      return;
    }
    if (data.type !== 'run') return;
    (async function () {
      var steps = data.steps || [];
      for (var i = 0; i < steps.length; i++) await runStep(steps[i]);
      var results = data.checks.map(function (check) {
        try {
          return { id: check.id, passed: evaluate(check) === true };
        } catch (error) {
          return { id: check.id, passed: false, error: describeError(error) };
        }
      });
      post({ type: 'result', results: results, errors: jsErrors.slice(), stepErrors: stepErrors.slice() });
    })();
  });
})();
