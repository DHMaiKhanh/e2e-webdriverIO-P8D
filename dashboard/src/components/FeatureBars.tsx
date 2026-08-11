import type { FeatureSummary } from "../types"
import { STATUS_META, STATUS_ORDER, fmtInt } from "../format"

/**
 * One horizontal stacked bar per feature (describe suite), width split by
 * status. Features arrive pre-sorted most-broken-first, so the rows that need
 * attention sit at the top. Hover any bar for the full breakdown.
 */
export function FeatureBars({ features }: { features: FeatureSummary[] }) {
  return (
    <div className="features">
      {features.map((f) => {
        const total = f.total || 1
        return (
          <div className="frow" key={f.name}>
            <div className="fname" title={f.name}>
              {f.name} <span className="farea">· {f.area}</span>
            </div>
            <div
              className="fbar"
              title={STATUS_ORDER.map((s) => `${STATUS_META[s].label} ${f[s]}`).join("  ·  ")}
            >
              {STATUS_ORDER.filter((s) => f[s] > 0).map((s) => (
                <span
                  key={s}
                  className="fseg"
                  style={{ width: `${(f[s] / total) * 100}%`, background: STATUS_META[s].color }}
                />
              ))}
            </div>
            <div className="frate" title={`${fmtInt(f.total)} test`}>
              {f.passed + f.failed + f.broken > 0 ? `${f.passRate}%` : "—"}
            </div>
          </div>
        )
      })}
    </div>
  )
}
