import type { Socials } from '../types'

// Rendered as buttons (not anchors) because cards are already <a> elements
// and anchors can't nest. window.open is fine for user-initiated clicks.
function open(e: React.MouseEvent, url: string) {
  e.preventDefault()
  e.stopPropagation()
  window.open(url, '_blank', 'noopener,noreferrer')
}

const X_PATH = 'M14.2 2H17l-6 6.9L18 18h-5.6l-4.3-5.6L3.2 18H.4l6.5-7.4L.2 2h5.7l3.9 5.1L14.2 2zm-1 14.4h1.5L5.1 3.5H3.5l9.7 12.9z'
const TG_PATH = 'M17.6 2.5 1.5 8.8c-1 .4-1 1.4-.2 1.7l4.1 1.3 1.6 4.9c.2.6 1 .8 1.5.3l2.2-2.1 4.3 3.2c.6.4 1.4.1 1.6-.6l2.7-13c.2-.9-.6-1.6-1.7-1zm-3 3.5-6.2 5.6-.2 2.5-1.2-3.9 7.3-4.6c.4-.2.7.1.3.4z'
const WEB_PATH = 'M10 1a9 9 0 1 0 0 18 9 9 0 0 0 0-18zm6.9 8h-2.6a14 14 0 0 0-1.2-5.2A7 7 0 0 1 16.9 9zM10 3.1c.9 1.1 1.9 3.1 2.2 5.9H7.8c.3-2.8 1.3-4.8 2.2-5.9zM3.1 11h2.6c.1 1.9.5 3.7 1.2 5.2A7 7 0 0 1 3.1 11zm2.6-2H3.1a7 7 0 0 1 3.8-5.2A14 14 0 0 0 5.7 9zM10 16.9c-.9-1.1-1.9-3.1-2.2-5.9h4.4c-.3 2.8-1.3 4.8-2.2 5.9zm3.1-.7c.7-1.5 1.1-3.3 1.2-5.2h2.6a7 7 0 0 1-3.8 5.2z'

function Icon({ path }: { path: string }) {
  return (
    <svg viewBox="0 0 20 20" fill="currentColor" aria-hidden="true">
      <path d={path} />
    </svg>
  )
}

export default function SocialRow({ socials, size = 22 }: { socials?: Socials; size?: number }) {
  if (!socials || (!socials.x && !socials.telegram && !socials.website)) return null
  const items = [
    socials.x && { url: socials.x, label: 'X', path: X_PATH },
    socials.telegram && { url: socials.telegram, label: 'Telegram', path: TG_PATH },
    socials.website && { url: socials.website, label: 'Website', path: WEB_PATH },
  ].filter(Boolean) as { url: string; label: string; path: string }[]
  return (
    <span className="soc-row">
      {items.map((s) => (
        <button
          key={s.label}
          className="soc"
          style={{ width: size, height: size }}
          aria-label={s.label}
          title={s.label}
          onClick={(e) => open(e, s.url)}
        >
          <Icon path={s.path} />
        </button>
      ))}
    </span>
  )
}
