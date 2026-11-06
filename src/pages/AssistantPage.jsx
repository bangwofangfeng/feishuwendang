import { useEffect, useRef, useState } from 'react';
import { Link } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import {
  AlertTriangle,
  CheckCircle2,
  Loader2,
  Send,
  Sparkles,
  Square,
  Wrench,
  XCircle,
} from 'lucide-react';
import { api } from '../api.js';
import { streamChat } from '../ai/sse.js';
import { typeLabel } from '../utils.js';

const TYPE_LABELS = { docx: '云文档', sheet: '电子表格', bitable: '多维表格' };

function newId() {
  return typeof crypto !== 'undefined' && crypto.randomUUID
    ? crypto.randomUUID()
    : `${Date.now()}-${Math.random().toString(16).slice(2)}`;
}

export default function AssistantPage() {
  const [messages, setMessages] = useState([]);
  const [input, setInput] = useState('');
  const [streaming, setStreaming] = useState(false);
  const [contextKey, setContextKey] = useState('');
  const [mcpInfo, setMcpInfo] = useState(null);
  const abortRef = useRef(null);
  const bottomRef = useRef(null);

  const statusQuery = useQuery({ queryKey: ['status'], queryFn: api.status });
  const sourcesQuery = useQuery({ queryKey: ['sources'], queryFn: api.sources });
  const aiStatusQuery = useQuery({ queryKey: ['aiStatus'], queryFn: api.aiStatus });

  const status = statusQuery.data;
  const sources = sourcesQuery.data?.items || [];
  const selectedSource = sources.find((source) => `${source.type}:${source.token}` === contextKey);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: 'smooth', block: 'end' });
  }, [messages, streaming]);

  const updateMessage = (id, updater) => {
    setMessages((previous) =>
      previous.map((message) => (message.id === id ? updater(message) : message))
    );
  };

  const sendMessage = async (override) => {
    if (streaming) return;
    const text = String(override ?? input).trim();
    if (!text) return;

    const history = messages
      .filter((message) => message.role === 'user' || message.role === 'assistant')
      .map((message) => ({ role: message.role, content: message.content }))
      .filter((message) => message.content.trim());

    const userMessage = { id: newId(), role: 'user', content: text, tools: [] };
    const assistantId = newId();
    const assistantMessage = {
      id: assistantId,
      role: 'assistant',
      content: '',
      tools: [],
      error: null,
    };

    setMessages((previous) => [...previous, userMessage, assistantMessage]);
    setInput('');
    setStreaming(true);

    const controller = new AbortController();
    abortRef.current = controller;
    const context = selectedSource
      ? {
          type: selectedSource.type,
          token: selectedSource.token,
          title: selectedSource.title || selectedSource.source_title,
        }
      : null;

    try {
      await streamChat({
        messages: [...history, { role: 'user', content: text }],
        context,
        signal: controller.signal,
        onEvent: (event) => {
          if (event.type === 'text') {
            updateMessage(assistantId, (message) => ({
              ...message,
              content: message.content + event.text,
            }));
          } else if (event.type === 'tool_start') {
            updateMessage(assistantId, (message) => ({
              ...message,
              tools: [
                ...message.tools,
                {
                  id: event.id,
                  name: event.name,
                  input: event.input,
                  status: 'running',
                  preview: '',
                },
              ],
            }));
          } else if (event.type === 'tool_end') {
            updateMessage(assistantId, (message) => ({
              ...message,
              tools: message.tools.map((tool) =>
                tool.id === event.id
                  ? { ...tool, status: event.ok ? 'ok' : 'error', preview: event.preview }
                  : tool
              ),
            }));
          } else if (event.type === 'error') {
            updateMessage(assistantId, (message) => ({ ...message, error: event.message }));
          } else if (event.type === 'ready') {
            setMcpInfo(event.mcp);
          }
        },
      });
    } catch (error) {
      if (error.name !== 'AbortError') {
        updateMessage(assistantId, (message) => ({ ...message, error: error.message }));
      }
    } finally {
      setStreaming(false);
      abortRef.current = null;
    }
  };

  const stopStreaming = () => {
    abortRef.current?.abort();
    setStreaming(false);
  };

  const configured = status?.aiConfigured;
  const mcpConnected = mcpInfo?.connected ?? aiStatusQuery.data?.mcp?.connected;
  const mcpTools = mcpInfo?.toolCount ?? aiStatusQuery.data?.mcp?.toolCount ?? 0;
  const mcpError = mcpInfo?.error ?? aiStatusQuery.data?.mcp?.error;

  return (
    <div className="page assistant-page">
      <header className="page-head">
        <div>
          <h1>AI 助手</h1>
          <div className="head-meta">
            <span>{status?.aiProvider === 'anthropic' ? 'Anthropic 兼容' : 'DeepSeek'}</span>
            <span className="meta-rule" aria-hidden="true" />
            <span className="mono">{status?.model || 'deepseek-chat'}</span>
            <span className="meta-rule" aria-hidden="true" />
            <span>
              {status?.mcpEnabled
                ? mcpConnected
                  ? `飞书 MCP 已连接 · ${mcpTools} 个工具`
                  : '飞书 MCP 未连接'
                : '飞书 MCP 已关闭'}
            </span>
          </div>
        </div>
      </header>

      {!configured && (
        <div className="setup-banner">
          <div>
            <strong>AI 助手还没有启用</strong>
            <p>
              在项目根目录的 <code>.env</code> 里填写 DEEPSEEK_API_KEY，重启 API 进程后即可对话。
            </p>
          </div>
          <Link className="btn btn-small" to="/settings">
            查看设置
          </Link>
        </div>
      )}

      <div className="chat-shell">
        <div className="chat-context">
          <span className="context-label">操作对象</span>
          <select
            value={contextKey}
            onChange={(event) => setContextKey(event.target.value)}
            aria-label="选择上下文文档"
          >
            <option value="">不指定（由助手自行搜索）</option>
            {sources.map((source) => (
              <option key={source.id} value={`${source.type}:${source.token}`}>
                {TYPE_LABELS[source.type] || typeLabel(source.type)}｜
                {source.title || source.source_title || source.token}
              </option>
            ))}
          </select>
          {mcpError && <span className="mcp-note">MCP：{mcpError}</span>}
        </div>

        <div className="chat-messages">
          {messages.length === 0 ? (
            <div className="chat-empty">
              <Sparkles size={26} strokeWidth={1.5} />
              <h2>用一句话操作飞书文档</h2>
              <p>
                选择上方的一份文档作为上下文，或者直接提问。读取和写入都会通过飞书接口执行，
                工具调用会显示在回答下方。
              </p>
              <div className="chat-suggestions">
                <button
                  type="button"
                  className="suggestion-btn"
                  onClick={() => sendMessage('平台里有哪些文档？先帮我列一个清单。')}
                >
                  列出平台里的文档
                </button>
                <button
                  type="button"
                  className="suggestion-btn"
                  onClick={() => sendMessage('搜索平台里关于「预算」的内容。')}
                >
                  搜索「预算」
                </button>
                {selectedSource && (
                  <button
                    type="button"
                    className="suggestion-btn"
                    onClick={() => sendMessage('总结一下这份文档的要点。')}
                  >
                    总结当前文档
                  </button>
                )}
              </div>
            </div>
          ) : (
            messages.map((message) => (
              <div
                key={message.id}
                className={`chat-msg ${message.role === 'user' ? 'chat-user' : 'chat-assistant'}`}
              >
                {message.role === 'user' ? (
                  message.content
                ) : (
                  <>
                    {message.content && <div className="chat-text">{message.content}</div>}
                    {message.tools.length > 0 && (
                      <div className="chat-tools">
                        {message.tools.map((tool) => (
                          <div
                            key={tool.id}
                            className={`chat-tool ${tool.status}`}
                            title={JSON.stringify(tool.input || {})}
                          >
                            {tool.status === 'running' ? (
                              <Loader2 size={12} className="spin" />
                            ) : tool.status === 'ok' ? (
                              <CheckCircle2 size={12} />
                            ) : (
                              <XCircle size={12} />
                            )}
                            <Wrench size={11} className="tool-icon" />
                            <span className="tool-name">{tool.name}</span>
                            {tool.status === 'error' && tool.preview && (
                              <span className="tool-error-text">{tool.preview}</span>
                            )}
                          </div>
                        ))}
                      </div>
                    )}
                    {!message.content && !message.tools.length && streaming && (
                      <span className="typing-cursor" />
                    )}
                    {message.error && (
                      <div className="chat-error">
                        <AlertTriangle size={13} />
                        {message.error}
                      </div>
                    )}
                  </>
                )}
              </div>
            ))
          )}
          <div ref={bottomRef} />
        </div>

        <div className="chat-composer">
          <textarea
            className="chat-input"
            value={input}
            onChange={(event) => setInput(event.target.value)}
            onKeyDown={(event) => {
              if (event.key === 'Enter' && !event.shiftKey) {
                event.preventDefault();
                sendMessage();
              }
            }}
            placeholder={configured ? '描述你想做的事，Enter 发送，Shift+Enter 换行' : '请先配置 DEEPSEEK_API_KEY'}
            rows={1}
            disabled={!configured}
          />
          {streaming ? (
            <button type="button" className="btn" onClick={stopStreaming}>
              <Square size={14} />
              停止
            </button>
          ) : (
            <button
              type="button"
              className="btn btn-primary"
              onClick={() => sendMessage()}
              disabled={!configured || !input.trim()}
            >
              <Send size={15} />
              发送
            </button>
          )}
        </div>
      </div>
    </div>
  );
}
