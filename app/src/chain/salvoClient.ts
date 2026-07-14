// Real-chain client for the Salvo program. Mirrors the mock layer's API so
// pages can swap between them behind one interface once we deploy to devnet.
//
// Wiring status: instruction builders are complete; they need
// `target/idl/salvo.json` copied to `src/chain/idl/salvo.json` (done by
// `npm run sync-idl` — see package.json) after `anchor build`, and the
// program deployed. Until then nothing imports this module.
import { AnchorProvider, BN, Program, type Idl } from '@coral-xyz/anchor'
import type { AnchorWallet } from '@solana/wallet-adapter-react'
import { Connection, Keypair, PublicKey, SystemProgram } from '@solana/web3.js'
import {
  commitPda, configPda, curvePda, positionPda, rewardVaultPda,
  solVaultPda, stakeVaultPda, tokenVaultPda,
} from './config'

const TOKEN_PROGRAM_ID = new PublicKey('TokenkegQfeZyiNwAJbNbGKPFXCWuBvf9Ss623VQ5DA')
const ASSOCIATED_TOKEN_PROGRAM_ID = new PublicKey('ATokenGPvbdGVxr1b2hvZbsiqW5xWH25efTNsLJA8knL')

const LAMPORTS = 1_000_000_000

function ata(mint: PublicKey, owner: PublicKey): PublicKey {
  return PublicKey.findProgramAddressSync(
    [owner.toBuffer(), TOKEN_PROGRAM_ID.toBuffer(), mint.toBuffer()],
    ASSOCIATED_TOKEN_PROGRAM_ID,
  )[0]
}

export class SalvoClient {
  readonly program: Program

  constructor(connection: Connection, wallet: AnchorWallet, idl: Idl) {
    const provider = new AnchorProvider(connection, wallet, { commitment: 'confirmed' })
    this.program = new Program(idl, provider)
  }

  get walletKey(): PublicKey {
    return (this.program.provider as AnchorProvider).wallet.publicKey
  }

  /** Creates mint + curve and opens the salvo. Returns the new mint address. */
  async createLaunch(name: string, symbol: string, uri: string, treasury: PublicKey): Promise<PublicKey> {
    const mint = Keypair.generate()
    const curve = curvePda(mint.publicKey)
    await this.program.methods
      .createLaunch(name, symbol, uri)
      .accountsPartial({
        creator: this.walletKey,
        config: configPda(),
        mint: mint.publicKey,
        curve,
        tokenVault: tokenVaultPda(curve),
        stakeVault: stakeVaultPda(curve),
        solVault: solVaultPda(curve),
        rewardVault: rewardVaultPda(curve),
        treasury,
        tokenProgram: TOKEN_PROGRAM_ID,
        systemProgram: SystemProgram.programId,
      })
      .signers([mint])
      .rpc()
    return mint.publicKey
  }

  async salvoCommit(mint: PublicKey, sol: number): Promise<string> {
    const curve = curvePda(mint)
    return this.program.methods
      .salvoCommit(new BN(Math.round(sol * LAMPORTS)))
      .accountsPartial({
        buyer: this.walletKey,
        config: configPda(),
        curve,
        mint,
        commit: commitPda(curve, this.walletKey),
        buyerAta: ata(mint, this.walletKey),
        solVault: solVaultPda(curve),
        tokenProgram: TOKEN_PROGRAM_ID,
        associatedTokenProgram: ASSOCIATED_TOKEN_PROGRAM_ID,
        systemProgram: SystemProgram.programId,
      })
      .rpc()
  }

  /** Permissionless — any client can crank a settle once the window closes. */
  async salvoSettle(mint: PublicKey, creator: PublicKey, treasury: PublicKey): Promise<string> {
    const curve = curvePda(mint)
    return this.program.methods
      .salvoSettle()
      .accountsPartial({
        cranker: this.walletKey,
        config: configPda(),
        curve,
        solVault: solVaultPda(curve),
        rewardVault: rewardVaultPda(curve),
        creatorWallet: creator,
        treasury,
        systemProgram: SystemProgram.programId,
      })
      .rpc()
  }

  /** Permissionless: deliver a committer's tokens after settle. The platform
   *  crank bot calls this for every commit so buyers never claim manually. */
  async salvoDistribute(mint: PublicKey, buyer: PublicKey): Promise<string> {
    const curve = curvePda(mint)
    return this.program.methods
      .salvoDistribute()
      .accountsPartial({
        cranker: this.walletKey,
        curve,
        mint,
        buyer,
        commit: commitPda(curve, buyer),
        tokenVault: tokenVaultPda(curve),
        buyerAta: ata(mint, buyer),
        tokenProgram: TOKEN_PROGRAM_ID,
        associatedTokenProgram: ASSOCIATED_TOKEN_PROGRAM_ID,
        systemProgram: SystemProgram.programId,
      })
      .rpc()
  }

  async buy(mint: PublicKey, creator: PublicKey, treasury: PublicKey, sol: number, minTokensOut: bigint): Promise<string> {
    return this.trade('buy', mint, creator, treasury, new BN(Math.round(sol * LAMPORTS)), new BN(minTokensOut.toString()))
  }

  async sell(mint: PublicKey, creator: PublicKey, treasury: PublicKey, tokens: bigint, minSolOut: bigint): Promise<string> {
    return this.trade('sell', mint, creator, treasury, new BN(tokens.toString()), new BN(minSolOut.toString()))
  }

  private trade(method: 'buy' | 'sell', mint: PublicKey, creator: PublicKey, treasury: PublicKey, a: BN, b: BN): Promise<string> {
    const curve = curvePda(mint)
    return this.program.methods[method](a, b)
      .accountsPartial({
        trader: this.walletKey,
        config: configPda(),
        curve,
        mint,
        tokenVault: tokenVaultPda(curve),
        solVault: solVaultPda(curve),
        rewardVault: rewardVaultPda(curve),
        creatorWallet: creator,
        treasury,
        traderAta: ata(mint, this.walletKey),
        tokenProgram: TOKEN_PROGRAM_ID,
        associatedTokenProgram: ASSOCIATED_TOKEN_PROGRAM_ID,
        systemProgram: SystemProgram.programId,
      })
      .rpc()
  }

  async stake(mint: PublicKey, amount: bigint): Promise<string> {
    return this.stakeOp('stake', mint, new BN(amount.toString()))
  }

  async unstake(mint: PublicKey, amount: bigint): Promise<string> {
    return this.stakeOp('unstake', mint, new BN(amount.toString()))
  }

  async claimRewards(mint: PublicKey): Promise<string> {
    const curve = curvePda(mint)
    return this.program.methods
      .claimRewards()
      .accountsPartial(this.stakeAccounts(mint, curve))
      .rpc()
  }

  private stakeOp(method: 'stake' | 'unstake', mint: PublicKey, amount: BN): Promise<string> {
    const curve = curvePda(mint)
    return this.program.methods[method](amount)
      .accountsPartial(this.stakeAccounts(mint, curve))
      .rpc()
  }

  private stakeAccounts(mint: PublicKey, curve: PublicKey) {
    return {
      owner: this.walletKey,
      config: configPda(),
      curve,
      mint,
      stakeVault: stakeVaultPda(curve),
      ownerAta: ata(mint, this.walletKey),
      position: positionPda(curve, this.walletKey),
      rewardVault: rewardVaultPda(curve),
      tokenProgram: TOKEN_PROGRAM_ID,
      systemProgram: SystemProgram.programId,
    }
  }
}
