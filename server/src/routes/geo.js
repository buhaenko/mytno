/**
 * The visitor's country, used only to pick a default language.
 * The CDN in front of the API fills the header in; without one this is null.
 */
export async function geoRoutes(app) {
  app.get('/api/geo', async (request, reply) => {
    const header = request.headers['cf-ipcountry'] ?? request.headers['x-vercel-ip-country'] ?? request.headers['x-country']
    reply.header('cache-control', 'no-store')
    return { country: header && header !== 'XX' ? String(header).toUpperCase() : null }
  })
}
