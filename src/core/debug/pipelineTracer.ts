export type PipelineStep = {
  step: string;
  status: "ok" | "failed";
  error?: any;
  timestamp: number;
};

const pipelineLog: PipelineStep[] = [];

export function logStep<T>(step: string, fn: () => T): T {
  try {
    const result = fn();
    pipelineLog.push({ step, status: "ok", timestamp: Date.now() });
    return result;
  } catch (error) {
    pipelineLog.push({ 
      step, 
      status: "failed", 
      error: error instanceof Error ? error.message : error, 
      timestamp: Date.now() 
    });
    throw error;
  }
}

export function getPipelineLog() {
  return [...pipelineLog];
}

export function clearPipelineLog() {
  pipelineLog.length = 0;
}
