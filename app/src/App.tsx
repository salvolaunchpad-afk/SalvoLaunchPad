import { Link, Route, Routes } from 'react-router-dom'
import { ConnectButton } from '@rainbow-me/rainbowkit'
import Ticker from './components/Ticker'
import { useEthPrice } from './hooks'
import Home from './pages/Home'
import HowItWorks from './pages/HowItWorks'
import LaunchPage from './pages/LaunchPage'
import TokenPage from './pages/TokenPage'

export default function App() {
  const ethUsd = useEthPrice()
  return (
    <div className="shell">
      <header className="topbar">
        <Link to="/" className="logo">
          <span className="logo-word"><span className="hl">Salvo</span></span>
          <span className="logo-tag">everyone fires at once</span>
        </Link>
        <div className="topbar-actions">
          <Link to="/how" className="nav-link">How it works</Link>
          {ethUsd !== null && (
            <span className="sol-price">ETH <b>${ethUsd.toFixed(2)}</b></span>
          )}
          <Link to="/launch" className="btn btn-accent">Launch a token</Link>
          <ConnectButton showBalance={false} accountStatus="address" chainStatus="icon" />
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
