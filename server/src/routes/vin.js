import { decodeVin } from '../services/vin.js'

const params = {
  type: 'object',
  required: ['vin'],
  properties: { vin: { type: 'string', pattern: '^[A-HJ-NPR-Za-hj-npr-z0-9]{17}$' } },
}

export async function vinRoutes(app) {
  app.get('/api/vin/:vin', { schema: { params } }, async (request, reply) => {
    try {
      const decoded = await decodeVin(request.params.vin.toUpperCase())
      reply.header('cache-control', 'public, max-age=86400')
      return decoded
    } catch (error) {
      return reply.code(502).send({ error: 'vin service unavailable', detail: error.message })
    }
  })
}
