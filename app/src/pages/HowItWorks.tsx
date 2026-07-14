import { Link } from 'react-router-dom'

const PHASES = [
  {
    num: '01',
    tag: 'THE SALVO · 2 MINUTES',
    color: 'var(--accent)',
    title: 'Everyone fires at once',
    body: 'Every launch opens with a 2-minute batch auction. Buys during the window are commitments: your ETH goes in, but nothing clears yet. When the clock hits zero, the entire batch executes as one buy at one average price, and everyone gets tokens pro-rata at exactly that price.',
    points: [
      'Commit up to 0.05 ETH per wallet, top up any time before the window closes',
      'Order and speed are irrelevant. Second 1 and second 119 pay the same price',
      'Nothing for sniper bots to win, so they don\'t show up',
      'Tokens are sent to your wallet automatically at settle. Nothing to claim',
    ],
  },
  {
    num: '02',
    tag: 'THE TRENCHES · UNTIL 2.8 ETH',
    color: 'var(--green)',
    title: 'Trade on the curve',
    body: 'After the salvo settles, the token trades on a bonding curve. The price comes from a formula, the ETH backing it is locked in the contract, and anyone can buy or sell at any time. This is where a token lives most of its life.',
    points: [
      '1% fee on every trade: 0.5% to staked holders, 0.25% to the creator, 0.25% to the protocol',
      'Stake your tokens to earn ETH from every trade, claim whenever you like',
      'Liquidity cannot be pulled. You can always sell back to the curve',
    ],
  },
  {
    num: '03',
    tag: 'OVER THE TOP · AT 2.8 ETH RAISED',
    color: 'var(--gold)',
    title: 'Graduation',
    body: 'When 2.8 ETH of net buying fills the curve, the token graduates. The raised ETH plus 200M reserved tokens seed a permanent liquidity pool, and trading continues there forever. The same fee split keeps paying stakers and the creator after graduation.',
    points: [
      'Pool liquidity is protocol-owned and locked by construction',
      'Only the strongest launches make it. This column is the flex',
      'Tokens that never graduate simply keep trading on the curve',
    ],
  },
]

const FAQ = [
  {
    q: 'How long does the salvo last?',
    a: 'Exactly 2 minutes from launch. It settles automatically when the window closes, and your tokens are delivered straight to your wallet. No claiming, no extra click.',
  },
  {
    q: 'Why a batch auction instead of first come, first served?',
    a: 'On other launchpads, bots land in the first block and buy before you, then sell into your entry. In a batch there is no "before you". One price for the whole window means a sniper\'s only edge, speed, is worth nothing.',
  },
  {
    q: 'What do holders actually earn?',
    a: 'Stake your tokens and you earn 50% of every trade fee, paid in ETH, proportional to your share of the staked supply. It accrues on every buy and sell, win or lose. Rewards claim any time; unstaking unlocks 5 minutes after your last stake so bots can\'t flash-stake around big trades.',
  },
  {
    q: 'What does the creator earn?',
    a: '25% of every trade fee on their token, forever, paid straight to their wallet on each trade. Creators who keep their community trading out-earn creators who dump.',
  },
  {
    q: 'Can the dev rug the liquidity?',
    a: 'No. Curve ETH sits in a contract-owned pool nobody can withdraw from, the token supply is fixed with no mint function, and graduation liquidity is locked to the protocol. The classic rug mechanics are removed by design.',
  },
  {
    q: 'What does it cost to launch?',
    a: 'A flat 0.0005 ETH platform fee plus gas. One click, no presale, no team allocation.',
  },
  {
    q: 'What chain is this on?',
    a: 'Robinhood Chain, an Ethereum layer-2 that pays gas in ETH. Connect any EVM wallet like MetaMask and add the network to get started.',
  },
]

export default function HowItWorks() {
  return (
    <main>
      <section className="hero">
        <div className="hero-copy">
          <h1 className="hero-title">
            From launch to <span className="flame">graduation</span>.
          </h1>
          <p className="hero-sub">
            Every token on Salvo moves through three phases, in one direction, with
            no exceptions. Two rules make it different from every other launchpad:
            nobody can snipe the start, and holding pays you in ETH.
          </p>
        </div>
      </section>

      <div className="phase-flow">
        {PHASES.map((p) => (
          <div key={p.num} className="phase-card" style={{ borderTopColor: p.color }}>
            <div className="hiw-num" style={{ color: p.color }}>{p.num} · {p.tag}</div>
            <h2 className="phase-title">{p.title}</h2>
            <p className="phase-body">{p.body}</p>
            <ul className="phase-points">
              {p.points.map((pt) => <li key={pt}>{pt}</li>)}
            </ul>
          </div>
        ))}
      </div>

      <div className="section-head">
        <h2 className="section-title" style={{ color: 'var(--green)' }}>Where every fee goes</h2>
      </div>
      <div className="panel" style={{ maxWidth: 820 }}>
        <div className="fee-split">
          <div style={{ width: '50%', background: '#0b2416', color: 'var(--green)' }}>50% staked holders</div>
          <div style={{ width: '25%', background: '#2a1608', color: 'var(--accent)' }}>25% creator</div>
          <div style={{ width: '25%', background: '#171b24', color: 'var(--muted)' }}>25% protocol</div>
        </div>
        <p className="note" style={{ fontSize: 13 }}>
          Every buy and sell pays a 1% fee, split as above. On a 1 ETH trade that is
          0.005 ETH to the people staking the token, 0.0025 ETH to its creator, and
          0.0025 ETH to the platform. Rewards are paid in ETH, not in the token, so
          staking yield is real regardless of where the chart goes.
        </p>
      </div>

      <div className="section-head">
        <h2 className="section-title">Questions people fire at us</h2>
      </div>
      <div className="faq-grid">
        {FAQ.map((f) => (
          <div key={f.q} className="hiw-step">
            <div className="hiw-title">{f.q}</div>
            <div className="hiw-body">{f.a}</div>
          </div>
        ))}
      </div>

      <div style={{ display: 'flex', gap: 10, marginTop: 34 }}>
        <Link to="/launch" className="btn btn-accent">Launch a token</Link>
        <Link to="/" className="btn">Back to the board</Link>
      </div>
    </main>
  )
}
