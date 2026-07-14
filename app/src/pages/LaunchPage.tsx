import { useRef, useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { createLaunch, tickerTakenBy } from '../mock'

/** Cover-crop and resize to 256px so token images stay small and square. */
async function fileToTokenImage(file: File): Promise<string> {
  const bitmap = await createImageBitmap(file)
  const size = 256
  const canvas = document.createElement('canvas')
  canvas.width = size
  canvas.height = size
  const ctx = canvas.getContext('2d')!
  const scale = Math.max(size / bitmap.width, size / bitmap.height)
  const w = bitmap.width * scale
  const h = bitmap.height * scale
  ctx.drawImage(bitmap, (size - w) / 2, (size - h) / 2, w, h)
  bitmap.close()
  return canvas.toDataURL('image/webp', 0.85)
}

export default function LaunchPage() {
  const nav = useNavigate()
  const fileInput = useRef<HTMLInputElement>(null)
  const [name, setName] = useState('')
  const [symbol, setSymbol] = useState('')
  const [image, setImage] = useState('')
  const [imageUrl, setImageUrl] = useState('')
  const [x, setX] = useState('')
  const [telegram, setTelegram] = useState('')
  const [website, setWebsite] = useState('')
  const [dragging, setDragging] = useState(false)
  const preview = image || imageUrl.trim()

  async function handleFile(file: File | undefined | null) {
    if (!file || !file.type.startsWith('image/')) return
    try {
      setImage(await fileToTokenImage(file))
      setImageUrl('')
    } catch {
      // Unreadable image, leave the uploader as is.
    }
  }

  const vampedBy = tickerTakenBy(symbol)

  function submit() {
    if (!name.trim() || !symbol.trim() || vampedBy) return
    const socials = {
      x: x.trim() || undefined,
      telegram: telegram.trim() || undefined,
      website: website.trim() || undefined,
    }
    const hasSocials = socials.x || socials.telegram || socials.website
    const mint = createLaunch(name.trim(), symbol.trim(), preview || undefined, hasSocials ? socials : undefined)
    if (mint) nav(`/t/${mint}`)
  }

  return (
    <main>
      <Link to="/" className="back-link">← back to the board</Link>
      <h1 style={{ fontSize: 22, marginBottom: 4 }}>Launch a token</h1>
      <p className="note" style={{ maxWidth: 560 }}>
        One click, no presale, no team allocation. Your token opens with a 2-minute
        salvo, a batch auction where every buyer clears at the same price, so your
        community's first candle isn't a sniper's exit.
      </p>

      <div className="launch-form">
        <label>Name</label>
        <input value={name} onChange={(e) => setName(e.target.value)} placeholder="Trench Rat" maxLength={32} />
        <label>Ticker</label>
        <input value={symbol} onChange={(e) => setSymbol(e.target.value)} placeholder="RAT" maxLength={12} />
        {vampedBy ? (
          <p className="annot" style={{ color: 'var(--red)', marginTop: 6 }}>
            taken by "{vampedBy}". one live token per ticker, no vamps.
          </p>
        ) : symbol.trim() ? (
          <p className="annot" style={{ color: 'var(--green)', marginTop: 6 }}>
            ${symbol.trim().toUpperCase()} is free. it's yours.
          </p>
        ) : null}
        <label>Image</label>
        <div
          className={`uploader${dragging ? ' dragging' : ''}`}
          onClick={() => fileInput.current?.click()}
          onDragOver={(e) => { e.preventDefault(); setDragging(true) }}
          onDragLeave={() => setDragging(false)}
          onDrop={(e) => { e.preventDefault(); setDragging(false); handleFile(e.dataTransfer.files?.[0]) }}
        >
          {preview ? (
            <>
              <img src={preview} alt="token preview" />
              <div className="uploader-hint">
                <span>Looking sharp. Click to swap it.</span>
                <button
                  className="btn"
                  style={{ padding: '4px 10px', fontSize: 12 }}
                  onClick={(e) => { e.stopPropagation(); setImage(''); setImageUrl('') }}
                >
                  Remove
                </button>
              </div>
            </>
          ) : (
            <div className="uploader-hint">
              <span className="accent-text">Click to upload</span>
              <span>or drag an image here. Square works best, we crop to 256px.</span>
            </div>
          )}
        </div>
        <input
          ref={fileInput}
          type="file"
          accept="image/*"
          style={{ display: 'none' }}
          onChange={(e) => { handleFile(e.target.files?.[0]); e.target.value = '' }}
        />
        <label>Or paste an image URL</label>
        <input
          value={imageUrl}
          onChange={(e) => { setImageUrl(e.target.value); setImage('') }}
          placeholder="https://…"
        />
        <div className="socials-grid">
          <div>
            <label>X / Twitter</label>
            <input value={x} onChange={(e) => setX(e.target.value)} placeholder="https://x.com/…" />
          </div>
          <div>
            <label>Telegram</label>
            <input value={telegram} onChange={(e) => setTelegram(e.target.value)} placeholder="https://t.me/…" />
          </div>
          <div>
            <label>Website</label>
            <input value={website} onChange={(e) => setWebsite(e.target.value)} placeholder="https://…" />
          </div>
        </div>
        <p className="note" style={{ marginTop: 6 }}>
          Socials are optional but tokens with them get aped harder. They show as
          one-click icons on your card and token page.
        </p>
        <div style={{ marginTop: 20 }}>
          <button className="btn btn-accent btn-block" onClick={submit} disabled={!name.trim() || !symbol.trim() || !!vampedBy}>
            Fire the opening salvo
          </button>
        </div>
        <p className="note" style={{ marginTop: 8 }}>
          Costs a flat 0.0005 ETH platform fee plus gas. You earn 50% of every trade
          fee on your token, forever.
        </p>
      </div>

      <div className="section-head"><h2 className="section-title">How a launch works</h2></div>
      <div className="hiw">
        <div className="hiw-step">
          <div className="hiw-num">01 · LAUNCH</div>
          <div className="hiw-title">Supply is fixed at 1B</div>
          <div className="hiw-body">All of it goes to the curve. Mint authority is burned in the same transaction, so nobody can print more, including you.</div>
        </div>
        <div className="hiw-step">
          <div className="hiw-num">02 · THE SALVO (2 MIN)</div>
          <div className="hiw-title">Everyone fires at once</div>
          <div className="hiw-body">Buys are commitments, capped at 0.05 ETH per wallet. When the window closes the whole batch clears at one average price. No gas war, nothing to snipe.</div>
        </div>
        <div className="hiw-step">
          <div className="hiw-num">03 · LIVE</div>
          <div className="hiw-title">Trade on the curve</div>
          <div className="hiw-body">1% fee on every trade, half of it paid to you in ETH, on every single trade, forever. Building pays.</div>
        </div>
        <div className="hiw-step">
          <div className="hiw-num">04 · GRADUATION</div>
          <div className="hiw-title">Over the top at 2.8 ETH</div>
          <div className="hiw-body">Curve liquidity plus 200M reserved tokens seed the Salvo pool, where the same fee split keeps paying you after graduation.</div>
        </div>
      </div>
    </main>
  )
}
