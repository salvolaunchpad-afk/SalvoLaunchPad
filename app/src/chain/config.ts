import { PublicKey } from '@solana/web3.js'

export const PROGRAM_ID = new PublicKey('yY4cYAc6iE2WtaPbcbsBVqEH5b7sjvsSunt4itujQa3')

const utf8 = (s: string) => new TextEncoder().encode(s)

export const configPda = () =>
  PublicKey.findProgramAddressSync([utf8('config')], PROGRAM_ID)[0]

export const curvePda = (mint: PublicKey) =>
  PublicKey.findProgramAddressSync([utf8('curve'), mint.toBuffer()], PROGRAM_ID)[0]

export const solVaultPda = (curve: PublicKey) =>
  PublicKey.findProgramAddressSync([utf8('sol_vault'), curve.toBuffer()], PROGRAM_ID)[0]

export const rewardVaultPda = (curve: PublicKey) =>
  PublicKey.findProgramAddressSync([utf8('reward_vault'), curve.toBuffer()], PROGRAM_ID)[0]

export const tokenVaultPda = (curve: PublicKey) =>
  PublicKey.findProgramAddressSync([utf8('token_vault'), curve.toBuffer()], PROGRAM_ID)[0]

export const stakeVaultPda = (curve: PublicKey) =>
  PublicKey.findProgramAddressSync([utf8('stake_vault'), curve.toBuffer()], PROGRAM_ID)[0]

export const commitPda = (curve: PublicKey, buyer: PublicKey) =>
  PublicKey.findProgramAddressSync([utf8('commit'), curve.toBuffer(), buyer.toBuffer()], PROGRAM_ID)[0]

export const positionPda = (curve: PublicKey, owner: PublicKey) =>
  PublicKey.findProgramAddressSync([utf8('position'), curve.toBuffer(), owner.toBuffer()], PROGRAM_ID)[0]
