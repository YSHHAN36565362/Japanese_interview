'use client'

export default function MicToggle({
  checked,
  onChange,
  disabled,
  label = '따라 말하기',
}: {
  checked: boolean
  onChange: (value: boolean) => void
  disabled?: boolean
  label?: string
}) {
  return (
    <div className="mic-toggle-block">
      <span className={`mic-toggle-label${checked ? ' active' : ''}`}>
        {checked ? '인식 중이에요 — 말씀해 주세요' : `${label} (눌러서 시작)`}
      </span>
      <label className="neo-toggle-container">
        <input
          type="checkbox"
          className="neo-toggle-input"
          checked={checked}
          disabled={disabled}
          onChange={(e) => onChange(e.target.checked)}
        />
        <span className="neo-toggle">
          <span className="neo-track">
            <span className="neo-background-layer" />
            <span className="neo-grid-layer" />
            <span className="neo-track-highlight" />
            <span className="neo-spectrum-analyzer">
              <span className="neo-spectrum-bar" />
              <span className="neo-spectrum-bar" />
              <span className="neo-spectrum-bar" />
              <span className="neo-spectrum-bar" />
              <span className="neo-spectrum-bar" />
            </span>
          </span>
          <span className="neo-thumb">
            <span className="neo-thumb-ring" />
            <span className="neo-thumb-core">
              <span className="neo-thumb-wave" />
            </span>
            <span className="neo-thumb-pulse" />
          </span>
        </span>
        <span className="neo-status">
          <span className="neo-status-dot" />
          <span className="neo-status-text">{checked ? 'ON AIR' : 'STANDBY'}</span>
        </span>
      </label>
    </div>
  )
}
