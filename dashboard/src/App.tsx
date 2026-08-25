import { useEffect, useMemo, useState } from "react"
import type { Dashboard, Status, TestResult } from "./types"
import { STATUS_META, fmtDuration, fmtInt, fmtTime } from "./format"
import { Donut } from "./components/Donut"
import { FeatureBars } from "./components/FeatureBars"

type StatusFilter = "problems" | "passed" | "skipped" | "notRun" | "all"

const STATUS_FILTERS: { key: StatusFilter; label: string }[] = [
  { key: "problems", label: "Có lỗi" },
  { key: "passed", label: "Pass" },
  { key: "skipped", label: "Skip" },
  { key: "notRun", label: "Chưa chạy" },
  { key: "all", label: "Tất cả" }
]

function matchesStatus(s: Status, filter: StatusFilter): boolean {
  if (filter === "all") return true
  if (filter === "problems") return s === "failed" || s === "broken"
  return s === filter
}

function StatusChip({ status }: { status: Status }) {
  const m = STATUS_META[status]
  return (
    <span className={`chip ${status}`}>
      <span className="ic" style={{ background: m.color }} />
      {m.label}
    </span>
  )
}

function useTheme(): [string, () => void] {
  const [theme, setTheme] = useState<string>(() => localStorage.getItem("p8d-dash-theme") || "system")
  useEffect(() => {
    const root = document.documentElement
    if (theme === "system") root.removeAttribute("data-theme")
    else root.setAttribute("data-theme", theme)
    localStorage.setItem("p8d-dash-theme", theme)
  }, [theme])
  const cycle = () => setTheme((t) => (t === "system" ? "light" : t === "light" ? "dark" : "system"))
  return [theme, cycle]
}

export function App() {
  const [data, setData] = useState<Dashboard | null>(null)
  const [error, setErr] = useState<string | null>(null)
  const [statusFilter, setStatusFilter] = useState<StatusFilter>("problems")
  const [area, setArea] = useState<string>("all")
  const [query, setQuery] = useState("")
  const [theme, cycleTheme] = useTheme()

  const load = () => {
    setErr(null)
    fetch(`results.json?t=${Date.now()}`)
      .then((r) => (r.ok ? r.json() : Promise.reject(new Error(`HTTP ${r.status}`))))
      .then(setData)
      .catch((e) => setErr(String(e.message || e)))
  }
  useEffect(load, [])

  const areas = useMemo(() => {
    if (!data) return []
    return [...new Set(data.tests.map((t) => t.area))].sort()
  }, [data])

  const filtered = useMemo(() => {
    if (!data) return []
    const q = query.trim().toLowerCase()
    return data.tests.filter((t) => {
      if (!matchesStatus(t.status, statusFilter)) return false
      if (area !== "all" && t.area !== area) return false
      if (!q) return true
      return (
        t.title.toLowerCase().includes(q) ||
        (t.id || "").toLowerCase().includes(q) ||
        t.feature.toLowerCase().includes(q) ||
        (t.error?.message || "").toLowerCase().includes(q)
      )
    })
  }, [data, statusFilter, area, query])

  // Group filtered tests by feature, honouring the data's most-broken-first order.
  const groups = useMemo(() => {
    if (!data) return []
    const order = data.features.map((f) => f.name)
    const map = new Map<string, TestResult[]>()
    for (const t of filtered) {
      if (!map.has(t.feature)) map.set(t.feature, [])
      map.get(t.feature)!.push(t)
    }
    return [...map.entries()]
      .sort((a, b) => order.indexOf(a[0]) - order.indexOf(b[0]))
      .map(([name, tests]) => ({ name, area: tests[0]?.area ?? "", tests }))
  }, [data, filtered])

  if (error) {
    return (
      <div className="app">
        <div className="empty">
          Không đọc được <code>results.json</code> — {error}.<br />
          Chạy <code>npm run data</code> để sinh dữ liệu từ <code>reports/allure-results</code>.
        </div>
      </div>
    )
  }
  if (!data) return <div className="app empty">Đang tải…</div>

  const s = data.summary
  const problems = s.failed + s.broken
  const executed = s.passed + s.failed + s.broken
  const kpis = [
    {
      label: "Tổng test",
      value: fmtInt(s.total),
      sub: `${data.features.length} tính năng · ${fmtInt(executed)} đã chạy`,
      accent: "var(--axis)"
    },
    {
      label: "Passed",
      value: fmtInt(s.passed),
      sub: `${s.passRate}% pass · trên ${fmtInt(executed)} đã chạy`,
      accent: "var(--st-pass)"
    },
    { label: "Failed", value: fmtInt(s.failed), sub: "assertion sai", accent: "var(--st-fail)" },
    { label: "Broken", value: fmtInt(s.broken), sub: "lỗi/timeout khi chạy", accent: "var(--st-broken)" },
    { label: "Skipped", value: fmtInt(s.skipped), sub: "bị gate / it.skip", accent: "var(--st-skip)" },
    {
      label: "Chưa chạy",
      value: fmtInt(s.notRun),
      sub: "có trong code, chưa sinh kết quả",
      accent: "var(--st-notrun)"
    },
    { label: "Thời lượng", value: fmtDuration(s.durationMs), sub: `${fmtInt(problems)} test lỗi`, accent: "var(--axis)" }
  ]
  const themeIcon = theme === "system" ? "🖥️ Auto" : theme === "light" ? "☀️ Sáng" : "🌙 Tối"

  return (
    <div className="app">
      <header className="topbar">
        <div>
          <h1>P8D · E2E Test Dashboard</h1>
          <div className="sub">
            <b>{data.runLabel}</b> · cập nhật {fmtTime(data.generatedAt)} · nguồn <code>{data.source}</code>
          </div>
        </div>
        <div className="toolbelt">
          <button className="btn" onClick={cycleTheme} title="Đổi giao diện sáng/tối">
            {themeIcon}
          </button>
          <button className="btn" onClick={load} title="Tải lại results.json">
            ↻ Làm mới
          </button>
        </div>
      </header>

      <section className="kpis">
        {kpis.map((k) => (
          <div className="kpi" key={k.label} style={{ ["--accent" as string]: k.accent }}>
            <div className="k-label">{k.label}</div>
            <div className="k-value">{k.value}</div>
            <div className="k-sub">{k.sub}</div>
          </div>
        ))}
      </section>

      <section className="grid-main">
        <div className="card">
          <div className="card-h">
            <h2 className="card-title">Tổng quan trạng thái</h2>
          </div>
          <Donut summary={s} />
        </div>
        <div className="card">
          <div className="card-h">
            <h2 className="card-title">Kết quả theo tính năng</h2>
          </div>
          <FeatureBars features={data.features} />
        </div>
      </section>

      <div className="filters">
        <div className="seg">
          {STATUS_FILTERS.map((f) => (
            <button
              key={f.key}
              className={statusFilter === f.key ? "on" : ""}
              onClick={() => setStatusFilter(f.key)}
            >
              {f.label}
            </button>
          ))}
        </div>
        <div className="seg">
          <button className={area === "all" ? "on" : ""} onClick={() => setArea("all")}>
            Mọi nhóm
          </button>
          {areas.map((a) => (
            <button key={a} className={area === a ? "on" : ""} onClick={() => setArea(a)}>
              {a}
            </button>
          ))}
        </div>
        <input
          className="search"
          placeholder="Tìm theo ID, tiêu đề, tính năng, hoặc nội dung lỗi…"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
        />
      </div>

      <section className="card">
        <div className="card-h">
          <h2 className="card-title">
            Chi tiết test &amp; nguyên nhân lỗi ·{" "}
            <span style={{ color: "var(--text-primary)", textTransform: "none", letterSpacing: 0 }}>
              {fmtInt(filtered.length)} test
            </span>
          </h2>
        </div>
        <div className="tbl-wrap">
          {groups.length === 0 && <div className="empty">Không có test nào khớp bộ lọc.</div>}
          {groups.map((g) => {
            const bad = g.tests.filter((t) => t.status === "failed" || t.status === "broken").length
            return (
              <div key={g.name}>
                <div className="grp-h">
                  <span className="gname">{g.name}</span>
                  <span className="gmeta">
                    {g.area} · {fmtInt(g.tests.length)} test{bad ? ` · ${fmtInt(bad)} lỗi` : ""}
                  </span>
                </div>
                {g.tests.map((t, i) => (
                  <div className="test" key={`${t.name}-${i}`}>
                    <StatusChip status={t.status} />
                    <span className="tid">{t.id || "—"}</span>
                    <div>
                      <div className="ttitle">{t.title}</div>
                      {t.tags.length > 0 && (
                        <div className="ttags">
                          {t.tags.map((tag) => (
                            <span className="tag" key={tag}>
                              {tag}
                            </span>
                          ))}
                        </div>
                      )}
                      {t.error && (
                        <div className={`err ${t.status === "broken" ? "broken" : ""}`}>
                          <div className="err-msg">{firstLines(t.error.message, 4)}</div>
                          {t.error.trace && (
                            <details>
                              <summary>Xem stack trace</summary>
                              <pre>{t.error.trace}</pre>
                            </details>
                          )}
                        </div>
                      )}
                    </div>
                    <span className="tdur">{fmtDuration(t.durationMs)}</span>
                  </div>
                ))}
              </div>
            )
          })}
        </div>
      </section>

      <div className="footer">
        Sinh từ Allure results bằng <code>npm run data</code>. Chạy lại test rồi bấm{" "}
        <b>Làm mới</b> để cập nhật số liệu.
      </div>
    </div>
  )
}

/** Keep failure blocks compact — show the first N meaningful lines of the message. */
function firstLines(text: string, n: number): string {
  return text.split("\n").slice(0, n).join("\n").trim()
}
