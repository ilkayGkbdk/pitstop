// The model catalog: families, ranks, prices. Bundled with the mod and
// refreshed from the repository at most once a day (see register.tsx).

export type Family = 'haiku' | 'sonnet' | 'opus' | 'fable'

export type Price = {
  input: number
  output: number
  cacheWrite5m: number
  cacheWrite1h: number
  cacheRead: number
}

export type CatalogModel = {
  id: string
  family: Family
  label: string
  contextWindow: number
  price: Price | null
  notes?: string
  needsReview?: boolean
}

export type Catalog = {
  schemaVersion: 1
  asOf: string
  source: string
  families: Record<Family, { rank: number; latest: string; label: string }>
  models: CatalogModel[]
}

const FAMILIES: Family[] = ['haiku', 'sonnet', 'opus', 'fable']

/** A catalog fetched from the network, checked before it is trusted. */
export function parseCatalog(value: unknown): Catalog | null {
  if (typeof value !== 'object' || value === null) return null
  const c = value as Partial<Catalog>
  if (c.schemaVersion !== 1 || typeof c.asOf !== 'string' || !Array.isArray(c.models)) return null
  if (typeof c.families !== 'object' || c.families === null) return null
  for (const f of FAMILIES) {
    const fam = (c.families as Record<string, unknown>)[f] as Catalog['families'][Family] | undefined
    if (!fam || typeof fam.rank !== 'number' || typeof fam.latest !== 'string' || typeof fam.label !== 'string') return null
  }
  for (const m of c.models) {
    if (typeof m?.id !== 'string' || !FAMILIES.includes(m.family) || typeof m.label !== 'string') return null
    if (m.price !== null) {
      const p = m.price as Partial<Price> | undefined
      if (!p || ['input', 'output', 'cacheWrite5m', 'cacheWrite1h', 'cacheRead'].some(k => typeof p[k as keyof Price] !== 'number')) return null
    }
  }
  return c as Catalog
}

/** The family a model id, alias or display name belongs to. */
export function familyOf(model: string | null | undefined, catalog?: Catalog): Family | 'unknown' {
  const m = (model ?? '').toLowerCase()
  const hit = catalog?.models.find(x => x.id === m)
  if (hit) return hit.family
  for (const f of ['fable', 'opus', 'sonnet', 'haiku'] as const) if (m.includes(f)) return f
  return 'unknown'
}

export function rankOf(family: Family | 'unknown', catalog: Catalog): number {
  return family === 'unknown' ? 0 : catalog.families[family].rank
}

/** The catalog entry for a model: exact id, else the newest of its family. */
export function modelOf(model: string, catalog: Catalog): CatalogModel | undefined {
  const m = model.toLowerCase()
  const exact = catalog.models.find(x => x.id === m || m.startsWith(`${x.id}[`))
  if (exact) return exact
  const fam = familyOf(m, catalog)
  if (fam === 'unknown') return undefined
  return catalog.models.find(x => x.id === catalog.families[fam].latest)
}

/** The family one step below, for "move down a model" tips. */
export function familyBelow(family: Family | 'unknown', catalog: Catalog): Family | null {
  if (family === 'unknown') return null
  const r = catalog.families[family].rank
  return FAMILIES.find(f => catalog.families[f].rank === r - 1) ?? null
}
