import crypto from 'node:crypto'
import type { SupabaseClient } from '@supabase/supabase-js'

type Row = Record<string, unknown>

export type MemoryStore = {
  tables: Record<string, Row[]>
  unique: { payment_webhook_events: Set<string> }
}

export function createMemoryStore(): MemoryStore {
  const rateBuckets = new Map<string, { windowStart: number; count: number }>()
  ;(globalThis as { __vfarmsRateBuckets?: typeof rateBuckets }).__vfarmsRateBuckets = rateBuckets
  return {
    tables: {
      pricing_rules: [
        {
          id: 'rule-1',
          name: 'Default',
          start_date: null,
          end_date: null,
          nightly_inr: 25000,
          minimum_nights: 1,
          active: true,
        },
      ],
      stay_bookings: [],
      inventory_holds: [],
      payments: [],
      payment_webhook_events: [],
      booking_notifications: [],
      admin_audit_logs: [],
      api_rate_limit_buckets: [],
    },
    unique: { payment_webhook_events: new Set() },
  }
}

function memoryConsumeRateLimit(
  store: MemoryStore,
  bucketKey: string,
  limit: number,
  windowSeconds: number,
): { allowed: boolean; retry_after_seconds: number } {
  const nowSec = Math.floor(Date.now() / 1000)
  const windowStart = Math.floor(nowSec / windowSeconds) * windowSeconds
  const key = `${bucketKey}:${windowStart}`
  const buckets = (globalThis as { __vfarmsRateBuckets?: Map<string, { windowStart: number; count: number }> }).__vfarmsRateBuckets
  const map = buckets ?? new Map()
  const existing = map.get(key)
  const count = (existing?.count ?? 0) + 1
  map.set(key, { windowStart, count })
  if (count > limit) {
    const retry = windowSeconds - (nowSec - windowStart)
    return { allowed: false, retry_after_seconds: Math.max(retry, 1) }
  }
  return { allowed: true, retry_after_seconds: 0 }
}

function clone<T>(value: T): T {
  return JSON.parse(JSON.stringify(value)) as T
}

function compareFilterValues(left: unknown, right: unknown): number {
  const leftNum = Number(left)
  const rightNum = Number(right)
  if (Number.isFinite(leftNum) && Number.isFinite(rightNum) && `${left}`.trim() !== '' && `${right}`.trim() !== '') {
    const leftLooksNumeric = typeof left === 'number' || /^\d+(\.\d+)?$/.test(String(left))
    const rightLooksNumeric = typeof right === 'number' || /^\d+(\.\d+)?$/.test(String(right))
    if (leftLooksNumeric && rightLooksNumeric) return leftNum - rightNum
  }
  return String(left).localeCompare(String(right))
}

function newId(): string {
  return crypto.randomUUID()
}

type Op = 'select' | 'insert' | 'update' | 'upsert' | 'delete'

class MemoryQuery implements PromiseLike<{ data: unknown; error: { code?: string; message: string } | null }> {
  private op: Op = 'select'
  private payload: Row | Row[] | null = null
  private filters: Array<(row: Row) => boolean> = []
  private selectFields: string | null = null
  private singleMode: 'none' | 'single' | 'maybeSingle' = 'none'
  private upsertOptions: { onConflict?: string; ignoreDuplicates?: boolean } | null = null
  private orderSpec: { column: string; ascending: boolean; nullsFirst?: boolean } | null = null
  private limitCount: number | null = null

  private store: MemoryStore
  private table: string

  constructor(store: MemoryStore, table: string) {
    this.store = store
    this.table = table
  }

  select(fields = '*') {
    this.selectFields = fields
    return this
  }

  insert(row: Row | Row[]) {
    this.op = 'insert'
    this.payload = row
    return this
  }

  update(row: Row) {
    this.op = 'update'
    this.payload = row
    return this
  }

  upsert(rows: Row | Row[], options?: { onConflict?: string; ignoreDuplicates?: boolean }) {
    this.op = 'upsert'
    this.payload = rows
    this.upsertOptions = options ?? null
    return this
  }

  delete() {
    this.op = 'delete'
    return this
  }

  eq(column: string, value: unknown) {
    this.filters.push((row) => row[column] === value)
    return this
  }

  neq(column: string, value: unknown) {
    this.filters.push((row) => row[column] !== value)
    return this
  }

  gt(column: string, value: unknown) {
    this.filters.push((row) => compareFilterValues(row[column], value) > 0)
    return this
  }

  lt(column: string, value: unknown) {
    this.filters.push((row) => compareFilterValues(row[column], value) < 0)
    return this
  }

  limit(count: number) {
    this.limitCount = count
    return this
  }

  in(column: string, values: unknown[]) {
    const set = new Set(values)
    this.filters.push((row) => set.has(row[column]))
    return this
  }

  order(column: string, options?: { ascending?: boolean; nullsFirst?: boolean }) {
    this.orderSpec = { column, ascending: options?.ascending ?? true, nullsFirst: options?.nullsFirst }
    return this
  }

  single() {
    this.singleMode = 'single'
    return this
  }

  maybeSingle() {
    this.singleMode = 'maybeSingle'
    return this
  }

  then<TResult1 = { data: unknown; error: null }, TResult2 = never>(
    onfulfilled?: ((value: { data: unknown; error: { code?: string; message: string } | null }) => TResult1 | PromiseLike<TResult1>) | null,
    onrejected?: ((reason: unknown) => TResult2 | PromiseLike<TResult2>) | null,
  ): Promise<TResult1 | TResult2> {
    return Promise.resolve(this.run()).then(onfulfilled, onrejected)
  }

  private rows(): Row[] {
    if (!this.store.tables[this.table]) this.store.tables[this.table] = []
    return this.store.tables[this.table]
  }

  private applyFilters(source: Row[]): Row[] {
    return source.filter((row) => this.filters.every((fn) => fn(row)))
  }

  private project(row: Row): Row {
    if (!this.selectFields || this.selectFields === '*') return clone(row)
    const fields = this.selectFields.split(',').map((f) => f.trim())
    const out: Row = {}
    for (const field of fields) out[field] = row[field]
    return out
  }

  private run(): { data: unknown; error: { code?: string; message: string } | null } {
    const tableRows = this.rows()

    if (this.op === 'insert') {
      const items = Array.isArray(this.payload) ? this.payload : [this.payload ?? {}]
      if (this.table === 'payment_webhook_events') {
        for (const item of items) {
          const eventId = String(item.provider_event_id)
          if (this.store.unique.payment_webhook_events.has(eventId)) {
            return { data: null, error: { code: '23505', message: 'duplicate key value violates unique constraint' } }
          }
          this.store.unique.payment_webhook_events.add(eventId)
        }
      }
      const inserted = items.map((item) => {
        const row = { id: newId(), ...item }
        tableRows.push(row)
        return clone(row)
      })
      return this.finishSelect(inserted)
    }

    if (this.op === 'update') {
      const patch = this.payload as Row
      const matched: Row[] = []
      for (const row of tableRows) {
        if (this.filters.every((fn) => fn(row))) {
          Object.assign(row, patch)
          matched.push(clone(row))
        }
      }
      return this.finishSelect(matched)
    }

    if (this.op === 'upsert') {
      const items = Array.isArray(this.payload) ? this.payload : [this.payload ?? {}]
      const conflictKey = this.upsertOptions?.onConflict ?? 'id'
      const inserted: Row[] = []
      for (const item of items) {
        const keyValue = item[conflictKey]
        const existing = tableRows.find((row) => row[conflictKey] === keyValue)
        if (existing) {
          if (this.upsertOptions?.ignoreDuplicates) continue
          Object.assign(existing, item)
          inserted.push(clone(existing))
        } else {
          const row = { id: newId(), ...item }
          tableRows.push(row)
          inserted.push(clone(row))
        }
      }
      return { data: inserted.length ? inserted : null, error: null }
    }

    if (this.op === 'delete') {
      const kept: Row[] = []
      const removed: Row[] = []
      for (const row of tableRows) {
        if (this.filters.every((fn) => fn(row))) removed.push(row)
        else kept.push(row)
      }
      this.store.tables[this.table] = kept
      return { data: removed, error: null }
    }

    let filtered = this.applyFilters([...tableRows])
    if (this.orderSpec) {
      const { column, ascending, nullsFirst } = this.orderSpec
      filtered.sort((a, b) => {
        const av = a[column]
        const bv = b[column]
        if (av == null && bv == null) return 0
        if (av == null) return nullsFirst ? -1 : 1
        if (bv == null) return nullsFirst ? 1 : -1
        if (av === bv) return 0
        return av > bv ? (ascending ? 1 : -1) : ascending ? -1 : 1
      })
    }

    if (this.limitCount != null) filtered = filtered.slice(0, this.limitCount)

    const projected = filtered.map((r) => this.project(r))
    return this.finishSelect(projected)
  }

  private finishSelect(rows: Row[]): { data: unknown; error: { code?: string; message: string } | null } {
    const projected = rows.map((r) => this.project(r))
    if (this.singleMode === 'single') {
      if (projected.length !== 1) {
        return { data: null, error: { message: 'JSON object requested, multiple (or no) rows returned' } }
      }
      return { data: projected[0], error: null }
    }
    if (this.singleMode === 'maybeSingle') {
      return { data: projected[0] ?? null, error: null }
    }
    return { data: projected, error: null }
  }
}

// Patch insert for webhook unique constraint
function from(store: MemoryStore, table: string) {
  const base = {
    select(fields?: string) {
      const q = new MemoryQuery(store, table)
      if (fields) q.select(fields)
      return q
    },
    insert(row: Row | Row[]) {
      return new MemoryQuery(store, table).insert(row)
    },
    update(row: Row) {
      return new MemoryQuery(store, table).update(row)
    },
    upsert(rows: Row | Row[], options?: { onConflict?: string; ignoreDuplicates?: boolean }) {
      return new MemoryQuery(store, table).upsert(rows, options)
    },
    delete() {
      return new MemoryQuery(store, table).delete()
    },
  }
  return base
}

export function createMemorySupabase(store: MemoryStore): SupabaseClient {
  return {
    from: (table: string) => from(store, table),
    rpc: async (fn: string, args?: Record<string, unknown>) => {
      if (fn === 'consume_rate_limit') {
        const payload = memoryConsumeRateLimit(
          store,
          String(args?.p_bucket_key ?? ''),
          Number(args?.p_limit ?? 1),
          Number(args?.p_window_seconds ?? 60),
        )
        return { data: payload, error: null }
      }
      return { data: null, error: null }
    },
  } as unknown as SupabaseClient
}
