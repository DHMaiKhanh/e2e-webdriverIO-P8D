// build-android.mjs
// Build the P8D Android APK for the emulator using p8-cli's OWN cross-compile toolchain env,
// but WITHOUT p8 build's uninstall+install step (that step wipes the login/device_id/DB).
// update-volt.ps1 calls this, then installs the APK with `adb install -r` to KEEP the session.
//
//   node build-android.mjs                 # x86_64 debug, app repo = D:/Project/P8D/P8D
//   P8D_TARGET=aarch64 node build-android.mjs
//   P8D_APP_REPO=D:/other/repo node build-android.mjs
import { pathToFileURL } from "node:url"
import { execSync } from "node:child_process"

const repoRoot = process.env.P8D_APP_REPO || "D:/Project/P8D/P8D"
const target = process.env.P8D_TARGET || "x86_64" // emulator ABI

// Resolve the globally-installed p8-cli dist dir instead of hardcoding a user path.
const globalRoot = execSync("npm root -g", { encoding: "utf8" }).trim().replace(/\\/g, "/")
const P8 = `${globalRoot}/p8-cli/dist/lib/android`
const imp = (f) => import(pathToFileURL(`${P8}/${f}`).href)

const { discoverCrossCompileEnv } = await imp("toolchain-discover.js")
const { runTauri } = await imp("tauri-cli.js")
const { resolveSentryEnv } = await imp("sentry-env.js")

const { env, ndkName } = discoverCrossCompileEnv(target, repoRoot)
Object.assign(env, resolveSentryEnv({ repoRoot, debug: true, processEnv: process.env }).env)

console.log(`[build] ${target} debug · ndk ${ndkName} · repo ${repoRoot}`)
const code = runTauri(repoRoot, ["android", "build", "--apk", "--target", target, "--debug"], env) ?? 1
console.log(`[build] tauri exit code = ${code}`)
process.exit(code)
