/**
 * Builds public/catalog/ from the EPA dataset: every model sold in the US
 * from 1984 to 2026, one small JSON file per year.
 *
 *   npm run catalog                    downloads the dataset
 *   npm run catalog -- path/to.csv     uses a local copy
 */
import { execSync } from 'node:child_process'
import { existsSync, mkdirSync, writeFileSync, readFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'

const SOURCE = 'https://www.fueleconomy.gov/feg/epadata/vehicles.csv.zip'
const OUT = 'public/catalog'
const MILES_TO_KM = 0.621371

const FUEL_BY_EPA = {
  'Regular Gasoline': 'petrol',
  'Premium Gasoline': 'petrol',
  'Midgrade Gasoline': 'petrol',
  Diesel: 'diesel',
  Electricity: 'electric',
  'Natural Gas': 'cng',
  Hydrogen: 'hydrogen',
}
const FUEL_BY_DRIVETRAIN = { 'Plug-in Hybrid': 'phev', Hybrid: 'hybrid', EV: 'electric' }

async function datasetPath() {
  const given = process.argv[2]
  if (given) return given

  const dir = join(tmpdir(), 'epa-catalog')
  const zip = join(dir, 'vehicles.csv.zip')
  mkdirSync(dir, { recursive: true })
  if (!existsSync(zip)) {
    console.log(`downloading ${SOURCE}`)
    writeFileSync(zip, Buffer.from(await (await fetch(SOURCE)).arrayBuffer()))
  }
  execSync(`unzip -o -q "${zip}" -d "${dir}"`)
  return join(dir, 'vehicles.csv')
}

/** A CSV reader small enough to read: quotes, doubled quotes, newlines. */
function parseCsv(text) {
  const rows = []
  let row = []
  let field = ''
  let quoted = false

  for (let i = 0; i < text.length; i++) {
    const ch = text[i]
    if (quoted) {
      if (ch !== '"') field += ch
      else if (text[i + 1] === '"') { field += '"'; i++ }
      else quoted = false
    } else if (ch === '"') quoted = true
    else if (ch === ',') { row.push(field); field = '' }
    else if (ch === '\n') { row.push(field); rows.push(row); row = []; field = '' }
    else if (ch !== '\r') field += ch
  }
  if (field || row.length) { row.push(field); rows.push(row) }
  return rows
}

const csv = parseCsv(readFileSync(await datasetPath(), 'utf8'))
const header = csv[0]
const at = (row, column) => row[header.indexOf(column)] ?? ''

/** year → make → model → the distinct engine versions offered that year. */
const byYear = new Map()
let versions = 0

for (const row of csv.slice(1)) {
  if (row.length < header.length - 5) continue
  const year = Number(at(row, 'year'))
  if (!year) continue

  const drivetrain = at(row, 'atvType').trim()
  const fuel = FUEL_BY_DRIVETRAIN[drivetrain] ?? FUEL_BY_EPA[at(row, 'fuelType1').trim()] ?? 'petrol'
  const litres = Number(at(row, 'displ')) || 0
  const co2PerMile = Number(at(row, 'co2TailpipeGpm')) || 0

  const version = [
    litres ? Math.round(litres * 1000) : 0,
    Number(at(row, 'cylinders')) || 0,
    fuel,
    co2PerMile > 0 ? Math.round(co2PerMile * MILES_TO_KM) : 0,
    at(row, 'trany').trim().replace('Automatic', 'AT').replace('Manual', 'MT'),
    at(row, 'drive').trim(),
    at(row, 'evMotor').trim(),
    Number(at(row, 'id')),
  ]

  const makes = byYear.get(year) ?? new Map()
  const models = makes.get(at(row, 'make').trim()) ?? new Map()
  const list = models.get(at(row, 'model').trim()) ?? []

  // Trims differ by a gram or two of CO₂; the same engine should appear once.
  const [cc, cylinders, , , gearbox, drive, motor] = version
  const signature = [cc, cylinders, fuel, gearbox, drive, motor].join('|')
  if (!list.some((v) => v.signature === signature)) {
    list.push({ signature, version })
    versions++
  }
  models.set(at(row, 'model').trim(), list)
  makes.set(at(row, 'make').trim(), models)
  byYear.set(year, makes)
}

mkdirSync(OUT, { recursive: true })
const makesByYear = {}

for (const [year, makes] of [...byYear].sort((a, b) => b[0] - a[0])) {
  const out = {}
  for (const [make, models] of [...makes].sort()) {
    out[make] = Object.fromEntries([...models].sort().map(([model, list]) => [model, list.map((v) => v.version)]))
  }
  writeFileSync(join(OUT, `${year}.json`), JSON.stringify(out))
  makesByYear[year] = Object.keys(out)
}

writeFileSync(join(OUT, 'index.json'), JSON.stringify({
  years: Object.keys(makesByYear).map(Number).sort((a, b) => b - a),
  makesByYear,
  source: SOURCE,
  built: new Date().toISOString().slice(0, 10),
}))

console.log(`catalogue: ${byYear.size} years, ${versions} versions → ${OUT}`)
