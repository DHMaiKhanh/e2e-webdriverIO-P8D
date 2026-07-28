# Specs

This folder holds the E2E test cases. **It is intentionally empty** — start
writing your specs here.

## Conventions

- One feature area per sub-folder, e.g. `auth/`, `smoke/`, `settings/`.
- File name pattern: `*.e2e.ts` (this is what the WDIO config picks up).
- Tag tests in the title for filtered runs: `@smoke`, `@regression`.
  Run a tag with `npm run test:smoke` or `cross-env TEST_TAGS=@regression ...`.

## Anatomy of a spec

```ts
import { expect } from "@wdio/globals"
import { loginPage } from "@pages"
import { ROUTES } from "@constants/routes.js"

describe("Login @smoke", () => {
  beforeEach(async () => {
    await loginPage.open()
  })

  it("shows an error for invalid credentials", async () => {
    await loginPage.submit()
    await expect(await loginPage.hasErrorMessage()).toBe(true)
  })
})
```

See `_example.e2e.ts.template` for a fuller starting point. Copy it to a real
`*.e2e.ts` file when you're ready — the `.template` suffix keeps WDIO from
running it.

## Adding a new page object

1. Create `src/pages/<feature>.page.ts` extending `BasePage`.
2. Add its selectors to `src/constants/selectors.ts`.
3. Export it from `src/pages/index.ts`.
4. Import it in your spec via `import { ... } from "@pages"`.
