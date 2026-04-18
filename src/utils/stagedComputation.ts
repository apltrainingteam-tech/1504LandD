/**
 * Staged Computation Utilities with requestIdleCallback
 * 
 * Executes expensive operations in non-blocking stages using browser idle time.
 * Enables true progressive rendering: KPIs → Tables (staggered) → Matrices (lazy by tab)
 * 
 * Usage:
 *   // Stage 1: KPI (immediate execution)
 *   scheduleIdle(() => computeKPIs(data), setKpiData, 0);
 *   
 *   // Stage 2a: Grouped table (first idle slot)
 *   scheduleIdle(() => computeGrouped(data), setGrouped, 20);
 *   
 *   // Stage 2b: Time series table (second idle slot)
 *   scheduleIdle(() => computeTimeSeries(data), setTimeSeries, 40);
 *   
 *   // Stage 3: Active tab matrix (low priority background)
 *   scheduleIdle(() => computeMatrix(data), setMatrix, 60, true);
 */

// Polyfill for browsers without requestIdleCallback
const requestIdleCallbackPolyfill = (callback: IdleRequestCallback) => {
  return setTimeout(callback as any, 1);
};

const cancelIdleCallbackPolyfill = (id: number) => {
  clearTimeout(id);
};

const getIdleCallback = (): typeof requestIdleCallback => {
  if (typeof window !== 'undefined' && window.requestIdleCallback) {
    return window.requestIdleCallback;
  }
  return requestIdleCallbackPolyfill as any;
};

const getCancelIdleCallback = (): typeof cancelIdleCallback => {
  if (typeof window !== 'undefined' && window.cancelIdleCallback) {
    return window.cancelIdleCallback;
  }
  return cancelIdleCallbackPolyfill as any;
};

/**
 * Schedule computation during browser idle time with optional fallback delay
 * Uses requestIdleCallback for true non-blocking execution.
 * 
 * @param compute - Function that performs expensive computation
 * @param setState - Callback to store result
 * @param fallbackDelayMs - Fallback setTimeout delay if requestIdleCallback unavailable (default: 1ms)
 * @param useIdleCallback - Force use requestIdleCallback over setTimeout (default: true)
 * @returns Cleanup function to cancel pending computation
 */
export function scheduleIdle<T>(
  compute: () => T,
  setState: (data: T) => void,
  fallbackDelayMs: number = 1,
  useIdleCallback: boolean = true
): () => void {
  let callbackId: number | null = null;
  let timeoutId: NodeJS.Timeout | null = null;

  const executeComputation = () => {
    try {
      const result = compute();
      setState(result);
    } catch (error) {
      console.error('Staged computation error:', error);
    }
  };

  if (useIdleCallback) {
    const idleCallback = getIdleCallback();
    // requestIdleCallback may run when UI is busy; we provide fallback
    if (typeof requestIdleCallback !== 'undefined') {
      callbackId = idleCallback(executeComputation, { timeout: fallbackDelayMs + 500 });
    } else {
      // Fallback: use setTimeout with minimal delay
      timeoutId = setTimeout(executeComputation, fallbackDelayMs);
    }
  } else {
    // Use setTimeout when explicit delay requested
    timeoutId = setTimeout(executeComputation, fallbackDelayMs);
  }

  // Return cleanup function
  return () => {
    if (callbackId !== null) {
      const cancelIdle = getCancelIdleCallback();
      cancelIdle(callbackId);
    }
    if (timeoutId !== null) {
      clearTimeout(timeoutId);
    }
  };
}

/**
 * Deprecated: Use scheduleIdle instead
 * @deprecated Use scheduleIdle for cleaner idle callback support
 */
export function stageComputation<T>(
  timeoutMs: number,
  compute: () => T,
  setState: (data: T) => void,
  useIdle: boolean = false
): () => void {
  return scheduleIdle(compute, setState, timeoutMs, useIdle);
}

/**
 * Execute multiple computation stages in sequence
 * 
 * Usage:
 *   const cleanup = stagePipeline([
 *     { delay: 0, compute: () => computeKPIs(data), setState: setKpiData },
 *     { delay: 0, compute: () => computeTable(data), setState: setTableData },
 *     { delay: 10, compute: () => computeMatrix(data), setState: setMatrixData, useIdle: true }
 *   ]);
 */
export function stagePipeline<T>(
  stages: Array<{
    delay: number;
    compute: () => T;
    setState: (data: T) => void;
    useIdle?: boolean;
  }>
): () => void {
  const cleanups: Array<() => void> = [];

  for (const stage of stages) {
    const cleanup = stageComputation(
      stage.delay,
      stage.compute,
      stage.setState,
      stage.useIdle || false
    );
    cleanups.push(cleanup);
  }

  // Return master cleanup function
  return () => {
    cleanups.forEach(cleanup => cleanup());
  };
}

/**
 * Create a stage-aware state tuple
 * Returns [data, isLoading] for convenient conditional rendering
 */
export function useStagedState<T>(initialData: T | null) {
  return [initialData, initialData === null] as const;
}

/**
 * Batch multiple stage computations with coordinated cleanup
 */
export class StagedComputationManager {
  private cleanups: Array<() => void> = [];

  add<T>(
    timeoutMs: number,
    compute: () => T,
    setState: (data: T) => void,
    useIdle: boolean = false
  ): void {
    const cleanup = stageComputation(timeoutMs, compute, setState, useIdle);
    this.cleanups.push(cleanup);
  }

  cleanup(): void {
    this.cleanups.forEach(cleanup => cleanup());
    this.cleanups = [];
  }
}
