/**
 * Selector-map dump for the P8D Android (Tauri webview) app.
 *
 * Purpose: give you a one-shot "map" of the current screen so writing/fixing
 * WDIO tests is fast and the selectors are guaranteed to match what the app
 * actually renders (same Chromium DOM the webview context sees). Runs NO
 * assertions and never fails for app-state reasons — it just captures whatever
 * is on-screen right now.
 *
 * On each run it writes to `reports/page-source/`:
 *   - webview-dom-<ts>.html   full live DOM of the webview (inspect selectors)
 *   - native-source-<ts>.xml  native uiautomator2 hierarchy (dialogs, token, etc.)
 *   - selectors-<ts>.md       ⭐ table of candidate elements + a suggested selector
 *
 * Workflow: drive the app to the screen you want to test, then run this dump.
 * Repeat per screen (login, token form, POS home, ...). Hand the generated
 * `selectors-*.md` back and it becomes the source for the real spec.
 *
 * Run just this spec:
 *   npm run android:dump
 * The screen it captures is simply whatever is showing when the session attaches;
 * pair it with `npm run android:open` (holds the app open) if you need to
 * navigate first, or add a manual `browser.pause()` above the dump.
 */
import { mkdir, writeFile } from "node:fs/promises"
import path from "node:path"
import { androidAppShellPage } from "@pages"
import { logger } from "../../utils/logger.js"

const OUT_DIR = path.resolve(process.cwd(), "reports/page-source")

/** One candidate element the selector map surfaces. */
interface Candidate {
  tag: string
  id?: string
  testid?: string
  name?: string
  role?: string
  type?: string
  ariaLabel?: string
  placeholder?: string
  text?: string
  classes?: string
  visible: boolean
}

/** A filesystem-safe timestamp for output filenames (no `:` for Windows). */
const stamp = (): string => new Date().toISOString().replace(/[:.]/g, "-")

/**
 * Build the WDIO selector a human would most likely reach for, in priority
 * order: data-testid → id → name → role+text → visible text → placeholder.
 * Mirrors how SELECTORS.* in this repo are written so the output drops
 * straight into a page object.
 */
const suggestSelector = (c: Candidate): string => {
  if (c.testid) return `[data-testid="${c.testid}"]`
  if (c.id) return `#${c.id}`
  if (c.name) return `${c.tag}[name="${c.name}"]`
  if (c.role && c.text) return `//*[@role="${c.role}" and normalize-space()="${c.text}"]`
  if (c.text && (c.tag === "button" || c.tag === "a")) return `${c.tag}=${c.text}`
  if (c.placeholder) return `${c.tag}[placeholder="${c.placeholder}"]`
  if (c.role) return `[role="${c.role}"]`
  return "(no stable attr — add a data-testid in the app)"
}

/** Escape pipe/newlines so a cell can't break the markdown table layout. */
const cell = (v: string | undefined): string => (v ?? "").replace(/\|/g, "\\|").replace(/\s+/g, " ").trim()

describe("Android page-source dump (selector map)", () => {
  it("captures the current screen's DOM, native tree, and selector map", async () => {
    await mkdir(OUT_DIR, { recursive: true })
    const ts = stamp()

    // 1. Native uiautomator2 hierarchy — grab this while still in NATIVE_APP
    //    (the default context right after attach) so native-only surfaces like
    //    system dialogs / the staff-token prompt are captured too.
    try {
      const nativeXml = await browser.getPageSource()
      const file = path.join(OUT_DIR, `native-source-${ts}.xml`)
      await writeFile(file, nativeXml, "utf8")
      logger.info(`[dump] native source → ${file} (${nativeXml.length} chars)`)
    } catch (err) {
      logger.warn(`[dump] native source failed: ${(err as Error).message}`)
    }

    // 2. Switch into the Tauri webview so DOM APIs resolve.
    await androidAppShellPage.switchToWebview(30_000)

    // 3. Full live DOM — the ground truth for every CSS/XPath selector WDIO
    //    will use in webview context.
    let dom = ""
    try {
      dom = (await browser.execute(() => document.documentElement.outerHTML)) as string
      const file = path.join(OUT_DIR, `webview-dom-${ts}.html`)
      await writeFile(file, dom, "utf8")
      logger.info(`[dump] webview DOM → ${file} (${dom.length} chars)`)
    } catch (err) {
      logger.warn(`[dump] webview DOM failed: ${(err as Error).message}`)
    }

    // 4. Selector map — collect elements that carry a stable hook (testid/id/
    //    name/role) or are interactive (button/link/input/...), plus their
    //    visibility, so the table below can rank real, tappable targets first.
    let candidates: Candidate[] = []
    try {
      candidates = (await browser.execute(() => {
        const pick = (el: Element): unknown => {
          const rect = el.getBoundingClientRect()
          const cls = typeof el.className === "string" ? el.className : ""
          return {
            tag: el.tagName.toLowerCase(),
            id: el.id || undefined,
            testid: el.getAttribute("data-testid") || el.getAttribute("data-test") || undefined,
            name: el.getAttribute("name") || undefined,
            role: el.getAttribute("role") || undefined,
            type: el.getAttribute("type") || undefined,
            ariaLabel: el.getAttribute("aria-label") || undefined,
            placeholder: el.getAttribute("placeholder") || undefined,
            text: (el.textContent || "").trim().slice(0, 60) || undefined,
            classes: cls ? cls.slice(0, 80) : undefined,
            visible: rect.width > 0 && rect.height > 0
          }
        }
        const nodes = document.querySelectorAll(
          "[id],[data-testid],[data-test],[name],[role],[aria-label],[placeholder],button,a[href],input,select,textarea"
        )
        return Array.from(nodes).map(pick)
      })) as Candidate[]
    } catch (err) {
      logger.warn(`[dump] selector collection failed: ${(err as Error).message}`)
    }

    // Visible elements first — those are the ones you can actually interact with.
    candidates.sort((a, b) => Number(b.visible) - Number(a.visible))

    const rows = candidates
      .map((c) => {
        const label = c.text || c.ariaLabel || c.placeholder || ""
        return `| \`${cell(suggestSelector(c))}\` | ${cell(c.tag)} | ${cell(label)} | ${c.visible ? "✓" : ""} |`
      })
      .join("\n")

    const md = [
      `# Selector map — ${ts}`,
      "",
      `Screen captured live from the P8D Android webview. Full DOM: \`webview-dom-${ts}.html\`.`,
      `Native tree: \`native-source-${ts}.xml\`. Total candidates: ${candidates.length}.`,
      "",
      "Suggested selector priority: `data-testid` → `id` → `name` → `role`+text → text → `placeholder`.",
      "Elements with no stable hook need a `data-testid` added in the app source.",
      "",
      "| Suggested selector | Tag | Label / text | Visible |",
      "| --- | --- | --- | --- |",
      rows,
      ""
    ].join("\n")

    const mdFile = path.join(OUT_DIR, `selectors-${ts}.md`)
    await writeFile(mdFile, md, "utf8")
    logger.info(`[dump] selector map → ${mdFile} (${candidates.length} candidates)`)

    // 5. Screenshot for a visual reference alongside the DOM.
    await androidAppShellPage.screenshot("dump")

    logger.info(`[dump] done — see ${OUT_DIR}`)
  })
})
