import { adminSupabase } from '@/lib/booking'
import { toAdminTableRows } from '@/lib/admin/table-rows'
import { requireAdminPageSession } from '@/lib/auth/guard-server'
import AdminExport from '@/components/admin-export'
import AdminDataTable from '@/components/admin-data-table'

export default async function ResourcePage({ title, kicker, description, table, columns }: { title: string; kicker: string; description: string; table: string; columns: string[] }) {
  await requireAdminPageSession()
  const supabase = adminSupabase()
  const { data, error } = await supabase.from(table).select(columns.join(',')).limit(50)
  const rows = toAdminTableRows(data)
  return (
    <main className="admin-content">
      <div className="admin-heading">
        <div>
          <p className="admin-kicker">{kicker}</p>
          <h1>{title}</h1>
          <p className="admin-muted">{description}</p>
        </div>
        <AdminExport filename={`${table}.csv`} columns={columns} rows={rows} />
      </div>
      <section className="admin-panel">
        {error ? <div className="admin-empty">Unable to load live records. Check the table policy and retry.</div> : rows.length ? <AdminDataTable columns={columns} rows={rows} /> : <div className="admin-empty">No records found.</div>}
      </section>
    </main>
  )
}
