import { Link } from 'react-router-dom'
import { GRADUATION_ETH, SALVO_GLOBAL_CAP, marketCapEth } from '../curve'
import { useNow, useEthPrice } from '../hooks'
import type { Launch } from '../types'
import { countdown, fmtEth, fmtUsd, timeAgo } from '../util'
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
  const ethUsd = useEthPrice()
  const inSalvo = l.phase === 'salvo'
  const mcap = marketCapEth(l.virtualEth, l.virtualTokens)
  const progress = Math.min(100, (l.realEth / GRADUATION_ETH) * 100)

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
            <span className="v">{fmtEth(l.salvoCommitted)}</span>
          </div>
        </>
      ) : (
        <>
          <div className="row">
            <span className="k">market cap</span>
            <span className="v">{ethUsd !== null ? fmtUsd(mcap * ethUsd) : fmtEth(mcap, 1)}</span>
          </div>
          <div className="row">
            <span className="k">volume</span>
            <span className="v">
              {ethUsd !== null ? fmtUsd(l.volumeEth * ethUsd) : fmtEth(l.volumeEth, 2)}
              <span style={{ color: 'var(--dim)' }}> · {l.txns} tx</span>
            </span>
          </div>
          <div className={`meter ${l.phase === 'graduating' ? 'meter-gold' : 'meter-green'}`}>
            <div style={{ width: `${progress}%` }} />
          </div>
          <div className="row">
            <span className="k">{l.holders} holders</span>
            <span className="v green-text">{fmtEth(l.creatorEarned, 3)} → creator</span>
          </div>
        </>
      )}
    </Link>
  )
}
