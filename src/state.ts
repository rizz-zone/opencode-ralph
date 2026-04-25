export type RalphSessionState = {
  activePrompt: boolean
}

export const createStateStore = () => {
  const sessions = new Map<string, RalphSessionState>()

  const get = (sessionID: string) => {
    let state = sessions.get(sessionID)
    if (!state) {
      state = {
        activePrompt: false,
      }
      sessions.set(sessionID, state)
    }

    return state
  }

  return { get }
}
