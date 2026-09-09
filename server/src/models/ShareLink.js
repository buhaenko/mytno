import { Schema, model } from 'mongoose'
import { env } from '../config.js'

/** A saved calculation behind a short code. Identical calculations share one code. */
const schema = new Schema(
  {
    code: { type: String, required: true, unique: true },
    hash: { type: String, required: true, index: true },
    state: { type: Schema.Types.Mixed, required: true },
    hits: { type: Number, default: 0 },
    ip: String,
  },
  { timestamps: true, versionKey: false },
)

schema.index({ createdAt: 1 }, { expireAfterSeconds: env.shareTtlDays * 86_400 })

export const ShareLink = model('ShareLink', schema)
