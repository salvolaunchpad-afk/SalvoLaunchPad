import { defineChain } from 'viem'

// Robinhood Chain (Arbitrum-stack EVM L2). Mainnet went live 2026-07-01.
export const robinhoodMainnet = defineChain({
  id: 4663,
  name: 'Robinhood Chain',
  nativeCurrency: { name: 'Ether', symbol: 'ETH', decimals: 18 },
  rpcUrls: { default: { http: ['https://rpc.mainnet.chain.robinhood.com'] } },
  blockExplorers: {
    default: { name: 'Blockscout', url: 'https://robinhoodchain.blockscout.com' },
  },
})

export const robinhoodTestnet = defineChain({
  id: 46646,
  name: 'Robinhood Chain Testnet',
  nativeCurrency: { name: 'Ether', symbol: 'ETH', decimals: 18 },
  rpcUrls: { default: { http: ['https://rpc.testnet.chain.robinhood.com'] } },
  blockExplorers: {
    default: { name: 'Blockscout', url: 'https://testnet.robinhoodchain.blockscout.com' },
  },
  testnet: true,
})

// Default to testnet until we deploy to mainnet; override with VITE_CHAIN=mainnet.
export const ACTIVE_CHAIN =
  import.meta.env.VITE_CHAIN === 'mainnet' ? robinhoodMainnet : robinhoodTestnet

// Deployed Salvo contract address, set after `forge script Deploy`.
// Zero address means "not deployed yet"; the app runs on the mock layer.
export const SALVO_ADDRESS = (import.meta.env.VITE_SALVO_ADDRESS ??
  '0x0000000000000000000000000000000000000000') as `0x${string}`

export const IS_LIVE = SALVO_ADDRESS !== '0x0000000000000000000000000000000000000000'
