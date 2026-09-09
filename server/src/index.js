// Vinta API: share links, exchange rates, VIN decoding and the rule config.
// Start with `npm run server` (embedded MongoDB) or set MONGO_URL for a real one.
import express from 'express'
import cors from 'cors'
import { env, loadRuleFiles } from './config.js'
import { connect, close } from './store/mongo.js'
import { rateLimit } from './middleware/rateLimit.js'
import { health } from './routes/health.js'
import { configRoute } from './routes/config.js'
import { fxRoute } from './routes/fx.js'
import { vinRoute } from './routes/vin.js'
import { shareRoutes } from './routes/share.js'
import { geoRoute } from './routes/geo.js'

const app = express()
app.disable('x-powered-by')
app.set('trust proxy', true)
app.use(cors({ origin: env.corsOrigin }))
app.use(express.json({ limit: env.shareMaxBytes }))
app.use(rateLimit)

const rules = loadRuleFiles()

app.get('/health', health)
app.get('/api/config', configRoute(rules))
app.get('/api/fx', fxRoute(rules['fx.fallback']))
app.get('/api/vin/:vin', vinRoute)
app.post('/api/share', shareRoutes.create)
app.get('/api/share/:code', shareRoutes.read)
app.get('/api/geo', geoRoute)

// Anything unhandled becomes a clean JSON error rather than an HTML stack trace.
app.use((req, res) => res.status(404).json({ error: 'not found' }))
app.use((err, _req, res, _next) => {
  console.error(err)
  res.status(500).json({ error: 'internal error' })
})

const { embedded } = await connect()
app.listen(env.port, () => {
  console.log(`Vinta API on http://localhost:${env.port}`)
  console.log(`MongoDB: ${embedded ? `embedded (data in ${env.localDbPath})` : env.mongoUrl.replace(/\/\/.*@/, '//***@')}`)
  console.log(`Rules loaded: ${Object.keys(rules).join(', ')}`)
})

for (const sig of ['SIGINT', 'SIGTERM']) process.on(sig, async () => { await close(); process.exit(0) })
