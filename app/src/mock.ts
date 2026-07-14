// Mock chain layer — simulates the Salvo program locally so the full UX is
// previewable before the wallet adapter + RPC wiring lands.
import {
  CURVE_SUPPLY, FEE_PCT, GRADUATION_SOL, HOLDER_SHARE, INITIAL_VIRTUAL_SOL,
  INITIAL_VIRTUAL_TOKENS, SALVO_DURATION_MS, spotPrice, tokensOutForSol,
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
  const c = 'ABCDEFGHJKLMNPQRSTUVWXYZabcdefghjkmnpqrstuvwxyz123456789'
  const pick = (n: number) => Array.from({ length: n }, () => c[Math.floor(Math.random() * c.length)]).join('')
  return `${pick(4)}…${pick(4)}`
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
    mint: Math.random().toString(36).slice(2, 10) + Math.random().toString(36).slice(2, 6),
    creator: '7xKq…3fPd',
    tileHue: Math.floor(Math.random() * 360),
    createdAt: now,
    phase: 'salvo',
    salvoEndsAt: now + SALVO_DURATION_MS,
    salvoCommitted: 0,
    salvoWallets: 0,
    yourCommit: 0,
    volumeSol: 0,
    txns: 0,
    virtualSol: INITIAL_VIRTUAL_SOL,
    virtualTokens: INITIAL_VIRTUAL_TOKENS,
    realSol: 0,
    realTokens: CURVE_SUPPLY,
    lifetimeHolderFees: 0,
    creatorEarned: 0,
    totalStakedPct: 0,
    yourBalance: 0,
    yourStaked: 0,
    yourClaimable: 0,
    priceHistory: [],
    holders: 0,
    ...partial,
  } as Launch
  if (base.priceHistory.length === 0) base.priceHistory = [spotPrice(base.virtualSol, base.virtualTokens)]
  return base
}

function applyBuy(l: Launch, grossSol: number) {
  const fee = grossSol * FEE_PCT
  const net = grossSol - fee
  const out = tokensOutForSol(l.virtualSol, l.virtualTokens, net)
  const bought = Math.min(out, l.realTokens)
  l.virtualSol += net
  l.virtualTokens -= bought
  l.realSol += net
  l.realTokens -= bought
  l.volumeSol += grossSol
  l.txns += 1
  l.lifetimeHolderFees += fee * HOLDER_SHARE
  l.creatorEarned += fee * 0.25
  l.priceHistory = [...l.priceHistory.slice(-59), spotPrice(l.virtualSol, l.virtualTokens)]
  if (l.realSol >= GRADUATION_SOL && l.phase !== 'graduating') {
    l.phase = 'graduating'
    pushEvent('grad', `$${l.symbol} is going over the top, 85 SOL raised`)
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
    make({ name: 'Trench Rat', symbol: 'RAT', salvoEndsAt: now + 87_000, salvoCommitted: 6.4, salvoWallets: 19, holders: 0, socials: socialsFor('RAT') }),
    make({ name: 'Over The Top', symbol: 'CHARGE', salvoEndsAt: now + 41_000, salvoCommitted: 14.8, salvoWallets: 42, holders: 0, socials: { x: 'https://x.com/search?q=%24CHARGE' } }),
    make({ name: 'Mudlark', symbol: 'MUD', phase: 'live', createdAt: now - 32 * 60_000, holders: 143, totalStakedPct: 31, socials: socialsFor('MUD') }),
    make({ name: 'Iron Rations', symbol: 'RATION', phase: 'live', createdAt: now - 2.4 * 3_600_000, holders: 402, totalStakedPct: 44, socials: { x: 'https://x.com/search?q=%24RATION', telegram: 'https://t.me/s/ration' } }),
    make({ name: 'Stand To', symbol: 'STANDTO', phase: 'live', createdAt: now - 5.1 * 3_600_000, holders: 611, totalStakedPct: 52, socials: socialsFor('STANDTO') }),
    make({ name: 'Duckboard', symbol: 'DUCK', phase: 'live', createdAt: now - 9 * 3_600_000, holders: 988, totalStakedPct: 58, socials: { x: 'https://x.com/search?q=%24DUCK' } }),
    make({ name: 'Creeping Barrage', symbol: 'BARRAGE', phase: 'live', createdAt: now - 14 * 3_600_000, holders: 1843, totalStakedPct: 61, socials: socialsFor('BARRAGE') }),
  ]
  // Walk the live curves to plausible depths.
  const depths = { MUD: 9, RATION: 26, STANDTO: 41, DUCK: 58, BARRAGE: 86 } as Record<string, number>
  for (const l of launches) {
    const target = depths[l.symbol]
    if (!target) continue
    let step = 0
    while (l.realSol < target && l.phase !== 'graduating') {
      applyBuy(l, Math.min(1.5, target - l.realSol + 0.02))
      if (++step > 200) break
    }
    if (l.realSol < GRADUATION_SOL) l.phase = 'live'
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
          const pool = tokensOutForSol(INITIAL_VIRTUAL_SOL, INITIAL_VIRTUAL_TOKENS, net)
          l.yourBalance += (pool * l.yourCommit) / l.salvoCommitted
        }
      } else if (Math.random() < 0.4) {
        const add = Math.min(+(Math.random() * 0.8).toFixed(2), 40 - l.salvoCommitted)
        if (add > 0) {
          l.salvoCommitted = +(l.salvoCommitted + add).toFixed(2)
          l.salvoWallets += 1
          pushEvent('salvo', `${wal()} committed ${add.toFixed(2)} SOL to the $${l.symbol} salvo`)
        }
      }
    } else if (l.phase === 'live' && Math.random() < 0.35) {
      const spent = +(Math.random() * 0.6 + 0.05).toFixed(3)
      applyBuy(l, spent)
      if (Math.random() < 0.5) pushEvent('buy', `${wal()} bought ${spent.toFixed(2)} SOL of $${l.symbol}`)
      if (Math.random() < 0.3) l.holders += 1
      // Stakers accrue their cut of the fees just simulated.
      if (l.yourStaked > 0 && l.totalStakedPct > 0) {
        const stakedTokens = (l.totalStakedPct / 100) * CURVE_SUPPLY
        l.yourClaimable += (l.lifetimeHolderFees * 0.002 * l.yourStaked) / stakedTokens
      }
    }
  }
  notify()
}

export function commitToSalvo(mint: string, amount: number) {
  const l = launches.find((x) => x.mint === mint)
  if (!l || l.phase !== 'salvo') return
  const capped = Math.min(amount, 2 - l.yourCommit, 40 - l.salvoCommitted)
  if (capped <= 0) return
  l.yourCommit = +(l.yourCommit + capped).toFixed(2)
  l.salvoCommitted = +(l.salvoCommitted + capped).toFixed(2)
  if (l.yourCommit === capped) l.salvoWallets += 1
  notify()
}

export function buy(mint: string, sol: number) {
  const l = launches.find((x) => x.mint === mint)
  if (!l || l.phase !== 'live') return
  const got = applyBuy(l, sol)
  l.yourBalance += got
  l.holders += l.yourBalance === got ? 1 : 0
  pushEvent('buy', `you bought ${sol.toFixed(2)} SOL of $${l.symbol}`)
  notify()
}

export function sell(mint: string, tokens: number) {
  const l = launches.find((x) => x.mint === mint)
  if (!l || l.phase !== 'live') return
  const amt = Math.min(tokens, l.yourBalance)
  if (amt <= 0) return
  const k = l.virtualSol * l.virtualTokens
  const gross = l.virtualSol - k / (l.virtualTokens + amt)
  l.virtualTokens += amt
  l.virtualSol -= gross
  l.realSol -= gross
  l.realTokens += amt
  l.yourBalance -= amt
  l.volumeSol += gross
  l.txns += 1
  l.lifetimeHolderFees += gross * FEE_PCT * HOLDER_SHARE
  l.creatorEarned += gross * FEE_PCT * 0.25
  l.priceHistory = [...l.priceHistory.slice(-59), spotPrice(l.virtualSol, l.virtualTokens)]
  pushEvent('sell', `you sold ${fmtM(amt)} $${l.symbol}`)
  notify()
}

function fmtM(n: number): string {
  return n >= 1_000_000 ? `${(n / 1_000_000).toFixed(1)}M` : `${(n / 1_000).toFixed(0)}K`
}

export function stake(mint: string, tokens: number) {
  const l = launches.find((x) => x.mint === mint)
  if (!l) return
  const amt = Math.min(tokens, l.yourBalance)
  if (amt <= 0) return
  l.yourBalance -= amt
  l.yourStaked += amt
  notify()
}

export function unstake(mint: string, tokens: number) {
  const l = launches.find((x) => x.mint === mint)
  if (!l) return
  const amt = Math.min(tokens, l.yourStaked)
  if (amt <= 0) return
  l.yourStaked -= amt
  l.yourBalance += amt
  notify()
}

export function claimRewards(mint: string) {
  const l = launches.find((x) => x.mint === mint)
  if (!l) return
  l.yourClaimable = 0
  notify()
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
  if (l.phase === 'salvo') pushEvent('salvo', `${wal()} committed ${(Math.random() * 1.5 + 0.2).toFixed(2)} SOL to the $${l.symbol} salvo`)
  else if (l.phase === 'graduating') pushEvent('grad', `$${l.symbol} is going over the top, 85 SOL raised`)
  else pushEvent('buy', `${wal()} bought ${(Math.random() * 0.8 + 0.1).toFixed(2)} SOL of $${l.symbol}`)
}
setInterval(tick, 1000)
