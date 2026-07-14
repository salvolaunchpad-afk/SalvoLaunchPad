# Salvo

**Everyone fires at once.** A community-first launchpad where launches open
with a batch auction instead of a sniper race, and holders earn from every
trade.

**Target chain: Robinhood Chain** (Arbitrum-stack EVM L2, mainnet live
2026-07-01). Contracts live in `contracts/` (Foundry). The original,
feature-complete Solana implementation is shelved in `programs/salvo/` and
remains redeployable.

## Why Salvo exists

On pump.fun-style launchpads, every incentive points at extraction in the
first hour: snipers eat the first block, devs dump, and holding earns you
nothing. Salvo changes exactly two things — and keeps everything else
one-click simple:

1. **The salvo (batch-auction start).** For the first 2 minutes, buys are
   commitments capped at 2 SOL per wallet. When the window closes, the whole
   batch clears as one buy at one average price. There is no first block to
   snipe, no gas war to lose. Order doesn't matter; speed doesn't matter.
2. **Holder fee share.** Every trade pays a 1% fee, split 50% to staked
   holders (paid in SOL), 25% to the creator, 25% to the protocol treasury.
   Holding generates yield from real volume — a reason to stay that isn't
   "find a greater fool."

Platform revenue: 0.25% of all trade volume (the treasury share), plus a
flat 0.02 SOL launch fee and a 2 SOL migration fee at graduation.

## Repo layout

```
programs/salvo/   Anchor (Rust) on-chain program
app/              React frontend (Vite). Currently runs on a mock chain
                  layer (src/mock.ts) so the full UX is previewable;
                  wallet adapter + RPC wiring is the next milestone.
docs/MECHANICS.md Tokenomics, curve math, and every instruction explained
```

## Mechanics at a glance

- Fixed 1B supply, 6 decimals, mint authority burned at creation
- Constant-product bonding curve with virtual reserves (30 SOL / 1.073B tokens)
- 800M tokens sold on the curve; 200M reserved for AMM liquidity
- Graduation at 85 SOL raised → liquidity migrates to the AMM, LP burned
  (migration CPI is a v2 TODO — the instruction currently locks the curve)
- Salvo window: 120s, 2 SOL per-wallet cap, 40 SOL global cap
- Staking uses a MasterChef-style accumulator; rewards paid in SOL

## Development

Frontend preview (mock chain):

```sh
cd app && npm install && npm run dev
```

Program (requires Rust + Solana CLI + Anchor 0.31):

```sh
cargo test -p salvo   # host-side curve math tests
anchor build          # then `anchor keys sync` to set the real program id
```

## Status / roadmap

- [x] On-chain program: launch, salvo commit/settle/claim, buy/sell, stake/unstake/claim, fee splits
- [x] Frontend UX with mock chain layer
- [x] Wallet connect (Phantom/Solflare via wallet adapter)
- [ ] Transaction signing against the deployed program (needs the IDL from `anchor build`)
- [ ] Crank bot: auto-settle salvos and auto-deliver tokens (`salvo_settle` + `salvo_distribute` are permissionless, the bot just runs them)
- [ ] Anchor integration tests (bankrun/litesvm)
- [ ] Metaplex token metadata CPI at launch
- [ ] SalvoSwap: protocol-owned single-LP AMM for graduated tokens, same
      fee split, so staker rewards continue after graduation
- [ ] Indexer for the board (websocket event feed)
- [ ] Security audit before any mainnet deploy
