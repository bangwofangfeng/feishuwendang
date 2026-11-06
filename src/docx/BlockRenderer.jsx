import { Fragment, useState } from 'react';
import { Link } from 'react-router-dom';
import {
  CheckSquare,
  Code2,
  Heading1,
  Heading2,
  Heading3,
  Image as ImageIcon,
  List,
  ListOrdered,
  Minus,
  Plus,
  Quote,
  Table2,
  Trash2,
  Type,
} from 'lucide-react';
import {
  BLOCK_TYPE,
  TEXT_BLOCK_KEYS,
  getBlockText,
  getTextElements,
} from '../../shared/docx.js';

const TEXT_TYPES = new Set(Object.keys(TEXT_BLOCK_KEYS).map(Number));

const HEADING_META = {
  [BLOCK_TYPE.HEADING1]: { tag: 'h1', className: 'doc-h1' },
  [BLOCK_TYPE.HEADING2]: { tag: 'h2', className: 'doc-h2' },
  [BLOCK_TYPE.HEADING3]: { tag: 'h3', className: 'doc-h3' },
  [BLOCK_TYPE.HEADING4]: { tag: 'h4', className: 'doc-h4' },
  [BLOCK_TYPE.HEADING5]: { tag: 'h5', className: 'doc-h5' },
  [BLOCK_TYPE.HEADING6]: { tag: 'h6', className: 'doc-h6' },
  [BLOCK_TYPE.HEADING7]: { tag: 'h6', className: 'doc-h7' },
  [BLOCK_TYPE.HEADING8]: { tag: 'h6', className: 'doc-h8' },
  [BLOCK_TYPE.HEADING9]: { tag: 'h6', className: 'doc-h9' },
};

const ADD_OPTIONS = [
  { kind: 'text', label: '正文', icon: Type },
  { kind: 'h1', label: '标题 1', icon: Heading1 },
  { kind: 'h2', label: '标题 2', icon: Heading2 },
  { kind: 'h3', label: '标题 3', icon: Heading3 },
  { kind: 'bullet', label: '无序列表', icon: List },
  { kind: 'ordered', label: '有序列表', icon: ListOrdered },
  { kind: 'todo', label: '待办事项', icon: CheckSquare },
  { kind: 'quote', label: '引用', icon: Quote },
  { kind: 'code', label: '代码块', icon: Code2 },
  { kind: 'divider', label: '分割线', icon: Minus },
  { kind: 'image', label: '图片', icon: ImageIcon },
  { kind: 'table', label: '表格', icon: Table2 },
];

const FALLBACK_LABELS = {
  [BLOCK_TYPE.FILE]: '文件',
  [BLOCK_TYPE.IFRAME]: '网页嵌入',
  [BLOCK_TYPE.MINDNOTE]: '思维笔记',
  [BLOCK_TYPE.VIEW]: '视图',
  [BLOCK_TYPE.ISV]: '第三方应用内容',
  [BLOCK_TYPE.BOARD]: '画板',
  [BLOCK_TYPE.AGENDA]: '议程',
  [BLOCK_TYPE.TASK]: '任务',
};

export function Inline({ elements }) {
  if (!elements?.length) return null;
  return elements.map((element, index) => {
    if (element.text_run) {
      const style = element.text_run.text_element_style || {};
      const content = element.text_run.content || '';
      if (!content) return null;
      let output = content;
      if (style.inline_code) output = <code className="doc-inline-code">{output}</code>;
      if (style.bold) output = <strong>{output}</strong>;
      if (style.italic) output = <em>{output}</em>;
      if (style.underline) output = <u>{output}</u>;
      if (style.strikethrough) output = <s>{output}</s>;
      if (style.link?.url) {
        output = (
          <a href={style.link.url} target="_blank" rel="noreferrer">
            {output}
          </a>
        );
      }
      return <Fragment key={index}>{output}</Fragment>;
    }
    if (element.mention_doc) {
      return (
        <span
          key={index}
          className="doc-mention"
          data-raw-element={encodeURIComponent(JSON.stringify(element))}
        >
          {element.mention_doc.title || '文档'}
        </span>
      );
    }
    if (element.mention_user) {
      return (
        <span
          key={index}
          className="doc-mention"
          data-raw-element={encodeURIComponent(JSON.stringify(element))}
        >
          {element.mention_user.name || '成员'}
        </span>
      );
    }
    if (element.equation) {
      return (
        <code
          key={index}
          className="doc-inline-code"
          data-raw-element={encodeURIComponent(JSON.stringify(element))}
        >
          {element.equation.content || ''}
        </code>
      );
    }
    return null;
  });
}

export function BlockList({ nodes, parentId, depth = 0, ctx }) {
  let orderedCounter = 0;
  return (nodes || []).map((node, index) => {
    if (node.block_type === BLOCK_TYPE.ORDERED) orderedCounter += 1;
    else orderedCounter = 0;
    return (
      <BlockNode
        key={node.block_id}
        node={node}
        index={index}
        parentId={parentId}
        depth={depth}
        orderedIndex={node.block_type === BLOCK_TYPE.ORDERED ? orderedCounter : 0}
        ctx={ctx}
      />
    );
  });
}

function BlockNode({ node, index, parentId, depth, orderedIndex, ctx }) {
  const [menuOpen, setMenuOpen] = useState(false);
  const { editing, selectedId, onFocus, onBlur, onAdd, onDelete, onToggleTodo } = ctx;
  const type = node.block_type;
  const selected = selectedId === node.block_id;
  const canEdit = editing && TEXT_TYPES.has(type);

  if (type === BLOCK_TYPE.PAGE) {
    return <BlockList nodes={node.childrenNodes} parentId={node.block_id} depth={depth} ctx={ctx} />;
  }

  const editableProps = {
    contentEditable: canEdit,
    suppressContentEditableWarning: true,
    spellCheck: false,
    ...(canEdit ? { onBlur: (event) => onBlur(node, event.currentTarget) } : {}),
  };

  const inline = <Inline elements={getTextElements(node)} />;
  const contentKey = `${node.block_id}:${node.__rev || 0}`;
  let body = null;

  if (type === BLOCK_TYPE.TEXT) {
    body = (
      <p key={contentKey} className="doc-text" {...editableProps}>
        {inline}
      </p>
    );
  } else if (HEADING_META[type]) {
    const Tag = HEADING_META[type].tag;
    body = (
      <Tag key={contentKey} className={HEADING_META[type].className} {...editableProps}>
        {inline}
      </Tag>
    );
  } else if (type === BLOCK_TYPE.BULLET) {
    body = (
      <div className="doc-bullet">
        <span className="doc-marker" aria-hidden="true">
          •
        </span>
        <div key={contentKey} className="doc-text doc-list-text" {...editableProps}>
          {inline}
        </div>
      </div>
    );
  } else if (type === BLOCK_TYPE.ORDERED) {
    body = (
      <div className="doc-ordered">
        <span className="doc-marker" aria-hidden="true">
          {orderedIndex}.
        </span>
        <div key={contentKey} className="doc-text doc-list-text" {...editableProps}>
          {inline}
        </div>
      </div>
    );
  } else if (type === BLOCK_TYPE.CODE) {
    body = (
      <pre key={contentKey} className="doc-code" {...editableProps}>
        {inline}
      </pre>
    );
  } else if (type === BLOCK_TYPE.QUOTE) {
    body = (
      <blockquote key={contentKey} className="doc-quote" {...editableProps}>
        {inline}
      </blockquote>
    );
  } else if (type === BLOCK_TYPE.TODO) {
    const done = Boolean(node.todo?.style?.done);
    body = (
      <div className={`doc-todo${done ? ' done' : ''}`}>
        <input
          type="checkbox"
          className="doc-todo-check"
          checked={done}
          disabled={!editing}
          onChange={() => onToggleTodo(node)}
        />
        <div key={contentKey} className="doc-text doc-todo-text" {...editableProps}>
          {inline}
        </div>
      </div>
    );
  } else if (type === BLOCK_TYPE.DIVIDER) {
    body = <hr className="doc-divider" />;
  } else if (type === BLOCK_TYPE.IMAGE) {
    const fileToken = node.image?.token;
    body = fileToken ? (
      <img
        className="doc-image"
        src={`/api/media/${encodeURIComponent(fileToken)}`}
        alt={node.image?.caption || '文档图片'}
        loading="lazy"
      />
    ) : (
      <div className="doc-fallback">图片缺少文件 Token，暂时无法显示。</div>
    );
  } else if (type === BLOCK_TYPE.TABLE) {
    body = renderTable(node, depth, ctx);
  } else if (type === BLOCK_TYPE.CALLOUT) {
    body = (
      <div className="doc-callout">
        <BlockList nodes={node.childrenNodes} parentId={node.block_id} depth={depth + 1} ctx={ctx} />
      </div>
    );
  } else if (type === BLOCK_TYPE.GRID || type === BLOCK_TYPE.GRID_COLUMN || type === BLOCK_TYPE.QUOTE_CONTAINER) {
    body = (
      <div className="doc-container">
        <BlockList nodes={node.childrenNodes} parentId={node.block_id} depth={depth + 1} ctx={ctx} />
      </div>
    );
  } else if (type === BLOCK_TYPE.SHEET) {
    const sheetToken = node.sheet?.token;
    body = sheetToken ? (
      <Link className="doc-fallback doc-embed" to={`/sheet/${sheetToken}`}>
        嵌入的电子表格：{node.sheet?.title || sheetToken}
      </Link>
    ) : (
      <div className="doc-fallback">嵌入的电子表格（缺少 Token）</div>
    );
  } else if (type === BLOCK_TYPE.BITABLE) {
    const appToken = node.bitable?.token;
    body = appToken ? (
      <Link className="doc-fallback doc-embed" to={`/bitable/${appToken}`}>
        嵌入的多维表格：{node.bitable?.title || appToken}
      </Link>
    ) : (
      <div className="doc-fallback">嵌入的多维表格（缺少 Token）</div>
    );
  } else {
    body = (
      <div className="doc-fallback">
        暂不支持的内容块：{FALLBACK_LABELS[type] || `类型 ${type}`}
      </div>
    );
  }

  const hasOwnChildren =
    type !== BLOCK_TYPE.TABLE &&
    type !== BLOCK_TYPE.CALLOUT &&
    type !== BLOCK_TYPE.GRID &&
    type !== BLOCK_TYPE.GRID_COLUMN &&
    type !== BLOCK_TYPE.QUOTE_CONTAINER &&
    type !== BLOCK_TYPE.SHEET &&
    type !== BLOCK_TYPE.BITABLE;

  return (
    <div
      className={`doc-block doc-block-type-${type}${selected ? ' selected' : ''}`}
      data-block-id={node.block_id}
      onFocusCapture={() => onFocus({ blockId: node.block_id, parentId, index, blockType: type })}
    >
      {editing && depth === 0 && (
        <div className="block-rail">
          <button
            type="button"
            title="在下方插入内容块"
            onClick={() => setMenuOpen((value) => !value)}
          >
            <Plus size={14} />
          </button>
          <button type="button" title="删除内容块" onClick={() => onDelete(parentId, index, node)}>
            <Trash2 size={14} />
          </button>
        </div>
      )}
      {body}
      {hasOwnChildren && node.childrenNodes?.length > 0 && (
        <div className="doc-children">
          <BlockList nodes={node.childrenNodes} parentId={node.block_id} depth={depth + 1} ctx={ctx} />
        </div>
      )}
      {menuOpen && (
        <div className="add-block-menu">
          {ADD_OPTIONS.map((option) => {
            const Icon = option.icon;
            return (
              <button
                key={option.kind}
                type="button"
                onClick={() => {
                  setMenuOpen(false);
                  onAdd(option.kind, parentId, index + 1);
                }}
              >
                <Icon size={14} />
                {option.label}
              </button>
            );
          })}
        </div>
      )}
    </div>
  );
}

function renderTable(node, depth, ctx) {
  const cells = (node.childrenNodes || []).filter(
    (child) => child.block_type === BLOCK_TYPE.TABLE_CELL
  );
  const property = node.table?.property || {};
  const columns = Math.max(property.column_size || 1, 1);
  const rows = Math.max(property.row_size || Math.ceil(cells.length / columns), 1);
  return (
    <div className="doc-table-wrap">
      <table className="doc-table">
        <tbody>
          {Array.from({ length: rows }).map((_, rowIndex) => (
            <tr key={rowIndex}>
              {Array.from({ length: columns }).map((_, columnIndex) => {
                const cell = cells[rowIndex * columns + columnIndex];
                return (
                  <td key={columnIndex}>
                    {cell ? (
                      <BlockList
                        nodes={cell.childrenNodes || []}
                        parentId={cell.block_id}
                        depth={depth + 1}
                        ctx={ctx}
                      />
                    ) : null}
                  </td>
                );
              })}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
