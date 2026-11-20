/** Lowest amplitude shown on the meter: about -54 dBFS, below most microphone noise. */
const FLOOR = 0.002
/** Highest amplitude: about -12 dBFS, loud speech close to the microphone. */
const CEILING = 0.25

/** Levels kept as history; the wave draws them all, oldest on the left. */
export const METER_BARS = 64

/** Height of the wave image, in SVG units. Bars grow from its middle in both directions. */
const WAVE_HEIGHT = 32
/** Shortest bar, so silence still draws a thin centre line instead of nothing. */
const WAVE_STUB = 0.5
/** Bar thickness, in SVG units; the rest of each slot stays empty. */
const WAVE_BAR = 0.55

/** Root-mean-square amplitude of one buffer of samples. */
export function rms(samples: Float32Array): number {
  let sum = 0
  for (let index = 0; index < samples.length; index++) sum += samples[index] * samples[index]
  return samples.length === 0 ? 0 : Math.sqrt(sum / samples.length)
}

/** Places an amplitude on a logarithmic 0..1 meter, so quiet speech still moves it. */
export function rmsToLevel(amplitude: number): number {
  if (!(amplitude > FLOOR)) return 0
  if (amplitude >= CEILING) return 1
  return Math.log(amplitude / FLOOR) / Math.log(CEILING / FLOOR)
}

/** Rises on the first loud buffer and falls back gradually, like a physical meter. */
export function createLevelSmoother(attack = 0.6, release = 0.2): (level: number) => number {
  let current = 0

  return (level) => {
    current += (level - current) * (level > current ? attack : release)
    return current
  }
}

/** A strip of silence, for the moment no audio has been captured yet. */
export function silentMeter(): readonly number[] {
  return Array.from({ length: METER_BARS }, () => 0)
}

/**
 * Draws the most recent levels as a mirrored bar waveform and returns it as a CSS
 * mask. Every bar grows the same amount above and below the centre line, which is what
 * makes the strip read as an audio wave instead of a bar chart standing on a baseline.
 *
 * The host only lets a composer pill show an icon and a text label, so the wave is
 * painted by CSS inside the label and this SVG is the shape of that paint.
 */
export function waveMask(levels: readonly number[], bars = METER_BARS): string {
  const middle = WAVE_HEIGHT / 2
  const recent = levels.slice(-bars)
  let path = ""

  recent.forEach((level, index) => {
    const half = WAVE_STUB + Math.min(1, Math.max(0, level)) * (middle - WAVE_STUB)
    const x = (index + 0.5 - WAVE_BAR / 2).toFixed(2)
    path += `M${x} ${(middle - half).toFixed(1)}v${(half * 2).toFixed(1)}`
  })

  const svg =
    `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${recent.length} ${WAVE_HEIGHT}" ` +
    `preserveAspectRatio="none" fill="none" stroke="#fff" stroke-width="${WAVE_BAR}">` +
    `<path d="${path}"/></svg>`

  return `url("data:image/svg+xml,${encodeURIComponent(svg)}")`
}
