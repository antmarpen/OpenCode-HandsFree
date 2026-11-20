import { spawn, type ChildProcess } from "node:child_process"

export interface RunOptions {
  /** Written to the child's stdin, which is opened as a pipe when set. */
  readonly stdin?: string
}

export interface Runner {
  /** Resolves true when the command exited with code 0, false when it was stopped. */
  run(file: string, args: readonly string[], options?: RunOptions): Promise<boolean>
  stop(): boolean
}

/**
 * Runs one audio command at a time. Starting a new command stops the previous one,
 * which gives dictation barge-in over a reply that is still being read.
 */
export function createRunner(): Runner {
  let current: ChildProcess | undefined

  return {
    run(file, args, options) {
      return new Promise((resolve, reject) => {
        if (current) {
          const previous = current
          current = undefined
          try {
            previous.kill()
          } catch {}
        }

        const child = spawn(file, [...args], {
          windowsHide: true,
          stdio: options?.stdin === undefined ? ["ignore", "ignore", "pipe"] : ["pipe", "ignore", "pipe"],
        })
        current = child

        let stderr = ""
        let settled = false

        const done = (code: number | null) => {
          if (settled) return
          settled = true
          if (current === child) current = undefined

          if (child.killed) {
            resolve(false)
            return
          }
          if (code === 0) {
            resolve(true)
            return
          }
          reject(new Error(stderr.trim() || `${file} exited with code ${code ?? "unknown"}`))
        }

        child.stderr?.on("data", (chunk) => {
          stderr += String(chunk)
        })

        child.once("error", (error) => {
          if (settled) return
          settled = true
          if (current === child) current = undefined
          reject(error)
        })
        child.once("exit", done)

        if (options?.stdin !== undefined) child.stdin?.end(options.stdin)
      })
    },

    stop() {
      if (!current) return false
      const child = current
      current = undefined
      try {
        child.kill()
      } catch {}
      return true
    },
  }
}
