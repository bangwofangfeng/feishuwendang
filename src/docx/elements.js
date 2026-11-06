function normalizeStyle(style) {
  const clean = {};
  for (const [key, value] of Object.entries(style || {})) {
    if (value) clean[key] = value;
  }
  return clean;
}

function sameStyle(a = {}, b = {}) {
  return JSON.stringify(a) === JSON.stringify(b);
}

function pushRun(out, content, style) {
  if (!content) return;
  const clean = normalizeStyle(style);
  const last = out[out.length - 1];
  if (last?.text_run && sameStyle(last.text_run.text_element_style, clean)) {
    last.text_run.content += content;
    return;
  }
  const run = { text_run: { content } };
  if (Object.keys(clean).length) run.text_run.text_element_style = clean;
  out.push(run);
  return run;
}

function walk(node, style, out, root) {
  if (node.nodeType === 3) {
    pushRun(out, node.nodeValue, style);
    return;
  }
  if (node.nodeType !== 1) return;

  const raw = node.getAttribute('data-raw-element');
  if (raw) {
    try {
      out.push(JSON.parse(decodeURIComponent(raw)));
      return;
    } catch {
      // 忽略损坏的原始元素标记
    }
  }

  const tag = node.tagName.toLowerCase();
  const next = { ...style };

  if (tag === 'strong' || tag === 'b') next.bold = true;
  if (tag === 'em' || tag === 'i') next.italic = true;
  if (tag === 'u') next.underline = true;
  if (tag === 's' || tag === 'strike' || tag === 'del') next.strikethrough = true;
  if (tag === 'code') next.inline_code = true;
  if (tag === 'a') {
    const href = node.getAttribute('href');
    if (href) next.link = { url: href };
  }
  if (tag === 'br') {
    pushRun(out, '\n', style);
    return;
  }
  if (tag === 'div' || tag === 'p') {
    if (node !== root && out.length) pushRun(out, '\n', style);
  }

  for (const child of node.childNodes) walk(child, next, out, root);
}

export function serializeEditable(root) {
  const out = [];
  if (!root) return out;
  for (const child of root.childNodes) walk(child, {}, out, root);
  // 去掉首尾多余换行
  if (out.length && out[0].text_run?.content?.startsWith('\n')) {
    out[0].text_run.content = out[0].text_run.content.replace(/^\n+/, '');
  }
  const last = out[out.length - 1];
  if (last?.text_run?.content) {
    last.text_run.content = last.text_run.content.replace(/\n+$/, '');
  }
  return out.filter((element) => element.text_run ? element.text_run.content !== '' : true);
}

export function wrapSelectionInCode() {
  const selection = window.getSelection();
  if (!selection || !selection.rangeCount || selection.isCollapsed) return;
  const range = selection.getRangeAt(0);
  const code = document.createElement('code');
  try {
    code.appendChild(range.extractContents());
    range.insertNode(code);
    const next = document.createRange();
    next.selectNodeContents(code);
    selection.removeAllRanges();
    selection.addRange(next);
  } catch {
    // 跨块选择时放弃内联代码
  }
}
