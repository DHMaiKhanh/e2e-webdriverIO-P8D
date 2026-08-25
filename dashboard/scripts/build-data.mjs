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
// Root of the spec source, and which sub-tree the last run was *supposed* to
// cover — so we can list every declared test, not just the ones that produced
// an Allure file. The Android suite is what this dashboard reports on; override
// with SPECS_DIR / EXPECTED_SPECS_ROOT for other runs (EXPECTED_SPECS_ROOT=""
// scans every spec).
const SPECS_DIR = process.env.SPECS_DIR || path.resolve(__dirname, "../../src/specs")
const EXPECTED_ROOT =
  process.env.EXPECTED_SPECS_ROOT != null ? process.env.EXPECTED_SPECS_ROOT : "android"

/** @typedef {"passed"|"failed"|"broken"|"skipped"|"notRun"} Status */

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

/** Strip the tags/mojibake off a describe-suite title so it matches parseFullName. */
function cleanFeature(s) {
  return String(s)
    .replace(/@[\w-]+/g, "")
    .replace(/Â/g, "")
    .replace(/\s{2,}/g, " ")
    .trim()
}

/**
 * Remove // line and /* block *\/ comments while respecting string / template
 * literals — so a commented-out `it(...)` is not counted and a `//` inside a URL
 * string is not mistaken for a comment. Small hand-rolled scanner (no deps).
 */
function stripComments(src) {
  let out = ""
  let state = "code" // code | line | block | s | d | t  (single/double/template)
  for (let i = 0; i < src.length; i++) {
    const c = src[i]
    const d = src[i + 1]
    if (state === "code") {
      if (c === "/" && d === "/") { state = "line"; i++; continue }
      if (c === "/" && d === "*") { state = "block"; i++; continue }
      if (c === "'") state = "s"
      else if (c === '"') state = "d"
      else if (c === "`") state = "t"
      out += c
    } else if (state === "line") {
      if (c === "\n") { state = "code"; out += c }
    } else if (state === "block") {
      if (c === "*" && d === "/") { state = "code"; i++ }
    } else {
      // inside a string/template: copy through, honour escapes, close on the quote
      out += c
      if (c === "\\") { out += d ?? ""; i++; continue }
      if ((state === "s" && c === "'") || (state === "d" && c === '"') || (state === "t" && c === "`")) {
        state = "code"
      }
    }
  }
  return out
}

/** describe/suite (feature) and it/test (case) declarations, in source order. */
const DECL_RE =
  /(?:^|[^.\w$])(describe|suite|context|it|test|specify)(?:\.(?:skip|only|each))?\s*\(\s*(['"`])((?:\\.|[^\\])*?)\2/g

/** Recursively list every *.e2e.ts file under dir. */
function listSpecFiles(dir) {
  const out = []
  let entries
  try {
    entries = fs.readdirSync(dir, { withFileTypes: true })
  } catch {
    return out
  }
  for (const e of entries) {
    const full = path.join(dir, e.name)
    if (e.isDirectory()) out.push(...listSpecFiles(full))
    else if (/\.e2e\.ts$/.test(e.name)) out.push(full)
  }
  return out
}

/** Normalised match key: prefer the test-case id, else area + fuzzy title. */
function normTitle(s) {
  return cleanTitle(s)
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, " ")
    .trim()
}
function keyOf(t) {
  return t.id ? `id:${t.id}` : `t:${t.area}|${normTitle(t.name)}`
}

/**
 * Every test *declared in the specs* the run was meant to cover — so tests that
 * never produced an Allure result (backend down, gated `describe.skip`, a crash
 * that aborted the file) still show up, instead of the dashboard silently
 * shrinking to only what executed.
 */
function buildExpected() {
  const root = EXPECTED_ROOT ? path.join(SPECS_DIR, EXPECTED_ROOT) : SPECS_DIR
  const expected = []
  for (const file of listSpecFiles(root)) {
    const rel = path.relative(SPECS_DIR, file).replace(/\\/g, "/")
    const area = (path.dirname(rel) || "root").replace(/\\/g, "/")
    const code = stripComments(fs.readFileSync(file, "utf8"))
    let feature = ""
    DECL_RE.lastIndex = 0
    let m
    while ((m = DECL_RE.exec(code))) {
      const kw = m[1]
      const title = m[3]
      if (kw === "describe" || kw === "suite" || kw === "context") {
        feature = cleanFeature(title)
      } else {
        expected.push({
          id: extractId(title),
          title: cleanTitle(title) || title,
          name: title,
          tags: extractTags(title),
          feature: feature || area,
          area,
          status: /** @type {Status} */ ("notRun"),
          durationMs: 0,
          start: 0,
          error: null
        })
      }
    }
  }
  return expected
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
  const s = { total: 0, passed: 0, failed: 0, broken: 0, skipped: 0, notRun: 0, passRate: 0, durationMs: 0 }
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
        notRun: 0,
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
  const results = readResults(ALLURE_DIR).map(normalise)
  const expected = buildExpected()

  // Merge: every declared test is a row; overlay the Allure result where one
  // exists, otherwise the test is "notRun". Results with no matching spec entry
  // (dynamically-named or parse misses) are still appended — never drop a real
  // result.
  const byKey = new Map()
  for (const r of results) if (!byKey.has(keyOf(r))) byKey.set(keyOf(r), r)
  const used = new Set()
  const merged = []
  for (const e of expected) {
    const k = keyOf(e)
    const r = byKey.get(k)
    if (r && !used.has(k)) {
      merged.push(r)
      used.add(k)
    } else {
      merged.push(e)
    }
  }
  for (const r of results) {
    const k = keyOf(r)
    if (!used.has(k)) {
      merged.push(r)
      used.add(k)
    }
  }

  const tests = merged.sort(
    (a, b) => a.feature.localeCompare(b.feature) || a.title.localeCompare(b.title)
  )
  const runLabel = results.length
    ? "Kết quả lần chạy gần nhất"
    : tests.length
      ? "Chưa chạy — mới chỉ liệt kê test từ source"
      : "Chưa có dữ liệu"
  const dashboard = {
    generatedAt: Date.now(),
    runLabel,
    source: path.relative(path.resolve(__dirname, ".."), ALLURE_DIR).replace(/\\/g, "/"),
    summary: summarise(tests),
    features: byFeature(tests),
    tests
  }
  fs.mkdirSync(path.dirname(OUT_FILE), { recursive: true })
  fs.writeFileSync(OUT_FILE, JSON.stringify(dashboard, null, 2))
  const { summary } = dashboard
  const executed = summary.passed + summary.failed + summary.broken
  console.log(
    `[build-data] ${summary.total} tests (${executed} đã chạy · ${summary.notRun} chưa chạy) → ${OUT_FILE}\n` +
      `             pass ${summary.passed} · fail ${summary.failed} · broken ${summary.broken} · skip ${summary.skipped} · notRun ${summary.notRun} · pass-rate ${summary.passRate}%`
  )
}

main()
