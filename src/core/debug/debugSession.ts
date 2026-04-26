let lastSession: any = null;

export function saveSession(input: any) {
  try {
    lastSession = JSON.parse(JSON.stringify(input));
  } catch (e) {
    console.warn("[Session] Failed to save session", e);
  }
}

export function replaySession<T>(fn: (input: any) => T): T | undefined {
  if (!lastSession) {
    console.warn("[Session] No last session to replay");
    return undefined;
  }
  return fn(lastSession);
}

export function getLastSession() {
  return lastSession;
}
