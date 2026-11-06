import { db } from '../db.js';
import {
  createBlockChildren,
  listBlocks,
  updateBlockText,
} from '../feishu/docx.js';
import {
  appendValues,
  deleteDimension,
  insertDimension,
  listSheets,
  readValues,
  writeValues,
} from '../feishu/sheets.js';
import {
  createRecord,
  listFields,
  listTables,
  searchRecords,
  updateRecord,
} from '../feishu/bitable.js';
import { getBlockText } from '../../shared/docx.js';

export const nativeToolDefinitions = [
  {
    name: 'hub_search_local',
    description:
      '在平台的本地汇总索引里搜索文档、电子表格、多维表格。适合用户问“平台里有没有关于 X 的资料”。返回标题、类型、token 和内容摘要。',
    input_schema: {
      type: 'object',
      properties: {
        query: { type: 'string', description: '搜索关键词' },
        type: { type: 'string', enum: ['docx', 'sheet', 'bitable'], description: '可选，限定类型' },
        limit: { type: 'number', description: '返回条数，默认 20，最多 50' },
      },
      required: ['query'],
    },
  },
  {
    name: 'hub_docx_list_blocks',
    description:
      '读取飞书云文档的全部内容块（block_id、类型、纯文本、子块）。修改文档前先用它定位 block_id。',
    input_schema: {
      type: 'object',
      properties: {
        document_token: { type: 'string', description: '云文档 token，通常来自 /docx/<token> 链接' },
      },
      required: ['document_token'],
    },
  },
  {
    name: 'hub_docx_update_block_text',
    description: '更新云文档中某个文本块的全部纯文本内容，保留块 id 与块类型。会直接修改飞书原文。',
    input_schema: {
      type: 'object',
      properties: {
        document_token: { type: 'string' },
        block_id: { type: 'string' },
        text: { type: 'string', description: '新的纯文本内容' },
      },
      required: ['document_token', 'block_id', 'text'],
    },
  },
  {
    name: 'hub_docx_append_paragraph',
    description: '在云文档末尾追加一个正文段落。会直接修改飞书原文。',
    input_schema: {
      type: 'object',
      properties: {
        document_token: { type: 'string' },
        text: { type: 'string' },
      },
      required: ['document_token', 'text'],
    },
  },
  {
    name: 'hub_sheets_list_sheets',
    description: '列出一个电子表格的所有工作表，返回 sheet_id、标题、行列数。读写单元格前先用它确认 sheet_id。',
    input_schema: {
      type: 'object',
      properties: {
        spreadsheet_token: { type: 'string', description: '电子表格 token，来自 /sheets/<token> 链接' },
      },
      required: ['spreadsheet_token'],
    },
  },
  {
    name: 'hub_sheets_read_values',
    description: '读取电子表格指定区域，返回二维数组。range 形如 <sheet_id>!A1:D20。',
    input_schema: {
      type: 'object',
      properties: {
        spreadsheet_token: { type: 'string' },
        range: { type: 'string', description: '例如 9b2f3c!A1:D20' },
      },
      required: ['spreadsheet_token', 'range'],
    },
  },
  {
    name: 'hub_sheets_write_values',
    description:
      '把二维数组写入电子表格指定区域。values 的行列数应与 range 匹配。会直接修改飞书原表格。',
    input_schema: {
      type: 'object',
      properties: {
        spreadsheet_token: { type: 'string' },
        range: { type: 'string' },
        values: {
          type: 'array',
          description: '二维数组，例如 [["姓名","金额"],["张三",100]]',
          items: { type: 'array', items: {} },
        },
      },
      required: ['spreadsheet_token', 'range', 'values'],
    },
  },
  {
    name: 'hub_sheets_append_values',
    description: '在电子表格某个工作表末尾追加若干行数据。会直接修改飞书原表格。',
    input_schema: {
      type: 'object',
      properties: {
        spreadsheet_token: { type: 'string' },
        range: { type: 'string', description: '例如 9b2f3c!A1:D1 或 9b2f3c!A:D' },
        values: { type: 'array', items: { type: 'array', items: {} } },
      },
      required: ['spreadsheet_token', 'range', 'values'],
    },
  },
  {
    name: 'hub_sheets_insert_dimension',
    description: '在电子表格中插入行或列。start_index / end_index 从 0 开始，end_index 为开区间。会直接修改飞书原表格。',
    input_schema: {
      type: 'object',
      properties: {
        spreadsheet_token: { type: 'string' },
        sheet_id: { type: 'string' },
        major_dimension: { type: 'string', enum: ['ROWS', 'COLUMNS'] },
        start_index: { type: 'number' },
        end_index: { type: 'number' },
      },
      required: ['spreadsheet_token', 'sheet_id', 'major_dimension', 'start_index', 'end_index'],
    },
  },
  {
    name: 'hub_sheets_delete_dimension',
    description: '删除电子表格中的行或列。start_index / end_index 从 0 开始，end_index 为开区间。会直接修改飞书原表格。',
    input_schema: {
      type: 'object',
      properties: {
        spreadsheet_token: { type: 'string' },
        sheet_id: { type: 'string' },
        major_dimension: { type: 'string', enum: ['ROWS', 'COLUMNS'] },
        start_index: { type: 'number' },
        end_index: { type: 'number' },
      },
      required: ['spreadsheet_token', 'sheet_id', 'major_dimension', 'start_index', 'end_index'],
    },
  },
  {
    name: 'hub_bitable_list_tables',
    description: '列出多维表格的数据表，返回 table_id 和名称。',
    input_schema: {
      type: 'object',
      properties: {
        app_token: { type: 'string', description: '多维表格 token，来自 /base/<token> 链接' },
      },
      required: ['app_token'],
    },
  },
  {
    name: 'hub_bitable_list_fields',
    description: '列出多维表格某个数据表的字段名称、字段 id 和字段类型。',
    input_schema: {
      type: 'object',
      properties: {
        app_token: { type: 'string' },
        table_id: { type: 'string' },
      },
      required: ['app_token', 'table_id'],
    },
  },
  {
    name: 'hub_bitable_search_records',
    description: '读取多维表格某个数据表的记录，返回 record_id 和 fields。',
    input_schema: {
      type: 'object',
      properties: {
        app_token: { type: 'string' },
        table_id: { type: 'string' },
        page_size: { type: 'number', description: '默认 50，最多 500' },
      },
      required: ['app_token', 'table_id'],
    },
  },
  {
    name: 'hub_bitable_create_record',
    description: '在多维表格中新增一条记录。fields 的键必须与字段名一致。会直接修改飞书原表格。',
    input_schema: {
      type: 'object',
      properties: {
        app_token: { type: 'string' },
        table_id: { type: 'string' },
        fields: { type: 'object', description: '字段名到值的映射' },
      },
      required: ['app_token', 'table_id', 'fields'],
    },
  },
  {
    name: 'hub_bitable_update_record',
    description: '更新多维表格中的一条记录。fields 只需包含要修改的字段。会直接修改飞书原表格。',
    input_schema: {
      type: 'object',
      properties: {
        app_token: { type: 'string' },
        table_id: { type: 'string' },
        record_id: { type: 'string' },
        fields: { type: 'object' },
      },
      required: ['app_token', 'table_id', 'record_id', 'fields'],
    },
  },
];

function requireParam(input, key) {
  const value = input?.[key];
  if (value === undefined || value === null || value === '') {
    throw new Error(`缺少参数 ${key}`);
  }
  return value;
}

export async function executeNativeTool(name, input = {}) {
  switch (name) {
    case 'hub_search_local': {
      const query = String(input.query || '').trim();
      const type = ['docx', 'sheet', 'bitable'].includes(input.type) ? input.type : '';
      const limit = Math.min(Math.max(Number(input.limit) || 20, 1), 50);
      const conditions = [];
      const params = [];
      if (type) {
        conditions.push('d.type = ?');
        params.push(type);
      }
      if (query) {
        conditions.push(
          `(instr(lower(coalesce(d.title, '')), lower(?)) > 0
            OR instr(lower(coalesce(d.search_text, '')), lower(?)) > 0)`
        );
        params.push(query, query);
      }
      const where = conditions.length ? `WHERE ${conditions.join(' AND ')}` : '';
      const rows = db
        .prepare(
          `SELECT d.type, d.token, d.title, d.search_text, s.url
           FROM documents d JOIN sources s ON s.id = d.source_id
           ${where}
           ORDER BY d.synced_at DESC
           LIMIT ?`
        )
        .all(...params, limit);
      return {
        items: rows.map((row) => ({
          type: row.type,
          token: row.token,
          title: row.title,
          url: row.url,
          snippet: String(row.search_text || '').slice(0, 200),
        })),
      };
    }

    case 'hub_docx_list_blocks': {
      const blocks = await listBlocks(requireParam(input, 'document_token'));
      return {
        document_token: input.document_token,
        blocks: blocks.map((block) => ({
          block_id: block.block_id,
          block_type: block.block_type,
          parent_id: block.parent_id,
          text: getBlockText(block),
          children: block.children || [],
        })),
      };
    }

    case 'hub_docx_update_block_text': {
      const data = await updateBlockText(
        requireParam(input, 'document_token'),
        requireParam(input, 'block_id'),
        [{ text_run: { content: String(input.text ?? '') } }]
      );
      return { ok: true, data };
    }

    case 'hub_docx_append_paragraph': {
      const data = await createBlockChildren(
        requireParam(input, 'document_token'),
        input.document_token,
        [
          {
            block_type: 2,
            text: {
              elements: [{ text_run: { content: String(input.text ?? '') } }],
              style: {},
            },
          },
        ]
      );
      return { ok: true, data };
    }

    case 'hub_sheets_list_sheets': {
      const sheets = await listSheets(requireParam(input, 'spreadsheet_token'));
      return {
        sheets: sheets.map((sheet) => ({
          sheet_id: sheet.sheet_id,
          title: sheet.title,
          row_count: sheet.grid_properties?.row_count ?? sheet.row_count,
          column_count: sheet.grid_properties?.column_count ?? sheet.column_count,
        })),
      };
    }

    case 'hub_sheets_read_values': {
      const valueRange = await readValues(
        requireParam(input, 'spreadsheet_token'),
        requireParam(input, 'range')
      );
      return { range: valueRange?.range, values: valueRange?.values || [] };
    }

    case 'hub_sheets_write_values': {
      if (!Array.isArray(input.values)) throw new Error('values 必须是二维数组');
      const data = await writeValues(
        requireParam(input, 'spreadsheet_token'),
        requireParam(input, 'range'),
        input.values
      );
      return { ok: true, data };
    }

    case 'hub_sheets_append_values': {
      if (!Array.isArray(input.values)) throw new Error('values 必须是二维数组');
      const data = await appendValues(
        requireParam(input, 'spreadsheet_token'),
        requireParam(input, 'range'),
        input.values
      );
      return { ok: true, data };
    }

    case 'hub_sheets_insert_dimension':
    case 'hub_sheets_delete_dimension': {
      const dimension = {
        sheetId: requireParam(input, 'sheet_id'),
        majorDimension: requireParam(input, 'major_dimension'),
        startIndex: Number(requireParam(input, 'start_index')),
        endIndex: Number(requireParam(input, 'end_index')),
      };
      const data =
        name === 'hub_sheets_insert_dimension'
          ? await insertDimension(input.spreadsheet_token, dimension)
          : await deleteDimension(input.spreadsheet_token, dimension);
      return { ok: true, data };
    }

    case 'hub_bitable_list_tables': {
      const tables = await listTables(requireParam(input, 'app_token'));
      return {
        tables: tables.map((table) => ({ table_id: table.table_id, name: table.name })),
      };
    }

    case 'hub_bitable_list_fields': {
      const fields = await listFields(
        requireParam(input, 'app_token'),
        requireParam(input, 'table_id')
      );
      return {
        fields: fields.map((field) => ({
          field_id: field.field_id,
          field_name: field.field_name,
          type: field.type,
          is_primary: field.is_primary || false,
        })),
      };
    }

    case 'hub_bitable_search_records': {
      const data = await searchRecords(
        requireParam(input, 'app_token'),
        requireParam(input, 'table_id'),
        { pageSize: Math.min(Number(input.page_size) || 50, 500) }
      );
      return {
        items: (data.items || []).map((record) => ({
          record_id: record.record_id,
          fields: record.fields,
        })),
        has_more: Boolean(data.has_more),
        page_token: data.page_token,
      };
    }

    case 'hub_bitable_create_record': {
      const data = await createRecord(
        requireParam(input, 'app_token'),
        requireParam(input, 'table_id'),
        requireParam(input, 'fields')
      );
      return { ok: true, record: data.record };
    }

    case 'hub_bitable_update_record': {
      const data = await updateRecord(
        requireParam(input, 'app_token'),
        requireParam(input, 'table_id'),
        requireParam(input, 'record_id'),
        requireParam(input, 'fields')
      );
      return { ok: true, record: data.record };
    }

    default:
      throw new Error(`未知的本地工具：${name}`);
  }
}
