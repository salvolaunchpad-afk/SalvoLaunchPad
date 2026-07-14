// Mirror of the on-chain constant-product math (programs/salvo/src/math.rs).
// All SOL values here are in whole SOL (floats are fine for UI estimates;
// the program does the exact u128 math).

export const TOTAL_SUPPLY = 1_000_000_000
export const CURVE_SUPPLY = 800_000_000
export const INITIAL_VIRTUAL_SOL = 30
export const INITIAL_VIRTUAL_TOKENS = 1_073_000_000
export const GRADUATION_SOL = 85
export const FEE_PCT = 0.01
export const HOLDER_SHARE = 0.5
export const CREATOR_SHARE = 0.25
export const PROTOCOL_SHARE = 0.25
export const SALVO_WALLET_CAP = 2
export const SALVO_GLOBAL_CAP = 40
export const SALVO_DURATION_MS = 120_000

export function tokensOutForSol(vSol: number, vTok: number, solIn: number): number {
  const k = vSol * vTok
  return vTok - k / (vSol + solIn)
}

export function solOutForTokens(vSol: number, vTok: number, tokIn: number): number {
  const k = vSol * vTok
  return vSol - k / (vTok + tokIn)
}

export function spotPrice(vSol: number, vTok: number): number {
  return vSol / vTok
}

export function marketCapSol(vSol: number, vTok: number): number {
  return spotPrice(vSol, vTok) * TOTAL_SUPPLY
}
