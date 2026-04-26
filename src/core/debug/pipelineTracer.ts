export type PipelineStep = {
  step: string;
  status: "ok" | "failed";
  error?: any;
  timestamp: string;
};

const pipelineLog: PipelineStep[] = [];

export function logStep<T>(step: string, fn: () => T): T {
  try {
    const result = fn();
    pipelineLog.push({ 
      step, 
      status: "ok",
      timestamp: new Date().toISOString()
    });
    return result;
  } catch (error) {
    pipelineLog.push({ 
      step, 
      status: "failed", 
      error,
      timestamp: new Date().toISOString()
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
