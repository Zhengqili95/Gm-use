import { SaxesParser } from 'saxes';

const NS = 'http://www.w3.org/2000/svg';
const colors = new Set([
  'text', 'gray-6', 'gray-4', 'accent', 'accent-low', 'bg',
  ...['green', 'red', 'orange', 'blue'].flatMap(c => [c, c + '-low']),
].map(c => '--sl-color-' + c));
const internalUrl = /^url\(\s*(['"]?)#[a-zA-Z_][\w:.-]*\1\s*\)$/i;
const colorProperty = /^(?:fill|stroke|color|stop-color|flood-color|lighting-color|background(?:-color)?|border(?:-(?:top|right|bottom|left))?-color)$/i;
const names = new Set(('aliceblue antiquewhite aqua aquamarine azure beige bisque black blanchedalmond blue blueviolet brown burlywood cadetblue chartreuse chocolate coral cornflowerblue cornsilk crimson cyan darkblue darkcyan darkgoldenrod darkgray darkgreen darkgrey darkkhaki darkmagenta darkolivegreen darkorange darkorchid darkred darksalmon darkseagreen darkslateblue darkslategray darkslategrey darkturquoise darkviolet deeppink deepskyblue dimgray dimgrey dodgerblue firebrick floralwhite forestgreen fuchsia gainsboro ghostwhite gold goldenrod gray green greenyellow grey honeydew hotpink indianred indigo ivory khaki lavender lavenderblush lawngreen lemonchiffon lightblue lightcoral lightcyan lightgoldenrodyellow lightgray lightgreen lightgrey lightpink lightsalmon lightseagreen lightskyblue lightslategray lightslategrey lightsteelblue lightyellow lime limegreen linen magenta maroon mediumaquamarine mediumblue mediumorchid mediumpurple mediumseagreen mediumslateblue mediumspringgreen mediumturquoise mediumvioletred midnightblue mintcream mistyrose moccasin navajowhite navy oldlace olive olivedrab orange orangered orchid palegoldenrod palegreen paleturquoise palevioletred papayawhip peachpuff peru pink plum powderblue purple rebeccapurple red rosybrown royalblue saddlebrown salmon sandybrown seagreen seashell sienna silver skyblue slateblue slategray slategrey snow springgreen steelblue tan teal thistle tomato turquoise violet wheat white whitesmoke yellow yellowgreen transparent currentcolor').split(' '));

// Static diagrams only: timing/animation elements are not part of the authored contract.
const animation = new Set(['animate', 'animatecolor', 'animatemotion', 'animatetransform', 'set', 'discard']);

// This validates the authored diagram contract; it is not a runtime SVG sanitizer.
export function checkSvg(source) {
  return analyzeSvg(source).errors;
}

// Same checks as checkSvg, plus the ids the diagram defines, so the caller can
// reject an id that two diagrams of the same lesson both use (one page, one id).
export function analyzeSvg(source) {
  const errors = [];
  const fail = reason => errors.push(reason);
  const stack = [];
  const nodes = [];
  const ids = new Set();
  const refs = [];
  const parser = new SaxesParser({ xmlns: true });
  parser.on('doctype', () => fail('SVG 不允許 DOCTYPE'));
  parser.on('processinginstruction', () => fail('SVG 不允許處理指令'));
  parser.on('opentag', tag => {
    const attrs = Object.fromEntries(Object.values(tag.attributes).map(a => [a.name, a.value]));
    const parent = stack.at(-1);
    const node = { name: tag.local, attrs, parent, children: [], text: '', size: parent?.size };
    nodes.push(node);
    parent?.children.push(node);
    stack.push(node);
    if (tag.uri !== NS) fail('SVG 元素 xmlns／namespace 必須是 ' + NS);
    if (['script', 'style', 'foreignobject', 'image'].includes(tag.local.toLowerCase())) fail('SVG 不允許 <' + tag.local + '>');
    if (animation.has(tag.local.toLowerCase())) fail('SVG 不允許動畫元素 <' + tag.local + '>，圖解必須是靜態的');
    if (tag.local === 'svg' && parent) fail('圖解只能有一個 svg');
    if (attrs.id) {
      if (!/^[a-z][a-z0-9]*-[\w.-]+$/.test(attrs.id)) fail('SVG id 必須有圖解名稱或縮寫前綴：' + attrs.id);
      if (ids.has(attrs.id)) fail('SVG id 重複：' + attrs.id);
      ids.add(attrs.id);
    }
    const fontSize = value => {
      if (!/^\d+(?:\.\d+)?(?:px)?$/.test(value)) { fail('font-size 必須能以 viewBox 單位判定且至少 14'); return NaN; }
      return parseFloat(value);
    };
    if (attrs['font-size']) node.size = fontSize(attrs['font-size']);
    for (const attr of Object.values(tag.attributes)) {
      const { local, name, value } = attr;
      if (/^on/i.test(local)) fail('SVG 不允許事件屬性 ' + name);
      if (local === 'href') {
        if (!/^#[a-zA-Z_][\w:.-]*$/.test(value)) fail('SVG 不允許外部連結 ' + name);
        else refs.push(value.slice(1));
      }
      if (/url\s*\(/i.test(value)) {
        for (const url of value.matchAll(/url\s*\([^)]*\)/gi)) {
          if (!internalUrl.test(url[0])) fail('SVG 不允許外部 url 連結');
          else refs.push(url[0].match(/#([\w:.-]+)/)[1]);
        }
      }
      if (['fill', 'stroke'].includes(local) && value !== 'none' && !internalUrl.test(value)) fail('SVG ' + name + ' 顏色只能寫在 style 的允許變數中');
      if (['color', 'stop-color', 'flood-color', 'lighting-color'].includes(local)) fail('SVG ' + name + ' 顏色只能寫在 style 中');
    }
    if (attrs.style) {
      // CSS escapes/comments can disguise forbidden values; the authored contract
      // does not need them. Reject instead of interpreting a second CSS language.
      if (/\\|\/\*|@/.test(attrs.style)) fail('SVG style 不允許跳脫、註解或 @ 規則');
      for (const declaration of attrs.style.split(';').filter(s => s.trim())) {
        const colon = declaration.indexOf(':');
        if (colon < 1) { fail('SVG style 宣告格式錯誤'); continue; }
        const prop = declaration.slice(0, colon).trim().toLowerCase();
        const value = declaration.slice(colon + 1).trim();
        if (!parent && ['width', 'height'].includes(prop)) fail('根 svg 不可用 style 設定固定 width／height');
        if (prop === 'font-size') node.size = fontSize(value);
        if (prop === 'font') fail('請使用明確 font-size，至少 14');
        const residual = value.replace(/var\(\s*(--[\w-]+)\s*\)/g, (_, variable) => {
          if (!colors.has(variable)) fail('SVG 使用未允許的顏色變數 ' + variable);
          return '';
        }).replace(/url\([^)]*\)/gi, url => internalUrl.test(url) ? '' : url);
        if (/var\s*\(/i.test(residual)) fail('SVG 顏色變數格式錯誤，不接受 fallback');
        if (/#[\da-f]{3,8}\b|\b(?:rgba?|hsla?|hwb|lab|lch|oklab|oklch|color)\s*\(/i.test(residual) ||
            (residual.match(/[a-z]+/gi) ?? []).some(word => names.has(word.toLowerCase()))) fail('SVG style 不可寫死顏色');
        if (colorProperty.test(prop) && residual.trim() && residual.trim() !== 'none') fail('SVG 顏色必須使用允許的 var(...)、none 或內部 url(#id)');
      }
    }
  });
  parser.on('text', text => { if (stack.length) stack.at(-1).text += text; });
  parser.on('cdata', text => { if (stack.length) stack.at(-1).text += text; });
  parser.on('closetag', () => stack.pop());
  try { parser.write(source).close(); }
  catch (e) { return { errors: ['SVG XML 解析失敗：' + e.message], ids: [] }; }
  const root = nodes[0];
  if (!root || root.name !== 'svg') { fail('根元素必須是 svg'); return { errors, ids: [...ids] }; }
  const view = (root.attrs.viewBox ?? '').trim().split(/[\s,]+/).map(Number);
  if (view.length !== 4 || !view.every(Number.isFinite) || view[0] !== 0 || view[1] !== 0 ||
      view[2] < 320 || view[2] > 480 || view[3] <= 0) fail('viewBox 必須為 0 0 寬 高，寬 320～480，高大於 0');
  if ('width' in root.attrs || 'height' in root.attrs) fail('根 svg 不可設定固定 width／height');
  for (const [i, name] of ['title', 'desc'].entries()) {
    if (root.children[i]?.name !== name || !root.children[i].text.trim()) fail('SVG 第 ' + (i + 1) + ' 個子元素必須是非空的 ' + name);
  }
  for (const node of nodes) {
    if (['text', 'tspan', 'textPath'].includes(node.name) && (!Number.isFinite(node.size) || node.size < 14)) fail('SVG text 的 font-size（可繼承）必須至少 14');
  }
  // Count explicit box/node primitives; semantic nodes drawn as paths require review.
  if (nodes.filter(n => ['rect', 'circle', 'ellipse'].includes(n.name) && !insideDefs(n)).length > 8) fail('SVG 最多 8 個方塊或節點');
  for (const ref of refs) if (!ids.has(ref)) fail('SVG 內部連結指向不存在的 id：' + ref);
  return { errors: [...new Set(errors)], ids: [...ids] };
}

function insideDefs(node) {
  for (let parent = node.parent; parent; parent = parent.parent) if (parent.name === 'defs') return true;
  return false;
}
