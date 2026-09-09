// Short, unambiguous share codes: no 0/o, 1/l/i.
import { createHash, randomBytes } from 'node:crypto'
import { links } from '../store/mongo.js'

const ALPHABET = 'abcdefghjkmnpqrstuvwxyz23456789'
const make = (len) => [...randomBytes(len)].map((b) => ALPHABET[b % ALPHABET.length]).join('')

export const hashOf = (body) => createHash('sha256').update(body).digest('hex').slice(0, 32)

/** The same calculation always gets the same code, so repeated shares do not fill the database. */
export async function saveShare(body, ip) {
  const hash = hashOf(body)
  const existing = await links().findOne({ hash })
  if (existing) return existing.code

  for (let len = 4; len <= 10; len++) {
    const code = make(len)
    try {
      await links().insertOne({ code, hash, body, createdAt: new Date(), hits: 0, ip })
      return code
    } catch (e) {
      if (e?.code !== 11000) throw e // 11000 = duplicate key, try a longer code
    }
  }
  throw new Error('could not allocate a code')
}

export async function readShare(code) {
  const row = await links().findOneAndUpdate({ code }, { $inc: { hits: 1 }, $set: { lastSeen: new Date() } })
  return row?.body ?? null
}
