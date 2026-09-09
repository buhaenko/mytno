import { createHash, randomBytes } from 'node:crypto'
import { ShareLink } from '../models/ShareLink.js'

/** No 0/o and no 1/l/i, so a code can be read out loud. */
const ALPHABET = 'abcdefghjkmnpqrstuvwxyz23456789'
const randomCode = (length) => [...randomBytes(length)].map((b) => ALPHABET[b % ALPHABET.length]).join('')
const fingerprint = (state) => createHash('sha256').update(JSON.stringify(state)).digest('hex').slice(0, 32)

/** The same calculation always gets the same code, so sharing twice costs one row. */
export async function saveShare(state, ip) {
  const hash = fingerprint(state)
  const existing = await ShareLink.findOne({ hash }).lean()
  if (existing) return existing.code

  for (let length = 4; length <= 10; length++) {
    try {
      const { code } = await ShareLink.create({ code: randomCode(length), hash, state, ip })
      return code
    } catch (error) {
      if (error?.code !== 11000) throw error // 11000 is a taken code: try a longer one
    }
  }
  throw new Error('could not allocate a share code')
}

export async function readShare(code) {
  const link = await ShareLink.findOneAndUpdate({ code }, { $inc: { hits: 1 } }, { new: true }).lean()
  return link?.state ?? null
}
