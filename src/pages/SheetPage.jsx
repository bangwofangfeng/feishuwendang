import { useEffect, useMemo, useRef, useState } from 'react';
import { useParams } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import {
  Columns3,
  ExternalLink,
  Plus,
  RefreshCw,
  Rows3,
  Save,
  Trash2,
} from 'lucide-react';
import { api } from '../api.js';
import ErrorBanner from '../components/ErrorBanner.jsx';
import Loading from '../components/Loading.jsx';
import { useToast } from '../components/Toast.jsx';
import { columnName } from '../utils.js';

const INITIAL_ROWS = 120;
const INITIAL_COLS = 24;

function normalizeGrid(values, rows, columns) {
  const source = Array.isArray(values) ? values : [];
  const height = Math.max(rows, source.length, 1);
  const width = Math.max(
    columns,
    ...source.map((row) => (Array.isArray(row) ? row.length : 0)),
    1
  );
  return Array.from({ length: height }, (_, rowIndex) => {
    const row = Array.isArray(source[rowIndex]) ? source[rowIndex] : [];
    return Array.from({ length: width }, (_, columnIndex) =>
      row[columnIndex] === null || row[columnIndex] === undefined
        ? ''
        : String(row[columnIndex])
    );
  });
}

export default function SheetPage() {
  const { token } = useParams();
  const toast = useToast();
  const [activeSheetId, setActiveSheetId] = useState('');
  const [rows, setRows] = useState(INITIAL_ROWS);
  const [columns] = useState(INITIAL_COLS);
  const [grid, setGrid] = useState([]);
  const [dirty, setDirty] = useState(() => new Map());
  const [selected, setSelected] = useState({ row: 0, col: 0 });
  const [editingCell, setEditingCell] = useState(null);
  const [editValue, setEditValue] = useState('');
  const gridRef = useRef(null);

  const metaQuery = useQuery({
    queryKey: ['sheetMeta', token],
    queryFn: () => api.sheetMeta(token),
    retry: 0,
  });
  const sourceQuery = useQuery({
    queryKey: ['sourceByToken', 'sheet', token],
    queryFn: () => api.sourceLookup('sheet', token),
    retry: false,
  });

  const sheets = metaQuery.data?.sheets || [];
  const activeSheet = sheets.find((sheet) => sheet.sheet_id === activeSheetId) || sheets[0];

  useEffect(() => {
    if (!activeSheetId && sheets.length) setActiveSheetId(sheets[0].sheet_id);
  }, [sheets, activeSheetId]);

  const range = activeSheet
    ? `${activeSheet.sheet_id}!A1:${columnName(columns - 1)}${rows}`
    : '';

  const valuesQuery = useQuery({
    queryKey: ['sheetValues', token, activeSheet?.sheet_id, rows, columns],
    queryFn: () => api.sheetValues(token, range),
    enabled: Boolean(activeSheet?.sheet_id),
    retry: 0,
  });

  useEffect(() => {
    if (!valuesQuery.data) return;
    const values = valuesQuery.data.valueRange?.values || [];
    setGrid(normalizeGrid(values, INITIAL_ROWS, INITIAL_COLS));
    setDirty(new Map());
    setSelected({ row: 0, col: 0 });
    setEditingCell(null);
  }, [valuesQuery.data]);

  const sheetRowCount =
    activeSheet?.grid_properties?.row_count ?? activeSheet?.row_count ?? grid.length;
  const usedRows = useMemo(() => {
    let last = 0;
    grid.forEach((row, rowIndex) => {
      if (row.some((cell) => cell !== '')) last = rowIndex + 1;
    });
    return last;
  }, [grid]);
  const usedColumns = useMemo(() => {
    let last = 0;
    grid.forEach((row) => {
      row.forEach((cell, columnIndex) => {
        if (cell !== '') last = Math.max(last, columnIndex + 1);
      });
    });
    return last;
  }, [grid]);

  const displayRows = Math.max(30, Math.min(grid.length, usedRows + 6));
  const displayColumns = Math.max(12, Math.min(columns, usedColumns + 3));

  const cellValue = (row, column) => (grid[row] && grid[row][column] != null ? grid[row][column] : '');

  const setCellValue = (row, column, value) => {
    setGrid((previous) => {
      const next = previous.map((line) => [...line]);
      while (next.length <= row) next.push([]);
      while (next[row].length <= column) next[row].push('');
      next[row][column] = value;
      return next;
    });
    setDirty((previous) => {
      const next = new Map(previous);
      next.set(`${row}:${column}`, true);
      return next;
    });
  };

  const startEdit = (row, column, initial) => {
    setSelected({ row, col: column });
    setEditingCell({ row, col: column });
    setEditValue(initial !== undefined ? initial : cellValue(row, column));
  };

  const commitEdit = (moveRow = 0, moveColumn = 0) => {
    if (!editingCell) return;
    setCellValue(editingCell.row, editingCell.col, editValue);
    const nextRow = Math.min(editingCell.row + moveRow, displayRows - 1);
    const nextColumn = Math.min(editingCell.col + moveColumn, displayColumns - 1);
    setSelected({ row: Math.max(0, nextRow), col: Math.max(0, nextColumn) });
    setEditingCell(null);
    setEditValue('');
    requestAnimationFrame(() => gridRef.current?.focus());
  };

  const saveChanges = async () => {
    if (!dirty.size || !activeSheet) return;
    const valueRanges = [];
    for (const key of dirty.keys()) {
      const [row, column] = key.split(':').map(Number);
      if (row >= grid.length || column >= (grid[row]?.length || 0)) continue;
      valueRanges.push({
        range: `${activeSheet.sheet_id}!${columnName(column)}${row + 1}:${columnName(column)}${row + 1}`,
        values: [[cellValue(row, column)]],
      });
    }
    if (!valueRanges.length) return;
    try {
      for (let index = 0; index < valueRanges.length; index += 100) {
        await api.batchWriteSheetValues(token, valueRanges.slice(index, index + 100));
      }
      setDirty(new Map());
      toast(`已保存 ${valueRanges.length} 个单元格`, 'success');
      await Promise.all([valuesQuery.refetch(), metaQuery.refetch()]);
    } catch (error) {
      toast(`保存失败：${error.message}`, 'error');
    }
  };

  const switchSheet = (sheetId) => {
    if (sheetId === activeSheet?.sheet_id) return;
    if (dirty.size && !window.confirm('当前工作表有未保存的修改，切换后这些修改会丢失。继续？')) {
      return;
    }
    setActiveSheetId(sheetId);
    setDirty(new Map());
    setEditingCell(null);
    setSelected({ row: 0, col: 0 });
  };

  const runDimensionOp = async (action, majorDimension) => {
    if (!activeSheet) return;
    const startIndex = majorDimension === 'ROWS' ? selected.row : selected.col;
    const endIndex = startIndex + 1;
    const label = majorDimension === 'ROWS' ? '行' : '列';
    if (action === 'delete' && !window.confirm(`删除当前${label}？会直接修改飞书原表格。`)) {
      return;
    }
    try {
      const dimension = { sheetId: activeSheet.sheet_id, majorDimension, startIndex, endIndex };
      if (action === 'insert') await api.insertSheetDimension(token, dimension);
      else await api.deleteSheetDimension(token, dimension);
      toast(`已${action === 'insert' ? '插入' : '删除'}${label}`, 'success');
      await Promise.all([valuesQuery.refetch(), metaQuery.refetch()]);
    } catch (error) {
      toast(`操作失败：${error.message}`, 'error');
    }
  };

  const appendRow = async () => {
    if (!activeSheet) return;
    try {
      await api.insertSheetDimension(token, {
        sheetId: activeSheet.sheet_id,
        majorDimension: 'ROWS',
        startIndex: sheetRowCount,
        endIndex: sheetRowCount + 1,
      });
      toast('已在末尾追加一行', 'success');
      await Promise.all([valuesQuery.refetch(), metaQuery.refetch()]);
    } catch (error) {
      toast(`追加失败：${error.message}`, 'error');
    }
  };

  const handleGridKeyDown = (event) => {
    if (editingCell) return;
    const { row, col } = selected;
    if (event.key === 'ArrowDown') {
      event.preventDefault();
      setSelected({ row: Math.min(row + 1, displayRows - 1), col });
    } else if (event.key === 'ArrowUp') {
      event.preventDefault();
      setSelected({ row: Math.max(row - 1, 0), col });
    } else if (event.key === 'ArrowRight' || event.key === 'Tab') {
      event.preventDefault();
      setSelected({ row, col: Math.min(col + 1, displayColumns - 1) });
    } else if (event.key === 'ArrowLeft') {
      event.preventDefault();
      setSelected({ row, col: Math.max(col - 1, 0) });
    } else if (event.key === 'Enter' || event.key === 'F2') {
      event.preventDefault();
      startEdit(row, col);
    } else if (event.key === 'Delete' || event.key === 'Backspace') {
      event.preventDefault();
      setCellValue(row, col, '');
    } else if (event.key.length === 1 && !event.metaKey && !event.ctrlKey && !event.altKey) {
      event.preventDefault();
      startEdit(row, col, event.key);
    }
  };

  const handlePaste = (event) => {
    if (editingCell) return;
    const text = event.clipboardData?.getData('text/plain');
    if (!text) return;
    event.preventDefault();
    const pastedRows = text.replace(/\r/g, '').split('\n').map((line) => line.split('\t'));
    const startRow = selected.row;
    const startColumn = selected.col;
    setGrid((previous) => {
      const next = previous.map((line) => [...line]);
      pastedRows.forEach((line, rowOffset) => {
        const rowIndex = startRow + rowOffset;
        while (next.length <= rowIndex) next.push([]);
        line.forEach((value, columnOffset) => {
          const columnIndex = startColumn + columnOffset;
          while (next[rowIndex].length <= columnIndex) next[rowIndex].push('');
          next[rowIndex][columnIndex] = value;
        });
      });
      return next;
    });
    setDirty((previous) => {
      const next = new Map(previous);
      pastedRows.forEach((line, rowOffset) => {
        line.forEach((_, columnOffset) => {
          next.set(`${startRow + rowOffset}:${startColumn + columnOffset}`, true);
        });
      });
      return next;
    });
    toast('已粘贴，保存后写入飞书', 'info');
  };

  if (metaQuery.isLoading) {
    return (
      <div className="page sheet-page">
        <Loading label="正在读取电子表格" />
      </div>
    );
  }

  if (metaQuery.isError) {
    return (
      <div className="page sheet-page">
        <header className="page-head">
          <div>
            <h1>电子表格</h1>
            <div className="head-meta">
              <span className="mono">{token}</span>
            </div>
          </div>
        </header>
        <ErrorBanner
          error={metaQuery.error}
          onRetry={() => metaQuery.refetch()}
          title="读取表格失败"
        />
      </div>
    );
  }

  const title = metaQuery.data?.spreadsheet?.title || '电子表格';
  const originalUrl = sourceQuery.data?.source?.url;

  return (
    <div className="page sheet-page">
      <header className="page-head">
        <div>
          <h1 className="docx-title">{title}</h1>
          <div className="head-meta">
            <span>
              {sheets.length} 个工作表
            </span>
            <span className="meta-rule" aria-hidden="true" />
            <span>
              {sheetRowCount} 行 × {activeSheet?.grid_properties?.column_count ?? activeSheet?.column_count ?? '—'} 列
            </span>
            {dirty.size > 0 && (
              <>
                <span className="meta-rule" aria-hidden="true" />
                <span>{dirty.size} 个单元格未保存</span>
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
          <button
            type="button"
            className="btn"
            onClick={() => {
              if (dirty.size && !window.confirm('刷新会丢弃未保存的修改，继续？')) return;
              valuesQuery.refetch();
              metaQuery.refetch();
            }}
            disabled={valuesQuery.isFetching}
          >
            <RefreshCw size={15} className={valuesQuery.isFetching ? 'spin' : undefined} />
            刷新
          </button>
          <button
            type="button"
            className="btn btn-primary"
            onClick={saveChanges}
            disabled={!dirty.size}
          >
            <Save size={15} />
            保存{dirty.size ? ` (${dirty.size})` : ''}
          </button>
        </div>
      </header>

      <div className="sheet-tabs" role="tablist" aria-label="工作表">
        {sheets.map((sheet) => (
          <button
            key={sheet.sheet_id}
            type="button"
            role="tab"
            className={`sheet-tab${sheet.sheet_id === activeSheet?.sheet_id ? ' active' : ''}`}
            onClick={() => switchSheet(sheet.sheet_id)}
          >
            {sheet.title || sheet.sheet_id}
          </button>
        ))}
      </div>

      <div className="sheet-toolbar">
        <span className="cell-coord">
          {columnName(selected.col)}
          {selected.row + 1}
        </span>
        <button type="button" className="btn btn-small" onClick={() => runDimensionOp('insert', 'ROWS')}>
          <Rows3 size={13} />
          插入行
        </button>
        <button type="button" className="btn btn-small" onClick={() => runDimensionOp('delete', 'ROWS')}>
          <Trash2 size={13} />
          删除行
        </button>
        <button type="button" className="btn btn-small" onClick={() => runDimensionOp('insert', 'COLUMNS')}>
          <Columns3 size={13} />
          插入列
        </button>
        <button type="button" className="btn btn-small" onClick={() => runDimensionOp('delete', 'COLUMNS')}>
          <Trash2 size={13} />
          删除列
        </button>
        <button type="button" className="btn btn-small" onClick={appendRow}>
          <Plus size={13} />
          追加一行
        </button>
        {rows < 500 && (
          <button type="button" className="btn btn-small" onClick={() => setRows((value) => Math.min(value + 120, 500))}>
            加载更多行
          </button>
        )}
        <span className="sheet-notice">点击单元格选中，双击或按 Enter 编辑；支持从剪贴板粘贴多行多列。</span>
      </div>

      {valuesQuery.isError && (
        <ErrorBanner
          error={valuesQuery.error}
          onRetry={() => valuesQuery.refetch()}
          title="读取单元格失败"
        />
      )}

      {valuesQuery.isLoading ? (
        <Loading label="正在读取单元格" />
      ) : (
        <div
          className="sheet-grid-wrap"
          ref={gridRef}
          tabIndex={0}
          onKeyDown={handleGridKeyDown}
          onPaste={handlePaste}
        >
          <table className="sheet-grid">
            <thead>
              <tr>
                <th className="sheet-corner" aria-label="行列表头" />
                {Array.from({ length: displayColumns }).map((_, columnIndex) => (
                  <th key={columnIndex} className="sheet-colhead">
                    {columnName(columnIndex)}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {Array.from({ length: displayRows }).map((_, rowIndex) => (
                <tr key={rowIndex}>
                  <th className="sheet-rowhead">{rowIndex + 1}</th>
                  {Array.from({ length: displayColumns }).map((_, columnIndex) => {
                    const isEditing =
                      editingCell?.row === rowIndex && editingCell?.col === columnIndex;
                    const isSelected =
                      selected.row === rowIndex && selected.col === columnIndex;
                    const isDirty = dirty.has(`${rowIndex}:${columnIndex}`);
                    return (
                      <td
                        key={columnIndex}
                        className={`sheet-cell${isSelected ? ' selected' : ''}${isDirty ? ' dirty' : ''}`}
                        onClick={() => {
                          setSelected({ row: rowIndex, col: columnIndex });
                          gridRef.current?.focus();
                        }}
                        onDoubleClick={() => startEdit(rowIndex, columnIndex)}
                      >
                        {isEditing ? (
                          <input
                            autoFocus
                            className="cell-input"
                            value={editValue}
                            onChange={(event) => setEditValue(event.target.value)}
                            onBlur={() => commitEdit()}
                            onKeyDown={(event) => {
                              if (event.key === 'Enter') {
                                event.preventDefault();
                                commitEdit(1, 0);
                              } else if (event.key === 'Tab') {
                                event.preventDefault();
                                commitEdit(0, 1);
                              } else if (event.key === 'Escape') {
                                event.preventDefault();
                                setEditingCell(null);
                                setEditValue('');
                                gridRef.current?.focus();
                              }
                            }}
                          />
                        ) : (
                          <span className="cell-display">{cellValue(rowIndex, columnIndex)}</span>
                        )}
                      </td>
                    );
                  })}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      <div className="sheet-notice">
        当前加载 {displayRows} 行 × {displayColumns} 列。修改会标为浅黄色，点「保存」才写回飞书。
      </div>
    </div>
  );
}
