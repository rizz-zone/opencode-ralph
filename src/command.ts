export const RALPH_LOOP_COMMAND = `---
description: Start Ralph loop in current session
argument-hint: "PROMPT [--max-iterations N] [--completion-promise TEXT]"
---
# Ralph Loop Command

Ralph loop request:

\`\`\`text
$ARGUMENTS
\`\`\`

Please work on the task. When you go idle, the Ralph plugin will feed the SAME PROMPT back to you for the next iteration. You'll see your previous work in files and git history, allowing you to iterate and improve.

CRITICAL RULE: If a completion promise is set, you may ONLY output it as \`<promise>TEXT</promise>\` when the statement is completely and unequivocally TRUE. Do not output false promises to escape the loop.
`

export const CANCEL_RALPH_COMMAND = `---
description: Cancel active Ralph loop
---
# Cancel Ralph

The Ralph plugin will cancel the active loop for this session.
`
