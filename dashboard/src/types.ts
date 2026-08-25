export type Status = "passed" | "failed" | "broken" | "skipped" | "notRun"

export interface TestResult {
  id: string | null
  title: string
  name: string
  tags: string[]
  feature: string
  area: string
  status: Status
  durationMs: number
  start: number
  error: { message: string; trace: string } | null
}

export interface FeatureSummary {
  name: string
  area: string
  total: number
  passed: number
  failed: number
  broken: number
  skipped: number
  notRun: number
  passRate: number
  durationMs: number
}

export interface Summary {
  total: number
  passed: number
  failed: number
  broken: number
  skipped: number
  notRun: number
  passRate: number
  durationMs: number
}

export interface Dashboard {
  generatedAt: number
  runLabel: string
  source: string
  summary: Summary
  features: FeatureSummary[]
  tests: TestResult[]
}
