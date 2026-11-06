import 'dotenv/config';
import path from 'node:path';
import { randomUUID } from 'node:crypto';
import { fileURLToPath } from 'node:url';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');

const appId = (process.env.FEISHU_APP_ID || '').trim();
const appSecret = (process.env.FEISHU_APP_SECRET || '').trim();
const anthropicKey = (process.env.ANTHROPIC_API_KEY || '').trim();
const deepseekKey = (process.env.DEEPSEEK_API_KEY || '').trim();
const gatewayBaseUrl = (process.env.AI_GATEWAY_BASE_URL || '').trim();
const gatewayModel = (process.env.AI_GATEWAY_MODEL || '').trim();
const gatewayKey = (process.env.AI_GATEWAY_API_KEY || '').trim();
const gatewaySessionId = (process.env.AI_GATEWAY_SESSION_ID || '').trim();
const anthropicBaseUrl = (
  gatewayBaseUrl ||
  process.env.ANTHROPIC_BASE_URL ||
  ''
).trim();
const anthropicModel =
  gatewayModel || process.env.ANTHROPIC_MODEL || 'claude-sonnet-5';
const effectiveAnthropicKey =
  anthropicBaseUrl && gatewayKey ? gatewayKey : anthropicKey;
const anthropicSessionId =
  gatewaySessionId || (anthropicBaseUrl ? randomUUID() : '');
const aiProvider =
  (process.env.AI_PROVIDER || 'deepseek').toLowerCase() === 'anthropic'
    ? 'anthropic'
    : 'deepseek';

export const config = {
  root,
  port: Number(process.env.PORT || 3001),
  dbPath: path.join(root, 'data', 'app.db'),
  feishu: {
    appId,
    appSecret,
    baseUrl: (process.env.FEISHU_BASE_URL || 'https://open.feishu.cn').replace(/\/+$/, ''),
  },
  isFeishuConfigured: Boolean(appId && appSecret),
  syncIntervalMinutes: Number(process.env.SYNC_INTERVAL_MINUTES ?? 15),
  ai: {
    provider: aiProvider,
    configured:
      aiProvider === 'deepseek'
        ? Boolean(deepseekKey)
        : Boolean(effectiveAnthropicKey),
  },
  deepseek: {
    apiKey: deepseekKey,
    model: process.env.DEEPSEEK_MODEL || 'deepseek-chat',
    baseUrl: (process.env.DEEPSEEK_BASE_URL || 'https://api.deepseek.com').replace(/\/+$/, ''),
  },
  anthropic: {
    apiKey: effectiveAnthropicKey,
    model: anthropicModel,
    baseUrl: anthropicBaseUrl,
    sessionId: anthropicSessionId,
  },
  mcpEnabled: String(process.env.MCP_ENABLED ?? 'true') !== 'false',
};
