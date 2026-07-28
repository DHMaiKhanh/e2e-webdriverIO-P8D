import type { ChainablePromiseElement } from "webdriverio"
import { TIMEOUTS } from "../../constants/timeouts.js"

/**
 * BaseComponent — parent for reusable UI fragments that appear across many
 * pages (header, sidebar, dialogs). A component is scoped to a root selector;
 * all of its queries are relative to that root, so the same component class
 * can be reused wherever the fragment renders.
 */
export abstract class BaseComponent {
  protected abstract readonly rootSelector: string

  /** The component's root element. */
  get root(): ChainablePromiseElement {
    return $(this.rootSelector)
  }

  /** Query an element scoped within this component. */
  protected $(selector: string): ChainablePromiseElement {
    return this.root.$(selector)
  }

  async isDisplayed(timeout = TIMEOUTS.SHORT): Promise<boolean> {
    try {
      await this.root.waitForDisplayed({ timeout })
      return true
    } catch {
      return false
    }
  }
}
