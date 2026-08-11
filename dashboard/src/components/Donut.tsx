import type { Summary } from "../types"
import { STATUS_META, STATUS_ORDER, fmtInt } from "../format"

/**
 * Overall status donut. The pass-rate sits in the centre as the view's single
 * hero figure (≥48px). Segments carry a 2px surface gap (butt caps + shortened
 * arc) per the dataviz spacer rule; identity also lives in the legend below,
 * so it is never colour-alone.
 */
export function Donut({ summary }: { summary: Summary }) {
  const size = 200
  const stroke = 26
  const r = (size - stroke) / 2
  const cx = size / 2
  const C = 2 * Math.PI * r
  const gap = 3 // arc-length units of surface gap between segments

  const segs = STATUS_ORDER.map((s) => ({ status: s, value: summary[s], color: STATUS_META[s].color }))
  const total = summary.total || 1

  let cum = 0
  const arcs = segs
    .filter((s) => s.value > 0)
    .map((s) => {
      const frac = s.value / total
      const len = frac * C
      const dash = Math.max(len - gap, 0.5)
      const el = (
        <circle
          key={s.status}
          cx={cx}
          cy={cx}
          r={r}
          fill="none"
          stroke={s.color}
          strokeWidth={stroke}
          strokeDasharray={`${dash} ${C - dash}`}
          strokeDashoffset={-cum}
        >
          <title>{`${STATUS_META[s.status].label}: ${fmtInt(s.value)} (${((frac * 100) || 0).toFixed(1)}%)`}</title>
        </circle>
      )
      cum += len
      return el
    })

  return (
    <div className="donut-wrap">
      <svg width={size} height={size} viewBox={`0 0 ${size} ${size}`} role="img" aria-label="Tỉ lệ trạng thái test">
        <g transform={`rotate(-90 ${cx} ${cx})`}>
          <circle cx={cx} cy={cx} r={r} fill="none" stroke="var(--surface-2)" strokeWidth={stroke} />
          {arcs}
        </g>
        <text
          x={cx}
          y={cx - 2}
          textAnchor="middle"
          dominantBaseline="central"
          className="hero"
          fill="var(--text-primary)"
          style={{ fontSize: 44, fontWeight: 680, letterSpacing: "-0.03em" }}
        >
          {summary.passRate}%
        </text>
        <text x={cx} y={cx + 26} textAnchor="middle" className="hero-sub" fontSize={12}>
          tỉ lệ pass
        </text>
      </svg>

      <div className="legend">
        {STATUS_ORDER.map((s) => (
          <div className="legend-row" key={s}>
            <span className="dot" style={{ background: STATUS_META[s].color }} />
            <span>{STATUS_META[s].label}</span>
            <span className="val">{fmtInt(summary[s])}</span>
          </div>
        ))}
      </div>
    </div>
  )
}
