import { adminSupabase } from '@/lib/booking'

export default async function Page() {
  const { data, error } = await adminSupabase().from('event_audit_logs').select('id, enquiry_id, action, details, created_at').order('created_at', { ascending: false }).limit(200)
  return <main className="admin-content"><div className="admin-heading"><div><p className="admin-kicker">Security and compliance</p><h1>Audit logs</h1><p className="admin-muted">Immutable event workflow activity from the live audit trail.</p></div></div>{error ? <div className="admin-alert">Unable to load audit logs.</div> : <section className="admin-panel"><div className="admin-table-wrap"><table><thead><tr><th>Action</th><th>Enquiry</th><th>Details</th><th>Created</th></tr></thead><tbody>{data?.map(item => <tr key={item.id}><td><span className="admin-status confirmed">{item.action}</span></td><td>{item.enquiry_id}</td><td><code>{JSON.stringify(item.details)}</code></td><td>{new Date(item.created_at).toLocaleString('en-IN')}</td></tr>)}</tbody></table></div>{!data?.length && <div className="admin-empty">No audit entries have been recorded.</div>}</section>}</main>
}
