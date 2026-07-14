// Live SOL/USD price store. Polls CoinGecko (Coinbase as fallback) every
// 60s, caches the last known price in localStorage so USD values paint
// instantly on reload.
const CACHE_KEY = 'salvo_sol_usd'
const POLL_MS = 60_000

let price: number | null = null
const listeners = new Set<() => void>()

try {
  const cached = localStorage.getItem(CACHE_KEY)
  if (cached) price = parseFloat(cached) || null
} catch { /* private mode etc. */ }

export function getSolPrice(): number | null {
  return price
}

export function subscribeSolPrice(fn: () => void): () => void {
  listeners.add(fn)
  return () => listeners.delete(fn)
}

function set(next: number) {
  if (!next || !isFinite(next)) return
  price = next
  try { localStorage.setItem(CACHE_KEY, String(next)) } catch { /* ignore */ }
  listeners.forEach((fn) => fn())
}

async function fetchCoinGecko(): Promise<number> {
  const r = await fetch('https://api.coingecko.com/api/v3/simple/price?ids=solana&vs_currencies=usd')
  if (!r.ok) throw new Error(`coingecko ${r.status}`)
  const j = await r.json()
  return j.solana.usd
}

async function fetchCoinbase(): Promise<number> {
  const r = await fetch('https://api.coinbase.com/v2/prices/SOL-USD/spot')
  if (!r.ok) throw new Error(`coinbase ${r.status}`)
  const j = await r.json()
  return parseFloat(j.data.amount)
}

async function poll() {
  try {
    set(await fetchCoinGecko())
  } catch {
    try {
      set(await fetchCoinbase())
    } catch {
      // Keep the last known price; retry next tick.
    }
  }
}

poll()
setInterval(poll, POLL_MS)
