import mongoose from 'mongoose'
import { mkdirSync } from 'node:fs'
import { env } from './config.js'

/**
 * One connection for the process. With no MONGO_URL we start a real MongoDB
 * in-process, so `npm run dev` needs nothing installed.
 */
export async function connect() {
  let url = env.mongoUrl
  let embedded = false

  if (!url) {
    mkdirSync(env.localDbPath, { recursive: true })
    const { MongoMemoryServer } = await import('mongodb-memory-server')
    const memory = await MongoMemoryServer.create({
      instance: { dbName: env.dbName, dbPath: env.localDbPath, storageEngine: 'wiredTiger' },
    })
    url = memory.getUri()
    embedded = true
  }

  mongoose.set('strictQuery', true)
  await mongoose.connect(url, { dbName: env.dbName })
  return { embedded, url }
}

export const disconnect = () => mongoose.disconnect()
