/**
 * What the prerender needs from the calculator, bundled for Node.
 * The route pages carry a worked example, and it has to be the same arithmetic the
 * app runs — so the example is computed by this very code rather than written down.
 */
export { estimate } from '../src/lib/calc/index.ts'
export { fallbackRates } from '../src/lib/fx.ts'
export { format } from '../src/lib/money.ts'
export { ORIGIN_GROUP } from '../src/lib/origins.ts'
