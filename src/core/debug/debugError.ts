export interface DebugError {
  message: string;
  context: any;
  timestamp: string;
  isCustomDebugError: true;
}

export function debugError(message: string, context: any): DebugError {
  return {
    message,
    context,
    timestamp: new Date().toISOString(),
    isCustomDebugError: true
  };
}
