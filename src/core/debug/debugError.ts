export function debugError(message: string, context: any) {
  return {
    message,
    context,
    timestamp: new Date().toISOString(),
    isStructuredError: true
  };
}

export function isStructuredError(error: any): error is ReturnType<typeof debugError> {
  return error && typeof error === 'object' && error.isStructuredError === true;
}
