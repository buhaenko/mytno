import countries from '@config/countries.json'
import ukraine from '@config/rules.ukraine.json'
import spain from '@config/rules.spain.json'
import { sourcesFor as build, type Destination, type SourceConfig } from './pages'

/**
 * The links a country page cites, bound to the config the app already carries.
 * The prerender builds the same object from the JSON on disk.
 */
export const DESTINATION_INFO = countries.destinations as Record<string, Destination>

export const SOURCE_CONFIG: SourceConfig = {
  euDuty: countries.euDutySource,
  vat: countries.vatSource,
  regTaxNone: countries.regTaxNoneSource,
  precise: {
    UA: ukraine.refs.excise,
    UA_DUTY: ukraine.refs.duty,
    UA_VAT: ukraine.refs.vat,
    ES: spain.refs.iedmt,
    PL: countries.poland.source,
    AT: countries.austria.source,
  },
}

export const sourcesFor = (code: string, info: Destination) => build(code, info, SOURCE_CONFIG)
