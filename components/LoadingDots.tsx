export default function LoadingDots({ label }: { label?: string }) {
  return (
    <div className="loading-row">
      <div className="loading-wrapper">
        <span className="loading-circle" />
        <span className="loading-circle" />
        <span className="loading-circle" />
        <span className="loading-shadow" />
        <span className="loading-shadow" />
        <span className="loading-shadow" />
      </div>
      {label && <span className="muted small">{label}</span>}
    </div>
  )
}
