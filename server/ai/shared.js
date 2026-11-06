const MAX_TOOL_RESULT = 12000;
const CONTEXT_LABELS = { docx: '云文档', sheet: '电子表格', bitable: '多维表格' };

export function buildSystemPrompt(context, mcpError) {
  const lines = [
    '你是「文档台」的 AI 助手，运行在一个汇总飞书云文档、电子表格、多维表格的本地平台里。',
    '你可以使用工具读取和修改飞书内容。请遵守以下规则：',
    '1. 先读后写。修改前先确认 token、sheet_id、table_id、block_id 或 record_id；不确定时先调用读取工具。',
    '2. 只执行用户明确要求的事，不擅自删除内容、修改权限或批量覆盖数据。',
    '3. 工具结果是唯一事实来源。没有工具返回成功时，不要声称已经完成修改。',
    '4. 回答使用简体中文，简洁具体；展示表格数据时使用 Markdown 表格。',
    '5. 遇到权限错误时，说明需要把飞书应用加为文档协作者或知识库成员。',
    'Token 形式：云文档 /docx/<token>，电子表格 /sheets/<token>，多维表格 /base/<token>。',
    '电子表格单元格读写优先使用 hub_sheets_* 工具；文档块和多维表格记录也可以使用飞书 MCP 工具。',
  ];
  if (context?.token) {
    lines.push(
      `用户当前查看：${CONTEXT_LABELS[context.type] || context.type}「${context.title || '未命名'}」，类型 ${context.type}，token ${context.token}。优先操作这个对象。`
    );
  }
  if (mcpError) {
    lines.push(`注意：飞书 MCP 当前不可用（${mcpError}）。你仍可使用 hub_* 本地工具完成读写。`);
  }
  return lines.join('\n');
}

export function normalizeHistory(messages) {
  return (messages || [])
    .filter((message) => message && (message.role === 'user' || message.role === 'assistant'))
    .map((message) => ({ role: message.role, content: String(message.content || '').trim() }))
    .filter((message) => message.content)
    .slice(-12);
}

function clip(text) {
  return text.length > MAX_TOOL_RESULT
    ? `${text.slice(0, MAX_TOOL_RESULT)}\n…（结果已截断）`
    : text;
}

export function stringifyToolOutput(output) {
  if (output && typeof output === 'object' && Array.isArray(output.content)) {
    const parts = [];
    for (const item of output.content) {
      if (!item) continue;
      if (item.type === 'text') parts.push(item.text || '');
      else if (item.type === 'image') parts.push(`[图片 ${item.mimeType || ''}]`);
      else if (item.type === 'resource') {
        parts.push(item.resource?.text || item.resource?.uri || '[资源]');
      } else parts.push(JSON.stringify(item));
    }
    if (output.structuredContent) parts.push(JSON.stringify(output.structuredContent));
    return clip(parts.join('\n') || JSON.stringify(output));
  }
  return clip(JSON.stringify(output, null, 2));
}
