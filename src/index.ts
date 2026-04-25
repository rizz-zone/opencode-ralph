import type { Plugin } from "@opencode-ai/plugin"
import { getBusySessionID, getIdleSessionID } from "./events.js"
import { readConfig } from "./config.js"
import { createStateStore } from "./state.js"

type LogLevel = "debug" | "info" | "warn" | "error"

type RalphLoop = {
  iteration: number
  maxIterations: number
  completionPromise: string | undefined
  prompt: string
}

type RalphArgs = {
  prompt: string
  maxIterations: number
  completionPromise: string | undefined
}

const STATE_DIR = ".opencode/ralph-loops"

const statePath = (directory: string, sessionID: string) => `${directory}/${STATE_DIR}/${sessionID}.md`

const parseFrontmatterValue = (frontmatter: string, key: string) => {
  const line = frontmatter.split("\n").find((item) => item.startsWith(`${key}:`))
  if (!line) return undefined

  const raw = line.slice(key.length + 1).trim()
  if (raw === "null") return undefined
  return raw.replace(/^"(.*)"$/, "$1")
}

const parseLoop = async (directory: string, sessionID: string): Promise<RalphLoop | undefined> => {
  const file = Bun.file(statePath(directory, sessionID))
  if (!(await file.exists())) return undefined

  const text = await file.text()
  const match = text.match(/^---\n([\s\S]*?)\n---\n?([\s\S]*)$/)
  if (!match) return undefined

  const frontmatter = match[1] ?? ""
  const prompt = (match[2] ?? "").trim()
  const iteration = Number.parseInt(parseFrontmatterValue(frontmatter, "iteration") ?? "1", 10)
  const maxIterations = Number.parseInt(parseFrontmatterValue(frontmatter, "max_iterations") ?? "0", 10)

  return {
    iteration: Number.isFinite(iteration) ? iteration : 1,
    maxIterations: Number.isFinite(maxIterations) ? maxIterations : 0,
    completionPromise: parseFrontmatterValue(frontmatter, "completion_promise"),
    prompt,
  }
}

const writeLoopIteration = async (directory: string, sessionID: string, nextIteration: number) => {
  const path = statePath(directory, sessionID)
  const text = await Bun.file(path).text()
  await Bun.write(path, text.replace(/^iteration: .*$/m, `iteration: ${nextIteration}`))
}

const removeLoop = async (directory: string, sessionID: string) => {
  await Bun.file(statePath(directory, sessionID)).delete()
}

const extractPromise = (text: string) => {
  const match = text.trim().match(/^<promise>([\s\S]*?)<\/promise>$/)
  return match?.[1]?.trim().replace(/\s+/g, " ")
}

const tokenize = (input: string) => {
  const result: string[] = []
  let current = ""
  let quote: '"' | "'" | undefined

  for (let index = 0; index < input.length; index++) {
    const char = input[index]

    if (quote) {
      if (char === quote) {
        quote = undefined
        continue
      }
      current += char
      continue
    }

    if (char === '"' || char === "'") {
      quote = char
      continue
    }

    if (/\s/.test(char ?? "")) {
      if (current) {
        result.push(current)
        current = ""
      }
      continue
    }

    current += char
  }

  if (current) result.push(current)
  return result
}

const parseArgs = (input: string): RalphArgs => {
  const completionMatch = input.match(/--completion-promise\s+(?:"([^"]*)"|'([^']*)'|(\S+))/)
  const maxMatch = input.match(/--max-iterations\s+(\d+)/)
  const completionPromise = completionMatch?.[1] ?? completionMatch?.[2] ?? completionMatch?.[3]
  const maxIterations = maxMatch?.[1] ? Number.parseInt(maxMatch[1], 10) : 0

  const stripped = input
    .replace(/--completion-promise\s+(?:"[^"]*"|'[^']*'|\S+)/, "")
    .replace(/--max-iterations\s+\d+/, "")
    .trim()

  if (completionPromise || maxIterations > 0) {
    return {
      prompt: stripped,
      maxIterations,
      completionPromise,
    }
  }

  const tokens = tokenize(input)
  const promptParts: string[] = []
  let fallbackMaxIterations = 0
  let fallbackCompletionPromise: string | undefined

  for (let index = 0; index < tokens.length; index++) {
    const token = tokens[index]

    if (token === "--max-iterations") {
      const value = tokens[++index]
      fallbackMaxIterations = value && /^\d+$/.test(value) ? Number.parseInt(value, 10) : 0
      continue
    }

    if (token === "--completion-promise") {
      fallbackCompletionPromise = tokens[++index]
      continue
    }

    if (token) promptParts.push(token)
  }

  return {
    prompt: promptParts.join(" ").trim(),
    maxIterations: fallbackMaxIterations,
    completionPromise: fallbackCompletionPromise,
  }
}

const repairLoopArgs = (loop: RalphLoop): RalphLoop => {
  if (loop.completionPromise) return loop

  const parsed = parseArgs(loop.prompt)
  if (!parsed.completionPromise && parsed.maxIterations === 0) return loop

  return {
    ...loop,
    maxIterations: loop.maxIterations || parsed.maxIterations,
    completionPromise: parsed.completionPromise ?? loop.completionPromise,
    prompt: parsed.prompt || loop.prompt,
  }
}

const writeLoopState = async (directory: string, sessionID: string, loop: RalphLoop) => {
  await Bun.$`mkdir -p ${`${directory}/${STATE_DIR}`}`.quiet()
  const promiseYaml = loop.completionPromise ? `"${loop.completionPromise.replaceAll('"', '\\"')}"` : "null"

  await Bun.write(
    statePath(directory, sessionID),
    `---
active: true
iteration: ${loop.iteration}
max_iterations: ${loop.maxIterations}
completion_promise: ${promiseYaml}
started_at: "${new Date().toISOString()}"
---

${loop.prompt}
`,
  )
}

const writeLoop = async (directory: string, sessionID: string, args: RalphArgs) => {
  await writeLoopState(directory, sessionID, {
    iteration: 1,
    maxIterations: args.maxIterations,
    completionPromise: args.completionPromise,
    prompt: args.prompt,
  })
}

const isRalphCommand = (name: unknown) => name === "ralph-loop" || name === "ralph"
const isCancelCommand = (name: unknown) => name === "cancel-ralph"

export const RalphPlugin: Plugin = async ({ client, directory }) => {
  const config = readConfig()
  const states = createStateStore()

  const log = async (level: LogLevel, message: string, extra?: Record<string, unknown>) => {
    try {
      const body = extra === undefined ? { service: "opencode-ralph", level, message } : { service: "opencode-ralph", level, message, extra }

      await client.app.log({
        body,
      })
    } catch {
      // Logging should never break continuation.
    }
  }

  const lastAssistantText = async (sessionID: string): Promise<string | undefined> => {
    const messages = await client.session.messages({ path: { id: sessionID } })
    const list = messages.data ?? []

    for (let index = list.length - 1; index >= 0; index--) {
      const message = list[index]
      if (message?.info.role !== "assistant") continue

      return message.parts
        .map((part) => (part.type === "text" ? part.text : ""))
        .filter(Boolean)
        .join("\n")
    }

    return undefined
  }

  const maybeContinue = async (sessionID: string) => {
    const state = states.get(sessionID)

    if (!config.enabled) return
    if (state.activePrompt) return

    state.activePrompt = true

    try {
      const loaded = await parseLoop(directory, sessionID)
      const loop = loaded ? repairLoopArgs(loaded) : undefined
      if (!loop) {
        state.activePrompt = false
        return
      }

      if (loaded && (loop.completionPromise !== loaded.completionPromise || loop.maxIterations !== loaded.maxIterations || loop.prompt !== loaded.prompt)) {
        await writeLoopState(directory, sessionID, loop)
      }

      const text = await lastAssistantText(sessionID)

      if (loop.completionPromise && extractPromise(text ?? "") === loop.completionPromise) {
        await removeLoop(directory, sessionID)
        await log("info", "Ralph loop stopped", { sessionID, reason: "completion promise detected" })
        state.activePrompt = false
        return
      }

      if (loop.maxIterations > 0 && loop.iteration >= loop.maxIterations) {
        await removeLoop(directory, sessionID)
        await log("warn", "Ralph loop stopped", { sessionID, reason: "max iterations reached", maxIterations: loop.maxIterations })
        state.activePrompt = false
        return
      }

      const nextIteration = loop.iteration + 1
      await writeLoopIteration(directory, sessionID, nextIteration)

      await log("info", "Continuing idle session", {
        sessionID,
        iteration: nextIteration,
      })

      const systemMessage = loop.completionPromise
        ? `Ralph iteration ${nextIteration}. To stop: output <promise>${loop.completionPromise}</promise> only when that exact statement is true.`
        : `Ralph iteration ${nextIteration}. No completion promise set; loop runs until cancelled.`

      client.session
        .prompt({
          path: { id: sessionID },
          body: {
            parts: [{ type: "text", text: `${systemMessage}\n\n${loop.prompt}` }],
          },
        })
        .catch((error) => {
          state.activePrompt = false
          void log("error", "Failed to continue idle session", {
            sessionID,
            error: error instanceof Error ? error.message : String(error),
          })
        })

      // Do not await the full assistant turn here. OpenCode may emit the next
      // idle event before the SDK prompt promise unwinds; the busy event clears
      // this guard once the continuation has actually started.
      return
    } catch (error) {
      await log("error", "Failed to continue idle session", {
        sessionID,
        error: error instanceof Error ? error.message : String(error),
      })
      state.activePrompt = false
    }
  }

  await log("info", "Ralph plugin initialized", {
    enabled: config.enabled,
  })

  return {
    "command.execute.before": async (input: unknown) => {
      const data = input as { command?: string; name?: string; arguments?: string }
      const name = data.command ?? data.name
      const sessionID = (data as { sessionID?: string }).sessionID
      if (!sessionID) return

      if (isCancelCommand(name)) {
        const loop = await parseLoop(directory, sessionID)
        await removeLoop(directory, sessionID).catch(() => {})
        await log("info", "Ralph loop cancelled", { iteration: loop?.iteration })
        return
      }

      if (!isRalphCommand(name)) return

      const args = parseArgs(data.arguments ?? "")
      if (!args.prompt) return

      await writeLoop(directory, sessionID, args)
      await log("info", "Ralph loop started", {
        command: data.command ?? data.name,
        maxIterations: args.maxIterations,
        completionPromise: args.completionPromise,
      })
    },
    event: async ({ event }) => {
      if (event.type === "command.executed") {
        const properties = event.properties as { name?: string; arguments?: string }
        const sessionID = (event.properties as { sessionID?: string }).sessionID
        if (!sessionID) return

        if (isCancelCommand(properties.name)) {
          const loop = await parseLoop(directory, sessionID)
          await removeLoop(directory, sessionID).catch(() => {})
          await log("info", "Ralph loop cancelled after command", { iteration: loop?.iteration })
          return
        }

        if (isRalphCommand(properties.name)) {
          const args = parseArgs(properties.arguments ?? "")
          if (args.prompt && !(await parseLoop(directory, sessionID))) {
            await writeLoop(directory, sessionID, args)
            await log("info", "Ralph loop started after command", {
              command: properties.name,
              maxIterations: args.maxIterations,
              completionPromise: args.completionPromise,
            })
          }
        }
      }

      const busySessionID = getBusySessionID(event)
      if (busySessionID) {
        states.get(busySessionID).activePrompt = false
        return
      }

      const idleSessionID = getIdleSessionID(event)
      if (idleSessionID) await maybeContinue(idleSessionID)
    },
  }
}

export default RalphPlugin
