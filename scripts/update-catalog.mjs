// Merges a Models API listing (GET /v1/models) into catalog.json.
// New Claude models are added with price: null and needsReview: true, and a
// newer model becomes its family's `latest`; a person fills in the prices.
// Usage: node scripts/update-catalog.mjs models.json   (prints "changed" or "unchanged")
import { readFileSync, writeFileSync } from 'node:fs'

const FAMILY = /^claude-(haiku|sonnet|opus|fable)-(\d+(?:-\d+)*)$/
const catalogUrl = new URL('../plugins/model-coach/catalog.json', import.meta.url)
const catalog = JSON.parse(readFileSync(catalogUrl, 'utf8'))
const listing = JSON.parse(readFileSync(process.argv[2], 'utf8'))

const version = id => (FAMILY.exec(id)?.[2] ?? '0').split('-').map(Number)
const newer = (a, b) => {
  const [x, y] = [version(a), version(b)]
  for (let i = 0; i < Math.max(x.length, y.length); i++) {
    if ((x[i] ?? 0) !== (y[i] ?? 0)) return (x[i] ?? 0) > (y[i] ?? 0)
  }
  return false
}

let changed = false
for (const m of listing.data ?? []) {
  const match = FAMILY.exec(m.id)
  if (!match) continue
  const family = match[1]
  if (!catalog.models.some(x => x.id === m.id)) {
    catalog.models.push({
      id: m.id,
      family,
      label: String(m.display_name ?? m.id).replace(/^Claude\s+/, ''),
      contextWindow: m.max_input_tokens ?? 0,
      price: null,
      needsReview: true,
    })
    console.error(`added ${m.id}`)
    changed = true
  }
  const fam = catalog.families[family]
  if (newer(m.id, fam.latest)) {
    fam.latest = m.id
    fam.label = String(m.display_name ?? m.id).replace(/^Claude\s+/, '')
    console.error(`${family} latest → ${m.id}`)
    changed = true
  }
}

if (changed) {
  catalog.asOf = new Date().toISOString().slice(0, 10)
  writeFileSync(catalogUrl, JSON.stringify(catalog, null, 2) + '\n')
}
console.log(changed ? 'changed' : 'unchanged')
