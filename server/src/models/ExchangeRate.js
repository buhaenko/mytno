import { Schema, model } from 'mongoose'

/** The latest rates from the National Bank of Ukraine, refreshed on a timer. */
const schema = new Schema(
  {
    key: { type: String, required: true, unique: true, default: 'nbu' },
    usdUah: { type: Number, required: true },
    eurUah: { type: Number, required: true },
    date: { type: String, required: true },
    fetchedAt: { type: Date, default: Date.now },
  },
  { versionKey: false },
)

schema.methods.isFresh = function isFresh(maxAgeHours) {
  return Date.now() - this.fetchedAt.getTime() < maxAgeHours * 3_600_000
}

export const ExchangeRate = model('ExchangeRate', schema)
