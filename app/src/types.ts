export type Phase = 'salvo' | 'live' | 'graduating' | 'graduated'

export interface Socials {
  x?: string
  telegram?: string
  website?: string
}

export interface Launch {
  // On EVM `mint` holds the token contract address; kept as the routing key.
  mint: string
  name: string
  symbol: string
  creator: string
  image?: string
  socials?: Socials
  volumeEth: number
  txns: number
  tileHue: number
  createdAt: number
  phase: Phase
  salvoEndsAt: number
  salvoCommitted: number
  salvoWallets: number
  yourCommit: number
  virtualEth: number
  virtualTokens: number
  realEth: number
  realTokens: number
  lifetimeHolderFees: number
  creatorEarned: number
  totalStakedPct: number
  yourBalance: number
  yourStaked: number
  yourClaimable: number
  priceHistory: number[]
  holders: number
}
