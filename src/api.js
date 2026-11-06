export class ApiError extends Error {
  constructor(message, { hint = '', code } = {}) {
    super(message);
    this.name = 'ApiError';
    this.hint = hint;
    this.code = code;
  }
}

async function request(path, { method = 'GET', body, headers = {} } = {}) {
  const options = { method, headers: { ...headers } };
  if (body !== undefined) {
    options.headers['Content-Type'] = 'application/json';
    options.body = JSON.stringify(body);
  }
  let res;
  try {
    res = await fetch(path, options);
  } catch {
    throw new ApiError('无法连接后端服务，请确认 npm run dev 的 API 进程正在运行');
  }
  const contentType = res.headers.get('content-type') || '';
  const data = contentType.includes('application/json') ? await res.json().catch(() => null) : null;
  if (!res.ok) {
    throw new ApiError(data?.error || `请求失败（HTTP ${res.status}）`, {
      hint: data?.hint || '',
      code: data?.code,
    });
  }
  return data;
}

function query(params) {
  const search = new URLSearchParams();
  for (const [key, value] of Object.entries(params)) {
    if (value !== undefined && value !== null && value !== '') search.set(key, value);
  }
  const text = search.toString();
  return text ? `?${text}` : '';
}

export const api = {
  status: () => request('/api/status'),
  typeStats: () => request('/api/stats/types'),
  feishuCheck: () => request('/api/feishu/check'),
  aiStatus: () => request('/api/ai/status'),

  sources: () => request('/api/sources'),
  sourceLookup: (type, token) =>
    request(`/api/sources/lookup${query({ type, token })}`),
  addSource: (body) => request('/api/sources', { method: 'POST', body }),
  deleteSource: (id) => request(`/api/sources/${id}`, { method: 'DELETE' }),
  syncSource: (id) => request(`/api/sources/${id}/sync`, { method: 'POST', body: {} }),
  syncAll: () => request('/api/sync', { method: 'POST', body: { force: true } }),

  wikiSpaces: () => request('/api/wiki/spaces'),
  wikiNodes: (spaceId, parent = '') =>
    request(`/api/wiki/spaces/${encodeURIComponent(spaceId)}/nodes${query({ parent })}`),
  wikiImport: (body) => request('/api/wiki/import', { method: 'POST', body }),

  documents: ({ type = '', q = '' } = {}) => request(`/api/documents${query({ type, q })}`),
  document: (id) => request(`/api/documents/${id}`),

  docx: (token) => request(`/api/docx/${encodeURIComponent(token)}`),
  updateBlock: (token, blockId, elements) =>
    request(`/api/docx/${encodeURIComponent(token)}/blocks/${encodeURIComponent(blockId)}`, {
      method: 'PATCH',
      body: { elements },
    }),
  updateBlockStyle: (token, blockId, style) =>
    request(`/api/docx/${encodeURIComponent(token)}/blocks/${encodeURIComponent(blockId)}`, {
      method: 'PATCH',
      body: { style },
    }),
  batchUpdateBlocks: (token, requests) =>
    request(`/api/docx/${encodeURIComponent(token)}/blocks/batch-update`, {
      method: 'PATCH',
      body: { requests },
    }),
  createBlocks: (token, parentId, children, index) =>
    request(
      `/api/docx/${encodeURIComponent(token)}/blocks/${encodeURIComponent(parentId)}/children`,
      { method: 'POST', body: { children, index } }
    ),
  deleteBlocks: (token, parentId, startIndex, endIndex) =>
    request(
      `/api/docx/${encodeURIComponent(token)}/blocks/${encodeURIComponent(parentId)}/children`,
      { method: 'DELETE', body: { start_index: startIndex, end_index: endIndex } }
    ),
  uploadImage: async (token, file, { parentBlock, index } = {}) => {
    const headers = {
      'Content-Type': file.type || 'application/octet-stream',
      'X-File-Name': encodeURIComponent(file.name || 'image.png'),
    };
    if (parentBlock) headers['X-Parent-Block'] = parentBlock;
    if (index !== undefined && index !== null) headers['X-Block-Index'] = String(index);
    const res = await fetch(`/api/docx/${encodeURIComponent(token)}/images`, {
      method: 'POST',
      headers,
      body: file,
    });
    const data = await res.json().catch(() => null);
    if (!res.ok) throw new ApiError(data?.error || '图片上传失败', { hint: data?.hint });
    return data;
  },

  sheetMeta: (token) => request(`/api/sheets/${encodeURIComponent(token)}`),
  sheetValues: (token, range) =>
    request(`/api/sheets/${encodeURIComponent(token)}/values${query({ range })}`),
  writeSheetValues: (token, range, values) =>
    request(`/api/sheets/${encodeURIComponent(token)}/values`, {
      method: 'PUT',
      body: { range, values },
    }),
  batchWriteSheetValues: (token, valueRanges) =>
    request(`/api/sheets/${encodeURIComponent(token)}/values/batch`, {
      method: 'POST',
      body: { valueRanges },
    }),
  appendSheetValues: (token, range, values) =>
    request(`/api/sheets/${encodeURIComponent(token)}/values/append`, {
      method: 'POST',
      body: { range, values },
    }),
  insertSheetDimension: (token, dimension) =>
    request(`/api/sheets/${encodeURIComponent(token)}/dimensions/insert`, {
      method: 'POST',
      body: dimension,
    }),
  deleteSheetDimension: (token, dimension) =>
    request(`/api/sheets/${encodeURIComponent(token)}/dimensions`, {
      method: 'DELETE',
      body: dimension,
    }),

  bitableMeta: (token) => request(`/api/bitable/${encodeURIComponent(token)}`),
  bitableFields: (token, tableId) =>
    request(
      `/api/bitable/${encodeURIComponent(token)}/tables/${encodeURIComponent(tableId)}/fields`
    ),
  bitableRecords: (token, tableId, { pageToken = '', pageSize = 100, viewId = '' } = {}) =>
    request(
      `/api/bitable/${encodeURIComponent(token)}/tables/${encodeURIComponent(tableId)}/records${query(
        { pageToken, pageSize, viewId }
      )}`
    ),
  createRecord: (token, tableId, fields) =>
    request(`/api/bitable/${encodeURIComponent(token)}/tables/${encodeURIComponent(tableId)}/records`, {
      method: 'POST',
      body: { fields },
    }),
  updateRecord: (token, tableId, recordId, fields) =>
    request(
      `/api/bitable/${encodeURIComponent(token)}/tables/${encodeURIComponent(tableId)}/records/${encodeURIComponent(recordId)}`,
      { method: 'PUT', body: { fields } }
    ),
  deleteRecord: (token, tableId, recordId) =>
    request(
      `/api/bitable/${encodeURIComponent(token)}/tables/${encodeURIComponent(tableId)}/records/${encodeURIComponent(recordId)}`,
      { method: 'DELETE' }
    ),
};
