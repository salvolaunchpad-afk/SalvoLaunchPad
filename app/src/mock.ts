// Mock chain layer: simulates the Salvo contract locally so the full UX is
// previewable before the deployed Robinhood Chain address is wired in.
// Denominations match the contract (ETH). Swap these calls for evmClient
// once the contract is live (see chain/evmClient.ts).
import {
  CREATOR_SHARE, CURVE_SUPPLY, FEE_PCT, GRADUATION_ETH, INITIAL_VIRTUAL_ETH,
  INITIAL_VIRTUAL_TOKENS, SALVO_DURATION_MS, SALVO_GLOBAL_CAP, SALVO_WALLET_CAP,
  spotPrice, tokensOutForEth,
} from './curve'
import type { Launch, Socials } from './types'

let launches: Launch[] = []
const listeners = new Set<() => void>()
let snapshot: Launch[] = []

export interface TickerEvent {
  id: number
  kind: 'buy' | 'sell' | 'salvo' | 'grad'
  text: string
}
let events: TickerEvent[] = []
let eventId = 0
let seeding = true

function wal(): string {
  const hex = '0123456789abcdef'
  const pick = (n: number) => Array.from({ length: n }, () => hex[Math.floor(Math.random() * hex.length)]).join('')
  return `0x${pick(4)}…${pick(4)}`
}

function pushEvent(kind: TickerEvent['kind'], text: string) {
  if (seeding) return
  events = [{ id: ++eventId, kind, text }, ...events].slice(0, 24)
}

export function getEvents(): TickerEvent[] {
  return events
}

function notify() {
  snapshot = launches.map((l) => ({ ...l }))
  listeners.forEach((fn) => fn())
}

export function subscribe(fn: () => void): () => void {
  listeners.add(fn)
  return () => listeners.delete(fn)
}

export function getLaunches(): Launch[] {
  return snapshot
}

function make(partial: Partial<Launch> & { name: string; symbol: string }): Launch {
  const now = Date.now()
  const base: Launch = {
    mint: '0x' + Array.from({ length: 40 }, () => '0123456789abcdef'[Math.floor(Math.random() * 16)]).join(''),
    creator: '0x7a1c…3fPd',
    tileHue: Math.floor(Math.random() * 360),
    createdAt: now,
    phase: 'salvo',
    salvoEndsAt: now + SALVO_DURATION_MS,
    salvoCommitted: 0,
    salvoWallets: 0,
    yourCommit: 0,
    volumeEth: 0,
    txns: 0,
    virtualEth: INITIAL_VIRTUAL_ETH,
    virtualTokens: INITIAL_VIRTUAL_TOKENS,
    realEth: 0,
    realTokens: CURVE_SUPPLY,
    creatorEarned: 0,
    yourBalance: 0,
    priceHistory: [],
    holders: 0,
    ...partial,
  } as Launch
  if (base.priceHistory.length === 0) base.priceHistory = [spotPrice(base.virtualEth, base.virtualTokens)]
  return base
}

function applyBuy(l: Launch, grossEth: number) {
  const fee = grossEth * FEE_PCT
  const net = grossEth - fee
  const out = tokensOutForEth(l.virtualEth, l.virtualTokens, net)
  const bought = Math.min(out, l.realTokens)
  l.virtualEth += net
  l.virtualTokens -= bought
  l.realEth += net
  l.realTokens -= bought
  l.volumeEth += grossEth
  l.txns += 1
  l.creatorEarned += fee * CREATOR_SHARE
  l.priceHistory = [...l.priceHistory.slice(-59), spotPrice(l.virtualEth, l.virtualTokens)]
  if (l.realEth >= GRADUATION_ETH && l.phase !== 'graduating') {
    l.phase = 'graduating'
    pushEvent('grad', `$${l.symbol} is going over the top, ${GRADUATION_ETH} ETH raised`)
  }
  return bought
}

function socialsFor(sym: string): Socials {
  return {
    x: `https://x.com/search?q=%24${sym}`,
    telegram: `https://t.me/s/${sym.toLowerCase()}`,
    website: `https://salvo.fun`,
  }
}

function seed() {
  const now = Date.now()
  launches = [
    make({ name: 'Trench Rat', symbol: 'RAT', salvoEndsAt: now + 87_000, salvoCommitted: 0.32, salvoWallets: 19, holders: 0, socials: socialsFor('RAT') }),
    make({ name: 'Over The Top', symbol: 'CHARGE', salvoEndsAt: now + 41_000, salvoCommitted: 0.74, salvoWallets: 42, holders: 0, socials: { x: 'https://x.com/search?q=%24CHARGE' } }),
    make({ name: 'Mudlark', symbol: 'MUD', phase: 'live', createdAt: now - 32 * 60_000, holders: 143, socials: socialsFor('MUD') }),
    make({ name: 'Iron Rations', symbol: 'RATION', phase: 'live', createdAt: now - 2.4 * 3_600_000, holders: 402, socials: { x: 'https://x.com/search?q=%24RATION', telegram: 'https://t.me/s/ration' } }),
    make({ name: 'Stand To', symbol: 'STANDTO', phase: 'live', createdAt: now - 5.1 * 3_600_000, holders: 611, socials: socialsFor('STANDTO') }),
    make({ name: 'Duckboard', symbol: 'DUCK', phase: 'live', createdAt: now - 9 * 3_600_000, holders: 988, socials: { x: 'https://x.com/search?q=%24DUCK' } }),
    make({ name: 'Creeping Barrage', symbol: 'BARRAGE', phase: 'live', createdAt: now - 14 * 3_600_000, holders: 1843, socials: socialsFor('BARRAGE') }),
  ]
  // Walk the live curves to plausible depths (in ETH).
  const depths = { MUD: 0.35, RATION: 0.9, STANDTO: 1.5, DUCK: 2.1, BARRAGE: 2.75 } as Record<string, number>
  for (const l of launches) {
    const target = depths[l.symbol]
    if (!target) continue
    let step = 0
    while (l.realEth < target && l.phase !== 'graduating') {
      applyBuy(l, Math.min(0.05, target - l.realEth + 0.004))
      if (++step > 400) break
    }
    if (l.realEth < GRADUATION_ETH) l.phase = 'live'
  }
  notify()
}

function tick() {
  const now = Date.now()
  for (const l of launches) {
    if (l.phase === 'salvo') {
      if (now >= l.salvoEndsAt) {
        // Settle: whole batch clears as one buy at one average price.
        if (l.salvoCommitted > 0) applyBuy(l, l.salvoCommitted)
        l.phase = 'live'
        l.holders = l.salvoWallets
        pushEvent('salvo', `$${l.symbol} salvo settled: ${l.salvoWallets} wallets, one price, zero snipes`)
        if (l.yourCommit > 0) {
          const net = l.salvoCommitted * (1 - FEE_PCT)
          const pool = tokensOutForEth(INITIAL_VIRTUAL_ETH, INITIAL_VIRTUAL_TOKENS, net)
          l.yourBalance += (pool * l.yourCommit) / l.salvoCommitted
        }
      } else if (Math.random() < 0.4) {
        const add = Math.min(+(Math.random() * 0.03).toFixed(4), SALVO_GLOBAL_CAP - l.salvoCommitted)
        if (add > 0) {
          l.salvoCommitted = +(l.salvoCommitted + add).toFixed(4)
          l.salvoWallets += 1
          pushEvent('salvo', `${wal()} committed ${add.toFixed(3)} ETH to the $${l.symbol} salvo`)
        }
      }
    } else if (l.phase === 'live' && Math.random() < 0.35) {
      const spent = +(Math.random() * 0.035 + 0.003).toFixed(4)
      applyBuy(l, spent)
      if (Math.random() < 0.5) pushEvent('buy', `${wal()} bought ${spent.toFixed(3)} ETH of $${l.symbol}`)
      if (Math.random() < 0.3) l.holders += 1
    }
  }
  notify()
}

export function commitToSalvo(mint: string, amount: number) {
  const l = launches.find((x) => x.mint === mint)
  if (!l || l.phase !== 'salvo') return
  const capped = Math.min(amount, SALVO_WALLET_CAP - l.yourCommit, SALVO_GLOBAL_CAP - l.salvoCommitted)
  if (capped <= 0) return
  l.yourCommit = +(l.yourCommit + capped).toFixed(4)
  l.salvoCommitted = +(l.salvoCommitted + capped).toFixed(4)
  if (l.yourCommit === capped) l.salvoWallets += 1
  notify()
}

export function buy(mint: string, eth: number) {
  const l = launches.find((x) => x.mint === mint)
  if (!l || l.phase !== 'live') return
  const got = applyBuy(l, eth)
  l.yourBalance += got
  l.holders += l.yourBalance === got ? 1 : 0
  pushEvent('buy', `you bought ${eth.toFixed(3)} ETH of $${l.symbol}`)
  notify()
}

export function sell(mint: string, tokens: number) {
  const l = launches.find((x) => x.mint === mint)
  if (!l || l.phase !== 'live') return
  const amt = Math.min(tokens, l.yourBalance)
  if (amt <= 0) return
  const k = l.virtualEth * l.virtualTokens
  const gross = l.virtualEth - k / (l.virtualTokens + amt)
  l.virtualTokens += amt
  l.virtualEth -= gross
  l.realEth -= gross
  l.realTokens += amt
  l.yourBalance -= amt
  l.volumeEth += gross
  l.txns += 1
  l.creatorEarned += gross * FEE_PCT * CREATOR_SHARE
  l.priceHistory = [...l.priceHistory.slice(-59), spotPrice(l.virtualEth, l.virtualTokens)]
  pushEvent('sell', `you sold ${fmtM(amt)} $${l.symbol}`)
  notify()
}

function fmtM(n: number): string {
  return n >= 1_000_000 ? `${(n / 1_000_000).toFixed(1)}M` : `${(n / 1_000).toFixed(0)}K`
}

export function createLaunch(name: string, symbol: string, image?: string, socials?: Socials): string {
  const l = make({ name, symbol: symbol.toUpperCase(), creator: 'you', image, socials })
  launches = [l, ...launches]
  pushEvent('salvo', `$${l.symbol} just launched: salvo open, everyone fires at once`)
  notify()
  return l.mint
}

seed()
seeding = false
// Backfill the ticker so it isn't empty on first paint.
for (const l of launches) {
  if (l.phase === 'salvo') pushEvent('salvo', `${wal()} committed ${(Math.random() * 0.04 + 0.005).toFixed(3)} ETH to the $${l.symbol} salvo`)
  else if (l.phase === 'graduating') pushEvent('grad', `$${l.symbol} is going over the top, ${GRADUATION_ETH} ETH raised`)
  else pushEvent('buy', `${wal()} bought ${(Math.random() * 0.03 + 0.004).toFixed(3)} ETH of $${l.symbol}`)
}
setInterval(tick, 1000)
