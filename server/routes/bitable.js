import { Router } from 'express';
import {
  createRecord,
  deleteRecord,
  getAppMeta,
  listFields,
  listTables,
  searchRecords,
  updateRecord,
} from '../feishu/bitable.js';

const router = Router();

router.get('/bitable/:token', async (req, res) => {
  const { token } = req.params;
  let app = null;
  try {
    app = await getAppMeta(token);
  } catch {
    app = null;
  }
  const tables = await listTables(token);
  res.json({ app, tables });
});

router.get('/bitable/:token/tables', async (req, res) => {
  const tables = await listTables(req.params.token);
  res.json({ items: tables });
});

router.get('/bitable/:token/tables/:tableId/fields', async (req, res) => {
  const fields = await listFields(req.params.token, req.params.tableId);
  res.json({ items: fields });
});

router.get('/bitable/:token/tables/:tableId/records', async (req, res) => {
  const data = await searchRecords(req.params.token, req.params.tableId, {
    pageSize: Math.min(Number(req.query.pageSize) || 100, 500),
    pageToken: String(req.query.pageToken || ''),
    viewId: String(req.query.viewId || ''),
  });
  res.json({
    items: data.items || [],
    hasMore: Boolean(data.has_more),
    pageToken: data.page_token || '',
    total: data.total,
  });
});

router.post('/bitable/:token/tables/:tableId/records', async (req, res) => {
  const { fields } = req.body || {};
  if (!fields || typeof fields !== 'object') {
    return res.status(400).json({ error: '缺少 fields' });
  }
  const data = await createRecord(req.params.token, req.params.tableId, fields);
  res.json({ ok: true, record: data.record });
});

router.put('/bitable/:token/tables/:tableId/records/:recordId', async (req, res) => {
  const { fields } = req.body || {};
  if (!fields || typeof fields !== 'object') {
    return res.status(400).json({ error: '缺少 fields' });
  }
  const data = await updateRecord(
    req.params.token,
    req.params.tableId,
    req.params.recordId,
    fields
  );
  res.json({ ok: true, record: data.record });
});

router.delete('/bitable/:token/tables/:tableId/records/:recordId', async (req, res) => {
  const data = await deleteRecord(req.params.token, req.params.tableId, req.params.recordId);
  res.json({ ok: true, data });
});

export default router;
