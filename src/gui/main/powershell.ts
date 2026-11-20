/** Escapes a value for a single-quoted PowerShell literal. */
export const quotePowerShell = (value: string): string => value.replace(/'/g, "''")
