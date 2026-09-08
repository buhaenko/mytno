// Будує статичний каталог авто з бази EPA (fueleconomy.gov): усі моделі 1984–2026 з двигуном, паливом, CO₂.
// Використання: node scripts/build-catalog.mjs [шлях до vehicles.csv]  (без аргументу — завантажить zip з fueleconomy.gov)
import { createWriteStream, existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs'
import { execSync } from 'node:child_process'
import { tmpdir } from 'node:os'
import { join } from 'node:path'

const SRC = 'https://www.fueleconomy.gov/feg/epadata/vehicles.csv.zip'
let csvPath = process.argv[2]
if (!csvPath) {
  const dir = join(tmpdir(), 'epa-catalog')
  mkdirSync(dir, { recursive: true })
  const zip = join(dir, 'vehicles.csv.zip')
  if (!existsSync(zip)) {
    console.log('downloading', SRC)
    const res = await fetch(SRC)
    const buf = Buffer.from(await res.arrayBuffer())
    writeFileSync(zip, buf)
  }
  execSync(`unzip -o -q "${zip}" -d "${dir}"`)
  csvPath = join(dir, 'vehicles.csv')
}

function parseCsv(text) {
  const rows = []
  let row = [], field = '', q = false
  for (let i = 0; i < text.length; i++) {
    const c = text[i]
    if (q) {
      if (c === '"') { if (text[i + 1] === '"') { field += '"'; i++ } else q = false }
      else field += c
    } else if (c === '"') q = true
    else if (c === ',') { row.push(field); field = '' }
    else if (c === '\n') { row.push(field); rows.push(row); row = []; field = '' }
    else if (c !== '\r') field += c
  }
  if (field || row.length) { row.push(field); rows.push(row) }
  return rows
}

const rows = parseCsv(readFileSync(csvPath, 'utf8'))
const head = rows[0]
const col = (n) => head.indexOf(n)
const C = { year: col('year'), make: col('make'), model: col('model'), displ: col('displ'), cyl: col('cylinders'), fuel: col('fuelType1'), atv: col('atvType'), co2: col('co2TailpipeGpm'), trany: col('trany'), drive: col('drive'), ev: col('evMotor'), id: col('id') }

const FUEL = { 'Regular Gasoline': 'petrol', 'Premium Gasoline': 'petrol', 'Midgrade Gasoline': 'petrol', 'Diesel': 'diesel', 'Electricity': 'electric', 'Natural Gas': 'cng', 'Hydrogen': 'hydrogen' }
const byYear = new Map()
for (const r of rows.slice(1)) {
  if (r.length < head.length - 5) continue
  const year = Number(r[C.year]); if (!year) continue
  const make = r[C.make].trim(), model = r[C.model].trim()
  const atv = r[C.atv].trim()
  let fuel = FUEL[r[C.fuel].trim()] ?? 'petrol'
  if (atv === 'Plug-in Hybrid') fuel = 'phev'
  else if (atv === 'Hybrid') fuel = 'hybrid'
  else if (atv === 'EV') fuel = 'electric'
  const displ = Number(r[C.displ]) || 0
  const cc = displ ? Math.round(displ * 1000) : 0
  const cyl = Number(r[C.cyl]) || 0
  const co2gpm = Number(r[C.co2]) || 0
  const co2 = co2gpm > 0 ? Math.round(co2gpm * 0.621371) : 0 // г/км (EPA, комбінований)
  const trany = r[C.trany].trim().replace('Automatic', 'AT').replace('Manual', 'MT')
  const drive = r[C.drive].trim()
  const ev = r[C.ev].trim()
  const y = byYear.get(year) ?? new Map()
  const m = y.get(make) ?? new Map()
  const versions = m.get(model) ?? []
  const key = `${cc}|${cyl}|${fuel}|${trany}|${drive}|${ev}`
  if (!versions.some((v) => v.key === key)) versions.push({ key, v: [cc, cyl, fuel, co2, trany, drive, ev, Number(r[C.id])] })
  m.set(model, versions); y.set(make, m); byYear.set(year, y)
}

const index = {}
let total = 0
for (const [year, makes] of [...byYear.entries()].sort((a, b) => b[0] - a[0])) {
  const out = {}
  for (const [make, models] of [...makes.entries()].sort()) {
    out[make] = {}
    for (const [model, versions] of [...models.entries()].sort()) { out[make][model] = versions.map((x) => x.v); total += versions.length }
  }
  writeFileSync(`public/catalog/${year}.json`, JSON.stringify(out))
  index[year] = Object.keys(out)
}
writeFileSync('public/catalog/index.json', JSON.stringify({ years: Object.keys(index).map(Number).sort((a, b) => b - a), makesByYear: index, source: SRC, built: new Date().toISOString().slice(0, 10) }))
console.log('years', byYear.size, 'versions', total)
