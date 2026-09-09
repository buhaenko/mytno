// MongoDB storage. Used in production and, through an embedded server, in local dev.
import { mkdirSync } from 'node:fs'
import { MongoClient } from 'mongodb'
import { env } from '../config.js'

let client
let db

export async function connect() {
  let url = env.mongoUrl
  let embedded = false
  if (!url) {
    // Local development: start a real MongoDB in-process so `npm run dev` needs nothing installed.
    const { MongoMemoryServer } = await import('mongodb-memory-server')
    mkdirSync(env.localDbPath, { recursive: true })
    const mem = await MongoMemoryServer.create({ instance: { dbName: env.dbName, dbPath: env.localDbPath, storageEngine: 'wiredTiger' } })
    url = mem.getUri()
    embedded = true
  }
  client = new MongoClient(url)
  await client.connect()
  db = client.db(env.dbName)
  await Promise.all([
    db.collection('links').createIndex({ code: 1 }, { unique: true }),
    db.collection('links').createIndex({ hash: 1 }),
    db.collection('links').createIndex({ createdAt: 1 }, { expireAfterSeconds: env.shareTtlDays * 86400 }),
    db.collection('vins').createIndex({ vin: 1 }, { unique: true }),
    db.collection('vins').createIndex({ fetchedAt: 1 }, { expireAfterSeconds: env.vinTtlDays * 86400 }),
    db.collection('fx').createIndex({ key: 1 }, { unique: true }),
  ])
  return { url, embedded }
}

export const links = () => db.collection('links')
export const vins = () => db.collection('vins')
export const fx = () => db.collection('fx')
export const close = () => client?.close()
