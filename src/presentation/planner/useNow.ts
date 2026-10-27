import { useEffect, useState } from 'react'

const minutesSinceMidnight = () => {
  const now = new Date()
  return now.getHours() * 60 + now.getMinutes() + now.getSeconds() / 60
}

/** Current time of day in minutes, refreshed every `intervalMs`. */
export function useNow(intervalMs = 30_000): number {
  const [now, setNow] = useState(minutesSinceMidnight)
  useEffect(() => {
    const tick = () => setNow(minutesSinceMidnight())
    const id = setInterval(tick, intervalMs)
    // Timers pause while a laptop sleeps or a tab is in the background; catch up on return.
    document.addEventListener('visibilitychange', tick)
    window.addEventListener('focus', tick)
    return () => {
      clearInterval(id)
      document.removeEventListener('visibilitychange', tick)
      window.removeEventListener('focus', tick)
    }
  }, [intervalMs])
  return now
}
