const LINK_PATTERNS = [
  { type: 'docx', re: /\/docx\/([A-Za-z0-9]+)/ },
  { type: 'sheet', re: /\/sheets\/([A-Za-z0-9]+)/ },
  { type: 'bitable', re: /\/base\/([A-Za-z0-9]+)/ },
  { type: 'bitable', re: /\/bitable\/([A-Za-z0-9]+)/ },
  { type: 'wiki', re: /\/wiki\/([A-Za-z0-9]+)/ },
  { type: 'doc', re: /\/docs\/([A-Za-z0-9]+)/ },
];

export const SUPPORTED_TYPES = new Set(['docx', 'sheet', 'bitable']);

export function parseFeishuLink(input) {
  const text = String(input || '').trim();
  if (!text) throw new Error('请输入飞书文档链接或 Token');

  if (/^https?:\/\//i.test(text)) {
    let url;
    try {
      url = new URL(text);
    } catch {
      throw new Error('链接格式不正确');
    }
    for (const pattern of LINK_PATTERNS) {
      const match = url.pathname.match(pattern.re);
      if (match) {
        return {
          type: pattern.type,
          token: match[1],
          url: text,
          tableId: url.searchParams.get('table') || '',
          viewId: url.searchParams.get('view') || '',
        };
      }
    }
    throw new Error('无法识别的飞书链接，目前支持 docx / sheets / base / wiki 链接');
  }

  return { type: null, token: text, url: null, tableId: '', viewId: '' };
}

export function buildSourceUrl(type, token) {
  const pathByType = { docx: 'docx', sheet: 'sheets', bitable: 'base' };
  return `https://feishu.cn/${pathByType[type] || 'docx'}/${token}`;
}
