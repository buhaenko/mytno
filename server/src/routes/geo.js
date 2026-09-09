// Country of the visitor, used only to pick a default language.
// Filled in by the CDN or proxy in front of the API; null when it is not.
export const geoRoute = (req, res) => {
  const country = req.get('cf-ipcountry') ?? req.get('x-vercel-ip-country') ?? req.get('x-country') ?? null
  res.set('cache-control', 'no-store')
  res.json({ country: country && country !== 'XX' ? country.toUpperCase() : null })
}
