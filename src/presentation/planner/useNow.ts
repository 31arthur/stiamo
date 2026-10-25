import { useEffect, useState } from 'react'

const minutesSinceMidnight = () => {
  const now = new Date()
  return now.getHours() * 60 + now.getMinutes() + now.getSeconds() / 60
}

/** Current time of day in minutes, refreshed every `intervalMs`. */
export function useNow(intervalMs = 30_000): number {
  const [now, setNow] = useState(minutesSinceMidnight)
  useEffect(() => {
    const id = setInterval(() => setNow(minutesSinceMidnight()), intervalMs)
    return () => clearInterval(id)
  }, [intervalMs])
  return now
}
