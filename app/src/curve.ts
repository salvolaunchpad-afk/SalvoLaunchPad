// Mirror of the on-chain constant-product math (contracts/src/Salvo.sol).
// All ETH values here are in whole ETH (floats are fine for UI estimates;
// the contract does the exact uint256 math). Constants match the deployed
// contract defaults so the mock demo behaves like the real chain.

export const TOTAL_SUPPLY = 1_000_000_000
export const CURVE_SUPPLY = 800_000_000
export const INITIAL_VIRTUAL_ETH = 1
export const INITIAL_VIRTUAL_TOKENS = 1_073_000_000
export const GRADUATION_ETH = 2.8
export const LAUNCH_FEE = 0.0005
export const FEE_PCT = 0.01
export const HOLDER_SHARE = 0.5
export const CREATOR_SHARE = 0.25
export const PROTOCOL_SHARE = 0.25
export const SALVO_WALLET_CAP = 0.05
export const SALVO_GLOBAL_CAP = 1.25
export const SALVO_DURATION_MS = 120_000

export function tokensOutForEth(vEth: number, vTok: number, ethIn: number): number {
  const k = vEth * vTok
  return vTok - k / (vEth + ethIn)
}

export function ethOutForTokens(vEth: number, vTok: number, tokIn: number): number {
  const k = vEth * vTok
  return vEth - k / (vTok + tokIn)
}

export function spotPrice(vEth: number, vTok: number): number {
  return vEth / vTok
}

export function marketCapEth(vEth: number, vTok: number): number {
  return spotPrice(vEth, vTok) * TOTAL_SUPPLY
}
