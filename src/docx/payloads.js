import { BLOCK_TYPE } from '../../shared/docx.js';

const emptyText = () => ({ elements: [], style: {} });

export function createBlockPayload(kind) {
  switch (kind) {
    case 'h1':
      return { block_type: BLOCK_TYPE.HEADING1, heading1: emptyText() };
    case 'h2':
      return { block_type: BLOCK_TYPE.HEADING2, heading2: emptyText() };
    case 'h3':
      return { block_type: BLOCK_TYPE.HEADING3, heading3: emptyText() };
    case 'bullet':
      return { block_type: BLOCK_TYPE.BULLET, bullet: emptyText() };
    case 'ordered':
      return { block_type: BLOCK_TYPE.ORDERED, ordered: emptyText() };
    case 'quote':
      return { block_type: BLOCK_TYPE.QUOTE, quote: emptyText() };
    case 'code':
      return { block_type: BLOCK_TYPE.CODE, code: emptyText() };
    case 'todo':
      return {
        block_type: BLOCK_TYPE.TODO,
        todo: { elements: [], style: { done: false } },
      };
    case 'divider':
      return { block_type: BLOCK_TYPE.DIVIDER, divider: {} };
    case 'text':
    default:
      return { block_type: BLOCK_TYPE.TEXT, text: emptyText() };
  }
}

export function buildTablePayload(rows = 2, columns = 2) {
  const safeRows = Math.min(Math.max(Number(rows) || 2, 1), 20);
  const safeColumns = Math.min(Math.max(Number(columns) || 2, 1), 10);
  const cells = [];
  for (let row = 0; row < safeRows; row += 1) {
    for (let column = 0; column < safeColumns; column += 1) {
      cells.push({
        block_type: BLOCK_TYPE.TABLE_CELL,
        table_cell: {},
        children: [{ block_type: BLOCK_TYPE.TEXT, text: emptyText() }],
      });
    }
  }
  return {
    block_type: BLOCK_TYPE.TABLE,
    table: {
      property: {
        row_size: safeRows,
        column_size: safeColumns,
        column_width: Array.from({ length: safeColumns }, () => 120),
        header_row: true,
      },
    },
    children: cells,
  };
}
