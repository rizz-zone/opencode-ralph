# opencode-ralph

Keep an OpenCode session working until a Ralph completion promise is satisfied.

This is intended to bring the official Claude Code Ralph Wiggum plugin workflow to OpenCode.

Ralph runs inside the current OpenCode session. When the session goes idle, the plugin continues that same session with the original prompt until the loop is cancelled, reaches an optional iteration limit, or the assistant outputs the exact completion promise.

## Install

Add the plugin to your OpenCode config:

```json
{
  "$schema": "https://opencode.ai/config.json",
  "plugin": ["@rizz-zone/opencode-ralph"]
}
```

Restart OpenCode after changing the config.

## Usage

Start a Ralph loop from the OpenCode TUI:

```text
/ralph-loop <task> [--max-iterations N] [--completion-promise TEXT]
```

Example:

```text
/ralph-loop add dark mode and verify the build passes --completion-promise DONE
```

To complete that loop, the assistant must output exactly:

```text
<promise>DONE</promise>
```

Only output the promise when it is completely true.

## Examples

Unlimited loop:

```text
/ralph-loop refactor the cache layer
```

Bounded loop:

```text
/ralph-loop fix the auth bug --max-iterations 20 --completion-promise AUTH_FIXED
```

Completion promise with spaces:

```text
/ralph-loop make the tests pass --completion-promise "all tests pass"
```

Cancel the active loop:

```text
/cancel-ralph
```

## Options

| Option | Meaning |
| --- | --- |
| `--max-iterations <n>` | Stop after N continuations. Default is unlimited. |
| `--completion-promise <text>` | Exact text that must appear inside `<promise>...</promise>` to stop. |

## Notes

Loops are scoped to the current OpenCode session. Multiple sessions in the same project can run separate Ralph loops without sharing loop state.

OpenCode does not currently expose a Claude Code-style cancellable `Stop` hook. This plugin resumes immediately after OpenCode reports the session as idle, while keeping the work in the same session and transcript.
