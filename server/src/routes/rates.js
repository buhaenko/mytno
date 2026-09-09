import { getRates } from '../services/rates.js'

export async function ratesRoutes(app, { fallback }) {
  app.get('/api/fx', async (_request, reply) => {
    reply.header('cache-control', 'public, max-age=1800')
    return getRates(fallback)
  })
}
