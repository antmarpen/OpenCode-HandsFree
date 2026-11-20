import { spawn } from "node:child_process"

/** Runs a short command and returns its stdout. */
export function capture(file: string, args: readonly string[]): Promise<string> {
  return new Promise((resolve, reject) => {
    const child = spawn(file, [...args], { windowsHide: true })

    let stdout = ""
    let stderr = ""

    child.stdout?.on("data", (chunk) => {
      stdout += String(chunk)
    })
    child.stderr?.on("data", (chunk) => {
      stderr += String(chunk)
    })

    child.once("error", reject)
    child.once("exit", (code) => {
      if (code === 0) {
        resolve(stdout)
        return
      }
      reject(new Error(stderr.trim() || `${file} exited with code ${code}`))
    })
  })
}
