import { getDefaultConfig } from '@rainbow-me/rainbowkit'
import { http } from 'wagmi'
import { ACTIVE_CHAIN } from './config'

// WalletConnect project id (for mobile/QR wallets). Injected wallets like
// MetaMask work without it; set VITE_WC_PROJECT_ID to enable the rest.
const WC_PROJECT_ID = import.meta.env.VITE_WC_PROJECT_ID ?? 'salvo_launchpad_demo'

export const wagmiConfig = getDefaultConfig({
  appName: 'Salvo',
  projectId: WC_PROJECT_ID,
  chains: [ACTIVE_CHAIN],
  transports: { [ACTIVE_CHAIN.id]: http() },
  ssr: false,
})
