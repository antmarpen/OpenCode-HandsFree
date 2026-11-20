import { createLevelSmoother, rms, rmsToLevel } from "./audio/meter"
import { encodeWav, mergeChunks, resample, toBase64 } from "./audio/wav"

export interface Recording {
  /** Base64-encoded 16 kHz mono 16-bit WAV. */
  audio: string
  seconds: number
  sampleRate: number
  /** Highest absolute sample; 0 means the microphone captured digital silence. */
  peak: number
}

export interface RecordingHandle {
  stop(): Promise<Recording>
  cancel(): void
  /** Keeps the buffered pre-roll and starts accumulating the utterance. */
  begin(): void
  /** Drops the buffer and goes back to the pre-roll, e.g. after cutting playback. */
  reset(): void
  /** Keeps only the last `seconds` of audio and starts accumulating from there. */
  trim(seconds: number): void
}

export interface RecordingOptions {
  /** Empty means the system default input device. */
  readonly deviceId?: string
  /** Receives the smoothed input level, from 0 to 1, while the microphone records. */
  onLevel?(level: number): void
  /**
   * Keep only a short pre-roll until `begin()` is called. Conversation mode listens for
   * minutes and must not hold every second of silence in memory.
   */
  readonly hold?: boolean
}

const TARGET_RATE = 16_000
/** Audio kept while waiting for speech, so the first word is not cut. */
const PRE_ROLL_SECONDS = 1.2

/**
 * Records the microphone in the renderer and returns a 16 kHz mono WAV, which both
 * whisper.cpp and OpenAI-compatible providers accept without an ffmpeg step.
 *
 * The window owns the microphone permission; main only receives the encoded audio.
 */
export async function startRecording(options: RecordingOptions = {}): Promise<RecordingHandle> {
  if (!navigator.mediaDevices?.getUserMedia) throw new Error("getUserMedia is not available")

  const audio: MediaTrackConstraints = {
    channelCount: 1,
    echoCancellation: true,
    noiseSuppression: true,
    autoGainControl: true,
  }
  if (options.deviceId) audio.deviceId = { exact: options.deviceId }

  const stream = await navigator.mediaDevices.getUserMedia({ audio })

  const context = new AudioContext()
  await context.resume()
  const sourceRate = context.sampleRate || 48_000

  const source = context.createMediaStreamSource(stream)
  // About 85 ms per captured buffer: one bar of the meter, slow enough to read.
  const processor = context.createScriptProcessor(4096, 1, 1)
  const mute = context.createGain()
  mute.gain.value = 0

  const chunks: Float32Array[] = []
  const smoother = createLevelSmoother()
  const preRoll = Math.ceil(PRE_ROLL_SECONDS * sourceRate)
  let held = 0
  let holding = options.hold ?? false
  let finished = false

  processor.onaudioprocess = (event) => {
    if (finished) return
    const samples = event.inputBuffer.getChannelData(0)
    chunks.push(new Float32Array(samples))

    if (holding) {
      held += samples.length
      while (held > preRoll && chunks.length > 0) {
        held -= chunks[0].length
        chunks.shift()
      }
    }

    options.onLevel?.(smoother(rmsToLevel(rms(samples))))
  }

  source.connect(processor)
  processor.connect(mute)
  mute.connect(context.destination)

  const teardown = () => {
    finished = true
    processor.onaudioprocess = null
    try {
      source.disconnect()
    } catch {}
    try {
      processor.disconnect()
    } catch {}
    try {
      mute.disconnect()
    } catch {}
    for (const track of stream.getTracks()) track.stop()
    void context.close().catch(() => {})
  }

  return {
    cancel() {
      teardown()
    },
    begin() {
      holding = false
    },
    reset() {
      chunks.length = 0
      held = 0
      holding = true
    },
    trim(seconds) {
      const limit = Math.ceil(seconds * sourceRate)
      let kept = 0
      let index = chunks.length - 1
      while (index >= 0 && kept + chunks[index].length <= limit) {
        kept += chunks[index].length
        index--
      }
      chunks.splice(0, index + 1)
      held = kept
      holding = false
    },
    async stop() {
      teardown()
      const merged = mergeChunks(chunks)
      const samples = sourceRate === TARGET_RATE ? merged : resample(merged, sourceRate, TARGET_RATE)

      let peak = 0
      for (let index = 0; index < samples.length; index++) {
        const value = Math.abs(samples[index])
        if (value > peak) peak = value
      }

      return {
        audio: toBase64(encodeWav(samples, TARGET_RATE)),
        seconds: samples.length / TARGET_RATE,
        sampleRate: TARGET_RATE,
        peak,
      }
    },
  }
}
