/**
 * HOOK INSTRUMENTATION — Wraps data hooks for Debug Layer reporting
 *
 * Captures: input size, output shape, execution time, failure reason.
 * Registers failures directly into the Debug Registry.
 * NOT for users. For AI agents, developers, and debugging workflows.
 */

import {
  registerFailure,
  generateTraceId,
} from './debugRegistry';
import { classifyError } from './errorClassifier';
import { recordStep } from './debugTraceEngine';
import { TRACE_ENABLED } from '../constants/debugConfig';

export interface HookInstrumentOptions {
  hookName: string;
  traceId?: string;
  /** Snapshot of input args (avoid circular refs) */
  inputSummary?: Record<string, any>;
}

/**
 * Wrap a hook's data-returning call with instrumentation.
 * Usage inside hooks:
 *   const result = instrumentHookCall('useChartData', () => computeChartData(input), { hookName: 'useChartData' });
 */
export function instrumentHookCall<T>(
  fn: () => T,
  options: HookInstrumentOptions
): T {
  if (!TRACE_ENABLED) return fn();

  const traceId = options.traceId ?? generateTraceId();
  const start = performance.now();

  try {
    const result = fn();
    const duration = performance.now() - start;

    recordStep(traceId, `Hook:${options.hookName}`, 'ok', {
      duration,
      data: summarizeOutput(result),
    });

    return result;
  } catch (err: any) {
    const duration = performance.now() - start;
    const classified = classifyError(err, { layer: 'Hook' });

    registerFailure({
      traceId,
      layer: 'Hook',
      component: options.hookName,
      type: classified.type,
      error: err?.message ?? String(err),
      rootCause: classified.rootCause,
      originLayer: classified.layer,
      fixHint: classified.fixHint,
      severity: classified.severity,
      inputSnapshot: options.inputSummary,
      meta: { duration },
    });

    recordStep(traceId, `Hook:${options.hookName}`, 'failed', {
      duration,
      error: err?.message ?? String(err),
    });

    throw err;
  }
}

/**
 * Wrap an async hook data call with instrumentation.
 */
export async function instrumentHookCallAsync<T>(
  fn: () => Promise<T>,
  options: HookInstrumentOptions
): Promise<T> {
  if (!TRACE_ENABLED) return fn();

  const traceId = options.traceId ?? generateTraceId();
  const start = performance.now();

  try {
    const result = await fn();
    const duration = performance.now() - start;

    recordStep(traceId, `Hook:${options.hookName}`, 'ok', {
      duration,
      data: summarizeOutput(result),
    });

    return result;
  } catch (err: any) {
    const duration = performance.now() - start;
    const classified = classifyError(err, { layer: 'Hook' });

    registerFailure({
      traceId,
      layer: 'Hook',
      component: options.hookName,
      type: classified.type,
      error: err?.message ?? String(err),
      rootCause: classified.rootCause,
      originLayer: classified.layer,
      fixHint: classified.fixHint,
      severity: classified.severity,
      inputSnapshot: options.inputSummary,
      meta: { duration },
    });

    recordStep(traceId, `Hook:${options.hookName}`, 'failed', {
      duration,
      error: err?.message ?? String(err),
    });

    throw err;
  }
}

/**
 * Engine-level guard — wraps an engine function to ensure it always
 * returns a structured { success, data, error, meta } envelope.
 */
export function engineGuard<T>(
  engineName: string,
  fn: () => T,
  traceId?: string
): { success: boolean; data: T | null; error?: string; meta?: Record<string, any> } {
  const tid = traceId ?? generateTraceId();
  const start = performance.now();

  try {
    const data = fn();
    const duration = performance.now() - start;

    if (TRACE_ENABLED) {
      recordStep(tid, `Engine:${engineName}`, 'ok', { duration, data: summarizeOutput(data) });
    }

    return { success: true, data, meta: { duration, engineName } };
  } catch (err: any) {
    const duration = performance.now() - start;
    const classified = classifyError(err, { layer: 'Engine' });

    if (TRACE_ENABLED) {
      registerFailure({
        traceId: tid,
        layer: 'Engine',
        component: engineName,
        type: classified.type,
        error: err?.message ?? String(err),
        rootCause: classified.rootCause,
        originLayer: classified.layer,
        fixHint: classified.fixHint,
        severity: classified.severity,
        meta: { duration },
      });

      recordStep(tid, `Engine:${engineName}`, 'failed', {
        duration,
        error: err?.message ?? String(err),
      });
    }

    return {
      success: false,
      data: null,
      error: err?.message ?? String(err),
      meta: { duration, engineName },
    };
  }
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

function summarizeOutput(data: any): any {
  if (Array.isArray(data)) {
    return { type: 'array', length: data.length, sample: data.slice(0, 1) };
  }
  if (data && typeof data === 'object') {
    return { type: 'object', keys: Object.keys(data).slice(0, 8) };
  }
  return data;
}
