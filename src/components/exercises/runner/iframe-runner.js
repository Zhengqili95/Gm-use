// 在沙箱 iframe 裡執行的檢查執行器（docs/CONTRACT.md B3）。
// 這份檔案會被當成文字塞進 srcdoc，所以不能 import 任何東西，也不能用 TypeScript。
// 流程：頁面載入完成後通知父頁 → 收到 run 訊息 → 先做 steps → 逐條檢查 → 把結果傳回去。
(function () {
  'use strict';

  var parentWin = window.parent;
  var jsErrors = [];
  var stepErrors = [];

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
      post({ type: 'ready' });
    }, 100);
  });

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
  var probe = null;
  function computedFor(property, value) {
    if (!probe) {
      probe = document.createElement('span');
      probe.style.cssText = 'position:absolute;visibility:hidden;pointer-events:none';
      document.body.appendChild(probe);
    }
    probe.style.removeProperty(property);
    probe.style.setProperty(property, value);
    if (probe.style.getPropertyValue(property) === '') {
      // 瀏覽器不認得這個值：不換算，照字面比
      return norm(value).toLowerCase();
    }
    var computed = getComputedStyle(probe).getPropertyValue(property);
    probe.style.removeProperty(property);
    return norm(computed).toLowerCase();
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
    if (!data || data.source !== 'vibe' || data.type !== 'run') return;
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
