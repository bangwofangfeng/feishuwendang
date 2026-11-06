export const BLOCK_TYPE = {
  PAGE: 1,
  TEXT: 2,
  HEADING1: 3,
  HEADING2: 4,
  HEADING3: 5,
  HEADING4: 6,
  HEADING5: 7,
  HEADING6: 8,
  HEADING7: 9,
  HEADING8: 10,
  HEADING9: 11,
  BULLET: 12,
  ORDERED: 13,
  CODE: 14,
  QUOTE: 15,
  TODO: 17,
  BITABLE: 18,
  CALLOUT: 19,
  DIVIDER: 20,
  FILE: 21,
  GRID: 22,
  GRID_COLUMN: 23,
  IFRAME: 24,
  IMAGE: 25,
  ISV: 26,
  MINDNOTE: 27,
  SHEET: 28,
  TABLE: 29,
  TABLE_CELL: 30,
  VIEW: 31,
  QUOTE_CONTAINER: 32,
};

export const TEXT_BLOCK_KEYS = {
  [BLOCK_TYPE.TEXT]: 'text',
  [BLOCK_TYPE.HEADING1]: 'heading1',
  [BLOCK_TYPE.HEADING2]: 'heading2',
  [BLOCK_TYPE.HEADING3]: 'heading3',
  [BLOCK_TYPE.HEADING4]: 'heading4',
  [BLOCK_TYPE.HEADING5]: 'heading5',
  [BLOCK_TYPE.HEADING6]: 'heading6',
  [BLOCK_TYPE.HEADING7]: 'heading7',
  [BLOCK_TYPE.HEADING8]: 'heading8',
  [BLOCK_TYPE.HEADING9]: 'heading9',
  [BLOCK_TYPE.BULLET]: 'bullet',
  [BLOCK_TYPE.ORDERED]: 'ordered',
  [BLOCK_TYPE.CODE]: 'code',
  [BLOCK_TYPE.QUOTE]: 'quote',
  [BLOCK_TYPE.TODO]: 'todo',
};

export const HEADING_BLOCK_TYPES = [
  BLOCK_TYPE.HEADING1,
  BLOCK_TYPE.HEADING2,
  BLOCK_TYPE.HEADING3,
  BLOCK_TYPE.HEADING4,
  BLOCK_TYPE.HEADING5,
  BLOCK_TYPE.HEADING6,
  BLOCK_TYPE.HEADING7,
  BLOCK_TYPE.HEADING8,
  BLOCK_TYPE.HEADING9,
];

export function getBlockPayload(block) {
  const key = TEXT_BLOCK_KEYS[block?.block_type];
  if (!key) return null;
  return block[key] || null;
}

export function getTextElements(block) {
  const payload = getBlockPayload(block);
  return payload?.elements || [];
}

export function textElementToPlain(element) {
  if (!element) return '';
  if (element.text_run) return element.text_run.content || '';
  if (element.mention_doc) return element.mention_doc.title || '';
  if (element.mention_user) return element.mention_user.name || '';
  if (element.equation) return element.equation.content || '';
  return '';
}

export function getBlockText(block) {
  return getTextElements(block).map(textElementToPlain).join('');
}

export function buildBlockTree(blocks) {
  const byId = new Map();
  for (const block of blocks) byId.set(block.block_id, { ...block, childrenNodes: [] });
  let root = null;
  for (const node of byId.values()) {
    const parent = byId.get(node.parent_id);
    if (parent) parent.childrenNodes.push(node);
    else root = node;
  }
  const orderChildren = (node) => {
    const order = node?.children || [];
    if (Array.isArray(node?.childrenNodes)) {
      const rank = new Map(order.map((id, index) => [id, index]));
      node.childrenNodes.sort((a, b) => (rank.get(a.block_id) ?? 1e9) - (rank.get(b.block_id) ?? 1e9));
      node.childrenNodes.forEach(orderChildren);
    }
  };
  if (root) orderChildren(root);
  return { root, byId };
}
