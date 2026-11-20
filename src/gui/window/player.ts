import { fromBase64 } from "../audio/wav"

export interface Player {
  /** Plays one encoded chunk; resolves when it ends, fails or is stopped. */
  play(audio: string, mime: string, deviceId: string): Promise<void>
  stop(): void
  /** Silences the chunk in flight without dropping it, so it can resume. */
  pause(): void
  resume(): void
}

/**
 * Plays audio in the window instead of the main process: `setSinkId` is the only way to
 * pick an output device, and Chromium decodes WAV and MP3 without a helper program.
 */
export function createPlayer(): Player {
  let stopCurrent: (() => void) | undefined
  let mediaInFlight: HTMLAudioElement | undefined

  const play = (audio: string, mime: string, deviceId: string) =>
    new Promise<void>((resolve, reject) => {
      stopCurrent?.()

      const bytes = fromBase64(audio)
      const buffer = new ArrayBuffer(bytes.byteLength)
      new Uint8Array(buffer).set(bytes)

      const url = URL.createObjectURL(new Blob([buffer], { type: mime }))
      const media = new Audio(url)
      let settled = false

      const stop = () => finish()

      const finish = (error?: Error) => {
        if (settled) return
        settled = true
        if (stopCurrent === stop) stopCurrent = undefined
        if (mediaInFlight === media) mediaInFlight = undefined

        media.onended = null
        media.onerror = null
        media.pause()
        media.removeAttribute("src")
        media.load()
        URL.revokeObjectURL(url)

        if (error) reject(error)
        else resolve()
      }

      stopCurrent = stop
      mediaInFlight = media
      media.onended = () => finish()
      media.onerror = () => finish(new Error("The audio could not be played"))

      // A device that disappeared (unplugged headphones) falls back to the default sink.
      void media
        .setSinkId(deviceId)
        .catch(() => {})
        .then(() => media.play())
        .catch((error: unknown) => finish(error instanceof Error ? error : new Error(String(error))))
    })

  return {
    play,
    stop: () => stopCurrent?.(),
    pause: () => mediaInFlight?.pause(),
    resume: () => {
      if (!mediaInFlight) return
      void mediaInFlight.play().catch(() => {})
    },
  }
}
