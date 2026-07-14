import { useEffect, useRef, type ReactNode } from 'react'

/** Framer-style reveal-on-scroll wrapper. */
export function Reveal({ children, delay = 0, className = '' }: {
  children: ReactNode
  delay?: number
  className?: string
}) {
  const ref = useRef<HTMLDivElement>(null)
  useEffect(() => {
    const el = ref.current
    if (!el) return
    const io = new IntersectionObserver(
      ([e]) => {
        if (e.isIntersecting) {
          el.classList.add('in')
          io.disconnect()
        }
      },
      { threshold: 0.12 },
    )
    io.observe(el)
    return () => io.disconnect()
  }, [])
  return (
    <div ref={ref} className={`reveal ${className}`} style={{ transitionDelay: `${delay}ms` }}>
      {children}
    </div>
  )
}

const ink = { stroke: 'var(--ink)', strokeWidth: 2.2, fill: 'none', strokeLinecap: 'round', strokeLinejoin: 'round' } as const
const orange = { ...ink, stroke: 'var(--accent)' } as const

/** Small curvy hand-drawn arrow pointing down-right (like the template's). */
export function ArrowDoodle({ width = 46, flip = false }: { width?: number; flip?: boolean }) {
  return (
    <svg viewBox="0 0 46 34" width={width} style={{ transform: flip ? 'scaleX(-1)' : undefined }} aria-hidden="true">
      <path {...ink} d="M3 6 Q20 4 30 14 T42 26" />
      <path {...ink} d="M34 26 L42 26 L40 18" />
    </svg>
  )
}

/** Hand-drawn squiggle underline. */
export function Squiggle({ width = 120, color = 'var(--ink)' }: { width?: number; color?: string }) {
  return (
    <svg viewBox="0 0 120 12" width={width} aria-hidden="true">
      <path {...ink} stroke={color} d="M3 7 Q13 3 23 7 T43 7 T63 7 T83 7 T103 7 T117 6" />
    </svg>
  )
}

/** Little hand-drawn sparkle stars. */
export function Sparkle({ size = 22, color = 'var(--accent)' }: { size?: number; color?: string }) {
  return (
    <svg viewBox="0 0 24 24" width={size} aria-hidden="true">
      <path {...ink} stroke={color} d="M12 2 L12 9 M12 15 L12 22 M2 12 L9 12 M15 12 L22 12" />
    </svg>
  )
}

/* ── Storyboard stage doodles ─────────────────────────── */

/** 01: the cannon fires — launching. */
export function DoodleLaunch() {
  return (
    <svg viewBox="0 0 120 92" aria-hidden="true">
      <path {...ink} d="M14 84 Q34 80 54 84 T98 84" />
      <circle {...ink} cx="32" cy="72" r="10" />
      <circle cx="32" cy="72" r="2.4" fill="var(--ink)" />
      <path {...ink} d="M38 66 L66 40" />
      <path {...ink} d="M28 58 L56 32" />
      <path {...ink} d="M56 32 Q66 30 66 40" />
      <path {...orange} d="M76 26 L82 18 M84 30 L92 26 M74 36 L80 36" />
      <circle {...orange} cx="98" cy="14" r="6" />
      <path {...ink} d="M84 12 L90 12 M80 20 L86 19" opacity="0.5" />
    </svg>
  )
}

/** 02: the salvo — 2-minute clock, everyone converges on one price. */
export function DoodleSalvo() {
  return (
    <svg viewBox="0 0 120 92" aria-hidden="true">
      <circle {...ink} cx="32" cy="30" r="17" />
      <path {...ink} d="M32 20 L32 30 L41 34" />
      <path {...ink} d="M32 9 L32 13 M53 30 L49 30 M32 51 L32 47 M11 30 L15 30" opacity="0.6" />
      <path {...ink} d="M62 14 Q80 20 88 44" />
      <path {...ink} d="M83 38 L88 44 L90 36" />
      <path {...ink} d="M56 66 Q72 62 84 54" />
      <path {...ink} d="M77 53 L84 54 L80 60" />
      <path {...ink} d="M110 76 Q100 66 94 58" />
      <path {...ink} d="M95 65 L94 58 L101 60" />
      <circle {...orange} cx="90" cy="50" r="7" />
      <circle cx="90" cy="50" r="2" fill="var(--accent)" />
    </svg>
  )
}

/** 03: the curve — price grinds up, fees rain on holders. */
export function DoodleCurve() {
  return (
    <svg viewBox="0 0 120 92" aria-hidden="true">
      <path {...ink} d="M18 12 L18 76 L106 76" />
      <path {...ink} d="M22 68 Q36 66 46 56 T70 38 T96 22" />
      <path {...ink} d="M89 21 L96 22 L94 29" />
      <path {...orange} d="M52 30 L52 36 M60 24 L60 30 M68 30 L68 36" />
      <path {...ink} d="M30 72 L32 70 M34 72 L36 70 M42 72 L44 70" opacity="0.45" />
      <circle {...orange} cx="96" cy="22" r="3.4" />
    </svg>
  )
}

/** 04: over the top — flag planted, pool locked. */
export function DoodleGrad() {
  return (
    <svg viewBox="0 0 120 92" aria-hidden="true">
      <path {...ink} d="M8 80 Q58 38 112 80" />
      <path {...ink} d="M58 56 L58 20" />
      <path d="M58 20 L84 27 L58 35 Z" fill="var(--accent)" stroke="var(--ink)" strokeWidth="2" strokeLinejoin="round" />
      <ellipse {...ink} cx="92" cy="74" rx="15" ry="6" />
      <path {...ink} d="M86 66 L86 61 Q86 55 92 55 Q98 55 98 61 L98 66" />
      <rect x="83" y="64" width="18" height="12" rx="3" fill="var(--paper-2)" stroke="var(--ink)" strokeWidth="2" />
      <circle cx="92" cy="70" r="1.8" fill="var(--ink)" />
    </svg>
  )
}
