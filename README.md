# opencode-ralph

Keep OpenCode working in the same session by continuing when it goes idle.

This plugin is intentionally not an external harness. It listens inside OpenCode for the active session becoming idle and sends a continuation prompt back into that same session through the OpenCode SDK.

OpenCode does not currently expose a Claude Code-style cancellable `Stop` hook. Ralph therefore resumes immediately after `session.status: idle` / `session.idle` instead of blocking the stop before it lands. The transcript and session stay the same.

## Install

Install it globally for OpenCode:

```sh
bun run install:global
```

This writes the built plugin to:

```text
~/.config/opencode/plugins/opencode-ralph.js
```

It also writes the slash command to:

```text
~/.config/opencode/commands/ralph-loop.md
~/.config/opencode/commands/cancel-ralph.md
```

Restart OpenCode after installing, then run Ralph from the TUI with:

```text
/ralph-loop <task> [--max-iterations N] [--completion-promise TEXT]
```

For example:

```text
/ralph-loop add dark mode and verify the build passes --completion-promise DONE
```

The completion promise follows the official Claude Code Ralph plugin style. To stop the loop, the assistant must output the exact promise inside XML tags:

```text
<promise>DONE</promise>
```

Only output that when the promise is completely true.

Unlimited loop, no completion promise:

```text
/ralph-loop refactor the cache layer
```

Bounded loop:

```text
/ralph-loop fix the auth bug --max-iterations 20 --completion-promise AUTH_FIXED
```

Cancel an active loop:

```text
/cancel-ralph
```

Cancellation is scoped to the current OpenCode session.

Supported options:

| Option | Meaning |
| --- | --- |
| `--max-iterations <n>` | Stop after N iterations. Default is `0`, meaning unlimited. |
| `--completion-promise <text>` | Exact text that must appear as `<promise>text</promise>` to stop. |

If this package is published to npm later, you can instead add it to OpenCode config:

```json
{
  "$schema": "https://opencode.ai/config.json",
  "plugin": ["@rizz-zone/opencode-ralph"]
}
```

Do not use `file:/.../opencode-ralph` in `opencode.json`; OpenCode's plugin config expects npm package names. Local plugins should be installed into `.opencode/plugins/` or `~/.config/opencode/plugins/`.

## Behavior

The `/ralph-loop` command writes `.opencode/ralph-loops/<sessionID>.md` with the original prompt, iteration count, max iteration limit, and completion promise.

The plugin then keeps that same session moving when OpenCode goes idle by feeding the same prompt back into the session.

Ralph listens for:

- `session.status` where `status.type` is `idle`
- `session.idle` as a compatibility fallback

When either event fires, Ralph calls:

```ts
client.session.prompt({
  path: { id: sessionID },
  body: {
    parts: [{ type: "text", text: continuationPrompt }],
  },
})
```

The prompt tells the agent to continue working, verify completion, and only stop when complete, blocked, or needing user input.

## Configuration

Configure with environment variables:

| Variable | Default | Description |
| --- | --- | --- |
| `RALPH_ENABLED` | `true` | Enable or disable the plugin. |

## Done Marker

If `--completion-promise DONE` is set, the loop stops only when the assistant outputs:

```text
<promise>DONE</promise>
```

The match is exact after whitespace normalization inside the XML tag.

## Safety

Ralph includes three loop controls:

- Per-session `activePrompt` guard to avoid recursive continuation.
- Optional `--completion-promise` detection using `<promise>...</promise>`.
- Optional `--max-iterations`; default is unlimited.

## Development

```sh
bun install
bun run build
bun run install:global
```

## Release

This package uses Changesets and npm trusted publishing.

For normal changes:

```sh
bun run changeset
```

The release workflow on `main` creates a Changesets version PR when changesets are present. When that PR is merged, the same workflow publishes to npm with provenance using GitHub OIDC.

For npm trusted publishing, configure the package on npmjs.com to trust:

```text
owner/repo: rizz-zone/opencode-ralph
workflow: .github/workflows/release.yml
environment: none
```

The workflow intentionally mirrors the trusted-publishing setup from `rizz-zone/ground0`: it grants `id-token: write`, writes an empty npm auth token line plus registry to `~/.npmrc`, and sets `NPM_CONFIG_PROVENANCE=true` for `changeset publish`.
