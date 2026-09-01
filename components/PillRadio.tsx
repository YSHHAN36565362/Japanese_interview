'use client'

export type PillOption = { value: string; label: string }

export default function PillRadio({
  options,
  value,
  onChange,
  name,
}: {
  options: PillOption[]
  value: string
  onChange: (value: string) => void
  name: string
}) {
  const index = Math.max(
    0,
    options.findIndex((o) => o.value === value)
  )
  const widthPct = 100 / options.length

  return (
    <div className="pill-radio" role="radiogroup" aria-label={name}>
      <div
        className="pill-indicator"
        style={{ width: `${widthPct}%`, transform: `translateX(${index * 100}%)` }}
      />
      {options.map((opt) => (
        <button
          key={opt.value}
          type="button"
          role="radio"
          aria-checked={value === opt.value}
          className={`pill-btn${value === opt.value ? ' active' : ''}`}
          onClick={() => onChange(opt.value)}
        >
          {opt.label}
        </button>
      ))}
    </div>
  )
}
