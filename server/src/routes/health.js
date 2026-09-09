export async function healthRoutes(app) {
  app.get('/health', async () => ({ ok: true, uptime: Math.round(process.uptime()) }))
}
