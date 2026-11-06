import { feishuRequest, paginate } from './client.js';

export async function getAppMeta(appToken) {
  const data = await feishuRequest(`/open-apis/bitable/v1/apps/${appToken}`);
  return data.app;
}

export async function listTables(appToken) {
  const result = await paginate(`/open-apis/bitable/v1/apps/${appToken}/tables`, {
    pageSize: 100,
    maxPages: 10,
  });
  return result.items;
}

export async function listFields(appToken, tableId) {
  const result = await paginate(
    `/open-apis/bitable/v1/apps/${appToken}/tables/${tableId}/fields`,
    { pageSize: 100, maxPages: 10 }
  );
  return result.items;
}

export async function searchRecords(appToken, tableId, { pageSize = 100, pageToken = '', viewId = '' } = {}) {
  const body = {};
  if (viewId) body.view_id = viewId;
  return feishuRequest(
    `/open-apis/bitable/v1/apps/${appToken}/tables/${tableId}/records/search`,
    {
      method: 'POST',
      query: { page_size: pageSize, page_token: pageToken || undefined },
      body,
    }
  );
}

export async function createRecord(appToken, tableId, fields) {
  return feishuRequest(`/open-apis/bitable/v1/apps/${appToken}/tables/${tableId}/records`, {
    method: 'POST',
    body: { fields },
  });
}

export async function updateRecord(appToken, tableId, recordId, fields) {
  return feishuRequest(
    `/open-apis/bitable/v1/apps/${appToken}/tables/${tableId}/records/${recordId}`,
    { method: 'PUT', body: { fields } }
  );
}

export async function deleteRecord(appToken, tableId, recordId) {
  return feishuRequest(
    `/open-apis/bitable/v1/apps/${appToken}/tables/${tableId}/records/${recordId}`,
    { method: 'DELETE' }
  );
}

export async function batchCreateRecords(appToken, tableId, records) {
  return feishuRequest(
    `/open-apis/bitable/v1/apps/${appToken}/tables/${tableId}/records/batch_create`,
    { method: 'POST', body: { records } }
  );
}

export async function batchUpdateRecords(appToken, tableId, records) {
  return feishuRequest(
    `/open-apis/bitable/v1/apps/${appToken}/tables/${tableId}/records/batch_update`,
    { method: 'POST', body: { records } }
  );
}

export async function batchDeleteRecords(appToken, tableId, recordIds) {
  return feishuRequest(
    `/open-apis/bitable/v1/apps/${appToken}/tables/${tableId}/records/batch_delete`,
    { method: 'POST', body: { records: recordIds } }
  );
}
