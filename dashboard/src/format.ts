import type { Status } from "./types"

/** Status → colour var, label, and an icon glyph (icon+label, never colour alone). */
export const STATUS_META: Record<Status, { label: string; color: string; icon: string }> = {
  passed: { label: "Passed", color: "var(--st-pass)", icon: "✓" },
  failed: { label: "Failed", color: "var(--st-fail)", icon: "✕" },
  broken: { label: "Broken", color: "var(--st-broken)", icon: "!" },
  skipped: { label: "Skipped", color: "var(--st-skip)", icon: "–" },
  notRun: { label: "Chưa chạy", color: "var(--st-notrun)", icon: "∅" }
}

export const STATUS_ORDER: Status[] = ["passed", "failed", "broken", "skipped", "notRun"]

/** 12345 → "12,345" */
export function fmtInt(n: number): string {
  return n.toLocaleString("en-US")
}

/** ms → "1m 23s" / "820ms" — compact, human. */
export function fmtDuration(ms: number): string {
  if (!ms) return "0s"
  if (ms < 1000) return `${Math.round(ms)}ms`
  const s = ms / 1000
  if (s < 60) return `${s.toFixed(s < 10 ? 1 : 0)}s`
  const m = Math.floor(s / 60)
  const rem = Math.round(s % 60)
  return `${m}m ${rem}s`
}

/** epoch ms → "04/08/2026 22:50" (vi locale, deterministic-ish). */
export function fmtTime(ms: number): string {
  if (!ms) return "—"
  try {
    return new Date(ms).toLocaleString("vi-VN", {
      day: "2-digit",
      month: "2-digit",
      year: "numeric",
      hour: "2-digit",
      minute: "2-digit"
    })
  } catch {
    return "—"
  }
}
