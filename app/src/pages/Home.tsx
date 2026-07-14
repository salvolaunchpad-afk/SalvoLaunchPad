import { Link } from 'react-router-dom'
import TokenCard from '../components/TokenCard'
import { useLaunches } from '../hooks'
import { fmtEth } from '../util'
import type { Launch } from '../types'

function Column({ title, sub, color, items, empty }: {
  title: string
  sub: string
  color: string
  items: Launch[]
  empty: string
}) {
  return (
    <section className="col">
      <header className="col-head">
        <h2 className="section-title" style={{ color }}>{title}</h2>
        <span className="col-count" style={{ color }}>{items.length}</span>
      </header>
      <p className="col-sub">{sub}</p>
      <div className="col-scroll">
        {items.map((l) => <TokenCard key={l.mint} l={l} />)}
        {items.length === 0 && <p className="note" style={{ padding: '8px 2px' }}>{empty}</p>}
      </div>
    </section>
  )
}

export default function Home() {
  const launches = useLaunches()
  const inSalvo = launches.filter((l) => l.phase === 'salvo')
  const live = launches.filter((l) => l.phase === 'live')
  const graduating = launches.filter((l) => l.phase === 'graduating' || l.phase === 'graduated')

  const paidToHolders = launches.reduce((s, l) => s + l.lifetimeHolderFees, 0)
  const inOpenSalvos = inSalvo.reduce((s, l) => s + l.salvoCommitted, 0)

  return (
    <main>
      <section className="hero">
        <div className="hero-copy">
          <h1 className="hero-title">
            Everyone <span className="flame">fires</span> at once.
          </h1>
          <p className="hero-sub">
            The launchpad where nobody snipes your entry. Every token opens with a
            2-minute batch auction: one price for every wallet, no bots, no gas wars.
            Then holders stake to earn ETH from every single trade. Launch it, hold
            it, get paid for it.
          </p>
          <div className="hero-actions">
            <Link to="/launch" className="btn btn-accent">Fire your own →</Link>
            <Link to="/how" className="btn">How it works</Link>
          </div>
        </div>
        <div className="hero-stats">
          <div className="chip chip-green">
            <span className="k">paid to holders</span>
            <span className="v">{fmtEth(paidToHolders)}</span>
          </div>
          <div className="chip chip-accent">
            <span className="k">in open salvos</span>
            <span className="v">{fmtEth(inOpenSalvos)}</span>
          </div>
          <div className="chip">
            <span className="k">launches</span>
            <span className="v">{launches.length}</span>
          </div>
        </div>
      </section>

      <div className="board">
        <Column
          title="In the salvo"
          sub="Just launched. The 2-minute batch auction is open: commit ETH now and you pay the same price as everyone else in the window."
          color="var(--accent)"
          items={inSalvo}
          empty="No open windows right now. Launch one."
        />
        <Column
          title="In the trenches"
          sub="Trading live on the bonding curve. Stake what you hold and earn ETH from every buy and sell."
          color="var(--green)"
          items={live}
          empty="Nothing live yet."
        />
        <Column
          title="Over the top"
          sub="Raised 2.8 ETH and graduated. Liquidity is permanent, and stakers keep earning."
          color="var(--gold)"
          items={graduating}
          empty="No graduations yet. The first one is yours to make."
        />
      </div>
    </main>
  )
}
