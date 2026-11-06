import { useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { CheckCircle2, PlugZap, RefreshCw, XCircle } from 'lucide-react';
import { api } from '../api.js';
import { useToast } from '../components/Toast.jsx';
import { errorMessage } from '../utils.js';

export default function SettingsPage() {
  const queryClient = useQueryClient();
  const toast = useToast();
  const [check, setCheck] = useState(null);

  const statusQuery = useQuery({ queryKey: ['status'], queryFn: api.status });
  const status = statusQuery.data;

  const checkMutation = useMutation({
    mutationFn: api.feishuCheck,
    onSuccess: (data) => {
      setCheck({ ok: true, message: `连接正常，token ${data.tokenPreview}` });
      toast('飞书连接正常', 'success');
    },
    onError: (error) => {
      setCheck({ ok: false, message: errorMessage(error) });
      toast(errorMessage(error), 'error');
    },
  });

  const syncMutation = useMutation({
    mutationFn: api.syncAll,
    onSuccess: (result) => {
      toast(
        result.failed ? `同步完成，${result.failed} 个失败` : `已同步 ${result.succeeded} 个数据源`,
        result.failed ? 'error' : 'success'
      );
      queryClient.invalidateQueries({ queryKey: ['documents'] });
      queryClient.invalidateQueries({ queryKey: ['sources'] });
      queryClient.invalidateQueries({ queryKey: ['typeStats'] });
    },
    onError: (error) => toast(errorMessage(error), 'error'),
  });

  return (
    <div className="page">
      <header className="page-head">
        <div>
          <h1>设置</h1>
          <div className="head-meta">
            <span>本地运行</span>
            <span className="meta-rule" aria-hidden="true" />
            <span>凭证只保存在服务端 .env</span>
          </div>
        </div>
      </header>

      <div className="settings-grid">
        <section className="settings-card">
          <h2>飞书应用</h2>
          <div className="setting-row">
            <span className="setting-label">应用凭证</span>
            <span className={`status-pill ${status?.feishuConfigured ? 'ok' : 'bad'}`}>
              {status?.feishuConfigured ? <CheckCircle2 size={13} /> : <XCircle size={13} />}
              {status?.feishuConfigured ? '已配置' : '未配置'}
            </span>
          </div>
          <div className="setting-row">
            <span className="setting-label">数据源</span>
            <span>{status?.counts?.sources ?? 0} 个</span>
          </div>
          <div className="setting-row">
            <span className="setting-label">汇总文档</span>
            <span>{status?.counts?.documents ?? 0} 份</span>
          </div>
          <div className="setting-row">
            <span className="setting-label">连接测试</span>
            <button
              type="button"
              className="btn btn-small"
              onClick={() => checkMutation.mutate()}
              disabled={checkMutation.isPending || !status?.feishuConfigured}
            >
              <PlugZap size={13} />
              {checkMutation.isPending ? '测试中' : '测试连接'}
            </button>
          </div>
          {check && (
            <p className={`settings-note ${check.ok ? 'status-pill ok' : 'status-pill bad'}`}>
              {check.message}
            </p>
          )}
          <p className="settings-note">
            在飞书开放平台创建企业自建应用，把 App ID 与 App Secret 写入项目根目录的
            <code> .env</code>，然后重启服务。
          </p>
        </section>

        <section className="settings-card">
          <h2>同步</h2>
          <div className="setting-row">
            <span className="setting-label">定时同步</span>
            <span>
              {status?.syncIntervalMinutes
                ? `每 ${status.syncIntervalMinutes} 分钟`
                : '已关闭'}
            </span>
          </div>
          <div className="setting-row">
            <span className="setting-label">手动同步</span>
            <button
              type="button"
              className="btn btn-small"
              onClick={() => syncMutation.mutate()}
              disabled={syncMutation.isPending || !status?.feishuConfigured}
            >
              <RefreshCw size={13} className={syncMutation.isPending ? 'spin' : undefined} />
              {syncMutation.isPending ? '同步中' : '立即同步全部'}
            </button>
          </div>
          <p className="settings-note">
            同步只读取飞书内容写入本地索引，不会修改原文。列表页搜索基于最近一次同步的内容。
          </p>
        </section>

        <section className="settings-card">
          <h2>AI 助手</h2>
          <div className="setting-row">
            <span className="setting-label">AI 提供方</span>
            <span className="mono">{status?.aiProvider || 'deepseek'}</span>
          </div>
          <div className="setting-row">
            <span className="setting-label">
              {status?.aiProvider === 'anthropic' ? 'Anthropic / 网关 API Key' : 'DeepSeek API Key'}
            </span>
            <span className={`status-pill ${status?.aiConfigured ? 'ok' : 'bad'}`}>
              {status?.aiConfigured ? '已配置' : '未配置'}
            </span>
          </div>
          <div className="setting-row">
            <span className="setting-label">飞书 MCP</span>
            <span className={`status-pill ${status?.mcpEnabled ? 'ok' : 'bad'}`}>
              {status?.mcpEnabled ? '已启用' : '已关闭'}
            </span>
          </div>
          <div className="setting-row">
            <span className="setting-label">模型</span>
            <span className="mono">{status?.model || '—'}</span>
          </div>
          <p className="settings-note">
            助手通过飞书官方 MCP Server 调用开放接口，写操作会在对话里单独标记。
          </p>
        </section>

        <section className="settings-card">
          <h2>应用权限</h2>
          <p className="settings-note">
            在开放平台为应用开通以下权限，并把应用加为目标文档的协作者、知识空间的成员。
          </p>
          <div className="code-block">{`docx:document
sheets:spreadsheet
bitable:app
wiki:wiki
drive:drive`}</div>
          <p className="settings-note">
            缺少权限时，飞书会返回具体的授权链接和错误码，同步失败原因会显示在数据源页。
          </p>
        </section>
      </div>

      <section className="settings-card" style={{ marginTop: 14 }}>
        <h2>本地配置</h2>
        <div className="code-block">{`# .env
FEISHU_APP_ID=cli_xxxxxxxx
FEISHU_APP_SECRET=xxxxxxxx
PORT=3001
SYNC_INTERVAL_MINUTES=15
AI_PROVIDER=deepseek
DEEPSEEK_API_KEY=sk-xxxxxxxx
DEEPSEEK_MODEL=deepseek-chat`}</div>
        <p className="settings-note">
          服务只监听 127.0.0.1，凭证不会发送到浏览器。修改 .env 后需要重启 API 进程。
        </p>
      </section>
    </div>
  );
}
