import Fastify from 'fastify'
import cors from '@fastify/cors'
import rateLimit from '@fastify/rate-limit'
import { env, loadRuleFiles } from './config.js'
import { healthRoutes } from './routes/health.js'
import { configRoutes } from './routes/config.js'
import { ratesRoutes } from './routes/rates.js'
import { vinRoutes } from './routes/vin.js'
import { shareRoutes } from './routes/share.js'
import { geoRoutes } from './routes/geo.js'

/** Builds the API. Everything it serves is registered here, in one readable list. */
export async function buildApp({ logger = true } = {}) {
  const app = Fastify({ logger, trustProxy: true, bodyLimit: env.shareMaxBytes })
  const rules = loadRuleFiles()

  await app.register(cors, { origin: env.corsOrigin })
  await app.register(rateLimit, { max: env.rateLimitPerMinute, timeWindow: '1 minute' })

  await app.register(healthRoutes)
  await app.register(configRoutes, { rules })
  await app.register(ratesRoutes, { fallback: rules['fx.fallback'] })
  await app.register(vinRoutes)
  await app.register(shareRoutes)
  await app.register(geoRoutes)

  app.setNotFoundHandler((_request, reply) => reply.code(404).send({ error: 'not found' }))
  app.setErrorHandler((error, _request, reply) => {
    app.log.error(error)
    const status = error.statusCode && error.statusCode < 500 ? error.statusCode : 500
    reply.code(status).send({ error: status === 500 ? 'internal error' : error.message })
  })

  app.decorate('rules', rules)
  return app
}
