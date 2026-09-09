// Serves the rule files so any client (or a reviewer) can read exactly what the app calculates with.
export const configRoute = (rules) => (_req, res) => {
  res.set('cache-control', 'public, max-age=300')
  res.json(rules)
}
