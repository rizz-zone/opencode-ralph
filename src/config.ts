export type RalphConfig = {
  enabled: boolean
}

const readBool = (name: string, fallback: boolean) => {
  const value = process.env[name]
  if (value === undefined || value === "") return fallback
  return ["1", "true", "yes", "on"].includes(value.toLowerCase())
}

export const readConfig = (): RalphConfig => ({
  enabled: readBool("RALPH_ENABLED", true),
})
