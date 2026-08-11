// @ts-check
/**
 * build-data.mjs — Allure results → dashboard/public/results.json
 *
 * Reads every `*-result.json` that WebdriverIO's Allure reporter drops into
 * reports/allure-results, keeps the LATEST attempt per unique test (dedup by
 * historyId, max start time — so retries and stale runs collapse to the current
 * state), then normalises each test into the flat schema the React dashboard
 * consumes: id / tags / feature (the describe suite) / area (the spec folder) /
 * status / duration / failure reason.
 *
 * No external dependencies — plain Node ESM. Run: `npm run data`.
 */
import fs from "node:fs"
import path from "node:path"
import { fileURLToPath } from "node:url"

const __dirname = path.dirname(fileURLToPath(import.meta.url))
const ALLURE_DIR =
  process.env.ALLURE_RESULTS_DIR || path.resolve(__dirname, "../../reports/allure-results")
const OUT_FILE = path.resolve(__dirname, "../public/results.json")

/** @typedef {"passed"|"failed"|"broken"|"skipped"} Status */

/** Pull "CASH-01" style test-case id out of the Allure test name, if present. */
function extractId(name) {
  const m = name.match(/\b([A-Z][A-Z0-9]+-\d+)\b/)
  return m ? m[1] : null
}

/** Every @tag in the test name (@smoke, @regression, …). */
function extractTags(name) {
  return (name.match(/@[\w-]+/g) || []).map((t) => t.toLowerCase())
}

/** Human-readable title: strip the id, the tags, and any leading separators. */
function cleanTitle(name) {
  return name
    .replace(/\b[A-Z][A-Z0-9]+-\d+\b/, "")
    .replace(/@[\w-]+/g, "")
    .replace(/Â/g, "") // stray "Â" from mojibake'd middot
    .replace(/^[\s·.\-–—|:]+/, "")
    .replace(/[\s·]+$/, "")
    .replace(/\s{2,}/g, " ")
    .trim()
}

/**
 * fullName looks like:
 *   src/specs/payment/promotion-reward.e2e.ts#Promotion & Reward.PROMO-02 …
 * → area  = "payment"          (folders under specs/, minus the file)
 * → suite = "Promotion & Reward" (the describe block = the feature)
 */
function parseFullName(fullName, testName) {
  const [specPath = "", right = ""] = fullName.split("#")
  const parts = specPath.split("/")
  const specsIdx = parts.indexOf("specs")
  const afterSpecs = specsIdx >= 0 ? parts.slice(specsIdx + 1) : parts
  const area = afterSpecs.slice(0, -1).join("/") || "root"

  // right = "<suite>.<mocha test title>". The Allure `name` IS the test title,
  // so peel it off the end to recover the suite; fall back to first segment.
  let suite = right
  if (testName && right.endsWith(testName)) {
    suite = right.slice(0, right.length - testName.length).replace(/\.$/, "")
  } else if (right.includes(".")) {
    suite = right.slice(0, right.lastIndexOf("."))
  }
  suite = suite
    .replace(/@[\w-]+/g, "") // tags belong on the test, not the feature label
    .replace(/Â/g, "")
    .replace(/\s{2,}/g, " ")
    .trim()
  return { area, feature: suite || area || "Unknown" }
}

function readResults(dir) {
  if (!fs.existsSync(dir)) {
    console.warn(`[build-data] Allure dir not found: ${dir}`)
    return []
  }
  const files = fs.readdirSync(dir).filter((f) => f.endsWith("-result.json"))
  /** @type {Map<string, any>} */
  const latest = new Map()
  for (const file of files) {
    let doc
    try {
      doc = JSON.parse(fs.readFileSync(path.join(dir, file), "utf8"))
    } catch {
      continue
    }
    if (!doc || !doc.name || !doc.status) continue
    const key = doc.historyId || doc.testCaseId || doc.fullName || doc.uuid
    const prev = latest.get(key)
    if (!prev || (doc.start || 0) >= (prev.start || 0)) latest.set(key, doc)
  }
  return [...latest.values()]
}

function normalise(doc) {
  const name = String(doc.name)
  const { area, feature } = parseFullName(String(doc.fullName || ""), name)
  const status = /** @type {Status} */ (
    ["passed", "failed", "broken", "skipped"].includes(doc.status) ? doc.status : "broken"
  )
  const details = doc.statusDetails || {}
  const hasError = status === "failed" || status === "broken"
  return {
    id: extractId(name),
    title: cleanTitle(name) || name,
    name,
    tags: extractTags(name),
    feature,
    area,
    status,
    durationMs: Math.max(0, (doc.stop || 0) - (doc.start || 0)),
    start: doc.start || 0,
    error:
      hasError && (details.message || details.trace)
        ? {
            message: String(details.message || "").trim(),
            trace: String(details.trace || "").trim()
          }
        : null
  }
}

function summarise(tests) {
  const s = { total: 0, passed: 0, failed: 0, broken: 0, skipped: 0, passRate: 0, durationMs: 0 }
  for (const t of tests) {
    s.total++
    s[t.status]++
    s.durationMs += t.durationMs
  }
  const executed = s.passed + s.failed + s.broken
  s.passRate = executed ? Math.round((s.passed / executed) * 1000) / 10 : 0
  return s
}

function byFeature(tests) {
  /** @type {Map<string, any>} */
  const groups = new Map()
  for (const t of tests) {
    const key = t.feature
    if (!groups.has(key)) {
      groups.set(key, {
        name: t.feature,
        area: t.area,
        total: 0,
        passed: 0,
        failed: 0,
        broken: 0,
        skipped: 0,
        passRate: 0,
        durationMs: 0
      })
    }
    const g = groups.get(key)
    g.total++
    g[t.status]++
    g.durationMs += t.durationMs
  }
  const features = [...groups.values()].map((g) => {
    const executed = g.passed + g.failed + g.broken
    g.passRate = executed ? Math.round((g.passed / executed) * 1000) / 10 : 0
    return g
  })
  // Most-broken features first — that is what a QA lead wants at the top.
  features.sort((a, b) => b.failed + b.broken - (a.failed + a.broken) || b.total - a.total)
  return features
}

function main() {
  const raw = readResults(ALLURE_DIR)
  const tests = raw.map(normalise).sort((a, b) => a.feature.localeCompare(b.feature) || a.title.localeCompare(b.title))
  const dashboard = {
    generatedAt: Date.now(),
    runLabel: tests.length ? "Kết quả lần chạy gần nhất" : "Chưa có dữ liệu",
    source: path.relative(path.resolve(__dirname, ".."), ALLURE_DIR).replace(/\\/g, "/"),
    summary: summarise(tests),
    features: byFeature(tests),
    tests
  }
  fs.mkdirSync(path.dirname(OUT_FILE), { recursive: true })
  fs.writeFileSync(OUT_FILE, JSON.stringify(dashboard, null, 2))
  const { summary } = dashboard
  console.log(
    `[build-data] ${summary.total} tests → ${OUT_FILE}\n` +
      `             pass ${summary.passed} · fail ${summary.failed} · broken ${summary.broken} · skip ${summary.skipped} · pass-rate ${summary.passRate}%`
  )
}

main()
