import { Schema, model } from 'mongoose'
import { env } from '../config.js'

/** A decoded VIN never changes, so it is fetched from NHTSA once and kept. */
const schema = new Schema(
  {
    vin: { type: String, required: true, unique: true, uppercase: true },
    data: { type: Schema.Types.Mixed, required: true },
    fetchedAt: { type: Date, default: Date.now },
  },
  { versionKey: false },
)

schema.index({ fetchedAt: 1 }, { expireAfterSeconds: env.vinTtlDays * 86_400 })

export const VinDecode = model('VinDecode', schema)
