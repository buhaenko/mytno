import { decodeVin } from '../services/vin.js'

const VIN = /^[A-HJ-NPR-Z0-9]{17}$/

export async function vinRoute(req, res) {
  const vin = String(req.params.vin ?? '').toUpperCase()
  if (!VIN.test(vin)) return res.status(400).json({ error: 'not a VIN' })
  try {
    const data = await decodeVin(vin)
    res.set('cache-control', 'public, max-age=86400')
    res.json(data)
  } catch (e) {
    res.status(502).json({ error: 'vin service unavailable', detail: String(e.message ?? e) })
  }
}
