import { Router } from 'express';
import { Readable } from 'node:stream';
import {
  batchUpdateBlocks,
  createBlockChildren,
  deleteBlockChildren,
  getDocument,
  listBlocks,
  updateBlockText,
  updateBlockTextStyle,
} from '../feishu/docx.js';
import { downloadMedia, uploadMedia } from '../feishu/drive.js';

const router = Router();

router.get('/docx/:token', async (req, res) => {
  const { token } = req.params;
  const [document, blocks] = await Promise.all([getDocument(token), listBlocks(token)]);
  res.json({ document, blocks });
});

router.patch('/docx/:token/blocks/:blockId', async (req, res) => {
  const { token, blockId } = req.params;
  const { elements, style } = req.body || {};
  if (Array.isArray(elements)) {
    const data = await updateBlockText(token, blockId, elements);
    return res.json({ ok: true, data });
  }
  if (style && typeof style === 'object') {
    const data = await updateBlockTextStyle(token, blockId, style);
    return res.json({ ok: true, data });
  }
  res.status(400).json({ error: '请提供 elements 或 style' });
});

router.post('/docx/:token/blocks/batch-update', async (req, res) => {
  const { requests } = req.body || {};
  if (!Array.isArray(requests) || !requests.length) {
    return res.status(400).json({ error: 'requests 不能为空' });
  }
  const data = await batchUpdateBlocks(req.params.token, requests);
  res.json({ ok: true, data });
});

router.post('/docx/:token/blocks/:parentId/children', async (req, res) => {
  const { children, index } = req.body || {};
  if (!Array.isArray(children) || !children.length) {
    return res.status(400).json({ error: 'children 不能为空' });
  }
  const data = await createBlockChildren(req.params.token, req.params.parentId, children, index);
  res.json({ ok: true, data });
});

router.delete('/docx/:token/blocks/:parentId/children', async (req, res) => {
  const { start_index: startIndex, end_index: endIndex } = req.body || {};
  if (!Number.isInteger(startIndex) || !Number.isInteger(endIndex)) {
    return res.status(400).json({ error: 'start_index / end_index 必须是整数' });
  }
  const data = await deleteBlockChildren(
    req.params.token,
    req.params.parentId,
    startIndex,
    endIndex
  );
  res.json({ ok: true, data });
});

router.post('/docx/:token/images', async (req, res) => {
  const buffer = Buffer.isBuffer(req.body) ? req.body : null;
  if (!buffer?.length) return res.status(400).json({ error: '没有收到图片数据' });

  const fileName = decodeURIComponent(req.get('x-file-name') || 'image.png');
  const parentNode = req.get('x-parent-block') || req.params.token;
  const rawIndex = req.get('x-block-index');
  const insertIndex = rawIndex === null || rawIndex === undefined || rawIndex === ''
    ? undefined
    : Number(rawIndex);
  const mimeType = req.get('content-type') || 'image/png';

  const uploaded = await uploadMedia({
    fileName,
    parentType: 'docx_image',
    parentNode,
    buffer,
    mimeType,
  });
  const fileToken = uploaded.file_token;
  const created = await createBlockChildren(
    req.params.token,
    parentNode,
    [{ block_type: 25, image: { token: fileToken } }],
    Number.isInteger(insertIndex) ? insertIndex : undefined
  );
  res.json({ ok: true, file_token: fileToken, data: created });
});

router.get('/media/:fileToken', async (req, res) => {
  const upstream = await downloadMedia(req.params.fileToken);
  res.setHeader('Content-Type', upstream.headers.get('content-type') || 'application/octet-stream');
  const length = upstream.headers.get('content-length');
  if (length) res.setHeader('Content-Length', length);
  res.setHeader('Cache-Control', 'private, max-age=600');
  if (!upstream.body) return res.end();
  Readable.fromWeb(upstream.body).pipe(res);
});

export default router;
