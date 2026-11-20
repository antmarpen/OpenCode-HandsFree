/** Pure audio helpers: no host APIs, no DOM. */

export function mergeChunks(chunks: readonly Float32Array[]): Float32Array {
  let length = 0
  for (const chunk of chunks) length += chunk.length

  const merged = new Float32Array(length)
  let offset = 0
  for (const chunk of chunks) {
    merged.set(chunk, offset)
    offset += chunk.length
  }
  return merged
}

/** Linear-interpolation resampling; enough for speech, without external dependencies. */
export function resample(input: Float32Array, from: number, to: number): Float32Array {
  const ratio = from / to
  const length = Math.max(1, Math.floor(input.length / ratio))
  const output = new Float32Array(length)

  for (let i = 0; i < length; i++) {
    const position = i * ratio
    const index = Math.floor(position)
    const next = Math.min(index + 1, input.length - 1)
    const weight = position - index
    output[i] = input[index] * (1 - weight) + input[next] * weight
  }

  return output
}

/** Encodes mono float samples as a 16-bit PCM WAV. */
export function encodeWav(samples: Float32Array, sampleRate: number): Uint8Array {
  const buffer = new ArrayBuffer(44 + samples.length * 2)
  const view = new DataView(buffer)

  writeAscii(view, 0, "RIFF")
  view.setUint32(4, 36 + samples.length * 2, true)
  writeAscii(view, 8, "WAVE")
  writeAscii(view, 12, "fmt ")
  view.setUint32(16, 16, true)
  view.setUint16(20, 1, true)
  view.setUint16(22, 1, true)
  view.setUint32(24, sampleRate, true)
  view.setUint32(28, sampleRate * 2, true)
  view.setUint16(32, 2, true)
  view.setUint16(34, 16, true)
  writeAscii(view, 36, "data")
  view.setUint32(40, samples.length * 2, true)

  let offset = 44
  for (let i = 0; i < samples.length; i++) {
    const sample = Math.max(-1, Math.min(1, samples[i]))
    view.setInt16(offset, sample < 0 ? sample * 0x8000 : sample * 0x7fff, true)
    offset += 2
  }

  return new Uint8Array(buffer)
}

export function toBase64(bytes: Uint8Array): string {
  let binary = ""
  const step = 0x2000
  for (let offset = 0; offset < bytes.length; offset += step) {
    binary += String.fromCharCode(...bytes.subarray(offset, offset + step))
  }
  return btoa(binary)
}

export function fromBase64(value: string): Uint8Array {
  const binary = atob(value)
  const bytes = new Uint8Array(binary.length)
  for (let index = 0; index < binary.length; index++) bytes[index] = binary.charCodeAt(index)
  return bytes
}

function writeAscii(view: DataView, offset: number, text: string) {
  for (let index = 0; index < text.length; index++) {
    view.setUint8(offset + index, text.charCodeAt(index))
  }
}
