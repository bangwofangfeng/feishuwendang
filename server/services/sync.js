import { db, nowIso } from '../db.js';
import { describeFeishuError } from '../feishu/client.js';
import { getDocument, listBlocks } from '../feishu/docx.js';
import { getSpreadsheetMeta, listSheets, readValues } from '../feishu/sheets.js';
import { getAppMeta, listTables, listFields, searchRecords } from '../feishu/bitable.js';
import { getBlockText } from '../../shared/docx.js';

const MAX_SEARCH_TEXT = 400000;
const SHEET_PREVIEW_ROWS = 30;
const SHEET_PREVIEW_COLS = 20;
const BITABLE_PREVIEW_RECORDS = 100;
const BITABLE_PREVIEW_TABLES = 3;

function stringifyCell(value, fieldType) {
  if (value === null || value === undefined) return '';
  if (fieldType === 7) return value ? '是' : '否';
  if (fieldType === 5 && typeof value === 'number') {
    const date = new Date(value);
    if (!Number.isNaN(date.getTime())) {
      const pad = (input) => String(input).padStart(2, '0');
      return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}`;
    }
  }
  if (fieldType === 11) {
    return Array.isArray(value)
      ? value.map((person) => person?.name || person?.en_name || '').filter(Boolean).join(' ')
      : String(value);
  }
  if (fieldType === 15 && typeof value === 'object') {
    return value.link || value.text || '';
  }
  if (fieldType === 17) {
    return Array.isArray(value) ? `附件 ${value.length}` : '附件';
  }
  if (typeof value === 'string' || typeof value === 'number' || typeof value === 'boolean') {
    return String(value);
  }
  if (Array.isArray(value)) return value.map((item) => stringifyCell(item)).filter(Boolean).join(' ');
  if (typeof value === 'object') {
    return stringifyCell(value.text || value.name || value.link || value.value || '');
  }
  return '';
}

function buildSheetPreviewText(previews) {
  const chunks = [];
  for (const preview of Object.values(previews)) {
    if (!preview?.values) continue;
    for (const row of preview.values) {
      chunks.push(row.map(stringifyCell).join('\t'));
    }
  }
  return chunks.join('\n');
}

async function buildDocxSnapshot(token) {
  const [document, blocks] = await Promise.all([getDocument(token), listBlocks(token)]);
  const bodyText = blocks.map(getBlockText).filter(Boolean).join('\n');
  return {
    title: document?.title || '未命名文档',
    meta: {
      document_id: document?.document_id || token,
      revision_id: document?.revision_id,
      title: document?.title,
    },
    content: { blocks, fetched_at: nowIso() },
    searchText: [document?.title || '', bodyText].join('\n').slice(0, MAX_SEARCH_TEXT),
  };
}

async function buildSheetSnapshot(token) {
  const [spreadsheet, sheets] = await Promise.all([getSpreadsheetMeta(token), listSheets(token)]);
  const previews = {};
  for (const sheet of sheets.slice(0, 8)) {
    const lastCol = String.fromCharCode(64 + SHEET_PREVIEW_COLS);
    const range = `${sheet.sheet_id}!A1:${lastCol}${SHEET_PREVIEW_ROWS}`;
    try {
      previews[sheet.sheet_id] = await readValues(token, range);
    } catch {
      previews[sheet.sheet_id] = null;
    }
  }
  const title = spreadsheet?.title || '未命名电子表格';
  const sheetNames = sheets.map((sheet) => sheet.title).join(' ');
  return {
    title,
    meta: { spreadsheet: spreadsheet || null, sheets },
    content: { sheets, previews, fetched_at: nowIso() },
    searchText: [title, sheetNames, buildSheetPreviewText(previews)]
      .join('\n')
      .slice(0, MAX_SEARCH_TEXT),
  };
}

async function buildBitableSnapshot(token) {
  let app = null;
  try {
    app = await getAppMeta(token);
  } catch {
    app = null;
  }
  const tables = await listTables(token);
  const details = [];
  for (const table of tables.slice(0, BITABLE_PREVIEW_TABLES)) {
    const fields = await listFields(token, table.table_id);
    let records = [];
    let hasMore = false;
    try {
      const data = await searchRecords(token, table.table_id, {
        pageSize: BITABLE_PREVIEW_RECORDS,
      });
      records = data.items || [];
      hasMore = Boolean(data.has_more);
    } catch {
      records = [];
    }
    details.push({ table, fields, records, has_more: hasMore });
  }
  const title = app?.name || tables[0]?.name || '未命名多维表格';
  const recordText = details
    .map((detail) => {
      const typeByName = new Map(detail.fields.map((field) => [field.field_name, field.type]));
      return detail.records
        .map((record) =>
          Object.entries(record.fields || {})
            .map(([name, value]) => stringifyCell(value, typeByName.get(name)))
            .join(' ')
        )
        .join('\n');
    })
    .join('\n');
  return {
    title,
    meta: { app: app || null, tables },
    content: { tables: details, fetched_at: nowIso() },
    searchText: [title, ...tables.map((table) => table.name), recordText]
      .join('\n')
      .slice(0, MAX_SEARCH_TEXT),
  };
}

const BUILDERS = {
  docx: buildDocxSnapshot,
  sheet: buildSheetSnapshot,
  bitable: buildBitableSnapshot,
};

export async function syncSource(sourceId) {
  const source = db.prepare('SELECT * FROM sources WHERE id = ?').get(sourceId);
  if (!source) throw new Error('数据源不存在');
  const builder = BUILDERS[source.type];
  if (!builder) throw new Error(`不支持的数据源类型：${source.type}`);

  try {
    const snapshot = await builder(source.token);
    db.prepare(
      `UPDATE documents
       SET type = ?, token = ?, title = ?, meta_json = ?, content_json = ?, search_text = ?,
           synced_at = ?, sync_error = NULL
       WHERE source_id = ?`
    ).run(
      source.type,
      source.token,
      snapshot.title,
      JSON.stringify(snapshot.meta),
      JSON.stringify(snapshot.content),
      snapshot.searchText,
      nowIso(),
      sourceId
    );
    db.prepare('UPDATE sources SET title = ?, last_synced_at = ? WHERE id = ?').run(
      snapshot.title,
      nowIso(),
      sourceId
    );
    return { sourceId, ok: true, title: snapshot.title };
  } catch (error) {
    const message = describeFeishuError(error);
    db.prepare(
      'UPDATE documents SET sync_error = ?, synced_at = ? WHERE source_id = ?'
    ).run(message, nowIso(), sourceId);
    db.prepare('UPDATE sources SET last_synced_at = ? WHERE id = ?').run(nowIso(), sourceId);
    throw Object.assign(error, { sourceId, message });
  }
}

async function mapLimit(items, limit, worker) {
  const results = new Array(items.length);
  let cursor = 0;
  const runners = Array.from({ length: Math.min(limit, items.length) }, async () => {
    while (cursor < items.length) {
      const index = cursor++;
      try {
        results[index] = { ok: true, value: await worker(items[index]) };
      } catch (error) {
        results[index] = { ok: false, error };
      }
    }
  });
  await Promise.all(runners);
  return results;
}

export async function syncAll({ force = false, intervalMinutes } = {}) {
  const sources = db.prepare('SELECT * FROM sources ORDER BY id').all();
  const minutes = intervalMinutes ?? 0;
  const cutoff = force || !minutes ? null : new Date(Date.now() - minutes * 60000).toISOString();
  const targets = cutoff
    ? sources.filter((source) => !source.last_synced_at || source.last_synced_at < cutoff)
    : sources;

  const results = await mapLimit(targets, 2, async (source) => syncSource(source.id));
  const failures = [];
  let succeeded = 0;
  results.forEach((result, index) => {
    if (result.ok) succeeded += 1;
    else failures.push({ sourceId: targets[index].id, title: targets[index].title, error: result.error });
  });
  return { total: targets.length, succeeded, failed: failures.length, failures };
}

export async function syncStale(intervalMinutes) {
  return syncAll({ intervalMinutes });
}

export function parseDocumentRow(row) {
  if (!row) return null;
  return {
    ...row,
    meta: row.meta_json ? JSON.parse(row.meta_json) : null,
    content: row.content_json ? JSON.parse(row.content_json) : null,
  };
}
