import { NextResponse } from 'next/server'
import { z } from 'zod'
import { requireAdminApi } from '@/lib/auth/admin-api'
import { adminSupabase } from '@/lib/booking'

const enquirySchema = z.object({
  eventDate: z.string().date(),
  guestCount: z.number().int().min(1).max(1000),
  contactName: z.string().trim().min(2).max(120),
  contactEmail: z.string().email().max(254),
  contactPhone: z.string().trim().min(7).max(30),
  requirements: z.string().trim().max(5000).default(''),
})
const updateSchema = z.object({
  id: z.string().uuid(),
  status: z.enum(['new', 'reviewing', 'quoted', 'accepted', 'held', 'confirmed', 'cancelled', 'expired', 'refunded']).optional(),
  internalNotes: z.string().trim().max(5000).optional(),
})

export async function GET() {
  const admin = await requireAdminApi()
  if (!admin.ok) return NextResponse.json({ error: admin.error }, { status: admin.status })
  const { data, error } = await admin.ctx.db.from('event_enquiries').select('id,reference,event_date,guest_count,contact_name,contact_email,contact_phone,requirements,status,internal_notes,created_at,updated_at,event_quotes(id,version,subtotal_inr,deposit_inr,currency,status,terms,created_at,accepted_at),event_audit_logs(id,action,details,created_at)').order('created_at', { ascending: false }).limit(100)
  if (error) return NextResponse.json({ error: 'Unable to load event enquiries' }, { status: 500 })
  return NextResponse.json({ enquiries: data ?? [] })
}

export async function POST(request: Request) {
  try {
    const input = enquirySchema.parse(await request.json())
    const db = adminSupabase()
    const reference = `VF-EVT-${new Date().toISOString().slice(0, 10).replaceAll('-', '')}-${crypto.randomUUID().slice(0, 6).toUpperCase()}`
    const { data, error } = await db.from('event_enquiries').insert({ reference, event_date: input.eventDate, guest_count: input.guestCount, contact_name: input.contactName, contact_email: input.contactEmail, contact_phone: input.contactPhone, requirements: input.requirements }).select('id,reference,status,created_at').single()
    if (error) return NextResponse.json({ error: 'Unable to save event enquiry' }, { status: 500 })
    await db.from('event_audit_logs').insert({ enquiry_id: data.id, action: 'enquiry_created', details: { source: 'public' } })
    return NextResponse.json({ enquiry: data }, { status: 201 })
  } catch { return NextResponse.json({ error: 'Invalid event enquiry' }, { status: 400 }) }
}

export async function PATCH(request: Request) {
  const admin = await requireAdminApi()
  if (!admin.ok) return NextResponse.json({ error: admin.error }, { status: admin.status })
  try {
    const input = updateSchema.parse(await request.json())
    const changes = { ...(input.status ? { status: input.status } : {}), ...(input.internalNotes !== undefined ? { internal_notes: input.internalNotes } : {}) }
    const { data, error } = await admin.ctx.db.from('event_enquiries').update(changes).eq('id', input.id).select('id,reference,status,internal_notes,updated_at').single()
    if (error) return NextResponse.json({ error: 'Unable to update event enquiry' }, { status: 500 })
    await admin.ctx.db.from('event_audit_logs').insert({ enquiry_id: input.id, action: 'enquiry_updated', details: { changes, actor: admin.ctx.user.id } })
    return NextResponse.json({ enquiry: data })
  } catch { return NextResponse.json({ error: 'Invalid event update' }, { status: 400 }) }
}

export async function PUT(request: Request) {
  const admin = await requireAdminApi()
  if (!admin.ok) return NextResponse.json({ error: admin.error }, { status: admin.status })
  try {
    const input = z.object({ enquiryId: z.string().uuid(), subtotalInr: z.number().min(0), depositInr: z.number().min(0), terms: z.string().trim().max(5000).default('') }).parse(await request.json())
    const { data: latest } = await admin.ctx.db.from('event_quotes').select('version').eq('enquiry_id', input.enquiryId).order('version', { ascending: false }).limit(1).maybeSingle()
    const version = (latest?.version ?? 0) + 1
    const { data, error } = await admin.ctx.db.from('event_quotes').insert({ enquiry_id: input.enquiryId, version, subtotal_inr: input.subtotalInr, deposit_inr: input.depositInr, terms: input.terms }).select('*').single()
    if (error) return NextResponse.json({ error: 'Unable to create quote' }, { status: 500 })
    await admin.ctx.db.from('event_enquiries').update({ status: 'quoted' }).eq('id', input.enquiryId)
    await admin.ctx.db.from('event_audit_logs').insert({ enquiry_id: input.enquiryId, action: 'quote_created', details: { version, actor: admin.ctx.user.id } })
    return NextResponse.json({ quote: data }, { status: 201 })
  } catch { return NextResponse.json({ error: 'Invalid quote' }, { status: 400 }) }
}
