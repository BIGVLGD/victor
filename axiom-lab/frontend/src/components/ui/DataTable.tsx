import { useState, useMemo } from 'react';
import { Search, ChevronUp, ChevronDown, Download } from 'lucide-react';

// eslint-disable-next-line @typescript-eslint/no-explicit-any
export interface Column<T = any> {
  key: string;
  label: string;
  render?: (row: T) => React.ReactNode;
  sortable?: boolean;
  className?: string;
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
interface DataTableProps<T = any> {
  data: T[];
  columns: Column<T>[];
  searchKeys?: string[];
  onRowClick?: (row: T) => void;
  actions?: (row: T) => React.ReactNode;
  exportFilename?: string;
  emptyMessage?: string;
  loading?: boolean;
  pageSize?: number;
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
export default function DataTable<T = any>({
  data, columns, searchKeys = [], onRowClick, actions, exportFilename, emptyMessage = 'No data found', loading, pageSize = 25,
}: DataTableProps<T>) {
  const [search, setSearch] = useState('');
  const [sortKey, setSortKey] = useState('');
  const [sortDir, setSortDir] = useState<'asc' | 'desc'>('asc');
  const [page, setPage] = useState(1);

  const filtered = useMemo(() => {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    let rows: any[] = [...data];
    if (search && searchKeys.length > 0) {
      const q = search.toLowerCase();
      rows = rows.filter(row => searchKeys.some(k => String(row[k] ?? '').toLowerCase().includes(q)));
    }
    if (sortKey) {
      rows.sort((a, b) => {
        const av = a[sortKey] ?? '';
        const bv = b[sortKey] ?? '';
        const cmp = String(av).localeCompare(String(bv), undefined, { numeric: true });
        return sortDir === 'asc' ? cmp : -cmp;
      });
    }
    return rows as T[];
  }, [data, search, sortKey, sortDir, searchKeys]);

  const pages = Math.ceil(filtered.length / pageSize);
  const paginated = filtered.slice((page - 1) * pageSize, page * pageSize);

  const handleSort = (key: string) => {
    if (sortKey === key) setSortDir(d => d === 'asc' ? 'desc' : 'asc');
    else { setSortKey(key); setSortDir('asc'); }
    setPage(1);
  };

  const exportCSV = () => {
    const headers = columns.map(c => c.label).join(',');
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const rows = filtered.map(row => columns.map(c => {
      const val = (row as any)[c.key];
      const str = String(val ?? '').replace(/,/g, ';').replace(/\n/g, ' ');
      return str;
    }).join(',')).join('\n');
    const blob = new Blob([headers + '\n' + rows], { type: 'text/csv' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url; a.download = (exportFilename || 'export') + '.csv';
    a.click(); URL.revokeObjectURL(url);
  };

  if (loading) {
    return (
      <div className="card">
        {[...Array(5)].map((_, i) => (
          <div key={i} className="flex gap-4 py-3 border-b border-border animate-pulse">
            <div className="h-4 bg-border rounded flex-1" />
            <div className="h-4 bg-border rounded w-24" />
            <div className="h-4 bg-border rounded w-16" />
          </div>
        ))}
      </div>
    );
  }

  return (
    <div className="card p-0 overflow-hidden">
      {/* Toolbar */}
      <div className="flex items-center gap-3 p-4 border-b border-border">
        <div className="relative flex-1 max-w-xs">
          <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-txt-muted" />
          <input
            value={search}
            onChange={e => { setSearch(e.target.value); setPage(1); }}
            placeholder="Search..."
            className="input pl-8 py-1.5 text-xs"
          />
        </div>
        <span className="text-xs text-txt-muted ml-auto">{filtered.length} records</span>
        {exportFilename && (
          <button onClick={exportCSV} className="flex items-center gap-1.5 text-xs text-txt-secondary hover:text-cyan transition-colors">
            <Download size={13} /> CSV
          </button>
        )}
      </div>

      {/* Table */}
      <div className="overflow-x-auto">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b border-border">
              {columns.map(col => (
                <th
                  key={col.key}
                  onClick={() => col.sortable !== false && handleSort(col.key)}
                  className={`px-4 py-3 text-left text-xs font-medium text-txt-secondary uppercase tracking-wider select-none ${col.sortable !== false ? 'cursor-pointer hover:text-cyan' : ''} ${col.className || ''}`}
                >
                  <span className="flex items-center gap-1">
                    {col.label}
                    {col.sortable !== false && sortKey === col.key && (
                      sortDir === 'asc' ? <ChevronUp size={11} /> : <ChevronDown size={11} />
                    )}
                  </span>
                </th>
              ))}
              {actions && <th className="px-4 py-3 w-16" />}
            </tr>
          </thead>
          <tbody>
            {paginated.length === 0 ? (
              <tr>
                <td colSpan={columns.length + (actions ? 1 : 0)} className="text-center py-16 text-txt-muted text-sm">
                  {emptyMessage}
                </td>
              </tr>
            ) : paginated.map((row, i) => (
              <tr
                key={i}
                onClick={() => onRowClick?.(row)}
                className={`table-row ${onRowClick ? 'cursor-pointer' : ''}`}
              >
                {columns.map(col => (
                  <td key={col.key} className={`px-4 py-3 text-txt-primary ${col.className || ''}`}>
                    {/* eslint-disable-next-line @typescript-eslint/no-explicit-any */}
                    {col.render ? col.render(row) : String((row as any)[col.key] ?? '—')}
                  </td>
                ))}
                {actions && (
                  <td className="px-4 py-3" onClick={e => e.stopPropagation()}>
                    {actions(row)}
                  </td>
                )}
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {/* Pagination */}
      {pages > 1 && (
        <div className="flex items-center justify-between px-4 py-3 border-t border-border">
          <span className="text-xs text-txt-muted">
            {(page - 1) * pageSize + 1}–{Math.min(page * pageSize, filtered.length)} of {filtered.length}
          </span>
          <div className="flex gap-1">
            <button disabled={page === 1} onClick={() => setPage(p => p - 1)} className="px-2 py-1 text-xs rounded border border-border disabled:opacity-30 hover:border-cyan hover:text-cyan transition-colors">Prev</button>
            <button disabled={page === pages} onClick={() => setPage(p => p + 1)} className="px-2 py-1 text-xs rounded border border-border disabled:opacity-30 hover:border-cyan hover:text-cyan transition-colors">Next</button>
          </div>
        </div>
      )}
    </div>
  );
}
