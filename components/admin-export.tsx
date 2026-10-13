'use client'

import { Download } from 'lucide-react'

type ExportValue = string | number | boolean | null | undefined

export default function AdminExport({ filename, columns, rows }: { filename: string; columns: string[]; rows: Record<string, ExportValue>[] }) {
  const download = () => {
    const escape = (value: ExportValue) => `"${String(value ?? '').replaceAll('"', '""')}"`
    const csv = [columns.join(','), ...rows.map(row => columns.map(column => escape(row[column])).join(','))].join('\n')
    const url = URL.createObjectURL(new Blob([csv], { type: 'text/csv;charset=utf-8' }))
    const anchor = document.createElement('a')
    anchor.href = url
    anchor.download = filename
    anchor.click()
    URL.revokeObjectURL(url)
  }

  return <button className="admin-secondary" type="button" onClick={download} disabled={!rows.length}><Download aria-hidden="true" /> Export CSV</button>
}
