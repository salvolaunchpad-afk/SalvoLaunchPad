import { useEffect, useState, useSyncExternalStore } from 'react'
import { getLaunches, subscribe } from './mock'
import { getSolPrice, subscribeSolPrice } from './solPrice'
import type { Launch } from './types'

/** Live SOL/USD price, or null before the first fetch resolves. */
export function useSolPrice(): number | null {
  return useSyncExternalStore(subscribeSolPrice, getSolPrice)
}

export function useLaunches(): Launch[] {
  return useSyncExternalStore(subscribe, getLaunches)
}

export function useLaunch(mint: string | undefined): Launch | undefined {
  const launches = useLaunches()
  return launches.find((l) => l.mint === mint)
}

/** Re-render every 250ms — keeps countdowns smooth. */
export function useNow(): number {
  const [now, setNow] = useState(Date.now())
  useEffect(() => {
    const id = setInterval(() => setNow(Date.now()), 250)
    return () => clearInterval(id)
  }, [])
  return now
}
