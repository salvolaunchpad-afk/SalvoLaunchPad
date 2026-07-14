import { Link, Route, Routes } from 'react-router-dom'
import { WalletMultiButton } from '@solana/wallet-adapter-react-ui'
import Ticker from './components/Ticker'
import { useSolPrice } from './hooks'
import Home from './pages/Home'
import HowItWorks from './pages/HowItWorks'
import LaunchPage from './pages/LaunchPage'
import TokenPage from './pages/TokenPage'

export default function App() {
  const solUsd = useSolPrice()
  return (
    <div className="shell">
      <header className="topbar">
        <Link to="/" className="logo">
          <span className="logo-word">SALVO</span>
          <span className="logo-tag">everyone fires at once</span>
        </Link>
        <div className="topbar-actions">
          <Link to="/how" className="nav-link">How it works</Link>
          {solUsd !== null && (
            <span className="sol-price">SOL <b>${solUsd.toFixed(2)}</b></span>
          )}
          <Link to="/launch" className="btn btn-accent">Launch a token</Link>
          <WalletMultiButton />
        </div>
      </header>
      <Ticker />
      <Routes>
        <Route path="/" element={<Home />} />
        <Route path="/how" element={<HowItWorks />} />
        <Route path="/launch" element={<LaunchPage />} />
        <Route path="/t/:mint" element={<TokenPage />} />
      </Routes>
    </div>
  )
}
