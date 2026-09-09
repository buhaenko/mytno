/**
 * mytno.app API: share links, exchange rates, VIN decoding and the rule config.
 * `npm run server` starts it with an embedded MongoDB; set MONGO_URL for a real one.
 */
import { env } from './config.js'
import { connect, disconnect } from './db.js'
import { buildApp } from './app.js'

const { embedded } = await connect()
const app = await buildApp()

await app.listen({ port: env.port, host: '0.0.0.0' })
app.log.info(`MongoDB: ${embedded ? `embedded (${env.localDbPath})` : env.mongoUrl.replace(/\/\/.*@/, '//***@')}`)
app.log.info(`Rules: ${Object.keys(app.rules).join(', ')}`)

for (const signal of ['SIGINT', 'SIGTERM']) {
  process.on(signal, async () => {
    await app.close()
    await disconnect()
    process.exit(0)
  })
}
