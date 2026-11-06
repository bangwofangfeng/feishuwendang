import { Router } from 'express';
import { db } from '../db.js';

const router = Router();

function makeSnippet(text, query, max = 150) {
  if (!text) return '';
  const plain = String(text).replace(/\s+/g, ' ').trim();
  if (!query) return plain.slice(0, max);
  const index = plain.toLowerCase().indexOf(query.toLowerCase());
  if (index < 0) return plain.slice(0, max);
  const start = Math.max(0, index - 40);
  const end = start + max;
  return `${start > 0 ? '…' : ''}${plain.slice(start, end)}${end < plain.length ? '…' : ''}`;
}

router.get('/documents', (req, res) => {
  const type = String(req.query.type || '');
  const query = String(req.query.q || '').trim();
  const limit = Math.min(Math.max(Number(req.query.limit) || 200, 1), 500);

  const conditions = [];
  const params = [];
  if (type) {
    conditions.push('d.type = ?');
    params.push(type);
  }
  if (query) {
    conditions.push(
      `(instr(lower(coalesce(d.title, '')), lower(?)) > 0
        OR instr(lower(coalesce(d.search_text, '')), lower(?)) > 0)`
    );
    params.push(query, query);
  }
  const where = conditions.length ? `WHERE ${conditions.join(' AND ')}` : '';

  const rows = db
    .prepare(
      `SELECT d.id, d.source_id, d.type, d.token, d.title, d.search_text, d.synced_at, d.sync_error,
              s.url, s.added_at, s.wiki_space_id
       FROM documents d
       JOIN sources s ON s.id = d.source_id
       ${where}
       ORDER BY COALESCE(d.synced_at, s.added_at) DESC
       LIMIT ?`
    )
    .all(...params, limit);

  const items = rows.map(({ search_text, ...row }) => ({
    ...row,
    snippet: makeSnippet(search_text, query),
  }));

  res.json({ items, query, type });
});

router.get('/documents/:id', (req, res) => {
  const row = db
    .prepare(
      `SELECT d.*, s.url, s.added_at, s.wiki_space_id
       FROM documents d JOIN sources s ON s.id = d.source_id
       WHERE d.id = ?`
    )
    .get(Number(req.params.id));
  if (!row) return res.status(404).json({ error: '文档不存在' });
  res.json({
    ...row,
    meta: row.meta_json ? JSON.parse(row.meta_json) : null,
    content: row.content_json ? JSON.parse(row.content_json) : null,
  });
});

export default router;
