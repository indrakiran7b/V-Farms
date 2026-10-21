import { adminSupabase } from '@/lib/booking'
import { requireAdminPageSession } from '@/lib/auth/guard-server'

export default async function Page() {
  await requireAdminPageSession()
  const { data, error } = await adminSupabase().from('gallery_items').select('id, storage_path, public_url, caption, alt_text, category, display_order, published, created_at').order('display_order').order('created_at', { ascending: false })
  return <main className="admin-content"><div className="admin-heading"><div><p className="admin-kicker">Content management</p><h1>Gallery</h1><p className="admin-muted">Review gallery assets and publication state from the live Supabase catalog.</p></div></div>{error ? <div className="admin-alert">Unable to load gallery items.</div> : <section className="admin-panel"><div className="admin-table-wrap"><table><thead><tr>{['storage_path','caption','alt_text','category','display_order','published','created_at'].map(column => <th key={column}>{column.replaceAll('_', ' ')}</th>)}</tr></thead><tbody>{data?.map(item => <tr key={item.id}><td>{item.storage_path}</td><td>{item.caption || '—'}</td><td>{item.alt_text}</td><td>{item.category}</td><td>{item.display_order}</td><td><span className={`admin-status ${item.published ? 'published' : 'draft'}`}>{item.published ? 'published' : 'draft'}</span></td><td>{new Date(item.created_at).toLocaleDateString('en-IN')}</td></tr>)}</tbody></table></div>{!data?.length && <div className="admin-empty">No gallery items have been added.</div>}</section>}</main>
}
