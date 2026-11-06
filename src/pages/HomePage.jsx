import { useEffect, useMemo, useState } from 'react';
import { Link, useParams } from 'react-router-dom';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import {
  AlertTriangle,
  ExternalLink,
  FileText,
  Grid3x3,
  Plus,
  RefreshCw,
  Search,
  Table2,
} from 'lucide-react';
import { api } from '../api.js';
import EmptyState from '../components/EmptyState.jsx';
import ErrorBanner from '../components/ErrorBanner.jsx';
import Loading from '../components/Loading.jsx';
import TypeBadge from '../components/TypeBadge.jsx';
import { useToast } from '../components/Toast.jsx';
import { relativeTime, typeRoute } from '../utils.js';

const TYPE_META = {
  docx: { label: '云文档', icon: FileText },
  sheet: { label: '电子表格', icon: Table2 },
  bitable: { label: '多维表格', icon: Grid3x3 },
};

const VALID_TYPES = new Set(['docx', 'sheet', 'bitable']);

export default function HomePage() {
  const { type: routeType = '' } = useParams();
  const type = VALID_TYPES.has(routeType) ? routeType : '';
  const [search, setSearch] = useState('');
  const [term, setTerm] = useState('');
  const queryClient = useQueryClient();
  const toast = useToast();

  useEffect(() => {
    const timer = setTimeout(() => setTerm(search.trim()), 260);
    return () => clearTimeout(timer);
  }, [search]);

  const docsQuery = useQuery({
    queryKey: ['documents', type, term],
    queryFn: () => api.documents({ type, q: term }),
  });
  const statusQuery = useQuery({ queryKey: ['status'], queryFn: api.status });
  const statsQuery = useQuery({ queryKey: ['typeStats'], queryFn: api.typeStats });

  const stats = Object.fromEntries(
    (statsQuery.data?.items || []).map((item) => [item.type, item.count])
  );
  const total = Object.values(stats).reduce((sum, count) => sum + count, 0);
  const status = statusQuery.data;
  const items = docsQuery.data?.items || [];

  const lastSynced = useMemo(() => {
    const times = items.map((item) => item.synced_at).filter(Boolean).sort();
    return times.length ? times[times.length - 1] : null;
  }, [items]);

  const syncMutation = useMutation({
    mutationFn: () => api.syncAll(),
    onSuccess: (result) => {
      if (result.failed) {
        toast(`同步完成，${result.failed} 个数据源失败，可在数据源页查看原因`, 'error');
      } else {
        toast(`已同步 ${result.succeeded} 个数据源`, 'success');
      }
      queryClient.invalidateQueries({ queryKey: ['documents'] });
      queryClient.invalidateQueries({ queryKey: ['sources'] });
      queryClient.invalidateQueries({ queryKey: ['typeStats'] });
      queryClient.invalidateQueries({ queryKey: ['status'] });
    },
    onError: (error) => toast(error.message, 'error'),
  });

  const noSources = status && status.counts.sources === 0;
  const title = type ? TYPE_META[type].label : '全部文档';

  return (
    <div className="page">
      <header className="page-head">
        <div>
          <h1>{title}</h1>
          <div className="head-meta">
            <span>共 {items.length} 份</span>
            <span className="meta-rule" aria-hidden="true" />
            <span>最近同步 {relativeTime(lastSynced)}</span>
          </div>
        </div>
        <div className="head-actions">
          <label className="search-field">
            <Search size={16} className="search-icon" />
            <input
              type="search"
              value={search}
              onChange={(event) => setSearch(event.target.value)}
              placeholder="搜索标题与正文"
              aria-label="搜索文档"
            />
          </label>
          <button
            type="button"
            className="btn"
            onClick={() => syncMutation.mutate()}
            disabled={syncMutation.isPending || !status?.feishuConfigured}
            title={status?.feishuConfigured ? '重新同步全部数据源' : '请先在设置中配置飞书应用'}
          >
            <RefreshCw size={15} className={syncMutation.isPending ? 'spin' : undefined} />
            {syncMutation.isPending ? '同步中' : '同步全部'}
          </button>
        </div>
      </header>

      <div className="catalog-tabs" role="tablist" aria-label="按类型筛选">
        <Link to="/" className={`catalog-tab${type === '' ? ' active' : ''}`} role="tab">
          全部
          <span className="tab-count">{total}</span>
        </Link>
        {Object.entries(TYPE_META).map(([key, meta]) => (
          <Link
            key={key}
            to={`/type/${key}`}
            className={`catalog-tab tone-${key}${type === key ? ' active' : ''}`}
            role="tab"
          >
            {meta.label}
            <span className="tab-count">{stats[key] || 0}</span>
          </Link>
        ))}
      </div>

      {docsQuery.isError && (
        <ErrorBanner
          error={docsQuery.error}
          onRetry={() => docsQuery.refetch()}
          title="读取文档列表失败"
        />
      )}

      {noSources ? (
        <div className="catalog empty-catalog">
          <EmptyState
            icon={Plus}
            title="还没有数据源"
            description="粘贴飞书文档、电子表格或多维表格的链接，平台会把它们汇总到这里。"
            action={
              <Link to="/sources" className="btn btn-primary">
                添加第一个数据源
              </Link>
            }
          />
        </div>
      ) : docsQuery.isLoading ? (
        <div className="catalog empty-catalog">
          <Loading label="正在读取汇总列表" />
        </div>
      ) : items.length === 0 ? (
        <div className="catalog empty-catalog">
          <EmptyState
            icon={Search}
            title={term ? '没有匹配的文档' : '列表还是空的'}
            description={
              term
                ? `没有找到包含「${term}」的标题或正文。换一个关键词试试。`
                : '数据源已添加，但还没有同步出内容。点右上角「同步全部」重试。'
            }
            action={
              term ? (
                <button type="button" className="btn" onClick={() => setSearch('')}>
                  清除搜索
                </button>
              ) : (
                <button
                  type="button"
                  className="btn btn-primary"
                  onClick={() => syncMutation.mutate()}
                  disabled={syncMutation.isPending}
                >
                  <RefreshCw size={15} />
                  同步全部
                </button>
              )
            }
          />
        </div>
      ) : (
        <section className="catalog" aria-label="文档索引">
          {items.map((item) => (
            <article key={item.id} className={`doc-row tone-${item.type}`}>
              <Link to={typeRoute(item.type, item.token)} className="doc-main">
                <div className="doc-title-line">
                  <h2>{item.title || '未命名文档'}</h2>
                  <TypeBadge type={item.type} compact />
                </div>
                <p className="doc-snippet">{item.snippet || '暂无内容摘要'}</p>
                <div className="doc-meta">
                  <span className="doc-source">
                    {item.url ? '来自飞书原文' : '通过 Token 导入'}
                  </span>
                  {item.sync_error && (
                    <span className="doc-sync-error" title={item.sync_error}>
                      <AlertTriangle size={13} />
                      同步失败
                    </span>
                  )}
                </div>
              </Link>
              <div className="doc-side">
                <span className="doc-time">{relativeTime(item.synced_at)}</span>
                {item.url && (
                  <a
                    className="icon-btn"
                    href={item.url}
                    target="_blank"
                    rel="noreferrer"
                    title="在飞书中打开原文"
                    aria-label="在飞书中打开原文"
                  >
                    <ExternalLink size={15} />
                  </a>
                )}
              </div>
            </article>
          ))}
        </section>
      )}
    </div>
  );
}
