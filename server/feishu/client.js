import { config } from '../config.js';

const TOKEN_INVALID_CODES = new Set([99991661, 99991663, 99991668]);

export class FeishuApiError extends Error {
  constructor(message, { code, status, path, hint, detail } = {}) {
    super(message);
    this.name = 'FeishuApiError';
    this.code = code;
    this.status = status;
    this.path = path;
    this.hint = hint;
    this.detail = detail;
  }
}

let tokenCache = { value: '', expiresAt: 0 };
let tokenInflight = null;

async function fetchTenantAccessToken() {
  if (!config.isFeishuConfigured) {
    throw new FeishuApiError('尚未配置飞书应用凭证，请在 .env 中填写 FEISHU_APP_ID 和 FEISHU_APP_SECRET', {
      code: 'NO_CREDENTIALS',
      status: 400,
    });
  }
  const res = await fetch(`${config.feishu.baseUrl}/open-apis/auth/v3/tenant_access_token/internal`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json; charset=utf-8' },
    body: JSON.stringify({
      app_id: config.feishu.appId,
      app_secret: config.feishu.appSecret,
    }),
    signal: AbortSignal.timeout(20000),
  });
  const json = await res.json().catch(() => null);
  if (!res.ok || !json || json.code !== 0 || !json.tenant_access_token) {
    const message =
      json?.code === 0 && !json?.tenant_access_token
        ? '飞书返回成功但缺少 tenant_access_token，请检查应用凭证或接口域名'
        : json?.msg || `获取 tenant_access_token 失败（HTTP ${res.status}）`;
    throw new FeishuApiError(message, {
      code: json?.code,
      status: res.status,
      path: '/auth/v3/tenant_access_token/internal',
    });
  }
  tokenCache = {
    value: json.tenant_access_token,
    // 提前 5 分钟过期，避免边界失效
    expiresAt: Date.now() + Math.max(60, (json.expire || 7200) - 300) * 1000,
  };
  return tokenCache.value;
}

export async function getTenantAccessToken() {
  if (tokenCache.value && Date.now() < tokenCache.expiresAt) return tokenCache.value;
  if (!tokenInflight) {
    tokenInflight = fetchTenantAccessToken().finally(() => {
      tokenInflight = null;
    });
  }
  return tokenInflight;
}

function buildUrl(path, query) {
  const url = new URL(path.startsWith('http') ? path : `${config.feishu.baseUrl}${path}`);
  for (const [key, value] of Object.entries(query || {})) {
    if (value !== undefined && value !== null && value !== '') {
      url.searchParams.set(key, String(value));
    }
  }
  return url;
}

function apiError(json, res, path) {
  const hint = json?.error?.troubleshooter || json?.error?.message || '';
  return new FeishuApiError(json?.msg || `飞书接口返回 HTTP ${res.status}`, {
    code: json?.code ?? res.status,
    status: res.status,
    path,
    hint,
    detail: json?.error,
  });
}

async function requestWithToken(token, path, { method = 'GET', query, body } = {}) {
  const url = buildUrl(path, query);
  const headers = { Authorization: `Bearer ${token}` };
  let payload;
  if (body !== undefined) {
    headers['Content-Type'] = 'application/json; charset=utf-8';
    payload = JSON.stringify(body);
  }
  const res = await fetch(url, {
    method,
    headers,
    body: payload,
    signal: AbortSignal.timeout(30000),
  });
  const json = await res.json().catch(() => null);
  if (!res.ok || !json || json.code !== 0) throw apiError(json, res, path);
  return json.data ?? json;
}

export async function feishuRequest(path, options = {}) {
  const token = await getTenantAccessToken();
  try {
    return await requestWithToken(token, path, options);
  } catch (error) {
    if (error instanceof FeishuApiError && TOKEN_INVALID_CODES.has(error.code)) {
      tokenCache = { value: '', expiresAt: 0 };
      const fresh = await getTenantAccessToken();
      return requestWithToken(fresh, path, options);
    }
    throw error;
  }
}

export async function feishuDownload(path, { query } = {}) {
  const token = await getTenantAccessToken();
  const res = await fetch(buildUrl(path, query), {
    headers: { Authorization: `Bearer ${token}` },
    signal: AbortSignal.timeout(60000),
  });
  if (!res.ok) {
    const json = await res.json().catch(() => null);
    throw apiError(json, res, path);
  }
  return res;
}

export async function feishuUpload(path, form) {
  const token = await getTenantAccessToken();
  const res = await fetch(buildUrl(path), {
    method: 'POST',
    headers: { Authorization: `Bearer ${token}` },
    body: form,
    signal: AbortSignal.timeout(120000),
  });
  const json = await res.json().catch(() => null);
  if (!res.ok || !json || json.code !== 0) throw apiError(json, res, path);
  return json.data ?? json;
}

export async function paginate(path, { query = {}, pageSize = 100, maxPages = 20, itemKey = 'items' } = {}) {
  const items = [];
  let pageToken = '';
  let pages = 0;
  do {
    const data = await feishuRequest(path, {
      query: { ...query, page_size: pageSize, page_token: pageToken || undefined },
    });
    items.push(...(data?.[itemKey] || []));
    pageToken = data?.has_more ? data.page_token : '';
    pages += 1;
  } while (pageToken && pages < maxPages);
  return { items, hasMore: Boolean(pageToken), pages };
}

export function describeFeishuError(error) {
  if (!(error instanceof FeishuApiError)) return error?.message || '未知错误';
  const parts = [error.message];
  if (error.code !== undefined && error.code !== error.status) parts.push(`错误码 ${error.code}`);
  if (error.hint) parts.push(error.hint);
  return parts.filter(Boolean).join(' · ');
}
