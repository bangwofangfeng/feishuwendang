import Anthropic from '@anthropic-ai/sdk';
import { config } from '../config.js';
import { getMcpSession } from './mcp.js';
import { executeNativeTool, nativeToolDefinitions } from './nativeTools.js';
import { buildSystemPrompt, normalizeHistory, stringifyToolOutput } from './shared.js';

const MAX_ROUNDS = 8;

let anthropicClient = null;

function getAnthropic() {
  if (!config.anthropic.apiKey) {
    throw new Error('尚未配置 ANTHROPIC_API_KEY，请在 .env 中填写后重启服务');
  }
  if (!anthropicClient) {
    anthropicClient = new Anthropic({
      apiKey: config.anthropic.apiKey,
      ...(config.anthropic.baseUrl ? { baseURL: config.anthropic.baseUrl } : {}),
      ...(config.anthropic.sessionId
        ? { defaultHeaders: { 'x-opencode-session': config.anthropic.sessionId } }
        : {}),
    });
  }
  return anthropicClient;
}

export async function runAgent({ messages, context, onEvent }) {
  const client = getAnthropic();
  const session = await getMcpSession();

  const toolKinds = new Map();
  for (const tool of session.tools) toolKinds.set(tool.name, 'mcp');
  for (const tool of nativeToolDefinitions) toolKinds.set(tool.name, 'native');

  const tools = [...nativeToolDefinitions, ...session.tools];
  const system = buildSystemPrompt(context, session.error);
  const history = normalizeHistory(messages);
  if (!history.length) throw new Error('消息不能为空');

  const working = [...history];

  for (let round = 0; round < MAX_ROUNDS; round += 1) {
    const stream = client.messages.stream({
      model: config.anthropic.model,
      max_tokens: 4096,
      system,
      messages: working,
      tools,
    });

    stream.on('text', (delta) => onEvent({ type: 'text', text: delta }));

    const final = await stream.finalMessage();
    const toolUses = (final.content || []).filter((block) => block.type === 'tool_use');
    if (!toolUses.length) {
      onEvent({ type: 'done' });
      return;
    }

    working.push({ role: 'assistant', content: final.content });
    const toolResults = [];

    for (const use of toolUses) {
      const kind = toolKinds.get(use.name);
      onEvent({ type: 'tool_start', id: use.id, name: use.name, input: use.input || {} });
      try {
        if (!kind) throw new Error(`未启用的工具：${use.name}`);
        const output =
          kind === 'native'
            ? await executeNativeTool(use.name, use.input || {})
            : await session.client.callTool({ name: use.name, arguments: use.input || {} });
        const text = stringifyToolOutput(output);
        const isError = Boolean(output?.isError);
        toolResults.push({
          type: 'tool_result',
          tool_use_id: use.id,
          content: [{ type: 'text', text }],
          ...(isError ? { is_error: true } : {}),
        });
        onEvent({
          type: 'tool_end',
          id: use.id,
          name: use.name,
          ok: !isError,
          preview: text.slice(0, 400),
        });
      } catch (error) {
        const text = `工具执行失败：${error.message || '未知错误'}`;
        toolResults.push({
          type: 'tool_result',
          tool_use_id: use.id,
          content: [{ type: 'text', text }],
          is_error: true,
        });
        onEvent({ type: 'tool_end', id: use.id, name: use.name, ok: false, preview: text });
      }
    }

    working.push({ role: 'user', content: toolResults });
  }

  onEvent({ type: 'error', message: '工具调用轮次过多，已经停止。请缩小请求范围后重试。' });
}
