import { NextResponse } from 'next/server'
import { z } from 'zod'
import { createClient } from '@/lib/supabase/server'
import { adminSupabase } from '@/lib/booking'

const ruleSchema = z.object({
  name: z.string().trim().min(2).max(120),
  nightlyInr: z.number().finite().positive().max(100000000),
  startDate: z.string().date().nullable().optional(),
  endDate: z.string().date().nullable().optional(),
  minimumNights: z.number().int().min(1).max(365),
  active: z.boolean(),
}).refine(value => !value.startDate || !value.endDate || value.endDate >= value.startDate, { message: 'End date must be on or after start date' })

async function ownerOnly() {
  const auth = await createClient()
  const { data: { user } } = await auth.auth.getUser()
  return user && (user.app_metadata?.admin_role ?? user.app_metadata?.role) === 'owner'
}

function overlaps(a: { start_date: string | null; end_date: string | null }, b: { startDate?: string | null; endDate?: string | null }) {
  const aStart = a.start_date ?? '0000-01-01', aEnd = a.end_date ?? '9999-12-31'
  const bStart = b.startDate ?? '0000-01-01', bEnd = b.endDate ?? '9999-12-31'
  return aStart <= bEnd && bStart <= aEnd
}

export async function POST(request: Request) {
  if (!(await ownerOnly())) return NextResponse.json({ error: 'Owner access required' }, { status: 403 })
  try {
    const input = ruleSchema.parse(await request.json())
    const db = adminSupabase()
    const { data: existing } = await db.from('pricing_rules').select('id,start_date,end_date,active').eq('active', true)
    if (input.active && existing?.some(rule => overlaps(rule, input))) return NextResponse.json({ error: 'This date range overlaps an active pricing rule. Deactivate or narrow the existing rule first.' }, { status: 409 })
    const { data, error } = await db.from('pricing_rules').insert({ name: input.name, nightly_inr: input.nightlyInr, start_date: input.startDate ?? null, end_date: input.endDate ?? null, minimum_nights: input.minimumNights, active: input.active }).select().single()
    if (error) throw error
    return NextResponse.json({ rule: data }, { status: 201 })
  } catch (error) { return NextResponse.json({ error: error instanceof z.ZodError ? error.issues[0]?.message : error instanceof Error ? error.message : 'Unable to create pricing rule' }, { status: 400 }) }
}

export async function PATCH(request: Request) {
  if (!(await ownerOnly())) return NextResponse.json({ error: 'Owner access required' }, { status: 403 })
  try {
    const body = await request.json()
    const id = z.string().uuid().parse(body.id)
    const input = ruleSchema.parse(body)
    const db = adminSupabase()
    const { data: existing } = await db.from('pricing_rules').select('id,start_date,end_date,active').eq('active', true).neq('id', id)
    if (input.active && existing?.some(rule => overlaps(rule, input))) return NextResponse.json({ error: 'This date range overlaps an active pricing rule.' }, { status: 409 })
    const { data, error } = await db.from('pricing_rules').update({ name: input.name, nightly_inr: input.nightlyInr, start_date: input.startDate ?? null, end_date: input.endDate ?? null, minimum_nights: input.minimumNights, active: input.active }).eq('id', id).select().single()
    if (error) throw error
    return NextResponse.json({ rule: data })
  } catch (error) { return NextResponse.json({ error: error instanceof z.ZodError ? error.issues[0]?.message : error instanceof Error ? error.message : 'Unable to update pricing rule' }, { status: 400 }) }
}

export async function DELETE(request: Request) {
  if (!(await ownerOnly())) return NextResponse.json({ error: 'Owner access required' }, { status: 403 })
  const id = new URL(request.url).searchParams.get('id')
  const parsed = z.string().uuid().safeParse(id)
  if (!parsed.success) return NextResponse.json({ error: 'A valid pricing rule is required' }, { status: 400 })
  const { error } = await adminSupabase().from('pricing_rules').delete().eq('id', parsed.data)
  if (error) return NextResponse.json({ error: error.message }, { status: 400 })
  return NextResponse.json({ ok: true })
}
