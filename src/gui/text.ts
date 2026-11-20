/** Decodes the few HTML entities that show up in prose. */
const ENTITIES: Record<string, string> = {
  amp: "&",
  lt: "<",
  gt: ">",
  quot: '"',
  "#39": "'",
  apos: "'",
  nbsp: " ",
}

/** A line that separates the header of a table from its rows. */
const TABLE_SEPARATOR = /^[ \t]*\|?[ \t]*:?-{3,}:?[ \t]*(\|[ \t]*:?-{3,}:?[ \t]*)+\|?[ \t]*$/

/** A row of a table, with or without the outer pipes, as a sentence. */
function tableRow(line: string): string {
  const cells = line
    .trim()
    .replace(/^\|/, "")
    .replace(/\|$/, "")
    .split("|")
    .map((cell) => cell.trim())
    .filter(Boolean)

  return cells.length > 0 ? `${cells.join(", ")};` : ""
}

/**
 * Tables are structure, not prose: each row becomes a sentence of its cells. Both the
 * form with outer pipes and the one without them are recognised.
 */
function readableTables(text: string): string {
  const lines = text.split("\n")
  const out: string[] = []

  for (let index = 0; index < lines.length; index++) {
    const line = lines[index]

    if (TABLE_SEPARATOR.test(line) && out.length > 0 && out[out.length - 1].includes("|")) {
      out[out.length - 1] = tableRow(out[out.length - 1])

      while (index + 1 < lines.length && lines[index + 1].includes("|")) {
        index++
        out.push(tableRow(lines[index]))
      }
      continue
    }

    out.push(line)
  }

  return out.join("\n")
}

/** Speaking a URL is noise; keep only the punctuation that followed it. */
function dropUrl(url: string): string {
  return /[.,;:!?]+$/.exec(url)?.[0] ?? ""
}

/** Labels of the `[label]: url` lines, so shortcut references can lose their brackets. */
function collectLabels(text: string): Set<string> {
  const labels = new Set<string>()
  for (const match of text.matchAll(/^[ \t]{0,3}\[([^\]]+)\]:[ \t]*\S+/gm)) labels.add(match[1])
  return labels
}

/**
 * Turns an assistant message into something worth reading aloud: prose survives, its
 * Markdown does not, and the words inside inline code survive too, because file names
 * and identifiers are often the point of the sentence.
 */
export function plainText(markdown: string): string {
  const labels = collectLabels(markdown)
  let text = markdown

  // Fenced blocks are code, not prose.
  text = text.replace(/```[\s\S]*?```/g, " ")
  text = text.replace(/~~~[\s\S]*?~~~/g, " ")
  // Indented blocks are code too, as long as they are not a list continuation.
  text = text.replace(/^(?: {4,}|\t+)(?![ \t]*(?:[-*+]|\d+[.)])[ \t]).*$/gm, " ")

  // Reference definitions and footnote bodies are metadata.
  text = text.replace(/^[ \t]{0,3}\[[^\]]+\]:[ \t]*\S+.*$/gm, " ")
  text = text.replace(/^[ \t]{0,3}\[\^[^\]]+\]:.*$/gm, " ")

  // Inline code keeps its content, without the backticks.
  text = text.replace(/`([^`\n]*)`/g, (_, code: string) => ` ${code} `)

  // An escaped character is that character: the backslash is markup.
  text = text.replace(/\\([\\`*_{}[\]()#+\-.!>~|])/g, "$1")
  text = text.replace(/\\\n/g, " ")

  // Images disappear; links keep their text, with or without a reference.
  text = text.replace(/!\[[^\]]*\]\([^)]*\)/g, " ")
  text = text.replace(/!\[[^\]]*\]\[[^\]]*\]/g, " ")
  text = text.replace(/\[([^\]]+)\]\([^)]*\)/g, "$1")
  text = text.replace(/\[([^\]]+)\]\[[^\]]*\]/g, "$1")
  text = text.replace(/\[([^\]^]+)\](?![([])/g, (whole, label: string) =>
    labels.has(label) ? label : whole,
  )

  text = readableTables(text)

  // Rules, task boxes, headings, quotes and bullets are structure, not words.
  text = text.replace(/^[ \t]*([-*_])(?:[ \t]*\1){2,}[ \t]*$/gm, " ")
  text = text.replace(/^[ \t]*[-*+][ \t]+\[[ xX]\][ \t]*/gm, "")
  text = text.replace(/^[ \t]{0,3}(?:>[ \t]*)+/gm, "")
  text = text.replace(/^[ \t]{0,3}(?:#{1,6}|[-*+]|\d+[.)])[ \t]+/gm, "")

  // Formulas are not prose; a price like "$5 y $10" has no symbols to go by.
  text = text.replace(/\$\$[\s\S]*?\$\$/g, " ")
  text = text.replace(/\$([^$\n]+)\$/g, (whole, body: string) =>
    /[=^_\\{}]/.test(body) ? " " : whole,
  )

  // Emphasis markers go, their text stays. Underscores inside words are identifiers.
  text = text.replace(/~~([^~]+)~~/g, "$1")
  text = text.replace(/\*\*\*([^*]+)\*\*\*/g, "$1")
  text = text.replace(/\*\*([^*]+)\*\*/g, "$1")
  text = text.replace(/__([^_]+)__/g, "$1")
  text = text.replace(/\*([^*\n]+)\*/g, "$1")
  text = text.replace(/(?<![\w])_([^_\n]+)_(?![\w])/g, "$1")

  // Emoji shortcodes are names of pictures, not words.
  text = text.replace(/:[a-z0-9_+-]+:/g, " ")

  // Footnotes point at a note the reader cannot see.
  text = text.replace(/\[\^[^\]]+\]/g, " ")

  // Autolinks and bare URLs are noise when spoken.
  text = text.replace(/<(?:https?:\/\/|mailto:)[^>]*>/g, " ")
  text = text.replace(/(?:https?:\/\/|www\.)[^\s<>()]+/g, (url) => dropUrl(url))

  // A tag is markup; its content stays.
  text = text.replace(/<[^>]+>/g, " ")
  text = text.replace(/&(amp|lt|gt|quot|#39|apos|nbsp);/g, (_, name: string) => ENTITIES[name] ?? " ")

  // Square brackets left over are markup, never words.
  text = text.replace(/[[\]]/g, " ")

  // Markup that disappeared leaves spaces where punctuation should touch the word.
  text = text.replace(/[ \t]+([.,;:!?…%])/g, "$1")
  text = text.replace(/\s+/g, " ")
  return text.trim()
}

/** Splits text on sentence boundaries, merging until each part fits `max` characters. */
export function chunk(text: string, max: number): string[] {
  const parts: string[] = []
  let current = ""

  const push = (value: string) => {
    const trimmed = value.trim()
    if (trimmed) parts.push(trimmed)
  }

  for (const sentence of text.split(/(?<=[.!?…])\s+/)) {
    if (!sentence) continue
    if (sentence.length > max) {
      push(current)
      current = ""
      for (const piece of splitLong(sentence, max)) push(piece)
      continue
    }
    if (current && current.length + 1 + sentence.length > max) {
      push(current)
      current = sentence
    } else {
      current = current ? `${current} ${sentence}` : sentence
    }
  }
  push(current)
  return parts
}

function splitLong(text: string, max: number): string[] {
  const pieces: string[] = []
  let current = ""
  for (const word of text.split(/\s+/)) {
    if (current && current.length + 1 + word.length > max) {
      pieces.push(current)
      current = word
    } else {
      current = current ? `${current} ${word}` : word
    }
  }
  if (current) pieces.push(current)
  return pieces
}
