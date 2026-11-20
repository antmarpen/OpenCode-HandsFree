/** Turns an assistant message into something worth reading aloud. */
export function plainText(markdown: string): string {
  let text = markdown.replace(/```[\s\S]*?```/g, "  ")
  text = text.replace(/`[^`\n]*`/g, " ")
  text = text.replace(/!\[[^\]]*\]\([^)]*\)/g, " ")
  text = text.replace(/\[([^\]]+)\]\([^)]*\)/g, "$1")
  text = text.replace(/<[^>]+>/g, " ")
  text = text.replace(/^[ \t]{0,3}(#{1,6}|>|[-*+]|\d+[.)])\s+/gm, "")
  text = text.replace(/[*_~]{1,3}/g, "")
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
