import { db, nowIso } from '../db.js';
import { describeFeishuError } from '../feishu/client.js';
import { parseFeishuLink, SUPPORTED_TYPES } from '../feishu/links.js';
import { mapWikiObjectType, resolveWikiNode } from '../feishu/wiki.js';
import { syncSource } from './sync.js';

const TYPE_LABELS = { docx: '云文档', sheet: '电子表格', bitable: '多维表格' };

export async function resolveSourceInput({ url, token, type }) {
  const raw = url || token;
  const parsed = parseFeishuLink(raw);
  let resolvedType = type || parsed.type;

  if (resolvedType === 'wiki') {
    const node = await resolveWikiNode(parsed.token);
    const mapped = mapWikiObjectType(node?.obj_type);
    if (!mapped) {
      throw new Error(
        `知识库节点「${node?.title || parsed.token}」的类型为 ${node?.obj_type || '未知'}，暂不支持汇总`
      );
    }
    return {
      type: mapped,
      token: node.obj_token,
      url: parsed.url,
      title: node.title,
      wikiSpaceId: node.space_id || '',
      wikiNodeToken: node.node_token || '',
    };
  }

  if (parsed.type === 'doc') {
    throw new Error('旧版文档（/docs/）暂不支持，请先在飞书中转换为新版文档');
  }

  if (!SUPPORTED_TYPES.has(resolvedType)) {
    throw new Error(
      `无法确定文档类型。请粘贴包含 /docx/、/sheets/、/base/ 或 /wiki/ 的链接，或手动选择类型`
    );
  }

  if (!parsed.token) throw new Error('缺少文档 Token');

  return {
    type: resolvedType,
    token: parsed.token,
    url: parsed.url,
    title: null,
    wikiSpaceId: '',
    wikiNodeToken: '',
  };
}

export function getSource(sourceId) {
  return db.prepare('SELECT * FROM sources WHERE id = ?').get(sourceId);
}

export function listSources() {
  return db
    .prepare(
      `SELECT s.id, s.type, s.token, s.url, s.title AS source_title, s.wiki_space_id,
              s.wiki_node_token, s.added_at, s.last_synced_at,
              d.title, d.synced_at, d.sync_error
       FROM sources s
       LEFT JOIN documents d ON d.source_id = s.id
       ORDER BY COALESCE(d.synced_at, s.added_at) DESC`
    )
    .all();
}

export async function addSource(input) {
  const resolved = await resolveSourceInput(input);
  const existing = db
    .prepare('SELECT * FROM sources WHERE type = ? AND token = ?')
    .get(resolved.type, resolved.token);
  if (existing) {
    return { source: existing, duplicate: true, sync: null };
  }

  const info = db
    .prepare(
      `INSERT INTO sources (type, token, url, title, wiki_space_id, wiki_node_token, added_at)
       VALUES (?, ?, ?, ?, ?, ?, ?)`
    )
    .run(
      resolved.type,
      resolved.token,
      resolved.url,
      resolved.title,
      resolved.wikiSpaceId,
      resolved.wikiNodeToken,
      nowIso()
    );
  const sourceId = Number(info.lastInsertRowid);

  db.prepare('INSERT INTO documents (source_id, type, token, title) VALUES (?, ?, ?, ?)').run(
    sourceId,
    resolved.type,
    resolved.token,
    resolved.title
  );

  let sync = null;
  try {
    sync = await syncSource(sourceId);
  } catch (error) {
    sync = { ok: false, error: describeFeishuError(error) };
  }

  return { source: getSource(sourceId), duplicate: false, sync };
}

export function deleteSource(sourceId) {
  const info = db.prepare('DELETE FROM sources WHERE id = ?').run(sourceId);
  return info.changes > 0;
}

export function typeLabel(type) {
  return TYPE_LABELS[type] || type;
}
