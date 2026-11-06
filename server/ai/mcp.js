import { existsSync } from 'node:fs';
import path from 'node:path';
import { Client } from '@modelcontextprotocol/sdk/client/index.js';
import { StdioClientTransport } from '@modelcontextprotocol/sdk/client/stdio.js';
import { config } from '../config.js';

const MCP_TOOL_LIST = [
  'docx.v1.document.get',
  'docx.v1.document.rawContent',
  'docx.v1.documentBlock.get',
  'docx.v1.documentBlock.list',
  'docx.v1.documentBlock.patch',
  'docx.v1.documentBlock.batchUpdate',
  'docx.v1.documentBlockChildren.create',
  'docx.v1.documentBlockChildren.batchDelete',
  'docx.v1.documentBlockDescendant.create',
  'bitable.v1.app.get',
  'bitable.v1.appTable.list',
  'bitable.v1.appTableField.list',
  'bitable.v1.appTableRecord.search',
  'bitable.v1.appTableRecord.create',
  'bitable.v1.appTableRecord.update',
  'bitable.v1.appTableRecord.batchCreate',
  'bitable.v1.appTableRecord.batchUpdate',
  'wiki.v2.space.getNode',
  'wiki.v2.space.list',
  'sheets.v3.spreadsheet.get',
  'sheets.v3.spreadsheetSheet.query',
  'drive.v1.media.batchGetTmpDownloadUrl',
].join(',');

const BLOCKED_TOOL_PATTERNS = [/delete/i, /remove/i, /clear/i, /permission/i, /member/i];

const state = {
  client: null,
  tools: [],
  error: null,
  connecting: null,
};

function resolveCliPath() {
  const direct = path.join(
    config.root,
    'node_modules',
    '@larksuiteoapi',
    'lark-mcp',
    'dist',
    'cli.js'
  );
  if (existsSync(direct)) return direct;
  throw new Error('找不到 @larksuiteoapi/lark-mcp，请先运行 npm install');
}

function normalizeSchema(schema) {
  if (!schema || typeof schema !== 'object') return { type: 'object', properties: {} };
  const copy = { ...schema };
  delete copy.$schema;
  if (!copy.type) copy.type = 'object';
  if (!copy.properties) copy.properties = {};
  return copy;
}

async function connect() {
  const cliPath = resolveCliPath();
  const transport = new StdioClientTransport({
    command: process.execPath,
    args: [
      cliPath,
      'mcp',
      '-a',
      config.feishu.appId,
      '-s',
      config.feishu.appSecret,
      '-d',
      config.feishu.baseUrl,
      '-l',
      'zh',
      '-c',
      'snake',
      '-t',
      MCP_TOOL_LIST,
    ],
    env: { ...process.env },
    stderr: 'pipe',
  });

  const client = new Client({ name: 'feishu-doc-hub', version: '0.1.0' });

  try {
    await Promise.race([
      client.connect(transport),
      new Promise((_, reject) =>
        setTimeout(() => reject(new Error('飞书 MCP 连接超时（20 秒）')), 20000)
      ),
    ]);
  } catch (error) {
    try {
      await client.close();
    } catch {
      // 忽略关闭错误
    }
    throw error;
  }

  if (transport.stderr) {
    transport.stderr.on('data', (chunk) => {
      const text = String(chunk).trim();
      if (text) console.log('[mcp]', text);
    });
  }

  transport.onclose = () => {
    if (state.client === client) {
      state.client = null;
      state.tools = [];
      state.error = 'MCP 进程已退出';
    }
  };
  transport.onerror = (error) => {
    console.error('[mcp] 进程错误', error);
  };

  const listed = await client.listTools();
  const tools = (listed.tools || [])
    .filter((tool) => !BLOCKED_TOOL_PATTERNS.some((pattern) => pattern.test(tool.name)))
    .map((tool) => ({
      name: tool.name,
      description: tool.description || '',
      input_schema: normalizeSchema(tool.inputSchema),
    }))
    .filter((tool) => /^[a-zA-Z0-9_-]{1,128}$/.test(tool.name));

  state.client = client;
  state.tools = tools;
  state.error = null;
  console.log(`[mcp] 已连接飞书 MCP，可用工具 ${tools.length} 个`);
  return state;
}

export async function getMcpSession() {
  if (!config.mcpEnabled) {
    return { client: null, tools: [], error: '飞书 MCP 已关闭' };
  }
  if (!config.isFeishuConfigured) {
    return { client: null, tools: [], error: '尚未配置飞书应用凭证' };
  }
  if (state.client) return state;
  if (!state.connecting) {
    state.connecting = connect()
      .catch((error) => {
        state.error = error.message;
        console.error('[mcp] 连接失败', error);
        return state;
      })
      .finally(() => {
        state.connecting = null;
      });
  }
  return state.connecting;
}

export function getMcpState() {
  return {
    connected: Boolean(state.client),
    toolCount: state.tools.length,
    error: state.error,
  };
}
