let lastSession: any = null;

export function saveSession(input: any) {
  try {
    lastSession = structuredClone(input);
  } catch (e) {
    console.warn("[Session] Failed to clone session data", e);
    lastSession = input;
  }
}

export function replaySession<TInput, TOutput>(fn: (input: TInput) => TOutput) {
  if (!lastSession) {
    console.warn("[Session] No session data to replay");
    return;
  }
  return fn(lastSession);
}

export function getLastSession() {
  return lastSession;
}
