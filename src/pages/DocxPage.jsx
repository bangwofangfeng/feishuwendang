import { useEffect, useMemo, useRef, useState } from 'react';
import { Link, useParams } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import {
  Bold,
  Check,
  Code2,
  Eraser,
  ExternalLink,
  FileText,
  Image as ImageIcon,
  Italic,
  Link2,
  Link2Off,
  Pencil,
  Plus,
  RefreshCw,
  Save,
  Strikethrough,
  Table2,
  Underline,
} from 'lucide-react';
import { api } from '../api.js';
import { buildBlockTree, TEXT_BLOCK_KEYS } from '../../shared/docx.js';
import { BlockList } from '../docx/BlockRenderer.jsx';
import { serializeEditable, wrapSelectionInCode } from '../docx/elements.js';
import { buildTablePayload, createBlockPayload } from '../docx/payloads.js';
import EmptyState from '../components/EmptyState.jsx';
import ErrorBanner from '../components/ErrorBanner.jsx';
import Loading from '../components/Loading.jsx';
import TypeBadge from '../components/TypeBadge.jsx';
import { useToast } from '../components/Toast.jsx';
import { relativeTime } from '../utils.js';

export default function DocxPage() {
  const { token } = useParams();
  const toast = useToast();
  const fileInputRef = useRef(null);

  const docQuery = useQuery({
    queryKey: ['docx', token],
    queryFn: () => api.docx(token),
    staleTime: 0,
    retry: 0,
  });
  const sourceQuery = useQuery({
    queryKey: ['sourceByToken', 'docx', token],
    queryFn: () => api.sourceLookup('docx', token),
    retry: false,
  });

  const [blocks, setBlocks] = useState([]);
  const [editing, setEditing] = useState(false);
  const [selectedId, setSelectedId] = useState('');
  const [activeBlock, setActiveBlock] = useState(null);
  const [saving, setSaving] = useState(false);
  const [savedAt, setSavedAt] = useState('');

  useEffect(() => {
    if (docQuery.data?.blocks) setBlocks(docQuery.data.blocks);
  }, [docQuery.data]);

  const tree = useMemo(() => buildBlockTree(blocks), [blocks]);
  const rootId = tree.root?.block_id || token;
  const rootChildren = tree.root?.childrenNodes || [];
  const title = docQuery.data?.document?.title || '云文档';
  const originalUrl = sourceQuery.data?.source?.url;

  useEffect(() => {
    if (!editing) setActiveBlock(null);
  }, [editing]);

  useEffect(() => {
    if (!editing) return undefined;
    const onKey = (event) => {
      if ((event.ctrlKey || event.metaKey) && event.key.toLowerCase() === 's') {
        event.preventDefault();
        if (document.activeElement?.isContentEditable) document.activeElement.blur();
      }
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [editing]);

  const reload = async () => {
    const result = await docQuery.refetch();
    if (result.data?.blocks) setBlocks(result.data.blocks);
    return result;
  };

  const saveBlock = async (node, dom) => {
    const key = TEXT_BLOCK_KEYS[node.block_type];
    if (!key || !dom) return;
    const nextElements = serializeEditable(dom);
    const currentElements = node[key]?.elements || [];
    if (JSON.stringify(nextElements) === JSON.stringify(currentElements)) return;
    const payload = nextElements.length ? nextElements : [{ text_run: { content: '' } }];
    setSaving(true);
    try {
      await api.updateBlock(token, node.block_id, payload);
      setBlocks((previous) =>
        previous.map((block) => {
          if (block.block_id !== node.block_id) return block;
          return {
            ...block,
            __rev: (block.__rev || 0) + 1,
            [key]: { ...(block[key] || {}), elements: payload },
          };
        })
      );
      setSavedAt(new Date().toISOString());
    } catch (error) {
      toast(`保存失败：${error.message}`, 'error');
    } finally {
      setSaving(false);
    }
  };

  const insertBlock = async (kind, parentId, index) => {
    if (kind === 'image') {
      fileInputRef.current?.click();
      return;
    }
    try {
      if (kind === 'table') {
        const rows = Number(window.prompt('表格行数', '2'));
        const columns = Number(window.prompt('表格列数', '2'));
        if (!rows || !columns) return;
        await api.createBlocks(token, parentId, [buildTablePayload(rows, columns)], index);
        await reload();
        toast('已插入表格', 'success');
        return;
      }
      await api.createBlocks(token, parentId, [createBlockPayload(kind)], index);
      await reload();
    } catch (error) {
      toast(`插入失败：${error.message}`, 'error');
    }
  };

  const deleteBlock = async (parentId, index, node) => {
    const label = node ? '这个内容块' : '这个内容块';
    if (!window.confirm(`删除${label}？会直接修改飞书原文。`)) return;
    try {
      await api.deleteBlocks(token, parentId, index, index + 1);
      await reload();
      toast('已删除内容块', 'success');
    } catch (error) {
      toast(`删除失败：${error.message}`, 'error');
    }
  };

  const toggleTodo = async (node) => {
    const done = !node.todo?.style?.done;
    try {
      await api.updateBlockStyle(token, node.block_id, { done });
      setBlocks((previous) =>
        previous.map((block) =>
          block.block_id === node.block_id
            ? { ...block, todo: { ...(block.todo || {}), style: { ...(block.todo?.style || {}), done } } }
            : block
        )
      );
    } catch (error) {
      toast(`更新待办状态失败：${error.message}`, 'error');
    }
  };

  const handleFile = async (event) => {
    const file = event.target.files?.[0];
    event.target.value = '';
    if (!file) return;
    const parentBlock = activeBlock?.parentId || rootId;
    const index = activeBlock ? activeBlock.index + 1 : rootChildren.length;
    try {
      await api.uploadImage(token, file, { parentBlock, index });
      await reload();
      toast('图片已插入', 'success');
    } catch (error) {
      toast(`图片上传失败：${error.message}`, 'error');
    }
  };

  const toggleEdit = () => {
    if (editing) {
      if (document.activeElement?.isContentEditable) document.activeElement.blur();
      setEditing(false);
    } else {
      setEditing(true);
      setSavedAt('');
    }
  };

  const handleCommand = (command, value) => {
    document.execCommand(command, false, value);
  };

  const handleLink = () => {
    const url = window.prompt('输入链接地址', 'https://');
    if (url) handleCommand('createLink', url);
  };

  const insertTable = () => {
    const parentId = activeBlock?.parentId || rootId;
    const index = activeBlock ? activeBlock.index + 1 : rootChildren.length;
    insertBlock('table', parentId, index);
  };

  const ctx = {
    editing,
    selectedId,
    token,
    onFocus: (info) => {
      setSelectedId(info.blockId);
      setActiveBlock(info);
    },
    onBlur: saveBlock,
    onAdd: insertBlock,
    onDelete: deleteBlock,
    onToggleTodo: toggleTodo,
  };

  if (docQuery.isLoading) {
    return (
      <div className="page docx-page">
        <div className="doc-sheet">
          <Loading label="正在读取飞书文档" />
        </div>
      </div>
    );
  }

  if (docQuery.isError) {
    return (
      <div className="page docx-page">
        <header className="page-head">
          <div>
            <h1>云文档</h1>
            <div className="head-meta">
              <span className="mono">{token}</span>
            </div>
          </div>
        </header>
        <ErrorBanner
          error={docQuery.error}
          onRetry={() => docQuery.refetch()}
          title="读取文档失败"
        />
        <div className="catalog empty-catalog">
          <EmptyState
            icon={FileText}
            title="无法打开这篇文档"
            description="确认应用已被加为文档协作者，并且已开通 docx:document 权限。也可以先在数据源页重新同步。"
            action={
              <Link to="/sources" className="btn">
                返回数据源
              </Link>
            }
          />
        </div>
      </div>
    );
  }

  return (
    <div className="page docx-page">
      <header className="page-head docx-page-head">
        <div className="docx-head-main">
          <div className="docx-subtitle">
            <TypeBadge type="docx" />
            <span>来自飞书</span>
            <span className="meta-rule" aria-hidden="true" />
            <span>读取于 {relativeTime(new Date(docQuery.dataUpdatedAt).toISOString())}</span>
            {savedAt && (
              <>
                <span className="meta-rule" aria-hidden="true" />
                <span>已保存 {relativeTime(savedAt)}</span>
              </>
            )}
          </div>
          <h1 className="docx-title">{title}</h1>
        </div>
        <div className="docx-actions">
          {originalUrl && (
            <a className="btn" href={originalUrl} target="_blank" rel="noreferrer">
              <ExternalLink size={15} />
              打开原文
            </a>
          )}
          <button
            type="button"
            className="btn"
            onClick={() => reload()}
            disabled={docQuery.isFetching}
          >
            <RefreshCw size={15} className={docQuery.isFetching ? 'spin' : undefined} />
            刷新
          </button>
          <button
            type="button"
            className={`btn${editing ? '' : ' btn-primary'}`}
            onClick={toggleEdit}
          >
            {editing ? (
              <>
                <Check size={15} />
                完成
              </>
            ) : (
              <>
                <Pencil size={15} />
                编辑
              </>
            )}
          </button>
        </div>
      </header>

      {editing && (
        <>
          <div className="doc-toolbar" onMouseDown={(event) => event.preventDefault()}>
            <button
              type="button"
              className="toolbar-btn"
              title="加粗"
              onClick={() => handleCommand('bold')}
            >
              <Bold size={15} />
            </button>
            <button
              type="button"
              className="toolbar-btn"
              title="斜体"
              onClick={() => handleCommand('italic')}
            >
              <Italic size={15} />
            </button>
            <button
              type="button"
              className="toolbar-btn"
              title="下划线"
              onClick={() => handleCommand('underline')}
            >
              <Underline size={15} />
            </button>
            <button
              type="button"
              className="toolbar-btn"
              title="删除线"
              onClick={() => handleCommand('strikeThrough')}
            >
              <Strikethrough size={15} />
            </button>
            <button type="button" className="toolbar-btn" title="行内代码" onClick={wrapSelectionInCode}>
              <Code2 size={15} />
            </button>
            <span className="toolbar-divider" aria-hidden="true" />
            <button type="button" className="toolbar-btn" title="添加链接" onClick={handleLink}>
              <Link2 size={15} />
            </button>
            <button
              type="button"
              className="toolbar-btn"
              title="移除链接"
              onClick={() => handleCommand('unlink')}
            >
              <Link2Off size={15} />
            </button>
            <button
              type="button"
              className="toolbar-btn"
              title="清除格式"
              onClick={() => handleCommand('removeFormat')}
            >
              <Eraser size={15} />
            </button>
            <span className="toolbar-divider" aria-hidden="true" />
            <button
              type="button"
              className="toolbar-btn"
              title="插入图片"
              onClick={() => fileInputRef.current?.click()}
            >
              <ImageIcon size={15} />
            </button>
            <button type="button" className="toolbar-btn" title="插入表格" onClick={insertTable}>
              <Table2 size={15} />
            </button>
            <span className="toolbar-divider" aria-hidden="true" />
            <button
              type="button"
              className="btn btn-small"
              onClick={() => {
                if (document.activeElement?.isContentEditable) document.activeElement.blur();
              }}
            >
              <Save size={13} />
              保存当前段
            </button>
            <span className="doc-save-note">
              {saving ? '保存中…' : '段落失焦自动保存'}
            </span>
          </div>
          <div className="doc-edit-banner">
            <Pencil size={13} />
            点击段落直接编辑，失焦或按 Ctrl+S 保存到飞书原文。左侧「+」可插入内容块。
          </div>
        </>
      )}

      <div className="doc-sheet">
        {rootChildren.length ? (
          <div className="docx-blocks">
            <BlockList nodes={rootChildren} parentId={rootId} depth={0} ctx={ctx} />
          </div>
        ) : (
          <div className="doc-empty">
            <p>这篇文档还没有正文内容。</p>
            {editing ? (
              <button
                type="button"
                className="btn btn-primary"
                onClick={() => insertBlock('text', rootId, 0)}
              >
                <Plus size={15} />
                插入段落
              </button>
            ) : (
              <p className="doc-empty-hint">进入编辑模式即可插入第一个段落。</p>
            )}
          </div>
        )}
      </div>

      <input ref={fileInputRef} type="file" accept="image/*" hidden onChange={handleFile} />
    </div>
  );
}
