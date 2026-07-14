# Salvo mechanics

This is the source of truth for how the protocol works. The canonical
implementation is the EVM contract at `contracts/src/Salvo.sol` (Robinhood
Chain); numbers below are its deployed defaults, all owner-tunable. The
Anchor program in `programs/` is the original Solana implementation, kept
for reference; it predates the removal of staking and is not maintained.

## Token

| Parameter | Value |
| --- | --- |
| Total supply | 1,000,000,000 (fixed, no mint function) |
| Decimals | 18 |
| Curve allocation | 800,000,000 |
| Pool reserve | 200,000,000 (paired with raised ETH at graduation) |
| Team / presale allocation | none |

## Bonding curve

Constant product over virtual reserves, pump-style:

```
k = virtual_eth * virtual_tokens
initial virtual_eth    = 1 ETH
initial virtual_tokens = 1,073,000,000
```

- Buy: `tokens_out = virtual_tokens - k / (virtual_eth + eth_in)`
- Sell: `eth_out = virtual_eth - k / (virtual_tokens + tokens_in)`
- All rounding is against the trader (ceiling division on the new
  reserve), so a buy-then-sell round trip can never profit — covered by a
  Foundry test.
- Graduation triggers at `real_eth >= 2.8 ETH`.

## The salvo (batch-auction launch)

The signature mechanic. For `salvoDuration` (120s) after launch:

1. `commit` — buyers deposit ETH. Caps: 0.05 ETH per wallet (top-uppable),
   1.25 ETH global.
2. `settle` — permissionless crank after the window. The entire batch
   executes as **one** buy on the curve: a single average clearing price
   for every participant. Fees are taken here, once.
3. `distribute` — permissionless delivery crank, batched over the
   committer list: pushes each buyer's pro-rata tokens straight to their
   wallet. The platform bot cranks it right after settle, so from the
   buyer's side tokens simply arrive. Nothing to claim.

Why it kills sniping: a sniper's edge is ordering — landing before you at
a lower point on the curve. Inside a batch there is no ordering. Speed is
worth nothing; the only variable left is conviction size, and that's
capped per wallet.

## Fees

1% of ETH notional on every buy and sell (`feeBps`, capped at 3% by the
setter), split:

| Recipient | Share | Paid |
| --- | --- | --- |
| Creator | 50% (0.5% of volume) | ETH, pull-based via `withdraw()` |
| Protocol treasury | 50% (0.5% of volume) | ETH, pull-based via `withdraw()` |

The split (`creatorShareBps`) is a contract parameter, so a future
holder-facing or community mechanic can claim a slice without redeploying.
Payouts are pull-based — fees credit an `owed` ledger and recipients
withdraw — so no reverting recipient can grief trades.

On top of the volume fee, the platform takes two flat fees:

| Fee | Amount | When |
| --- | --- | --- |
| Launch fee | 0.0005 ETH | paid by the creator at `createLaunch` |
| Migration fee | 0.05 ETH | skimmed from raised ETH at graduation |

Design intent: the creator earns from volume forever, which is a stronger
incentive than a one-time dump — creators who keep their community trading
out-earn creators who rug. (Holder fee-share staking was prototyped and
removed 2026-07 after market research; the accumulator design lives in git
history if it's ever wanted again.)

Wash-trade note: farming your own creator fees is strictly unprofitable —
a wash trader pays 1% and recovers at most 0.5%, donating the platform's
half on every cycle.

## Phases

```
Salvo (120s) → Live (curve trading) → Graduated (permanent pool)
```

Graduation takes the migration fee, burns unsold curve inventory, and
flips the SAME contract from virtual-reserve curve to a real-reserve pool
seeded with the raised ETH plus the 200M reserve. The protocol is the only
LP, so liquidity is locked by construction, and the fee split keeps paying
the creator after graduation.

## Functions

| Function | Who | What |
| --- | --- | --- |
| `createLaunch` | anyone | deploy token, mint full supply to the contract, open the salvo |
| `commit` | anyone | deposit ETH during the window (capped) |
| `settle` | anyone (crank) | clear the batch at one price, book fees |
| `distribute` | anyone (crank) | push committers' pro-rata tokens to their wallets |
| `buy` / `sell` | anyone | curve (Live) or pool (Graduated) trading, 1% fee |
| `withdraw` | fee recipients | collect accrued ETH from the `owed` ledger |
| `setSalvoDuration` / `setFeeSplit` / `setCaps` / `setFees` / `setTreasury` | owner | tune parameters within bounds |

## Anti-vamp: one live token per ticker

Copycat "vamp" launches (fifty CASHCATs in ten minutes) shred liquidity
and bury the real team. Salvo blocks them at the contract:

- `createLaunch` enforces a **case-insensitive ticker registry**: tickers
  are 1-12 chars of A-Z 0-9, and a second launch of a live ticker reverts
  with `TickerTaken`.
- **Graduated tokens own their ticker permanently.**
- **Dormancy reclaim stops squatting**: a ticker frees up only if its
  token never graduated, is older than `reclaimDelay` (72h), and its
  curve holds less than `dormancyFloor` (0.15 ETH). Real communities
  can't be vamped; dead names recycle.
- **Reclaiming retires the old token to exit-only.** Buys and commits on
  the retired token revert forever and it can never graduate, so a
  reclaimed zombie can't be revived to confuse buyers. Sells always
  work: each token's curve ETH is isolated and exactly backs its
  circulating supply, so holders of a retired token keep full exit
  liquidity at the formula price, indefinitely. Nothing is confiscated.
- Invariant: **at most one buyable token per ticker at any moment**, and
  graduation locks the name permanently.
- `tickerAvailable(symbol)` lets the launch form check availability live.

## Known gaps before mainnet

- The crank bot (auto-settle + auto-distribute) is off-chain infra still
  to be built; both functions are permissionless so anyone can cover for
  it.
- Token metadata images need decentralized hosting (IPFS pinning) wired
  into the launch flow.
- Near graduation, a buy larger than the remaining curve inventory
  reverts rather than partially filling; the app sizes buys via
  `quoteBuy` so users don't hit it, but a partial-fill path would be
  cleaner.
- Needs an external audit. Focus areas: the batch-settle fee path,
  graduation reserve accounting, and the pull-payment ledger.
