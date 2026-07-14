import { Link } from 'react-router-dom'
import { GRADUATION_SOL, SALVO_GLOBAL_CAP, marketCapSol } from '../curve'
import { useNow, useSolPrice } from '../hooks'
import type { Launch } from '../types'
import { countdown, fmtSol, fmtUsd, timeAgo } from '../util'
import SocialRow from './SocialRow'

export function Tile({ l }: { l: Launch }) {
  if (l.image) return <img className="tile tile-img" src={l.image} alt={l.symbol} />
  return (
    <div className="tile" style={{ background: `hsl(${l.tileHue} 70% 62%)` }}>
      {l.symbol.slice(0, 4)}
    </div>
  )
}

export function PhasePill({ phase }: { phase: Launch['phase'] }) {
  if (phase === 'salvo') return <span className="pill pill-salvo">salvo</span>
  if (phase === 'live') return <span className="pill pill-live">live</span>
  return <span className="pill pill-grad">graduating</span>
}

export default function TokenCard({ l }: { l: Launch }) {
  useNow()
  const solUsd = useSolPrice()
  const inSalvo = l.phase === 'salvo'
  const mcap = marketCapSol(l.virtualSol, l.virtualTokens)
  const progress = Math.min(100, (l.realSol / GRADUATION_SOL) * 100)

  return (
    <Link to={`/t/${l.mint}`} className={`card${inSalvo ? ' card-salvo' : ''}`}>
      <div className="card-top">
        <Tile l={l} />
        <div style={{ minWidth: 0 }}>
          <div className="card-name">{l.name}</div>
          <div className="card-sym">
            ${l.symbol}
            <SocialRow socials={l.socials} size={18} />
          </div>
        </div>
        <span className="card-age">{timeAgo(l.createdAt)}</span>
      </div>

      {inSalvo ? (
        <>
          <div className="row">
            <span className="k">window closes</span>
            <span className="countdown">{countdown(l.salvoEndsAt)}</span>
          </div>
          <div className="meter meter-accent">
            <div style={{ width: `${Math.min(100, (l.salvoCommitted / SALVO_GLOBAL_CAP) * 100)}%` }} />
          </div>
          <div className="row">
            <span className="k">{l.salvoWallets} wallets in</span>
            <span className="v">{fmtSol(l.salvoCommitted)}</span>
          </div>
        </>
      ) : (
        <>
          <div className="row">
            <span className="k">market cap</span>
            <span className="v">{solUsd !== null ? fmtUsd(mcap * solUsd) : fmtSol(mcap, 0)}</span>
          </div>
          <div className="row">
            <span className="k">volume</span>
            <span className="v">
              {solUsd !== null ? fmtUsd(l.volumeSol * solUsd) : fmtSol(l.volumeSol, 1)}
              <span style={{ color: 'var(--dim)' }}> · {l.txns} tx</span>
            </span>
          </div>
          <div className={`meter ${l.phase === 'graduating' ? 'meter-gold' : 'meter-green'}`}>
            <div style={{ width: `${progress}%` }} />
          </div>
          <div className="row">
            <span className="k">{l.holders} holders · {l.totalStakedPct}% staked</span>
            <span className="v green-text">{fmtSol(l.lifetimeHolderFees, 2)} → holders</span>
          </div>
        </>
      )}
    </Link>
  )
}
