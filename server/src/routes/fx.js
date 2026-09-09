import { getRates } from '../services/fx.js'

export const fxRoute = (fallback) => async (_req, res) => {
  const rates = await getRates(fallback)
  res.set('cache-control', 'public, max-age=1800')
  res.json(rates)
}
