/** Joins a provider base URL and an API path without doubling or missing the slash. */
export const endpoint = (base: string, path: string): string =>
  `${base.replace(/\/+$/, "")}/${path.replace(/^\/+/, "")}`
