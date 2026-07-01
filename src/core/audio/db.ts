const MIN_RMS = 1e-10

/** Timebolt UI reads ~8 dB higher than our peak-normalized internal scale for the same cuts. */
export const TIMEBOLT_DISPLAY_DB_OFFSET = 8

/** Linear RMS (0–1) → dBFS (full-scale float PCM). */
export function rmsToDbFs(rms: number): number {
  return 20 * Math.log10(Math.max(rms, MIN_RMS))
}

/** dBFS → linear RMS. */
export function dbFsToRms(dbFs: number): number {
  return Math.pow(10, dbFs / 20)
}

/** Approximate Timebolt "Filter below sound level" readout. */
export function toTimeboltDisplayDb(internalDbFs: number): number {
  return internalDbFs + TIMEBOLT_DISPLAY_DB_OFFSET
}
