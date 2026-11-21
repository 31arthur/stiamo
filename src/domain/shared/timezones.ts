/** The zones people use most here, first in every zone list. */
export const COMMON_ZONES = ['Asia/Kolkata', 'Asia/Qatar', 'Asia/Dubai', 'Asia/Riyadh', 'Asia/Kuwait', 'Asia/Muscat', 'Asia/Singapore', 'Asia/Kathmandu', 'Asia/Colombo', 'Asia/Dhaka', 'Europe/London', 'Europe/Geneva', 'Europe/Paris', 'Africa/Algiers', 'Africa/Cairo', 'America/New_York', 'America/Sao_Paulo', 'Australia/Sydney']

/** Every time zone the browser knows (about 400), or the common ones when it cannot say. */
export function allZones(): string[] {
  try {
    const list = (Intl as unknown as { supportedValuesOf?: (key: string) => string[] }).supportedValuesOf?.('timeZone')
    if (list && list.length > 0) return list
  } catch {
    // fall through
  }
  return COMMON_ZONES
}

/** "Asia/Kolkata" as "Asia / Kolkata (GMT+5:30)", so the right one can be told apart without knowing its name. */
export function zoneLabel(zone: string, at: Date = new Date()): string {
  const name = zone.replace(/_/g, ' ').replace('/', ' / ')
  try {
    const offset = new Intl.DateTimeFormat('en', { timeZone: zone, timeZoneName: 'shortOffset' }).formatToParts(at).find((p) => p.type === 'timeZoneName')?.value
    return offset ? `${name} (${offset})` : name
  } catch {
    return name
  }
}
