export type AdminTableRow = Record<string, string | number | boolean | null | undefined>

export function toAdminTableRows(data: unknown): AdminTableRow[] {
  if (!Array.isArray(data)) return []
  return data.flatMap((item) => {
    if (typeof item !== 'object' || item === null || 'error' in item) return []
    return [item as AdminTableRow]
  })
}
