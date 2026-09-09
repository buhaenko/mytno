/** Serves the rule files, so anyone can read exactly what the app calculates with. */
export async function configRoutes(app, { rules }) {
  app.get('/api/config', async (_request, reply) => {
    reply.header('cache-control', 'public, max-age=300')
    return rules
  })
}
