import { Router } from 'express';
import { config } from '../config.js';
import { db } from '../db.js';
import { getTenantAccessToken } from '../feishu/client.js';

const router = Router();

router.get('/health', (req, res) => {
  res.json({ ok: true, time: new Date().toISOString() });
});

router.get('/status', (req, res) => {
  const sourceCount = db.prepare('SELECT COUNT(*) AS count FROM sources').get().count;
  const documentCount = db.prepare('SELECT COUNT(*) AS count FROM documents').get().count;
  const aiModel =
    config.ai.provider === 'deepseek'
      ? config.deepseek.model
      : config.anthropic.model;
  res.json({
    feishuConfigured: config.isFeishuConfigured,
    aiConfigured: config.ai.configured,
    aiProvider: config.ai.provider,
    anthropicConfigured: Boolean(config.anthropic.apiKey),
    deepseekConfigured: Boolean(config.deepseek.apiKey),
    mcpEnabled: config.mcpEnabled,
    model: aiModel,
    syncIntervalMinutes: config.syncIntervalMinutes,
    counts: { sources: sourceCount, documents: documentCount },
  });
});

router.get('/feishu/check', async (req, res) => {
  const token = await getTenantAccessToken();
  res.json({ ok: true, tokenPreview: `${token.slice(0, 6)}…${token.slice(-4)}` });
});

export default router;
