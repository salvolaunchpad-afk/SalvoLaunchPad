import { useState } from 'react'
import { Link, useParams } from 'react-router-dom'
import SocialRow from '../components/SocialRow'
import Spark from '../components/Spark'
import { PhasePill, Tile } from '../components/TokenCard'
import {
  FEE_PCT, GRADUATION_ETH, SALVO_GLOBAL_CAP, SALVO_WALLET_CAP,
  marketCapEth, spotPrice, tokensOutForEth, ethOutForTokens,
} from '../curve'
import { useLaunch, useNow, useEthPrice } from '../hooks'
import { buy, claimRewards, commitToSalvo, sell, stake, unstake } from '../mock'
import { countdown, fmtNum, fmtPrice, fmtEth, fmtUsd, timeAgo } from '../util'

export default function TokenPage() {
  const { mint } = useParams()
  const l = useLaunch(mint)
  useNow()
  if (!l) return <p className="note">Token not found. <Link to="/" className="accent-text">Back to the board</Link></p>

  return (
    <main>
      <Link to="/" className="back-link">← back to the board</Link>
      <div className="card-top" style={{ marginBottom: 16 }}>
        <Tile l={l} />
        <div>
          <div style={{ display: 'flex', gap: 10, alignItems: 'center' }}>
            <span style={{ fontSize: 18, fontWeight: 800 }}>{l.name}</span>
            <span className="card-sym" style={{ fontSize: 14 }}>${l.symbol}</span>
            <PhasePill phase={l.phase} />
            <SocialRow socials={l.socials} />
          </div>
          <div className="note">created {timeAgo(l.createdAt)} by {l.creator}</div>
        </div>
      </div>

      <div className="token-layout">
        <div>
          {l.phase === 'salvo' ? <SalvoInfo l={l} /> : <CurveInfo l={l} />}
          <FeePanel l={l} />
        </div>
        <div>
          {l.phase === 'salvo' ? <SalvoPanel l={l} /> : <TradePanel l={l} />}
          {l.phase !== 'salvo' && <StakePanel l={l} />}
        </div>
      </div>
    </main>
  )
}

type L = NonNullable<ReturnType<typeof useLaunch>>

function SalvoInfo({ l }: { l: L }) {
  const net = l.salvoCommitted * (1 - FEE_PCT)
  const pool = net > 0 ? tokensOutForEth(l.virtualEth, l.virtualTokens, net) : 0
  const clearing = pool > 0 ? net / pool : spotPrice(l.virtualEth, l.virtualTokens)
  return (
    <div className="panel">
      <div className="panel-title">Salvo window: batch auction</div>
      <div className="big-countdown">{countdown(l.salvoEndsAt)}</div>
      <p className="note" style={{ margin: '6px 0 14px' }}>
        Every commit in this window clears at the <span className="accent-text">same average price</span> when
        it closes. Order doesn't matter. Speed doesn't matter. Bots have nothing to win here.
      </p>
      <div className="meter meter-accent" style={{ height: 10 }}>
        <div style={{ width: `${Math.min(100, (l.salvoCommitted / SALVO_GLOBAL_CAP) * 100)}%` }} />
      </div>
      <div className="stat-grid" style={{ marginTop: 12 }}>
        <div className="stat"><div className="k">committed</div><div className="v">{fmtEth(l.salvoCommitted)}</div></div>
        <div className="stat"><div className="k">wallets in</div><div className="v">{l.salvoWallets}</div></div>
        <div className="stat"><div className="k">projected clearing price</div><div className="v">{fmtPrice(clearing)}</div></div>
        <div className="stat"><div className="k">window cap</div><div className="v">{SALVO_GLOBAL_CAP} ETH</div></div>
      </div>
    </div>
  )
}

function CurveInfo({ l }: { l: L }) {
  const ethUsd = useEthPrice()
  const price = spotPrice(l.virtualEth, l.virtualTokens)
  const mcap = marketCapEth(l.virtualEth, l.virtualTokens)
  const progress = Math.min(100, (l.realEth / GRADUATION_ETH) * 100)
  return (
    <div className="panel">
      <div className="panel-title">Curve</div>
      <Spark data={l.priceHistory} color={l.phase === 'graduating' ? 'var(--gold)' : 'var(--green)'} />
      <div className="stat-grid">
        <div className="stat">
          <div className="k">price</div>
          <div className="v">{ethUsd !== null ? fmtUsd(price * ethUsd) : `${fmtPrice(price)} ETH`}</div>
        </div>
        <div className="stat">
          <div className="k">market cap</div>
          <div className="v">{ethUsd !== null ? fmtUsd(mcap * ethUsd) : fmtEth(mcap, 1)}</div>
        </div>
        <div className="stat">
          <div className="k">volume</div>
          <div className="v">{ethUsd !== null ? fmtUsd(l.volumeEth * ethUsd) : fmtEth(l.volumeEth, 2)}</div>
        </div>
        <div className="stat"><div className="k">txns</div><div className="v">{l.txns}</div></div>
        <div className="stat"><div className="k">in curve</div><div className="v">{fmtEth(l.realEth)}</div></div>
        <div className="stat"><div className="k">holders</div><div className="v">{l.holders}</div></div>
      </div>
      <div className={`meter ${l.phase === 'graduating' ? 'meter-gold' : 'meter-green'}`} style={{ marginTop: 14 }}>
        <div style={{ width: `${progress}%` }} />
      </div>
      <div className="row">
        <span className="k">graduation progress</span>
        <span className="v">{progress.toFixed(1)}% of {GRADUATION_ETH} ETH</span>
      </div>
      {l.phase === 'graduating' && (
        <div className="note-box gold-text">
          Curve complete. Liquidity is moving to the pool, and staking keeps earning.
        </div>
      )}
    </div>
  )
}

function FeePanel({ l }: { l: L }) {
  return (
    <div className="panel">
      <div className="panel-title">Where every 1% fee goes</div>
      <div className="fee-split">
        <div style={{ width: '50%', background: '#0b2416', color: 'var(--green)' }}>50% staked holders</div>
        <div style={{ width: '25%', background: '#2a1608', color: 'var(--accent)' }}>25% creator</div>
        <div style={{ width: '25%', background: '#171b24', color: 'var(--muted)' }}>25% protocol</div>
      </div>
      <div className="stat-grid">
        <div className="stat"><div className="k">paid to holders so far</div><div className="v green-text">{fmtEth(l.lifetimeHolderFees, 4)}</div></div>
        <div className="stat"><div className="k">creator earned</div><div className="v">{fmtEth(l.creatorEarned, 4)}</div></div>
        <div className="stat"><div className="k">supply staked</div><div className="v">{l.totalStakedPct}%</div></div>
      </div>
      <p className="note" style={{ marginTop: 10 }}>
        Rewards are paid in ETH, not in the token, so staking earns yield from
        real trading volume, win or lose.
      </p>
    </div>
  )
}

function SalvoPanel({ l }: { l: L }) {
  const [amt, setAmt] = useState('0.02')
  const amount = parseFloat(amt) || 0
  const remaining = Math.max(0, SALVO_WALLET_CAP - l.yourCommit)
  return (
    <div className="panel">
      <div className="panel-title">Join the salvo</div>
      <div className="input-row">
        <input value={amt} onChange={(e) => setAmt(e.target.value)} inputMode="decimal" />
        <button className="btn" onClick={() => setAmt(String(remaining))}>max</button>
      </div>
      <button
        className="btn btn-accent btn-block"
        disabled={amount <= 0 || amount > remaining}
        onClick={() => commitToSalvo(l.mint, amount)}
      >
        Commit {amount > 0 ? fmtEth(amount) : 'ETH'}
      </button>
      <div className="row" style={{ marginTop: 10 }}>
        <span className="k">your commit</span>
        <span className="v">{fmtEth(l.yourCommit)} / {SALVO_WALLET_CAP} ETH cap</span>
      </div>
      <div className="note-box">
        The {SALVO_WALLET_CAP} ETH per-wallet cap means no single whale owns the
        launch. Top up as much as you like until the window closes. When it does,
        your tokens are sent to your wallet automatically. Nothing to claim.
      </div>
    </div>
  )
}

function TradePanel({ l }: { l: L }) {
  const [side, setSide] = useState<'buy' | 'sell'>('buy')
  const [amt, setAmt] = useState('0.02')
  const amount = parseFloat(amt) || 0
  const live = l.phase === 'live'

  const est =
    side === 'buy'
      ? tokensOutForEth(l.virtualEth, l.virtualTokens, amount * (1 - FEE_PCT))
      : ethOutForTokens(l.virtualEth, l.virtualTokens, amount) * (1 - FEE_PCT)

  return (
    <div className="panel">
      <div className="panel-title">Trade</div>
      <div className="tabs">
        <button className={`tab${side === 'buy' ? ' on-buy' : ''}`} onClick={() => setSide('buy')}>Buy</button>
        <button className={`tab${side === 'sell' ? ' on-sell' : ''}`} onClick={() => setSide('sell')}>Sell</button>
      </div>
      <div className="input-row">
        <input value={amt} onChange={(e) => setAmt(e.target.value)} inputMode="decimal" />
        <span className="note" style={{ alignSelf: 'center', minWidth: 44 }}>{side === 'buy' ? 'ETH' : l.symbol}</span>
      </div>
      {side === 'sell' && (
        <div className="row">
          <span className="k">your balance</span>
          <button className="btn" style={{ padding: '2px 8px', fontSize: 12 }} onClick={() => setAmt(String(Math.floor(l.yourBalance)))}>
            {fmtNum(l.yourBalance)} {l.symbol}
          </button>
        </div>
      )}
      <div className="row">
        <span className="k">you receive ≈</span>
        <span className="v">{side === 'buy' ? `${fmtNum(Math.max(0, est))} ${l.symbol}` : fmtEth(Math.max(0, est), 5)}</span>
      </div>
      <div className="row">
        <span className="k">fee (1%)</span>
        <span className="v">{side === 'buy' ? fmtEth(amount * FEE_PCT, 5) : fmtEth(ethOutForTokens(l.virtualEth, l.virtualTokens, amount) * FEE_PCT, 5)}</span>
      </div>
      <div style={{ marginTop: 10 }}>
        <button
          className={`btn ${side === 'buy' ? 'btn-green' : 'btn-red'} btn-block`}
          disabled={!live || amount <= 0}
          onClick={() => (side === 'buy' ? buy(l.mint, amount) : sell(l.mint, amount))}
        >
          {live ? (side === 'buy' ? `Buy $${l.symbol}` : `Sell $${l.symbol}`) : 'Trading locked for migration'}
        </button>
      </div>
    </div>
  )
}

function StakePanel({ l }: { l: L }) {
  const [amt, setAmt] = useState('')
  const amount = parseFloat(amt) || 0
  return (
    <div className="panel">
      <div className="panel-title">Stake and earn 50% of all fees</div>
      <div className="stat-grid">
        <div className="stat"><div className="k">your balance</div><div className="v">{fmtNum(l.yourBalance)}</div></div>
        <div className="stat"><div className="k">your staked</div><div className="v">{fmtNum(l.yourStaked)}</div></div>
      </div>
      <div className="input-row">
        <input value={amt} onChange={(e) => setAmt(e.target.value)} placeholder="amount" inputMode="decimal" />
        <button className="btn" onClick={() => setAmt(String(Math.floor(l.yourBalance)))}>max</button>
      </div>
      <div style={{ display: 'flex', gap: 8 }}>
        <button className="btn btn-block" disabled={amount <= 0 || amount > l.yourBalance} onClick={() => { stake(l.mint, amount); setAmt('') }}>Stake</button>
        <button className="btn btn-block" disabled={amount <= 0 || amount > l.yourStaked} onClick={() => { unstake(l.mint, amount); setAmt('') }}>Unstake</button>
      </div>
      <div className="row" style={{ marginTop: 12 }}>
        <span className="k">claimable rewards</span>
        <span className="v green-text">{fmtEth(l.yourClaimable, 6)}</span>
      </div>
      <button className="btn btn-block" style={{ marginTop: 6 }} disabled={l.yourClaimable <= 0} onClick={() => claimRewards(l.mint)}>
        Claim ETH
      </button>
      <p className="note" style={{ marginTop: 10, fontSize: 11.5 }}>
        Minimum stake 1,000 tokens. Unstaking unlocks 5 minutes after your last
        stake, so bots can't flash-stake around big trades. Rewards claim any time.
      </p>
    </div>
  )
}
