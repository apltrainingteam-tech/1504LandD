import { TRACE_ENABLED } from "../constants/debugConfig";

export type TraceLog = {
  engine: string;
  input: any;
  output?: any;
  error?: any;
  duration: number;
  timestamp: string;
};

const traceStore: TraceLog[] = [];

export function traceEngine<TArgs extends any[], TOutput>(
  engineName: string,
  engineFn: (...args: TArgs) => TOutput
) {
  return function (...args: TArgs): TOutput {
    if (!TRACE_ENABLED) return engineFn(...args);
    
    const start = performance.now();
    try {
      const output = engineFn(...args);
      
      if (output instanceof Promise) {
        return (output as any).then((result: any) => {
          const duration = performance.now() - start;
          traceStore.push({
            engine: engineName,
            input: args,
            output: result,
            duration,
            timestamp: new Date().toISOString()
          });
          return result;
        }).catch((error: any) => {
          const duration = performance.now() - start;
          traceStore.push({
            engine: engineName,
            input: args,
            error,
            duration,
            timestamp: new Date().toISOString()
          });
          throw error;
        }) as unknown as TOutput;
      }
      
      const duration = performance.now() - start;
      traceStore.push({
        engine: engineName,
        input: args,
        output,
        duration,
        timestamp: new Date().toISOString()
      });
      return output;
    } catch (error) {
      const duration = performance.now() - start;
      traceStore.push({
        engine: engineName,
        input: args,
        error,
        duration,
        timestamp: new Date().toISOString()
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
