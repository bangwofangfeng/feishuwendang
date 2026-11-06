import OpenAI from 'openai';
import { config } from '../config.js';
import { getMcpSession } from './mcp.js';
import { executeNativeTool, nativeToolDefinitions } from './nativeTools.js';
import { buildSystemPrompt, normalizeHistory, stringifyToolOutput } from './shared.js';

const MAX_ROUNDS = 8;

let openaiClient = null;

function getOpenAI() {
  if (!config.deepseek.apiKey) {
    throw new Error('尚未配置 DEEPSEEK_API_KEY，请在 .env 中填写后重启服务');
  }
  if (!openaiClient) {
    openaiClient = new OpenAI({
      apiKey: config.deepseek.apiKey,
      baseURL: config.deepseek.baseUrl,
    });
  }
  return openaiClient;
}

function toOpenAiTools(tools) {
  return tools.map((tool) => ({
    type: 'function',
    function: {
      name: tool.name,
      description: tool.description || '',
      parameters: tool.input_schema || { type: 'object', properties: {} },
    },
  }));
}

function mergeToolCallDelta(accumulator, delta) {
  const index = delta.index ?? accumulator.length;
  if (!accumulator[index]) {
    accumulator[index] = {
      id: '',
      type: 'function',
      function: { name: '', arguments: '' },
    };
  }
  const target = accumulator[index];
  if (delta.id) target.id = delta.id;
  if (delta.function?.name) target.function.name += delta.function.name;
  if (delta.function?.arguments) target.function.arguments += delta.function.arguments;
}

export async function runDeepSeekAgent({ messages, context, onEvent }) {
  const client = getOpenAI();
  const session = await getMcpSession();

  const toolKinds = new Map();
  for (const tool of session.tools) toolKinds.set(tool.name, 'mcp');
  for (const tool of nativeToolDefinitions) toolKinds.set(tool.name, 'native');

  const tools = toOpenAiTools([...nativeToolDefinitions, ...session.tools]);
  const system = buildSystemPrompt(context, session.error);
  const history = normalizeHistory(messages);
  if (!history.length) throw new Error('消息不能为空');

  const working = [{ role: 'system', content: system }, ...history];
  let callCounter = 0;

  for (let round = 0; round < MAX_ROUNDS; round += 1) {
    const stream = await client.chat.completions.create({
      model: config.deepseek.model,
      messages: working,
      tools: tools.length ? tools : undefined,
      stream: true,
      max_tokens: 4096,
    });

    let content = '';
    const toolCalls = [];

    for await (const chunk of stream) {
      const choice = chunk.choices?.[0];
      if (!choice) continue;
      const delta = choice.delta || {};
      if (delta.content) {
        content += delta.content;
        onEvent({ type: 'text', text: delta.content });
      }
      if (Array.isArray(delta.tool_calls)) {
        for (const toolCallDelta of delta.tool_calls) {
          mergeToolCallDelta(toolCalls, toolCallDelta);
        }
      }
    }

    if (!toolCalls.length) {
      onEvent({ type: 'done' });
      return;
    }

    const assistantToolCalls = toolCalls.map((toolCall) => {
      callCounter += 1;
      const id = toolCall.id || `call_${Date.now()}_${callCounter}`;
      return {
        id,
        type: 'function',
        function: {
          name: toolCall.function.name,
          arguments: toolCall.function.arguments || '{}',
        },
      };
    });

    working.push({
      role: 'assistant',
      content: content || null,
      tool_calls: assistantToolCalls,
    });

    for (const toolCall of assistantToolCalls) {
      const name = toolCall.function.name;
      let input = {};
      onEvent({ type: 'tool_start', id: toolCall.id, name, input });
      try {
        input = toolCall.function.arguments
          ? JSON.parse(toolCall.function.arguments)
          : {};
      } catch {
        const text = `工具参数不是合法 JSON：${toolCall.function.arguments}`;
        working.push({ role: 'tool', tool_call_id: toolCall.id, content: text });
        onEvent({ type: 'tool_end', id: toolCall.id, name, ok: false, preview: text });
        continue;
      }

      const kind = toolKinds.get(name);
      try {
        if (!kind) throw new Error(`未启用的工具：${name}`);
        const output =
          kind === 'native'
            ? await executeNativeTool(name, input)
            : await session.client.callTool({ name, arguments: input });
        const text = stringifyToolOutput(output);
        const isError = Boolean(output?.isError);
        working.push({ role: 'tool', tool_call_id: toolCall.id, content: text });
        onEvent({
          type: 'tool_end',
          id: toolCall.id,
          name,
          ok: !isError,
          preview: text.slice(0, 400),
        });
      } catch (error) {
        const text = `工具执行失败：${error.message || '未知错误'}`;
        working.push({ role: 'tool', tool_call_id: toolCall.id, content: text });
        onEvent({ type: 'tool_end', id: toolCall.id, name, ok: false, preview: text });
      }
    }
  }

  onEvent({ type: 'error', message: '工具调用轮次过多，已经停止。请缩小请求范围后重试。' });
}
