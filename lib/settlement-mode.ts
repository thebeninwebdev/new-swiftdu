/** Real payment providers must only be bypassed for local development. */
export function isDevelopmentSettlementSimulation(nodeEnv = process.env.NODE_ENV) {
  return nodeEnv === 'development'
}
