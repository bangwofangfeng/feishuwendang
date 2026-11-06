import { feishuRequest } from './client.js';

export async function getSpreadsheetMeta(spreadsheetToken) {
  const data = await feishuRequest(`/open-apis/sheets/v3/spreadsheets/${spreadsheetToken}`);
  return data.spreadsheet;
}

export async function listSheets(spreadsheetToken) {
  const data = await feishuRequest(`/open-apis/sheets/v3/spreadsheets/${spreadsheetToken}/sheets/query`);
  return data.sheets || [];
}

export async function readValues(spreadsheetToken, range) {
  const data = await feishuRequest(
    `/open-apis/sheets/v2/spreadsheets/${spreadsheetToken}/values/${encodeURIComponent(range)}`,
    {
      query: {
        valueRenderOption: 'ToString',
        dateTimeRenderOption: 'FormattedString',
      },
    }
  );
  return data.valueRange;
}

export async function writeValues(spreadsheetToken, range, values) {
  return feishuRequest(`/open-apis/sheets/v2/spreadsheets/${spreadsheetToken}/values`, {
    method: 'PUT',
    body: { valueRange: { range, values } },
  });
}

export async function batchWriteValues(spreadsheetToken, valueRanges) {
  return feishuRequest(`/open-apis/sheets/v2/spreadsheets/${spreadsheetToken}/values_batch_update`, {
    method: 'POST',
    body: { valueRanges },
  });
}

export async function appendValues(spreadsheetToken, range, values) {
  return feishuRequest(`/open-apis/sheets/v2/spreadsheets/${spreadsheetToken}/values_append`, {
    method: 'POST',
    query: { insertDataOption: 'INSERT_ROWS' },
    body: { valueRange: { range, values } },
  });
}

export async function insertDimension(spreadsheetToken, dimension) {
  return feishuRequest(`/open-apis/sheets/v2/spreadsheets/${spreadsheetToken}/dimension_range`, {
    method: 'POST',
    body: { dimension, inheritStyle: 'BEFORE' },
  });
}

export async function deleteDimension(spreadsheetToken, dimension) {
  return feishuRequest(`/open-apis/sheets/v2/spreadsheets/${spreadsheetToken}/dimension_range`, {
    method: 'DELETE',
    body: { dimension },
  });
}
