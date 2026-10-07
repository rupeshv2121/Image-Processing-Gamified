// Circular progress ring
export default function Ring({ value = 0, size = 120, stroke = 10, color = 'var(--green-500)', track = 'var(--line-2)', label, sub }) {
  const r = (size - stroke) / 2
  const c = 2 * Math.PI * r
  const v = Math.max(0, Math.min(1, value))
  return (
    <div className="ring" style={{ width: size, height: size }}>
      <svg width={size} height={size}>
        <circle cx={size / 2} cy={size / 2} r={r} stroke={track} strokeWidth={stroke} fill="none" />
        <circle cx={size / 2} cy={size / 2} r={r} stroke={color} strokeWidth={stroke} fill="none" strokeLinecap="round"
          strokeDasharray={c} strokeDashoffset={c * (1 - v)} style={{ transition: 'stroke-dashoffset 0.6s ease' }} />
      </svg>
      <div className="ring-label"><b>{label}</b>{sub && <span>{sub}</span>}</div>
    </div>
  )
}
