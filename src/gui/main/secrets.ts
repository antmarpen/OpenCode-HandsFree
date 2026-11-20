import { safeStorage } from "electron"
import { Schema } from "effect"
import type { MainContext } from "@opencode/plugin/gui/main"
import type { VoiceSlot } from "../contract"
import type { Log } from "./log"

const ENCRYPTED = "enc:"
const PLAIN = "plain:"

export interface Secrets {
  read(slot: VoiceSlot): string
  write(slot: VoiceSlot, value: string): void
  has(slot: VoiceSlot): boolean
}

/**
 * API keys live in the plugin namespace as ciphertext from `safeStorage` (DPAPI on
 * Windows). When no keychain is available the value is stored as plain text and the
 * desktop log records it.
 */
export function createSecrets(ctx: MainContext, log: Log): Secrets {
  const stores = {
    transcribe: ctx.storage.store("secret.transcribe", { schema: Schema.String, initial: "" }),
    speak: ctx.storage.store("secret.speak", { schema: Schema.String, initial: "" }),
  }

  const encryptionAvailable = () => {
    try {
      return safeStorage.isEncryptionAvailable()
    } catch {
      return false
    }
  }

  const read = (slot: VoiceSlot): string => {
    const raw = stores[slot].value
    if (!raw) return ""

    if (!raw.startsWith(ENCRYPTED)) {
      return raw.startsWith(PLAIN) ? raw.slice(PLAIN.length) : raw
    }

    try {
      return safeStorage.decryptString(Buffer.from(raw.slice(ENCRYPTED.length), "base64"))
    } catch (error) {
      log.write("warn", "voice: cannot decrypt the API key", { slot, error: String(error) })
      return ""
    }
  }

  const write = (slot: VoiceSlot, value: string) => {
    if (!value) {
      stores[slot].set("")
      return
    }

    if (!encryptionAvailable()) {
      log.write("warn", "voice: safeStorage is unavailable, storing the API key as plain text")
      stores[slot].set(`${PLAIN}${value}`)
      return
    }

    stores[slot].set(`${ENCRYPTED}${safeStorage.encryptString(value).toString("base64")}`)
  }

  return { read, write, has: (slot) => read(slot).length > 0 }
}
