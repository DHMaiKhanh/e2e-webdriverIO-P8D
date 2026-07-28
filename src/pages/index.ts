/**
 * Page-object barrel.
 *
 * Specs should `import { loginPage } from "@pages"` rather than reaching into
 * individual files. Keeps imports tidy and lets us swap a page implementation
 * behind the scenes without touching specs.
 *
 * Add each new page / component export here.
 */
export { loginPage, LoginPage } from "./login.page.js"
export { staffTokenLoginPage, StaffTokenLoginPage } from "./staff-token-login.page.js"
export { customerDisplayPage, CustomerDisplayPage } from "./customer-display.page.js"
export { androidAppShellPage, AndroidAppShellPage } from "./android/app-shell.page.js"

// Components
export { header, HeaderComponent } from "./components/header.component.js"
