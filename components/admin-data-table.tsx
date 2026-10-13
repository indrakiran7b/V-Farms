'use client'

import { useMemo, useState } from 'react'

export default function AdminDataTable({ columns, rows }: { columns: string[]; rows: Record<string, unknown>[] }) {
  const [query, setQuery] = useState('')
  const filtered = useMemo(() => {
    const normalized = query.trim().toLowerCase()
    if (!normalized) return rows
    return rows.filter((row) => columns.some((column) => String(row[column] ?? '').toLowerCase().includes(normalized)))
  }, [columns, query, rows])
  return <div className="admin-table-block"><label className="admin-search"><span className="sr-only">Search records</span><input value={query} onChange={(event) => setQuery(event.target.value)} placeholder="Search records" type="search" /></label>{filtered.length ? <div className="admin-table-wrap"><table><thead><tr>{columns.map(column => <th key={column}>{column.replaceAll('_', ' ')}</th>)}</tr></thead><tbody>{filtered.map((row, index) => <tr key={String(row.id ?? index)}>{columns.map(column => <td key={column}>{String(row[column] ?? '—')}</td>)}</tr>)}</tbody></table></div> : <div className="admin-empty">No matching records.</div>}<small className="admin-table-count">Showing {filtered.length} of {rows.length} records</small></div>
}
