import { useId } from 'react'

export default function Spark({ data, color = 'var(--green)' }: { data: number[]; color?: string }) {
  const gid = useId().replace(/[:]/g, '')
  if (data.length < 2) return <svg className="spark" />
  const min = Math.min(...data)
  const max = Math.max(...data)
  const span = max - min || 1
  const xy = (v: number, i: number): [number, number] => [
    (i / (data.length - 1)) * 100,
    40 - ((v - min) / span) * 34 - 3,
  ]
  const pts = data.map((v, i) => xy(v, i).join(',')).join(' ')
  const area = `0,40 ${pts} 100,40`
  return (
    <svg className="spark" viewBox="0 0 100 40" preserveAspectRatio="none">
      <defs>
        <linearGradient id={gid} x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stopColor={color} stopOpacity="0.28" />
          <stop offset="100%" stopColor={color} stopOpacity="0" />
        </linearGradient>
      </defs>
      <polygon points={area} fill={`url(#${gid})`} />
      <polyline points={pts} fill="none" stroke={color} strokeWidth="1.6" vectorEffect="non-scaling-stroke" />
    </svg>
  )
}
