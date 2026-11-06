import { useEffect, useState } from 'react';
import { useParams } from 'react-router-dom';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import {
  ChevronLeft,
  ChevronRight,
  ExternalLink,
  Grid3x3,
  Pencil,
  Plus,
  RefreshCw,
  Trash2,
} from 'lucide-react';
import { api } from '../api.js';
import EmptyState from '../components/EmptyState.jsx';
import ErrorBanner from '../components/ErrorBanner.jsx';
import Loading from '../components/Loading.jsx';
import Modal from '../components/Modal.jsx';
import { useToast } from '../components/Toast.jsx';
import { cellText, errorMessage, formatBitableValue } from '../utils.js';

const FIELD_TYPE_LABELS = {
  1: '文本',
  2: '数字',
  3: '单选',
  4: '多选',
  5: '日期',
  7: '复选框',
  11: '人员',
  13: '电话',
  15: '链接',
  17: '附件',
  18: '单向关联',
  19: '查找引用',
  20: '公式',
  21: '双向关联',
  22: '地理位置',
  1001: '创建时间',
  1002: '修改时间',
  1003: '创建人',
  1004: '修改人',
  1005: '自动编号',
};

const EDITABLE_TYPES = new Set([1, 2, 3, 4, 5, 7, 13, 15]);

function pad(value) {
  return String(value).padStart(2, '0');
}

function msToDateInput(ms) {
  const time = Number(ms);
  if (!Number.isFinite(time)) return '';
  const date = new Date(time);
  if (Number.isNaN(date.getTime())) return '';
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}`;
}

function dateInputToMs(value) {
  if (!value) return null;
  const date = new Date(`${value}T00:00:00`);
  return Number.isNaN(date.getTime()) ? null : date.getTime();
}

function editableValue(field, raw) {
  switch (field.type) {
    case 1:
    case 3:
    case 13:
      return cellText(raw);
    case 2:
      return raw === null || raw === undefined ? '' : String(raw);
    case 4:
      return Array.isArray(raw) ? raw.map(cellText) : raw ? [cellText(raw)] : [];
    case 5:
      return raw === null || raw === undefined ? '' : msToDateInput(raw);
    case 7:
      return Boolean(raw);
    case 15:
      return raw?.link || cellText(raw);
    default:
      return '';
  }
}

function encodeValue(field, value) {
  switch (field.type) {
    case 1:
    case 3:
    case 13:
      return String(value);
    case 2: {
      const number = Number(value);
      return Number.isFinite(number) ? number : 0;
    }
    case 4:
      return Array.isArray(value) ? value : [];
    case 5:
      return dateInputToMs(value);
    case 7:
      return Boolean(value);
    case 15:
      return { link: String(value), text: String(value) };
    default:
      return value;
  }
}

function isEmptyValue(value) {
  return (
    value === '' ||
    value === null ||
    value === undefined ||
    (Array.isArray(value) && value.length === 0)
  );
}

export default function BitablePage() {
  const { token } = useParams();
  const toast = useToast();
  const queryClient = useQueryClient();

  const [activeTableId, setActiveTableId] = useState('');
  const [pageStack, setPageStack] = useState(['']);
  const [recordModal, setRecordModal] = useState(null);

  const metaQuery = useQuery({
    queryKey: ['bitableMeta', token],
    queryFn: () => api.bitableMeta(token),
    retry: 0,
  });
  const sourceQuery = useQuery({
    queryKey: ['sourceByToken', 'bitable', token],
    queryFn: () => api.sourceLookup('bitable', token),
    retry: false,
  });

  const tables = metaQuery.data?.tables || [];
  const activeTable = tables.find((table) => table.table_id === activeTableId) || tables[0];

  useEffect(() => {
    if (!activeTableId && tables.length) setActiveTableId(tables[0].table_id);
  }, [tables, activeTableId]);

  useEffect(() => {
    setPageStack(['']);
    setRecordModal(null);
  }, [activeTable?.table_id]);

  const fieldsQuery = useQuery({
    queryKey: ['bitableFields', token, activeTable?.table_id],
    queryFn: () => api.bitableFields(token, activeTable.table_id),
    enabled: Boolean(activeTable?.table_id),
    retry: 0,
  });

  const pageToken = pageStack[pageStack.length - 1];
  const recordsQuery = useQuery({
    queryKey: ['bitableRecords', token, activeTable?.table_id, pageToken],
    queryFn: () =>
      api.bitableRecords(token, activeTable.table_id, { pageToken, pageSize: 100 }),
    enabled: Boolean(activeTable?.table_id),
    retry: 0,
  });

  const fields = fieldsQuery.data?.items || [];
  const records = recordsQuery.data?.items || [];
  const primaryField = fields.find((field) => field.is_primary) || fields[0];

  const refreshAll = async () => {
    await Promise.all([fieldsQuery.refetch(), recordsQuery.refetch(), metaQuery.refetch()]);
  };

  const saveRecord = useMutation({
    mutationFn: ({ record, fields: payload }) =>
      record
        ? api.updateRecord(token, activeTable.table_id, record.record_id, payload)
        : api.createRecord(token, activeTable.table_id, payload),
    onSuccess: (_, variables) => {
      toast(variables.record ? '记录已更新' : '记录已新增', 'success');
      setRecordModal(null);
      queryClient.invalidateQueries({ queryKey: ['bitableRecords'] });
    },
    onError: (error) => toast(errorMessage(error), 'error'),
  });

  const removeRecord = useMutation({
    mutationFn: (recordId) =>
      api.deleteRecord(token, activeTable.table_id, recordId),
    onSuccess: () => {
      toast('记录已删除', 'success');
      queryClient.invalidateQueries({ queryKey: ['bitableRecords'] });
    },
    onError: (error) => toast(errorMessage(error), 'error'),
  });

  const handleDelete = (record) => {
    if (window.confirm('删除这条记录？会直接修改飞书原表格。')) {
      removeRecord.mutate(record.record_id);
    }
  };

  if (metaQuery.isLoading) {
    return (
      <div className="page">
        <Loading label="正在读取多维表格" />
      </div>
    );
  }

  if (metaQuery.isError) {
    return (
      <div className="page">
        <header className="page-head">
          <div>
            <h1>多维表格</h1>
            <div className="head-meta">
              <span className="mono">{token}</span>
            </div>
          </div>
        </header>
        <ErrorBanner
          error={metaQuery.error}
          onRetry={() => metaQuery.refetch()}
          title="读取多维表格失败"
        />
      </div>
    );
  }

  const title = metaQuery.data?.app?.name || tables[0]?.name || '多维表格';
  const originalUrl = sourceQuery.data?.source?.url;
  const hasPrev = pageStack.length > 1;

  return (
    <div className="page">
      <header className="page-head">
        <div>
          <h1 className="docx-title">{title}</h1>
          <div className="head-meta">
            <span>{tables.length} 个数据表</span>
            <span className="meta-rule" aria-hidden="true" />
            <span>{fields.length} 个字段</span>
            {recordsQuery.data?.total !== undefined && (
              <>
                <span className="meta-rule" aria-hidden="true" />
                <span>{recordsQuery.data.total} 条记录</span>
              </>
            )}
          </div>
        </div>
        <div className="head-actions">
          {originalUrl && (
            <a className="btn" href={originalUrl} target="_blank" rel="noreferrer">
              <ExternalLink size={15} />
              打开原文
            </a>
          )}
          <button type="button" className="btn" onClick={refreshAll}>
            <RefreshCw size={15} className={recordsQuery.isFetching ? 'spin' : undefined} />
            刷新
          </button>
          <button
            type="button"
            className="btn btn-primary"
            onClick={() => setRecordModal({ record: null, fields })}
            disabled={!activeTable || !fields.length}
          >
            <Plus size={15} />
            新增记录
          </button>
        </div>
      </header>

      {tables.length === 0 ? (
        <div className="catalog empty-catalog">
          <EmptyState
            icon={Grid3x3}
            title="这个多维表格还没有数据表"
            description="先在飞书中创建数据表，再回到这里刷新。"
          />
        </div>
      ) : (
        <div className="bitable-layout">
          <aside className="bitable-tables" aria-label="数据表列表">
            {tables.map((table) => (
              <button
                key={table.table_id}
                type="button"
                className={`bitable-table-item${table.table_id === activeTable?.table_id ? ' active' : ''}`}
                onClick={() => setActiveTableId(table.table_id)}
              >
                <span>{table.name || '未命名数据表'}</span>
              </button>
            ))}
          </aside>

          <section className="bitable-main">
            <div className="bitable-toolbar">
              <span className="cell-coord">{activeTable?.name || '数据表'}</span>
              {recordsQuery.data?.total !== undefined && (
                <span className="sheet-notice">共 {recordsQuery.data.total} 条</span>
              )}
            </div>

            {fieldsQuery.isError && (
              <ErrorBanner
                error={fieldsQuery.error}
                onRetry={() => fieldsQuery.refetch()}
                title="读取字段失败"
              />
            )}
            {recordsQuery.isError && (
              <ErrorBanner
                error={recordsQuery.error}
                onRetry={() => recordsQuery.refetch()}
                title="读取记录失败"
              />
            )}

            {fieldsQuery.isLoading || recordsQuery.isLoading ? (
              <Loading label="正在读取记录" />
            ) : records.length === 0 ? (
              <div className="catalog empty-catalog">
                <EmptyState
                  icon={Grid3x3}
                  title="还没有记录"
                  description="新增第一条记录，内容会直接写入飞书多维表格。"
                  action={
                    <button
                      type="button"
                      className="btn btn-primary"
                      onClick={() => setRecordModal({ record: null, fields })}
                    >
                      <Plus size={15} />
                      新增记录
                    </button>
                  }
                />
              </div>
            ) : (
              <div className="bitable-grid-wrap">
                <table className="bitable-grid">
                  <thead>
                    <tr>
                      {fields.map((field) => (
                        <th key={field.field_id || field.field_name}>
                          {field.field_name}
                        </th>
                      ))}
                      <th className="bitable-actions">操作</th>
                    </tr>
                  </thead>
                  <tbody>
                    {records.map((record) => (
                      <tr key={record.record_id}>
                        {fields.map((field) => {
                          const value = record.fields?.[field.field_name];
                          const isPrimary = primaryField && field.field_id === primaryField.field_id;
                          return (
                            <td key={field.field_id || field.field_name} className={isPrimary ? 'bitable-primary' : undefined}>
                              {formatBitableValue(value, field) || <span className="cell-empty">—</span>}
                            </td>
                          );
                        })}
                        <td className="bitable-actions">
                          <div className="row-actions">
                            <button
                              type="button"
                              className="icon-btn"
                              title="编辑记录"
                              aria-label="编辑记录"
                              onClick={() => setRecordModal({ record, fields })}
                            >
                              <Pencil size={14} />
                            </button>
                            <button
                              type="button"
                              className="icon-btn danger"
                              title="删除记录"
                              aria-label="删除记录"
                              onClick={() => handleDelete(record)}
                            >
                              <Trash2 size={14} />
                            </button>
                          </div>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}

            <div className="pager">
              <button
                type="button"
                className="btn btn-small"
                disabled={!hasPrev}
                onClick={() => setPageStack((previous) => previous.slice(0, -1))}
              >
                <ChevronLeft size={13} />
                上一页
              </button>
              <span>第 {pageStack.length} 页</span>
              <button
                type="button"
                className="btn btn-small"
                disabled={!recordsQuery.data?.hasMore}
                onClick={() =>
                  setPageStack((previous) => [...previous, recordsQuery.data.pageToken])
                }
              >
                下一页
                <ChevronRight size={13} />
              </button>
            </div>
          </section>
        </div>
      )}

      <RecordModal
        open={Boolean(recordModal)}
        fields={recordModal?.fields || []}
        record={recordModal?.record || null}
        submitting={saveRecord.isPending}
        onClose={() => setRecordModal(null)}
        onSubmit={(payload) =>
          saveRecord.mutate({ record: recordModal?.record || null, fields: payload })
        }
      />
    </div>
  );
}

function RecordModal({ open, fields, record, submitting, onClose, onSubmit }) {
  const [values, setValues] = useState({});
  const [touched, setTouched] = useState(() => new Set());

  useEffect(() => {
    if (!open) return;
    const initial = {};
    fields.forEach((field) => {
      initial[field.field_name] = editableValue(field, record?.fields?.[field.field_name]);
    });
    setValues(initial);
    setTouched(new Set());
  }, [open, record, fields]);

  const update = (name, value) => {
    setValues((previous) => ({ ...previous, [name]: value }));
    setTouched((previous) => new Set(previous).add(name));
  };

  const handleSubmit = () => {
    const payload = {};
    for (const field of fields) {
      if (!EDITABLE_TYPES.has(field.type)) continue;
      const value = values[field.field_name];
      const edited = touched.has(field.field_name);
      if (!record && isEmptyValue(value) && field.type !== 7) continue;
      if (record && !edited) continue;
      if (field.type === 7) {
        payload[field.field_name] = Boolean(value);
        continue;
      }
      if (isEmptyValue(value)) continue;
      payload[field.field_name] = encodeValue(field, value);
    }
    if (!Object.keys(payload).length) {
      onClose();
      return;
    }
    onSubmit(payload);
  };

  return (
    <Modal
      open={open}
      onClose={onClose}
      title={record ? '编辑记录' : '新增记录'}
      width={680}
      footer={
        <div className="modal-actions">
          <button type="button" className="btn" onClick={onClose}>
            取消
          </button>
          <button type="button" className="btn btn-primary" onClick={handleSubmit} disabled={submitting}>
            {submitting ? '保存中' : record ? '保存修改' : '新增记录'}
          </button>
        </div>
      }
    >
      <div className="record-form">
        {fields.map((field) => {
          const editable = EDITABLE_TYPES.has(field.type);
          return (
            <div className="field-row" key={field.field_id || field.field_name}>
              <label className="field-label">
                {field.field_name}
                <span className="field-type">{FIELD_TYPE_LABELS[field.type] || field.type}</span>
              </label>
              {editable ? (
                <FieldEditor
                  field={field}
                  value={values[field.field_name]}
                  onChange={(value) => update(field.field_name, value)}
                />
              ) : (
                <div className="field-readonly">
                  {formatBitableValue(record?.fields?.[field.field_name], field) || '该字段由飞书自动维护'}
                </div>
              )}
            </div>
          );
        })}
      </div>
    </Modal>
  );
}

function FieldEditor({ field, value, onChange }) {
  const options = field.property?.options || [];

  if (field.type === 3) {
    return (
      <select
        className="field-select"
        value={value || ''}
        onChange={(event) => onChange(event.target.value)}
      >
        <option value="">未选择</option>
        {options.map((option) => (
          <option key={option.id || option.name} value={option.name}>
            {option.name}
          </option>
        ))}
      </select>
    );
  }

  if (field.type === 4) {
    const selected = Array.isArray(value) ? value : [];
    return (
      <div className="multi-options">
        {options.map((option) => {
          const checked = selected.includes(option.name);
          return (
            <label key={option.id || option.name} className="multi-option">
              <input
                type="checkbox"
                checked={checked}
                onChange={() => {
                  onChange(
                    checked
                      ? selected.filter((name) => name !== option.name)
                      : [...selected, option.name]
                  );
                }}
              />
              {option.name}
            </label>
          );
        })}
      </div>
    );
  }

  if (field.type === 7) {
    return (
      <label className="checkbox-row">
        <input
          type="checkbox"
          checked={Boolean(value)}
          onChange={(event) => onChange(event.target.checked)}
        />
        已勾选
      </label>
    );
  }

  if (field.type === 5) {
    return (
      <input
        type="date"
        className="field-input"
        value={value || ''}
        onChange={(event) => onChange(event.target.value)}
      />
    );
  }

  if (field.type === 2) {
    return (
      <input
        type="number"
        className="field-input"
        value={value ?? ''}
        onChange={(event) => onChange(event.target.value)}
      />
    );
  }

  if (field.type === 15) {
    return (
      <input
        type="url"
        className="field-input"
        value={value || ''}
        placeholder="https://"
        onChange={(event) => onChange(event.target.value)}
      />
    );
  }

  if (field.type === 13) {
    return (
      <input
        type="tel"
        className="field-input"
        value={value || ''}
        onChange={(event) => onChange(event.target.value)}
      />
    );
  }

  if (field.type === 1) {
    return (
      <textarea
        className="field-input"
        value={value || ''}
        onChange={(event) => onChange(event.target.value)}
      />
    );
  }

  return (
    <input
      className="field-input"
      value={value || ''}
      onChange={(event) => onChange(event.target.value)}
    />
  );
}
