import { Link } from 'react-router-dom'
import {
  ArrowDoodle, DoodleCurve, DoodleGrad, DoodleLaunch, DoodleSalvo, Reveal, Squiggle,
} from '../components/Doodles'
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
        <span className="col-count">{items.length}</span>
      </header>
      <p className="col-sub">{sub}</p>
      <div className="col-scroll">
        {items.map((l) => <TokenCard key={l.mint} l={l} />)}
        {items.length === 0 && <p className="note" style={{ padding: '8px 2px' }}>{empty}</p>}
      </div>
    </section>
  )
}

const STAGES = [
  {
    num: '01',
    doodle: <DoodleLaunch />,
    title: 'You launch it',
    body: 'One click, one flat 0.0005 ETH fee. Fixed 1B supply, no presale, no team bags, no mint function. Your idea goes from sketch to on-chain in seconds.',
    note: 'that\'s the whole form →',
  },
  {
    num: '02',
    doodle: <DoodleSalvo />,
    title: 'Everyone fires at once',
    body: 'The first 2 minutes are a batch auction. Buys are commitments, and when the clock hits zero the whole batch clears at ONE price. A bot in second 1 and a human in second 119 pay exactly the same.',
    note: 'nothing to snipe. nothing.',
  },
  {
    num: '03',
    doodle: <DoodleCurve />,
    title: 'The trenches',
    body: 'Trading opens on the bonding curve. Every buy and sell pays a 1% fee, and half of it goes straight to the creator in ETH, on every trade, forever. Building beats dumping.',
    note: 'creators get paid, forever',
  },
  {
    num: '04',
    doodle: <DoodleGrad />,
    title: 'Over the top',
    body: 'At 2.8 ETH raised the token graduates: liquidity locks into a permanent pool and trading continues forever. Unlike everywhere else, the fee split keeps flowing after graduation.',
    note: 'fees never stop',
  },
]

const VS_ROWS = [
  {
    label: 'The launch',
    us: '2-minute batch auction. One clearing price for every single wallet.',
    them: 'A sniper race. Bots win block one, then sell into your entry.',
  },
  {
    label: 'Creators earn',
    us: '0.5% of ALL volume, in ETH, paid on every single trade, forever.',
    them: 'A sliver, sometimes, if the platform feels generous that month.',
  },
  {
    label: 'After graduation',
    us: 'Same contract flips to a locked pool. The creator keeps earning.',
    them: 'The fee stream changes or dies the moment a token succeeds.',
  },
  {
    label: 'Copycat "vamps"',
    us: 'Blocked on-chain: one live token per ticker. Your narrative stays yours.',
    them: 'Fifty CASHCATs in ten minutes, liquidity shredded across all of them.',
  },
  {
    label: 'Rug surface',
    us: 'No mint function, contract-owned liquidity, locked by construction.',
    them: 'Depends who you trust that day.',
  },
]

export default function Home() {
  const launches = useLaunches()
  const inSalvo = launches.filter((l) => l.phase === 'salvo')
  const live = launches.filter((l) => l.phase === 'live')
  const graduating = launches.filter((l) => l.phase === 'graduating' || l.phase === 'graduated')

  const paidToCreators = launches.reduce((s, l) => s + l.creatorEarned, 0)
  const inOpenSalvos = inSalvo.reduce((s, l) => s + l.salvoCommitted, 0)

  return (
    <main>
      {/* ── Hero ── */}
      <section className="hero">
        <div className="hero-annots">
          <span className="annot annot-muted wiggle">remind: nobody snipes you here</span>
          <span className="annot annot-muted">every idea deserves a fair shot</span>
        </div>
        <Reveal>
          <h1 className="hero-title">
            Everyone <span className="hl">fires</span> at once.
          </h1>
        </Reveal>
        <Reveal delay={120}>
          <p className="hero-sub">
            The launchpad where launches open with a 2-minute batch auction nobody can
            snipe, and creators earn ETH from every single trade, forever. Sketch the
            idea, fire the salvo, get paid for building.
          </p>
        </Reveal>
        <Reveal delay={200}>
          <div className="hero-actions">
            <Link to="/launch" className="btn btn-accent">Launch a token</Link>
            <Link to="/how" className="btn">How it works</Link>
          </div>
        </Reveal>
        <div className="hero-scroll">
          <span className="annot annot-muted">scroll to explore</span>
          <div style={{ display: 'flex', justifyContent: 'center', marginTop: 2 }}>
            <ArrowDoodle width={40} />
          </div>
        </div>
        <div className="hero-stats">
          <div className="chip chip-green">
            <span className="k">paid to creators</span>
            <span className="v">{fmtEth(paidToCreators)}</span>
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

      {/* ── Storyboard: how it works ── */}
      <section className="sect">
        <Reveal>
          <div className="sect-head-row">
            <h2 className="serif-head">From <span className="hl-y">sketch</span> to launched</h2>
            <span className="annot annot-muted">small steps → big results</span>
          </div>
        </Reveal>
        <div className="storyboard">
          {STAGES.map((s, i) => (
            <Reveal key={s.num} delay={i * 90}>
              <div className="stage-card">
                <span className="stage-num">{s.num}</span>
                <div className="stage-doodle">{s.doodle}</div>
                <h3 className="stage-title">{s.title}</h3>
                <p className="stage-body">{s.body}</p>
                <div className="stage-note">{s.note}</div>
              </div>
            </Reveal>
          ))}
        </div>
        <Reveal delay={120}>
          <div style={{ marginTop: 26, display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 14 }}>
            <span className="annot">your idea goes here</span>
            <ArrowDoodle width={38} />
            <Link to="/launch" className="btn btn-accent">Launch a token</Link>
          </div>
        </Reveal>
      </section>

      {/* ── Live board ── */}
      <section className="sect" style={{ textAlign: 'left' }}>
        <Reveal>
          <div className="sect-head-row" style={{ justifyContent: 'flex-start' }}>
            <h2 className="serif-head">Live on the <span className="hl">board</span></h2>
            <span className="annot annot-muted">happening right now ↓</span>
          </div>
        </Reveal>
        <div className="board">
          <Column
            title="In the salvo"
            sub="Just launched. Commit ETH in the window and you pay the same price as everyone else. No exceptions."
            color="var(--accent)"
            items={inSalvo}
            empty="No open windows right now. Launch one."
          />
          <Column
            title="In the trenches"
            sub="Trading live on the curve. Every trade pays the creator, so builders stick around."
            color="var(--green)"
            items={live}
            empty="Nothing live yet."
          />
          <Column
            title="Over the top"
            sub="Raised 2.8 ETH and graduated. Liquidity locked forever, creators keep earning."
            color="var(--gold)"
            items={graduating}
            empty="No graduations yet. The first one is yours to make."
          />
        </div>
      </section>

      {/* ── Comparison ── */}
      <section className="sect">
        <Reveal>
          <div className="sect-head-row">
            <h2 className="serif-head">Why not just use <span className="hl-y">pump.fun</span>?</h2>
            <span className="annot annot-muted">fair question, honest answer</span>
          </div>
        </Reveal>
        <Reveal delay={100}>
          <div className="vs-wrap">
            <div className="vs-row vs-head">
              <div className="vs-cell" />
              <div className="vs-cell" style={{ color: 'var(--accent)' }}>salvo ← us</div>
              <div className="vs-cell" style={{ color: 'var(--muted)' }}>pump.fun, NOXA, hood.fun</div>
            </div>
            {VS_ROWS.map((r) => (
              <div key={r.label} className="vs-row">
                <div className="vs-cell vs-label">{r.label}</div>
                <div className="vs-cell vs-us"><span className="vs-check">✓</span>{r.us}</div>
                <div className="vs-cell"><span className="vs-cross">✗</span>{r.them}</div>
              </div>
            ))}
          </div>
        </Reveal>
        <Reveal delay={160}>
          <div style={{ marginTop: 22 }}>
            <span className="annot annot-muted">convinced? good.&nbsp;&nbsp;</span>
            <Link to="/launch" className="btn btn-accent">Launch a token</Link>
          </div>
        </Reveal>
      </section>

      {/* ── CTA band + footer ── */}
      <section className="cta-band">
        <Reveal>
          <h2 className="serif-head">Ready to <span className="hl">fire</span>?</h2>
          <span className="annot annot-muted">the window is 2 minutes. everyone gets the same shot.</span>
          <div style={{ display: 'flex', justifyContent: 'center', gap: 12 }}>
            <Link to="/launch" className="btn btn-accent" style={{ fontSize: 16, padding: '13px 28px' }}>
              Launch a token
            </Link>
          </div>
          <div style={{ display: 'flex', justifyContent: 'center', marginTop: 18 }}>
            <Squiggle width={160} color="var(--accent)" />
          </div>
        </Reveal>
        <div className="footer-row">
          <span className="annot annot-muted">salvo.fun — made in the trenches</span>
          <div className="footer-links">
            <Link to="/how">how it works</Link>
            <Link to="/launch">launch</Link>
            <a href="https://github.com/salvolaunchpad-afk/SalvoLaunchPad" target="_blank" rel="noreferrer">github</a>
          </div>
        </div>
      </section>
    </main>
  )
}
