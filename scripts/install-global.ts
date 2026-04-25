import { existsSync } from "node:fs"
import { mkdir } from "node:fs/promises"
import { homedir } from "node:os"
import { dirname, join } from "node:path"
import { CANCEL_RALPH_COMMAND, RALPH_LOOP_COMMAND } from "../src/command.js"

const source = join(import.meta.dir, "..", "dist", "index.js")
const config = join(homedir(), ".config", "opencode")
const pluginTarget = join(config, "plugins", "opencode-ralph.js")
const ralphCommandTarget = join(config, "commands", "ralph-loop.md")
const cancelCommandTarget = join(config, "commands", "cancel-ralph.md")

if (!existsSync(source)) {
  throw new Error("dist/index.js does not exist. Run `bun run build` first.")
}

await mkdir(dirname(pluginTarget), { recursive: true })
await mkdir(dirname(ralphCommandTarget), { recursive: true })
await Bun.write(pluginTarget, await Bun.file(source).text())
await Bun.write(ralphCommandTarget, RALPH_LOOP_COMMAND)
await Bun.write(cancelCommandTarget, CANCEL_RALPH_COMMAND)

console.log(`Installed opencode-ralph plugin to ${pluginTarget}`)
console.log(`Installed /ralph-loop command to ${ralphCommandTarget}`)
console.log(`Installed /cancel-ralph command to ${cancelCommandTarget}`)
console.log("Restart OpenCode for the plugin to load.")
console.log("Use it with: /ralph-loop <task> --completion-promise <text>")
