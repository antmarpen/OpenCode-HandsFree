import type { SearchOption } from "../components/search-select"

async function listDevices(kind: MediaDeviceKind, prefix: string): Promise<SearchOption[]> {
  if (!navigator.mediaDevices?.enumerateDevices) return []

  const devices = await navigator.mediaDevices.enumerateDevices()
  return devices
    .filter((device) => device.kind === kind && device.deviceId)
    .map((device, index) => ({
      value: device.deviceId,
      label: device.label || `${prefix} ${index + 1}`,
    }))
}

/** Audio input devices the browser can see. Labels need a previous mic permission. */
export function listInputDevices(prefix: string): Promise<SearchOption[]> {
  return listDevices("audioinput", prefix)
}

/** Audio output devices the browser can see; playback picks one with `setSinkId`. */
export function listOutputDevices(prefix: string): Promise<SearchOption[]> {
  return listDevices("audiooutput", prefix)
}
