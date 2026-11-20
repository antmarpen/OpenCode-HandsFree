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

/** A rule is structure on its own line: nothing to say about it. */
const RULE = /^([-*_=])(?:[ \t]*\1){2,}$/

/** A line that starts a new block instead of continuing the previous one. */
const BLOCK_START = /^(?:#{1,6}[ \t]+|>[ \t]*|[-*+][ \t]+|\d+[.)][ \t]+)/

/** Endings that already make the voice pause, so no period is needed. */
const TERMINAL = /[.!?…:;,]$/

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

/**
 * Cuts the text into the blocks the author wrote: paragraphs, headings, list items,
 * quotes and table rows. Each one is spoken as its own sentence, which is what gives
 * the voice a place to breathe between them.
 */
function blocks(text: string): string[] {
  const out: string[] = []
  let current = ""

  const flush = () => {
    const value = current.trim()
    if (value) out.push(value)
    current = ""
  }

  for (const raw of text.split("\n")) {
    const line = raw.trim()
    if (!line || RULE.test(line)) {
      flush()
      continue
    }
    if (BLOCK_START.test(line)) flush()
    // A trailing backslash is a hard break, not a word.
    const bare = line.replace(/\\$/, "")
    current = current ? `${current} ${bare}` : bare
  }

  flush()
  return out
}

/**
 * Turns an address into something the voice can read out: no scheme, no query, and the
 * separators named. "https://ejemplo.com/ruta?x=1" becomes "ejemplo punto com barra ruta".
 */
function readableUrl(value: string): string {
  return value
    .replace(/^[a-z][a-z0-9+.-]*:\/\//i, "")
    .replace(/^mailto:/i, "")
    .replace(/[?#].*$/, "")
    .replace(/[.,;:!?]+$/, "")
    .replace(/\./g, " punto ")
    .replace(/\//g, " barra ")
    .replace(/@/g, " arroba ")
    .replace(/-/g, " guion ")
    .replace(/_/g, " guion bajo ")
    .replace(/\s+/g, " ")
    .trim()
}

/** Labels of the `[label]: url` lines, with the address each one points at. */
function collectReferences(text: string): Map<string, string> {
  const references = new Map<string, string>()
  for (const match of text.matchAll(/^[ \t]{0,3}\[([^\]]+)\]:[ \t]*(\S+)/gm)) {
    references.set(match[1], match[2])
  }
  return references
}

/** Link text plus the address it points at, unless the text already says it. */
function labelled(label: string, url: string): string {
  const address = readableUrl(url)
  if (!address || label === url || label.includes(address)) return label
  return `${label}, ${address}`
}

/** One block of Markdown, without its markup and with a period to close it. */
function speakable(block: string, references: Map<string, string>): string {
  let text = block

  // Inline code keeps its content, without the backticks.
  text = text.replace(/`([^`\n]*)`/g, (_, code: string) => ` ${code} `)

  // An escaped character is that character: the backslash is markup.
  text = text.replace(/\\([\\`*_{}[\]()#+\-.!>~|])/g, "$1")

  // Images disappear; links keep their text and then say where they point.
  text = text.replace(/!\[[^\]]*\]\([^)]*\)/g, " ")
  text = text.replace(/!\[[^\]]*\]\[[^\]]*\]/g, " ")
  text = text.replace(/\[([^\]]+)\]\(([^)\s]+)[^)]*\)/g, (_, label: string, url: string) =>
    labelled(label, url),
  )
  text = text.replace(/\[([^\]]+)\]\[([^\]]*)\]/g, (_, label: string, key: string) =>
    labelled(label, references.get(key || label) ?? ""),
  )
  text = text.replace(/\[([^\]^]+)\](?![([])/g, (whole, label: string) => {
    const url = references.get(label)
    return url ? labelled(label, url) : whole
  })

  // Task boxes, headings, quotes and bullets are structure, not words.
  text = text.replace(/^[ \t]{0,3}[-*+][ \t]+\[[ xX]\][ \t]*/, "")
  text = text.replace(/^[ \t]{0,3}(?:>[ \t]*)+/, "")
  text = text.replace(/^[ \t]{0,3}(?:#{1,6}|[-*+]|\d+[.)])[ \t]+/, "")

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

  // Autolinks and bare addresses are read out, separators and all.
  text = text.replace(/<([^\s<>@]+@[^\s<>]+)>/g, (_, mail: string) => ` ${readableUrl(mail)} `)
  text = text.replace(/<(?:https?:\/\/|mailto:)[^>]*>/g, (whole) =>
    ` ${readableUrl(whole.slice(1, -1))} `,
  )
  text = text.replace(/\b(?:https?:\/\/|www\.)[^\s<>()]+/g, (url) => readableUrl(url))
  text = text.replace(/\b[\w.+-]+@[\w-]+(?:\.[\w-]+)+\b/g, (mail) => readableUrl(mail))

  // A tag is markup; its content stays.
  text = text.replace(/<[^>]+>/g, " ")
  text = text.replace(/&(amp|lt|gt|quot|#39|apos|nbsp);/g, (_, name: string) => ENTITIES[name] ?? " ")

  // Square brackets left over are markup, never words.
  text = text.replace(/[[\]]/g, " ")

  // Markup that disappeared leaves spaces where punctuation should touch the word.
  text = text.replace(/[ \t]+([.,;:!?…%])/g, "$1")
  text = text.replace(/\s+/g, " ").trim()

  if (!text) return ""
  return TERMINAL.test(text) ? text : `${text}.`
}

/**
 * Turns an assistant message into something worth reading aloud: prose survives, its
 * Markdown does not, and the words inside inline code survive too, because file names
 * and identifiers are often the point of the sentence.
 */
export function plainText(markdown: string): string {
  const references = collectReferences(markdown)
  let text = markdown

  // Fenced blocks are code, not prose.
  text = text.replace(/```[\s\S]*?```/g, "\n")
  text = text.replace(/~~~[\s\S]*?~~~/g, "\n")
  // Indented blocks are code too, as long as they are not a list continuation.
  text = text.replace(/^(?: {4,}|\t+)(?![ \t]*(?:[-*+]|\d+[.)])[ \t]).*$/gm, "")

  // Reference definitions and footnote bodies are metadata.
  text = text.replace(/^[ \t]{0,3}\[[^\]]+\]:[ \t]*\S+.*$/gm, "")
  text = text.replace(/^[ \t]{0,3}\[\^[^\]]+\]:.*$/gm, "")

  return blocks(readableTables(text))
    .map((block) => speakable(block, references))
    .filter(Boolean)
    .join(" ")
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
