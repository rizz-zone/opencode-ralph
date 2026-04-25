type EventLike = {
  type?: string
  properties?: Record<string, unknown>
}

export const getIdleSessionID = (event: EventLike): string | undefined => {
  const sessionID = event.properties?.sessionID

  if (event.type === "session.status") {
    const status = event.properties?.status
    if (
      typeof sessionID === "string" &&
      typeof status === "object" &&
      status !== null &&
      "type" in status &&
      status.type === "idle"
    ) {
      return sessionID
    }
  }

  if (event.type === "session.idle") {
    return typeof sessionID === "string" ? sessionID : undefined
  }

  return undefined
}

export const getBusySessionID = (event: EventLike): string | undefined => {
  const sessionID = event.properties?.sessionID
  const status = event.properties?.status

  if (
    event.type === "session.status" &&
    typeof sessionID === "string" &&
    typeof status === "object" &&
    status !== null &&
    "type" in status &&
    status.type === "busy"
  ) {
    return sessionID
  }

  return undefined
}
