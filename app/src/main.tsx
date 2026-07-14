import React from 'react'
import ReactDOM from 'react-dom/client'
import { HashRouter } from 'react-router-dom'
import { WagmiProvider } from 'wagmi'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { RainbowKitProvider, lightTheme } from '@rainbow-me/rainbowkit'
import { wagmiConfig } from './chain/wagmi'
import App from './App'
import '@rainbow-me/rainbowkit/styles.css'
import './styles.css'

const queryClient = new QueryClient()

const salvoTheme = lightTheme({
  accentColor: '#ff6b2b',
  accentColorForeground: '#1f1c17',
  borderRadius: 'medium',
  overlayBlur: 'small',
})

ReactDOM.createRoot(document.getElementById('root')!).render(
  <React.StrictMode>
    <WagmiProvider config={wagmiConfig}>
      <QueryClientProvider client={queryClient}>
        <RainbowKitProvider theme={salvoTheme} modalSize="compact">
          <HashRouter>
            <App />
          </HashRouter>
        </RainbowKitProvider>
      </QueryClientProvider>
    </WagmiProvider>
  </React.StrictMode>,
)
