# Salvo mechanics

This is the source of truth for how the protocol works. The numbers live in
`programs/salvo/src/constants.rs`; if this document and the code disagree,
the code wins.

## Token

| Parameter | Value |
| --- | --- |
| Total supply | 1,000,000,000 (fixed — mint authority burned at creation) |
| Decimals | 6 |
| Curve allocation | 800,000,000 |
| AMM liquidity reserve | 200,000,000 (paired with raised SOL at graduation) |
| Team / presale allocation | none |

## Bonding curve

Constant product over *virtual* reserves, pump.fun-style:

```
k = virtual_sol * virtual_tokens
initial virtual_sol    = 30 SOL
initial virtual_tokens = 1,073,000,000
```

- Buy: `tokens_out = virtual_tokens - k / (virtual_sol + sol_in)`
- Sell: `sol_out = virtual_sol - k / (virtual_tokens + tokens_in)`
- All rounding is against the trader (`div_ceil` on the new reserve), so a
  buy-then-sell round trip can never profit — covered by a unit test.
- Graduation triggers when `real_sol >= 85 SOL`. The curve locks
  (`PendingMigration`) and trading stops until migration runs.

## The salvo (batch-auction launch)

The signature mechanic. For `SALVO_DURATION_SECS` (120s) after launch:

1. `salvo_commit` — buyers deposit SOL into the curve's vault. Caps:
   2 SOL per wallet, 40 SOL global. Commits are top-uppable until close.
   The buyer's ATA is created here (buyer pays its rent) so delivery at
   settle can never fail on a missing token account.
2. `salvo_settle` — permissionless crank after the window. The entire batch
   executes as **one** buy on the curve. This defines a single average
   clearing price for every participant. Fees are taken here, once.
3. `salvo_distribute` — permissionless delivery crank, one call per commit:
   pushes `pool_tokens * my_sol / total_sol` straight to the buyer's wallet
   and refunds their commit rent. The platform bot cranks every commit
   right after settle, so from the buyer's side tokens simply arrive.
   (A Solana transaction can't touch hundreds of wallets at once, which is
   why delivery is per-commit cranks rather than part of settle itself.)

Why it kills sniping: a sniper's edge is ordering — landing before you at a
lower point on the curve. Inside a batch there is no ordering. A bot that
commits 2 SOL gets exactly the same price as a phone user who commits 2 SOL
at second 119. The only "edge" left is conviction size, and that's capped.

Why the global cap: an uncapped batch could clear past the graduation
threshold in one settle, which would need refund logic. 40 SOL keeps the
worst case (~47% of the curve) clean and leaves price discovery to the
open market.

## Fees

1% of SOL notional on every buy and sell, split:

| Recipient | Share | Paid |
| --- | --- | --- |
| Staked holders | 50% (0.5% of volume) | SOL, via reward accumulator |
| Creator | 25% (0.25% of volume) | SOL, instantly to their wallet |
| Protocol treasury | 25% (0.25% of volume) | SOL, instantly |

On top of the volume fee, the platform takes two flat fees:

| Fee | Amount | When |
| --- | --- | --- |
| Launch fee | 0.02 SOL | paid by the creator at `create_launch`, to the treasury |
| Migration fee | 2 SOL | skimmed from raised SOL at graduation, before LP seeding |

Holder rewards use a MasterChef-style accumulator
(`acc_reward_per_share`, 1e12 precision): stake tokens, accrue SOL
per-share as fees arrive, harvest any time. Fees that arrive while nobody
is staked queue in `pending_holder_rewards` and are folded in on the first
stake — nothing is lost or redirected.

Design intent: rewards are paid in **SOL, not the token**, so staking is
yield on real volume rather than reflexive token emissions. The creator
earns from volume forever, which is a stronger incentive than a one-time
dump — creators who keep their community trading out-earn creators who rug.

### Staking threat model

| Attack | Why it fails |
| --- | --- |
| Flash-stake around a whale's trade (stake, capture fee, unstake) | 5-minute unstake cooldown, refreshed on every stake/top-up (`STAKE_COOLDOWN_SECS`). Capturing yield now requires real price exposure. |
| Wash-trade to farm your own fees | Strictly unprofitable: a wash trader pays 1% and can recover at most 0.75% (holder share + creator share), losing the protocol's 0.25% every cycle. |
| Dust stake inflating `acc_reward_per_share` toward overflow | 1,000-token minimum resulting stake (`MIN_STAKE`) bounds per-share growth; all accumulator math is u128 with overflow checks on. |
| Claiming someone else's rewards | Positions are PDAs keyed to the owner's pubkey and every stake/unstake/claim requires the owner's signature. |
| Draining the reward vault | Payouts are computed from booked accumulator state only, and fees are booked at the same instant the SOL enters the vault. Floor rounding means total claims ≤ vault balance, always. |
| DoS via thousands of positions | Reward math is O(1) — no instruction ever iterates positions. Each position's rent is paid by its creator. |

Residual risk is implementation bugs, not design: the settle fee path and
this accumulator are the two audit focus areas before mainnet.

## Phases

```
Salvo (120s) → Live (curve trading) → PendingMigration (85 SOL) → Graduated
```

## Instructions

| Instruction | Who | What |
| --- | --- | --- |
| `initialize` | deployer | global config + treasury |
| `create_launch` | anyone | mint, vaults, full supply minted, mint authority burned, salvo opens |
| `salvo_commit` | anyone | deposit SOL during the window (capped) |
| `salvo_settle` | anyone (crank) | clear the batch at one price, distribute fees |
| `salvo_distribute` | anyone (crank) | push a committer's pro-rata tokens to their wallet + refund their rent; platform bot cranks all commits after settle |
| `buy` / `sell` | anyone | curve trading with 1% fee split |
| `stake` / `unstake` | holder | move tokens in/out of the fee-share pool (auto-harvests) |
| `claim_rewards` | staker | harvest accrued SOL |
| `migrate` | authority | takes the 2 SOL migration fee and retires the curve; v2: seeds the SalvoSwap pool in the same instruction |

## Post-graduation: SalvoSwap (decided 2026-07, v2 build)

Graduated tokens move to a **protocol-owned single-LP AMM** rather than
Raydium. Rationale: our 1% fee only exists on curve trades, so a Raydium
migration would end the staker/creator fee stream at exactly the moment a
token succeeds. A SalvoSwap pool is the same constant-product math as the
curve with real reserves on both sides, no LP deposits/withdrawals (the
protocol is the only LP, so liquidity is locked by construction), and the
identical 50/25/25 fee split. Volume stays on salvo.fun and staking yield
outlives graduation. Ecosystem work (Jupiter routing, indexer listings)
follows later and does not block launch.

## Known gaps before mainnet

- SalvoSwap pool seeding is not implemented yet — `migrate` takes the
  platform fee and locks the curve; the pool program is the next
  program-side milestone.
- No Metaplex metadata yet (name/symbol/URI live in the Curve account).
- Salvo settle assumes commits ≥ rent-exempt minimum for the vault PDAs
  (vaults are seeded with rent at launch to cover this).
- Needs integration tests (litesvm/bankrun) and a professional audit.
  The batch-settle fee path and the reward accumulator are the two places
  an auditor should stare at hardest.
