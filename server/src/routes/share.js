import { readShare, saveShare } from '../services/codes.js'

const codeParams = {
  type: 'object',
  required: ['code'],
  properties: { code: { type: 'string', pattern: '^[a-z0-9]{4,10}$' } },
}

export async function shareRoutes(app) {
  app.post('/api/share', { schema: { body: { type: 'object' } } }, async (request, reply) =>
    reply.code(201).send({ code: await saveShare(request.body, request.ip) }))

  app.get('/api/share/:code', { schema: { params: codeParams } }, async (request, reply) => {
    const state = await readShare(request.params.code)
    if (!state) return reply.code(404).send({ error: 'not found' })
    reply.header('cache-control', 'public, max-age=86400')
    return state
  })
}
