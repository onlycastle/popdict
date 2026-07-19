export function timezoneFingerprint(
  date = new Date(),
  timezone = Intl.DateTimeFormat().resolvedOptions().timeZone,
  offsetMinutes = date.getTimezoneOffset()
): string {
  return `${timezone || 'unknown'}|${offsetMinutes}`
}
