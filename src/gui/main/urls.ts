/** Joins a provider base URL and an API path without doubling or missing the slash. */
export const endpoint = (base: string, path: string): string =>
  `${base.replace(/\/+$/, "")}/${path.replace(/^\/+/, "")}`

/**
 * A URL safe to write to the log: origin and path only, so credentials or tokens carried
 * in the userinfo or the query string never reach the log file.
 */
export const safeURL = (value: string): string => {
  try {
    const url = new URL(value)
    return `${url.origin}${url.pathname}`
  } catch {
    return "(unparseable URL)"
  }
}
