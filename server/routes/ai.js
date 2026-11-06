import { Router } from 'express';
import { config } from '../config.js';
import { runAgent } from '../ai/agent.js';
import { runDeepSeekAgent } from '../ai/deepseekAgent.js';
import { getMcpSession, getMcpState } from '../ai/mcp.js';

const router = Router();

function activeModel() {
  return config.ai.provider === 'deepseek'
    ? config.deepseek.model
    : config.anthropic.model;
}

router.get('/ai/status', (req, res) => {
  res.json({
    provider: config.ai.provider,
    configured: config.ai.configured,
    aiConfigured: config.ai.configured,
    anthropicConfigured: Boolean(config.anthropic.apiKey),
    deepseekConfigured: Boolean(config.deepseek.apiKey),
    mcpEnabled: config.mcpEnabled,
    model: activeModel(),
    mcp: getMcpState(),
  });
});

router.post('/ai/chat', async (req, res) => {
  const { messages, context } = req.body || {};
  if (!Array.isArray(messages) || !messages.length) {
    return res.status(400).json({ error: 'messages 不能为空' });
  }
  if (!config.ai.configured) {
    const keyName =
      config.ai.provider === 'deepseek' ? 'DEEPSEEK_API_KEY' : 'ANTHROPIC_API_KEY';
    return res.status(400).json({
      error: `尚未配置 ${keyName}，请在 .env 中填写后重启服务`,
    });
  }

  res.setHeader('Content-Type', 'text/event-stream; charset=utf-8');
  res.setHeader('Cache-Control', 'no-cache, no-transform');
  res.setHeader('Connection', 'keep-alive');
  res.setHeader('X-Accel-Buffering', 'no');
  res.flushHeaders?.();

  let closed = false;
  res.on('close', () => {
    closed = true;
  });

  const send = (event) => {
    if (!closed && !res.writableEnded) {
      res.write(`data: ${JSON.stringify(event)}\n\n`);
    }
  };

  try {
    const session = await getMcpSession();
    send({
      type: 'ready',
      provider: config.ai.provider,
      model: activeModel(),
      mcp: {
        connected: Boolean(session.client),
        toolCount: session.tools.length,
        error: session.error || null,
      },
    });
    const runner = config.ai.provider === 'deepseek' ? runDeepSeekAgent : runAgent;
    await runner({ messages, context, onEvent: send });
  } catch (error) {
    console.error('[ai] 对话失败', error);
    send({ type: 'error', message: error.message || 'AI 请求失败' });
  } finally {
    if (!closed) {
      res.write('data: [DONE]\n\n');
      res.end();
    }
  }
});

export default router;
