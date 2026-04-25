import { rm } from "node:fs/promises"
import { homedir } from "node:os"
import { join } from "node:path"

const config = join(homedir(), ".config", "opencode")
const pluginTarget = join(config, "plugins", "opencode-ralph.js")
const ralphCommandTarget = join(config, "commands", "ralph-loop.md")
const cancelCommandTarget = join(config, "commands", "cancel-ralph.md")

await rm(pluginTarget, { force: true })
await rm(ralphCommandTarget, { force: true })
await rm(cancelCommandTarget, { force: true })

console.log(`Removed ${pluginTarget}`)
console.log(`Removed ${ralphCommandTarget}`)
console.log(`Removed ${cancelCommandTarget}`)
console.log("Restart OpenCode for the change to take effect.")
