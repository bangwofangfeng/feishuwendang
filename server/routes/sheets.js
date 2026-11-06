import { Router } from 'express';
import {
  appendValues,
  batchWriteValues,
  deleteDimension,
  getSpreadsheetMeta,
  insertDimension,
  listSheets,
  readValues,
  writeValues,
} from '../feishu/sheets.js';

const router = Router();

router.get('/sheets/:token', async (req, res) => {
  const { token } = req.params;
  const [spreadsheet, sheets] = await Promise.all([getSpreadsheetMeta(token), listSheets(token)]);
  res.json({ spreadsheet, sheets });
});

router.get('/sheets/:token/values', async (req, res) => {
  const range = String(req.query.range || '');
  if (!range) return res.status(400).json({ error: '缺少 range 参数' });
  const valueRange = await readValues(req.params.token, range);
  res.json({ valueRange });
});

router.put('/sheets/:token/values', async (req, res) => {
  const { range, values } = req.body || {};
  if (!range || !Array.isArray(values)) {
    return res.status(400).json({ error: '需要 range 和 values' });
  }
  const data = await writeValues(req.params.token, range, values);
  res.json({ ok: true, data });
});

router.post('/sheets/:token/values/batch', async (req, res) => {
  const { valueRanges } = req.body || {};
  if (!Array.isArray(valueRanges) || !valueRanges.length) {
    return res.status(400).json({ error: 'valueRanges 不能为空' });
  }
  const data = await batchWriteValues(req.params.token, valueRanges);
  res.json({ ok: true, data });
});

router.post('/sheets/:token/values/append', async (req, res) => {
  const { range, values } = req.body || {};
  if (!range || !Array.isArray(values)) {
    return res.status(400).json({ error: '需要 range 和 values' });
  }
  const data = await appendValues(req.params.token, range, values);
  res.json({ ok: true, data });
});

router.post('/sheets/:token/dimensions/insert', async (req, res) => {
  const { sheetId, majorDimension, startIndex, endIndex } = req.body || {};
  const data = await insertDimension(req.params.token, {
    sheetId,
    majorDimension,
    startIndex,
    endIndex,
  });
  res.json({ ok: true, data });
});

router.delete('/sheets/:token/dimensions', async (req, res) => {
  const { sheetId, majorDimension, startIndex, endIndex } = req.body || {};
  const data = await deleteDimension(req.params.token, {
    sheetId,
    majorDimension,
    startIndex,
    endIndex,
  });
  res.json({ ok: true, data });
});

export default router;
