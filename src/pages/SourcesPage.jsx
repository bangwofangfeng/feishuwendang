import { useState } from 'react';
import { Link } from 'react-router-dom';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import {
  ChevronDown,
  ChevronRight,
  ExternalLink,
  FolderTree,
  Link as LinkIcon,
  Plus,
  RefreshCw,
  Trash2,
} from 'lucide-react';
import { api } from '../api.js';
import EmptyState from '../components/EmptyState.jsx';
import ErrorBanner from '../components/ErrorBanner.jsx';
import Loading from '../components/Loading.jsx';
import Modal from '../components/Modal.jsx';
import TypeBadge from '../components/TypeBadge.jsx';
import { useToast } from '../components/Toast.jsx';
import { errorMessage, relativeTime, typeLabel } from '../utils.js';

const OBJ_TYPE_LABELS = {
  docx: '云文档',
  sheet: '电子表格',
  bitable: '多维表格',
  doc: '旧版文档',
  file: '文件',
  slides: '幻灯片',
  mindnote: '思维笔记',
};

const IMPORTABLE_TYPES = new Set(['docx', 'sheet', 'bitable']);

export default function SourcesPage() {
  const queryClient = useQueryClient();
  const toast = useToast();
  const [link, setLink] = useState('');
  const [manualType, setManualType] = useState('');
  const [wikiOpen, setWikiOpen] = useState(false);

  const sourcesQuery = useQuery({ queryKey: ['sources'], queryFn: api.sources });
  const statusQuery = useQuery({ queryKey: ['status'], queryFn: api.status });
  const status = statusQuery.data;
  const sources = sourcesQuery.data?.items || [];

  const refreshAll = () => {
    queryClient.invalidateQueries({ queryKey: ['sources'] });
    queryClient.invalidateQueries({ queryKey: ['documents'] });
    queryClient.invalidateQueries({ queryKey: ['typeStats'] });
    queryClient.invalidateQueries({ queryKey: ['status'] });
  };

  const addMutation = useMutation({
    mutationFn: () =>
      api.addSource({ url: link.trim(), type: manualType || undefined }),
    onSuccess: (data) => {
      if (data.duplicate) {
        toast('这个文档已经在列表里了', 'info');
      } else if (data.sync?.ok) {
        toast(`已添加并同步「${data.source.title || '文档'}」`, 'success');
      } else {
        toast(`已添加，但同步失败：${data.sync?.error || '未知原因'}`, 'error');
      }
      setLink('');
      refreshAll();
    },
    onError: (error) => toast(errorMessage(error), 'error'),
  });

  const syncAllMutation = useMutation({
    mutationFn: () => api.syncAll(),
    onSuccess: (result) => {
      toast(
        result.failed
          ? `同步完成，${result.failed} 个数据源失败`
          : `已同步 ${result.succeeded} 个数据源`,
        result.failed ? 'error' : 'success'
      );
      refreshAll();
    },
    onError: (error) => toast(errorMessage(error), 'error'),
  });

  const syncOneMutation = useMutation({
    mutationFn: (id) => api.syncSource(id),
    onSuccess: () => {
      toast('同步完成', 'success');
      refreshAll();
    },
    onError: (error) => toast(errorMessage(error), 'error'),
  });

  const removeMutation = useMutation({
    mutationFn: (id) => api.deleteSource(id),
    onSuccess: () => {
      toast('已从汇总列表中移除，飞书原文档不受影响', 'success');
      refreshAll();
    },
    onError: (error) => toast(errorMessage(error), 'error'),
  });

  const handleDelete = (source) => {
    const name = source.title || source.source_title || source.token;
    if (window.confirm(`从汇总列表移除「${name}」？不会删除飞书原文档。`)) {
      removeMutation.mutate(source.id);
    }
  };

  return (
    <div className="page">
      <header className="page-head">
        <div>
          <h1>数据源</h1>
          <div className="head-meta">
            <span>共 {sources.length} 个来源</span>
            <span className="meta-rule" aria-hidden="true" />
            <span>同步间隔 {status?.syncIntervalMinutes ?? '—'} 分钟</span>
          </div>
        </div>
        <div className="head-actions">
          <button type="button" className="btn" onClick={() => setWikiOpen(true)}>
            <FolderTree size={15} />
            从知识库导入
          </button>
          <button
            type="button"
            className="btn"
            onClick={() => syncAllMutation.mutate()}
            disabled={syncAllMutation.isPending || !status?.feishuConfigured}
          >
            <RefreshCw size={15} className={syncAllMutation.isPending ? 'spin' : undefined} />
            {syncAllMutation.isPending ? '同步中' : '同步全部'}
          </button>
        </div>
      </header>

      {!status?.feishuConfigured && (
        <div className="setup-banner">
          <div>
            <strong>还没有配置飞书应用</strong>
            <p>
              在项目根目录的 <code>.env</code> 中填入 FEISHU_APP_ID 与 FEISHU_APP_SECRET，
              重启服务后即可导入文档。
            </p>
          </div>
          <Link className="btn btn-small" to="/settings">
            查看配置说明
          </Link>
        </div>
      )}

      <section className="add-panel" aria-label="添加数据源">
        <div className="add-title">
          <LinkIcon size={16} />
          <span>粘贴飞书链接</span>
        </div>
        <form
          className="add-form"
          onSubmit={(event) => {
            event.preventDefault();
            if (!link.trim()) return;
            addMutation.mutate();
          }}
        >
          <input
            type="text"
            value={link}
            onChange={(event) => setLink(event.target.value)}
            placeholder="https://xxx.feishu.cn/docx/… 或 /sheets/… /base/… /wiki/…"
            aria-label="飞书文档链接"
          />
          <select
            value={manualType}
            onChange={(event) => setManualType(event.target.value)}
            aria-label="文档类型"
          >
            <option value="">自动识别</option>
            <option value="docx">云文档</option>
            <option value="sheet">电子表格</option>
            <option value="bitable">多维表格</option>
          </select>
          <button
            type="submit"
            className="btn btn-primary"
            disabled={addMutation.isPending || !link.trim()}
          >
            <Plus size={15} />
            {addMutation.isPending ? '添加中' : '添加'}
          </button>
        </form>
        <p className="add-hint">
          如果只粘贴 Token，请同时选择文档类型。应用需要先被加为该文档的协作者，否则同步会返回权限错误。
        </p>
      </section>

      {sourcesQuery.isError && (
        <ErrorBanner
          error={sourcesQuery.error}
          onRetry={() => sourcesQuery.refetch()}
          title="读取数据源失败"
        />
      )}

      {sourcesQuery.isLoading ? (
        <div className="catalog empty-catalog">
          <Loading label="正在读取数据源" />
        </div>
      ) : sources.length === 0 ? (
        <div className="catalog empty-catalog">
          <EmptyState
            icon={LinkIcon}
            title="还没有数据源"
            description="从上面的输入框粘贴一个飞书链接，或从知识库空间批量导入。"
          />
        </div>
      ) : (
        <section className="source-list" aria-label="数据源列表">
          {sources.map((source) => {
            const syncing = syncOneMutation.isPending && syncOneMutation.variables === source.id;
            return (
              <article key={source.id} className={`source-row tone-${source.type}`}>
                <div className="source-type">
                  <TypeBadge type={source.type} />
                </div>
                <div className="source-main">
                  <h3>{source.title || source.source_title || '未命名来源'}</h3>
                  <div className="source-meta">
                    <code>{source.token}</code>
                    <span>{source.synced_at ? `同步于 ${relativeTime(source.synced_at)}` : '尚未同步'}</span>
                    {source.wiki_space_id && <span>来自知识库</span>}
                  </div>
                  {source.sync_error && <p className="source-error">{source.sync_error}</p>}
                </div>
                <div className="source-actions">
                  <button
                    type="button"
                    className="btn btn-small"
                    onClick={() => syncOneMutation.mutate(source.id)}
                    disabled={syncing || !status?.feishuConfigured}
                  >
                    <RefreshCw size={13} className={syncing ? 'spin' : undefined} />
                    {syncing ? '同步中' : '同步'}
                  </button>
                  {source.url && (
                    <a
                      className="icon-btn"
                      href={source.url}
                      target="_blank"
                      rel="noreferrer"
                      title="在飞书中打开"
                      aria-label="在飞书中打开"
                    >
                      <ExternalLink size={15} />
                    </a>
                  )}
                  <button
                    type="button"
                    className="icon-btn danger"
                    onClick={() => handleDelete(source)}
                    title="移除数据源"
                    aria-label="移除数据源"
                  >
                    <Trash2 size={15} />
                  </button>
                </div>
              </article>
            );
          })}
        </section>
      )}

      <WikiImportModal
        open={wikiOpen}
        onClose={() => setWikiOpen(false)}
        onImported={() => {
          refreshAll();
        }}
      />
    </div>
  );
}

function WikiImportModal({ open, onClose, onImported }) {
  const toast = useToast();
  const [spaceId, setSpaceId] = useState('');
  const [selected, setSelected] = useState(() => new Map());
  const [importing, setImporting] = useState(false);

  const spacesQuery = useQuery({
    queryKey: ['wikiSpaces'],
    queryFn: api.wikiSpaces,
    enabled: open,
  });
  const spaces = spacesQuery.data?.items || [];

  const toggleNode = (node) => {
    setSelected((previous) => {
      const next = new Map(previous);
      if (next.has(node.node_token)) next.delete(node.node_token);
      else next.set(node.node_token, node);
      return next;
    });
  };

  const handleImport = async () => {
    if (!selected.size) return;
    setImporting(true);
    try {
      const result = await api.wikiImport({
        spaceId,
        nodes: [...selected.values()].map((node) => ({ node_token: node.node_token })),
      });
      const ok = result.results.filter((item) => item.ok).length;
      const failed = result.results.length - ok;
      toast(
        failed ? `导入 ${ok} 个，失败 ${failed} 个` : `已导入 ${ok} 个知识库文档`,
        failed ? 'error' : 'success'
      );
      setSelected(new Map());
      onImported();
      if (!failed) onClose();
    } catch (error) {
      toast(errorMessage(error), 'error');
    } finally {
      setImporting(false);
    }
  };

  return (
    <Modal
      open={open}
      onClose={onClose}
      title="从知识库导入"
      width={820}
      footer={
        <div className="modal-actions">
          <span className="modal-selection">已选 {selected.size} 个节点</span>
          <button type="button" className="btn" onClick={onClose}>
            取消
          </button>
          <button
            type="button"
            className="btn btn-primary"
            onClick={handleImport}
            disabled={!selected.size || importing}
          >
            {importing ? '导入中' : '导入选中'}
          </button>
        </div>
      }
    >
      <div className="wiki-layout">
        <aside className="wiki-spaces">
          <div className="wiki-side-title">知识空间</div>
          {spacesQuery.isLoading && <Loading label="读取知识空间" />}
          {spacesQuery.isError && (
            <p className="inline-error">{errorMessage(spacesQuery.error)}</p>
          )}
          {spaces.map((space) => (
            <button
              key={space.space_id}
              type="button"
              className={`wiki-space${spaceId === space.space_id ? ' active' : ''}`}
              onClick={() => {
                setSpaceId(space.space_id);
                setSelected(new Map());
              }}
            >
              <span className="wiki-space-name">{space.name}</span>
              {space.description && <span className="wiki-space-desc">{space.description}</span>}
            </button>
          ))}
          {!spacesQuery.isLoading && !spaces.length && !spacesQuery.isError && (
            <p className="wiki-empty">没有可访问的知识空间</p>
          )}
        </aside>

        <div className="wiki-nodes">
          {spaceId ? (
            <WikiNodeList
              spaceId={spaceId}
              parent=""
              depth={0}
              selected={selected}
              onToggle={toggleNode}
            />
          ) : (
            <p className="wiki-hint">选择左侧的知识空间，然后勾选要导入的文档。</p>
          )}
        </div>
      </div>
    </Modal>
  );
}

function WikiNodeList({ spaceId, parent, depth, selected, onToggle }) {
  const query = useQuery({
    queryKey: ['wikiNodes', spaceId, parent],
    queryFn: () => api.wikiNodes(spaceId, parent),
  });
  const nodes = query.data?.items || [];

  if (query.isLoading) return <Loading label="读取节点" />;
  if (query.isError) return <p className="inline-error">{errorMessage(query.error)}</p>;
  if (!nodes.length) return depth === 0 ? <p className="wiki-hint">这个空间还没有内容。</p> : null;

  return (
    <ul className={`wiki-tree depth-${depth}`}>
      {nodes.map((node) => (
        <WikiNode
          key={node.node_token}
          node={node}
          spaceId={spaceId}
          depth={depth}
          selected={selected}
          onToggle={onToggle}
        />
      ))}
    </ul>
  );
}

function WikiNode({ node, spaceId, depth, selected, onToggle }) {
  const [expanded, setExpanded] = useState(false);
  const importable = IMPORTABLE_TYPES.has(node.obj_type);
  const checked = selected.has(node.node_token);

  return (
    <li className="wiki-node">
      <div className="wiki-node-row" style={{ paddingLeft: `${depth * 16}px` }}>
        {node.has_child ? (
          <button
            type="button"
            className="wiki-expand"
            onClick={() => setExpanded((value) => !value)}
            aria-label={expanded ? '收起子节点' : '展开子节点'}
          >
            {expanded ? <ChevronDown size={14} /> : <ChevronRight size={14} />}
          </button>
        ) : (
          <span className="wiki-expand placeholder" aria-hidden="true" />
        )}
        <label className={`wiki-node-label${importable ? '' : ' disabled'}`}>
          <input
            type="checkbox"
            checked={checked}
            disabled={!importable}
            onChange={() => onToggle(node)}
          />
          <span className="wiki-node-title">{node.title || '未命名节点'}</span>
          <span className={`wiki-node-type obj-${node.obj_type}`}>
            {OBJ_TYPE_LABELS[node.obj_type] || node.obj_type}
          </span>
        </label>
      </div>
      {expanded && node.has_child && (
        <WikiNodeList
          spaceId={spaceId}
          parent={node.node_token}
          depth={depth + 1}
          selected={selected}
          onToggle={onToggle}
        />
      )}
    </li>
  );
}
