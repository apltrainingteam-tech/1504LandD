import { TRACE_ENABLED } from '../constants/debugConfig';

export type TraceLog = {
  engine: string;
  input: any;
  output?: any;
  error?: any;
  duration: number;
  timestamp: number;
};

const traceStore: TraceLog[] = [];

export function traceEngine<TArgs extends any[], TOutput>(
  engineName: string,
  fn: (...args: TArgs) => TOutput
) {
  return (...args: TArgs): TOutput => {
    if (!TRACE_ENABLED) return fn(...args);

    const start = performance.now();

    try {
      const output = fn(...args);

      traceStore.push({
        engine: engineName,
        input: args,
        output,
        duration: performance.now() - start,
        timestamp: Date.now()
      });

      return output;

    } catch (error) {
      traceStore.push({
        engine: engineName,
        input: args,

        error: error instanceof Error ? { message: error.message, stack: error.stack } : error,
        duration: performance.now() - start,
        timestamp: Date.now()
      });

      throw error;
    }
  };
}

export function getTraceLogs() {
  return [...traceStore];
}

export function clearTraceLogs() {
  traceStore.length = 0;
}
