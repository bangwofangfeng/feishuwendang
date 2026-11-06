export const TYPE_LABELS = {
  docx: '云文档',
  sheet: '电子表格',
  bitable: '多维表格',
};

export const TYPE_PATHS = {
  docx: 'docx',
  sheet: 'sheet',
  bitable: 'bitable',
};

export function typeLabel(type) {
  return TYPE_LABELS[type] || type || '文档';
}

export function typeRoute(type, token) {
  return `/${TYPE_PATHS[type] || 'docx'}/${token}`;
}

export function relativeTime(value) {
  if (!value) return '尚未同步';
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return '—';
  const diff = Date.now() - date.getTime();
  if (diff < 60000) return '刚刚';
  if (diff < 3600000) return `${Math.floor(diff / 60000)} 分钟前`;
  if (diff < 86400000) return `${Math.floor(diff / 3600000)} 小时前`;
  if (diff < 172800000) return `昨天 ${pad(date.getHours())}:${pad(date.getMinutes())}`;
  if (date.getFullYear() === new Date().getFullYear()) {
    return `${date.getMonth() + 1} 月 ${date.getDate()} 日`;
  }
  return `${date.getFullYear()}/${pad(date.getMonth() + 1)}/${pad(date.getDate())}`;
}

export function absoluteTime(value) {
  if (!value) return '—';
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return '—';
  return `${date.getFullYear()}/${pad(date.getMonth() + 1)}/${pad(date.getDate())} ${pad(
    date.getHours()
  )}:${pad(date.getMinutes())}`;
}

function pad(value) {
  return String(value).padStart(2, '0');
}

export function columnName(index) {
  let name = '';
  let current = index;
  do {
    name = String.fromCharCode(65 + (current % 26)) + name;
    current = Math.floor(current / 26) - 1;
  } while (current >= 0);
  return name;
}

export function cellText(value) {
  if (value === null || value === undefined) return '';
  if (typeof value === 'string') return value;
  if (typeof value === 'number' || typeof value === 'boolean') return String(value);
  if (Array.isArray(value)) return value.map(cellText).join(' ');
  if (typeof value === 'object') {
    if (value.text) return value.text;
    if (value.name) return value.name;
    if (value.link) return value.link;
    if (value.value !== undefined) return cellText(value.value);
  }
  return '';
}

export function formatBitableValue(value, field) {
  if (value === null || value === undefined || value === '') return '';
  if (field?.type === 7) return value ? '是' : '否';
  if (field?.type === 5) {
    const number = typeof value === 'number' ? value : Number(value);
    if (Number.isFinite(number)) {
      const date = new Date(number);
      if (!Number.isNaN(date.getTime())) return absoluteTime(date.toISOString()).slice(0, 10);
    }
  }
  if (field?.type === 11) {
    return Array.isArray(value)
      ? value.map((person) => person.name || person.en_name || person.id || '').join(' ')
      : cellText(value);
  }
  if (field?.type === 17) {
    return Array.isArray(value) ? `${value.length} 个附件` : '附件';
  }
  if (Array.isArray(value)) return value.map(cellText).join('、');
  if (typeof value === 'object') return cellText(value);
  if (field?.type === 2 && typeof value === 'number') return String(value);
  return String(value);
}

export function formatNumber(value) {
  const number = Number(value);
  return Number.isFinite(number) ? number.toLocaleString('zh-CN') : String(value ?? '');
}

export function errorMessage(error) {
  if (!error) return '';
  return error.hint ? `${error.message}（${error.hint}）` : error.message;
}

export function debounce(fn, delay = 250) {
  let timer = null;
  return (...args) => {
    clearTimeout(timer);
    timer = setTimeout(() => fn(...args), delay);
  };
}
