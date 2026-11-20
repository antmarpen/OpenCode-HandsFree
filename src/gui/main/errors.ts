export const errorMessage = (error: unknown): string =>
  error instanceof Error ? error.message : String(error)

/**
 * What may be written to the log: the HTTP status, but never the provider body, which is
 * untrusted text and can echo the request or contain another service's data.
 */
export const errorForLog = (error: unknown): string => {
  const message = errorMessage(error)
  const status = /^HTTP \d{3}:/.exec(message)
  return status ? `${status[0]} (body omitted)` : message
}
