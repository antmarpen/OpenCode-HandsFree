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

/** A table row as a sentence: its cells, separated by commas. */
function readableTables(text: string): string {
  const separator = /^\s*\|?\s*:?-{3,}:?\s*(\|\s*:?-{3,}:?\s*)+\|?\s*$/

  return text
    .split("\n")
    .filter((line) => !separator.test(line))
    .map((line) => {
      if (!/^\s*\|.*\|\s*$/.test(line)) return line

      const cells = line
        .trim()
        .replace(/^\|/, "")
        .replace(/\|$/, "")
        .split("|")
        .map((cell) => cell.trim())
        .filter(Boolean)

      return `${cells.join(", ")};`
    })
    .join("\n")
}

/** Speaking a URL is noise; keep only the punctuation that followed it. */
function dropUrl(url: string): string {
  return /[.,;:!?]+$/.exec(url)?.[0] ?? ""
}

/**
 * Turns an assistant message into something worth reading aloud: prose survives, its
 * Markdown does not, and the words inside inline code survive too, because file names
 * and identifiers are often the point of the sentence.
 */
export function plainText(markdown: string): string {
  let text = markdown

  // Fenced blocks are code, not prose.
  text = text.replace(/```[\s\S]*?```/g, " ")
  text = text.replace(/~~~[\s\S]*?~~~/g, " ")

  // Reference definitions and footnotes are metadata.
  text = text.replace(/^\s*\[[^\]]+\]:\s*\S+.*$/gm, " ")

  // Inline code keeps its content, without the backticks.
  text = text.replace(/`([^`\n]*)`/g, (_, code: string) => ` ${code} `)

  // Images disappear; links keep their text, with or without a reference.
  text = text.replace(/!\[[^\]]*\]\([^)]*\)/g, " ")
  text = text.replace(/!\[[^\]]*\]\[[^\]]*\]/g, " ")
  text = text.replace(/\[([^\]]+)\]\([^)]*\)/g, "$1")
  text = text.replace(/\[([^\]]+)\]\[[^\]]*\]/g, "$1")

  text = readableTables(text)

  // Rules, task boxes, headings, quotes and bullets are structure, not words.
  text = text.replace(/^\s*([-*_])(\s*\1){2,}\s*$/gm, " ")
  text = text.replace(/^\s*[-*+]\s+\[[ xX]\]\s*/gm, "")
  text = text.replace(/^[ \t]{0,3}(#{1,6}|>|[-*+]|\d+[.)])\s+/gm, "")

  // Formulas are not prose.
  text = text.replace(/\$\$[\s\S]*?\$\$/g, " ")
  text = text.replace(/\$[^\s$]+\$/g, " ")

  // Emphasis markers go, their text stays. Underscores inside words are identifiers.
  text = text.replace(/~~([^~]+)~~/g, "$1")
  text = text.replace(/\*\*([^*]+)\*\*/g, "$1")
  text = text.replace(/__([^_]+)__/g, "$1")
  text = text.replace(/\*([^*\n]+)\*/g, "$1")
  text = text.replace(/(?<![\w])_([^_\n]+)_(?![\w])/g, "$1")

  // Bare URLs are noise when spoken.
  text = text.replace(/(?:https?:\/\/|www\.)[^\s<>()]+/g, (url) => dropUrl(url))

  // A tag is markup; its content stays.
  text = text.replace(/<[^>]+>/g, " ")
  text = text.replace(/&(amp|lt|gt|quot|#39|apos|nbsp);/g, (_, name: string) => ENTITIES[name] ?? " ")

  // Markup that disappeared leaves spaces where punctuation should touch the word.
  text = text.replace(/\s+([.,;:!?…%])/g, "$1")
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
