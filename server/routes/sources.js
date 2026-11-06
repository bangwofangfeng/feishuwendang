import { Router } from 'express';
import { db } from '../db.js';
import { describeFeishuError } from '../feishu/client.js';
import { listWikiNodes, listWikiSpaces, resolveWikiNode } from '../feishu/wiki.js';
import { addSource, deleteSource, listSources } from '../services/sources.js';
import { syncAll, syncSource } from '../services/sync.js';

const router = Router();

router.get('/sources', (req, res) => {
  res.json({ items: listSources() });
});

router.post('/sources', async (req, res) => {
  const { url, token, type } = req.body || {};
  if (!url && !token) {
    return res.status(400).json({ error: '请提供飞书链接或 Token' });
  }
  const result = await addSource({ url, token, type });
  res.status(result.duplicate ? 200 : 201).json(result);
});

router.get('/sources/lookup', (req, res) => {
  const type = String(req.query.type || '');
  const token = String(req.query.token || '');
  const row = db
    .prepare(
      'SELECT id, type, token, url, title, wiki_space_id, last_synced_at FROM sources WHERE type = ? AND token = ?'
    )
    .get(type, token);
  if (!row) return res.status(404).json({ error: '该文档不在数据源中' });
  res.json({ source: row });
});

router.delete('/sources/:id', (req, res) => {
  const deleted = deleteSource(Number(req.params.id));
  if (!deleted) return res.status(404).json({ error: '数据源不存在' });
  res.json({ ok: true });
});

router.post('/sources/:id/sync', async (req, res) => {
  try {
    const result = await syncSource(Number(req.params.id));
    res.json(result);
  } catch (error) {
    res.status(502).json({ error: describeFeishuError(error), sourceId: Number(req.params.id) });
  }
});

router.post('/sync', async (req, res) => {
  const force = req.body?.force !== false;
  const result = await syncAll({ force });
  res.json({ ...result, failures: result.failures.map((f) => ({ ...f, error: describeFeishuError(f.error) })) });
});

router.get('/wiki/spaces', async (req, res) => {
  const result = await listWikiSpaces();
  res.json({ items: result.items, hasMore: result.hasMore });
});

router.get('/wiki/spaces/:spaceId/nodes', async (req, res) => {
  const result = await listWikiNodes(req.params.spaceId, String(req.query.parent || ''));
  res.json({ items: result.items, hasMore: result.hasMore });
});

router.post('/wiki/import', async (req, res) => {
  const { spaceId, nodes } = req.body || {};
  const nodeTokens = Array.isArray(nodes)
    ? nodes
        .map((node) => (typeof node === 'string' ? node : node?.node_token))
        .filter(Boolean)
    : [];
  if (!nodeTokens.length) return res.status(400).json({ error: '请选择要导入的知识库节点' });

  const results = [];
  for (const nodeToken of nodeTokens.slice(0, 50)) {
    try {
      const node = await resolveWikiNode(nodeToken);
      const result = await addSource({ token: nodeToken, type: 'wiki' });
      results.push({
        node_token: nodeToken,
        title: node?.title,
        ok: true,
        duplicate: result.duplicate,
        sync: result.sync,
      });
    } catch (error) {
      results.push({ node_token: nodeToken, ok: false, error: describeFeishuError(error) });
    }
  }
  res.json({ spaceId, results });
});

router.get('/stats/types', (req, res) => {
  const rows = db
    .prepare('SELECT type, COUNT(*) AS count FROM documents GROUP BY type')
    .all();
  res.json({ items: rows });
});

export default router;
