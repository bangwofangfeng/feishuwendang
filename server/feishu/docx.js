import { feishuRequest, paginate } from './client.js';

export async function getDocument(documentId) {
  const data = await feishuRequest(`/open-apis/docx/v1/documents/${documentId}`);
  return data.document;
}

export async function listBlocks(documentId) {
  const items = [];
  let pageToken = '';
  do {
    const data = await feishuRequest(`/open-apis/docx/v1/documents/${documentId}/blocks`, {
      query: { page_size: 500, document_revision_id: -1, page_token: pageToken || undefined },
    });
    items.push(...(data.items || []));
    pageToken = data.has_more ? data.page_token : '';
  } while (pageToken);
  return items;
}

export async function getRawContent(documentId) {
  const data = await feishuRequest(`/open-apis/docx/v1/documents/${documentId}/raw_content`);
  return data.content || '';
}

export async function updateBlockText(documentId, blockId, elements) {
  return feishuRequest(`/open-apis/docx/v1/documents/${documentId}/blocks/${blockId}`, {
    method: 'PATCH',
    body: { update_text_elements: { elements } },
  });
}

export async function updateBlockTextStyle(documentId, blockId, style) {
  return feishuRequest(`/open-apis/docx/v1/documents/${documentId}/blocks/${blockId}`, {
    method: 'PATCH',
    body: { update_text_style: { style } },
  });
}

export async function batchUpdateBlocks(documentId, requests) {
  return feishuRequest(`/open-apis/docx/v1/documents/${documentId}/blocks/batch_update`, {
    method: 'PATCH',
    body: { requests },
  });
}

export async function createBlockChildren(documentId, parentId, children, index) {
  return feishuRequest(`/open-apis/docx/v1/documents/${documentId}/blocks/${parentId}/children`, {
    method: 'POST',
    query: { document_revision_id: -1 },
    body: index === undefined || index === null ? { children } : { children, index },
  });
}

export async function deleteBlockChildren(documentId, parentId, startIndex, endIndex) {
  return feishuRequest(
    `/open-apis/docx/v1/documents/${documentId}/blocks/${parentId}/children/batch_delete`,
    {
      method: 'DELETE',
      body: { start_index: startIndex, end_index: endIndex },
    }
  );
}

export async function updateTableProperty(documentId, blockId, property) {
  return feishuRequest(`/open-apis/docx/v1/documents/${documentId}/blocks/${blockId}`, {
    method: 'PATCH',
    body: { update_table_property: property },
  });
}

export async function listDocumentBlocks(documentId) {
  return paginate(`/open-apis/docx/v1/documents/${documentId}/blocks`, {
    query: { document_revision_id: -1 },
    pageSize: 500,
  });
}
