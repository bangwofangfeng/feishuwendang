import { feishuRequest, paginate } from './client.js';

export async function listWikiSpaces() {
  const result = await paginate('/open-apis/wiki/v2/spaces', { pageSize: 50, maxPages: 20 });
  return result;
}

export async function listWikiNodes(spaceId, parentNodeToken = '') {
  const result = await paginate(`/open-apis/wiki/v2/spaces/${spaceId}/nodes`, {
    query: { parent_node_token: parentNodeToken || undefined },
    pageSize: 50,
    maxPages: 20,
  });
  return result;
}

export async function resolveWikiNode(nodeToken) {
  const data = await feishuRequest('/open-apis/wiki/v2/spaces/get_node', {
    query: { token: nodeToken },
  });
  return data.node;
}

const WIKI_OBJECT_TYPE_MAP = {
  docx: 'docx',
  sheet: 'sheet',
  bitable: 'bitable',
};

export function mapWikiObjectType(objType) {
  return WIKI_OBJECT_TYPE_MAP[objType] || null;
}
