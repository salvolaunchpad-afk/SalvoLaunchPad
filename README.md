# Salvo

**Everyone fires at once.** The launchpad where launches open with a batch
auction instead of a sniper race, and creators earn from every trade,
forever.

**Chain: Robinhood Chain** (Arbitrum-stack EVM L2, ETH gas). The canonical
contracts live in `contracts/` (Foundry). An earlier, feature-complete
Solana implementation is preserved in `programs/` for reference.

## Why Salvo exists

On pump.fun-style launchpads, every incentive points at extraction in the
first hour: snipers eat the first block and devs dump. Salvo changes
exactly two things, and keeps everything else one-click simple:

1. **The salvo (batch-auction start).** For the first 2 minutes, buys are
   commitments capped per wallet. When the window closes, the whole batch
   clears as one buy at one average price. There is no first block to
   snipe, no gas war to lose. Order doesn't matter; speed doesn't matter.
   Tokens are delivered automatically at settle — nothing to claim.
2. **Creators earn forever.** Every trade pays a 1% fee, split evenly
   between the token's creator and the platform, in ETH, on the curve and
   after graduation. Building a community that keeps trading out-earns
   dumping on it, by design.

Platform revenue: 0.5% of all trade volume, plus a flat 0.0005 ETH launch
fee and a 0.05 ETH migration fee at graduation.

## Repo layout

```
contracts/        Solidity contracts (Foundry): Salvo.sol + SalvoToken.sol
app/              React frontend (Vite + wagmi/RainbowKit). Runs on a mock
                  chain layer until VITE_SALVO_ADDRESS points at a deploy.
programs/         Legacy Solana/Anchor implementation (reference only)
docs/MECHANICS.md Tokenomics, curve math, and every function explained
```

## Mechanics at a glance

- Fixed 1B supply, 18 decimals, no mint function
- Constant-product bonding curve with virtual reserves (1 ETH / 1.073B tokens)
- 800M tokens sold on the curve; 200M reserved for graduation liquidity
- Salvo window: 120s, 0.05 ETH per-wallet cap, 1.25 ETH global cap
- Graduation at 2.8 ETH raised: the same contract flips from virtual-reserve
  curve to a real-reserve pool (protocol is the sole LP, liquidity locked by
  construction); unsold curve inventory is burned
- All fee payouts are pull-based, so no recipient can grief trades

## Development

Frontend preview (mock chain):

```sh
cd app && npm install && npm run dev
```

Contracts (requires Foundry):

```sh
cd contracts && forge test
```

Deploy (testnet or mainnet):

```sh
TREASURY=0x... forge script script/Deploy.s.sol \
  --rpc-url $ROBINHOOD_RPC --private-key $DEPLOYER_KEY --broadcast
```

## Status / roadmap

- [x] Contracts: launch, salvo commit/settle/distribute, curve + pool trading, fee splits, graduation
- [x] Foundry test suite over the full lifecycle
- [x] Frontend UX (mock chain layer) with wagmi/RainbowKit wallet connect
- [ ] Robinhood Chain testnet deploy + wiring the app to the live contract
- [ ] Crank bot: auto-settle salvos and auto-deliver tokens (`settle` + `distribute` are permissionless, the bot just runs them)
- [ ] IPFS pinning for token images
- [ ] Indexer for the board (event feed)
- [ ] Security audit before mainnet
