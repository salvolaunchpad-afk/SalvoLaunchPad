// Ready-to-wire write builders for the deployed Salvo contract. Each returns
// the exact params object for wagmi's `useWriteContract().writeContract(...)`.
// The UI still runs on the mock layer until SALVO_ADDRESS is set (IS_LIVE);
// swapping the action handlers in the pages to call these is the post-deploy
// step. Reads (launch lists, curve state, pending rewards) come from the
// contract's view functions plus an event indexer, added alongside deploy.
import { parseEther } from 'viem'
import { SALVO_ADDRESS } from './config'
import { SALVO_ABI } from './salvoAbi'

const base = { address: SALVO_ADDRESS, abi: SALVO_ABI } as const

export const salvoWrites = {
  createLaunch: (name: string, symbol: string, uri: string, launchFeeEth: number) => ({
    ...base,
    functionName: 'createLaunch',
    args: [name, symbol, uri],
    value: parseEther(String(launchFeeEth)),
  }),

  commit: (token: `0x${string}`, eth: number) => ({
    ...base,
    functionName: 'commit',
    args: [token],
    value: parseEther(String(eth)),
  }),

  settle: (token: `0x${string}`) => ({
    ...base,
    functionName: 'settle',
    args: [token],
  }),

  distribute: (token: `0x${string}`, maxCount: number) => ({
    ...base,
    functionName: 'distribute',
    args: [token, BigInt(maxCount)],
  }),

  buy: (token: `0x${string}`, eth: number, minTokensOut: bigint) => ({
    ...base,
    functionName: 'buy',
    args: [token, minTokensOut],
    value: parseEther(String(eth)),
  }),

  sell: (token: `0x${string}`, tokens: bigint, minEthOut: bigint) => ({
    ...base,
    functionName: 'sell',
    args: [token, tokens, minEthOut],
  }),

  withdraw: () => ({
    ...base,
    functionName: 'withdraw',
    args: [],
  }),
}
