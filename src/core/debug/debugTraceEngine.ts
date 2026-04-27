/**
 * DEBUG TRACE ENGINE — Execution Trace Timeline
 *
 * Tracks every significant step in a user interaction or data flow.
 * Each trace has a unique traceId and builds a chronological step log.
 * Replaces & supersedes the old pipelineTracer + traceEngine for agent use.
 * NOT for users. For AI agents, developers, and debugging workflows.
 */

import {
  generateTraceId,
  registerTraceStep,
  getTraceStepsByTraceId,
  type TraceStepRecord,
} from './debugRegistry';
import { TRACE_ENABLED } from '../constants/debugConfig';

// ─── Active Trace Session ─────────────────────────────────────────────────────

let _activeTraceId: string | null = null;

export function startTrace(label?: string): string {
  _activeTraceId = generateTraceId();
  if (TRACE_ENABLED) {
    recordStep(_activeTraceId, label ?? 'TRACE_START', 'ok');
  }
  return _activeTraceId;
}

export function getActiveTraceId(): string | null {
  return _activeTraceId;
}

export function endTrace(): void {
  if (_activeTraceId && TRACE_ENABLED) {
    recordStep(_activeTraceId, 'TRACE_END', 'ok');
  }
  _activeTraceId = null;
}

// ─── Step Recording ───────────────────────────────────────────────────────────

export function recordStep(
  traceId: string,
  step: string,
  status: 'ok' | 'failed' | 'skipped',
  options?: { error?: string; data?: any; duration?: number }
): void {
  if (!TRACE_ENABLED) return;
  const record: TraceStepRecord = {
    traceId,
    step,
    status,
    timestamp: new Date().toISOString(),
    error: options?.error,
    data: options?.data,
    duration: options?.duration,
  };
  registerTraceStep(record);
}

/** Record a step on the active trace (shorthand) */
export function traceStep(
  step: string,
  status: 'ok' | 'failed' | 'skipped',
  options?: { error?: string; data?: any; duration?: number }
): void {
  const traceId = _activeTraceId ?? generateTraceId();
  recordStep(traceId, step, status, options);
}

// ─── Instrumented Function Wrapper ────────────────────────────────────────────

/**
 * Wraps a function and automatically records its execution as a trace step.
 * Works with both sync and async functions.
 */
export function traceCall<TArgs extends any[], TReturn>(
  step: string,
  fn: (...args: TArgs) => TReturn,
  options?: { traceId?: string }
): (...args: TArgs) => TReturn {
  return function (...args: TArgs): TReturn {
    if (!TRACE_ENABLED) return fn(...args);

    const traceId = options?.traceId ?? _activeTraceId ?? generateTraceId();
    const start = performance.now();

    try {
      const result = fn(...args);

      if (result instanceof Promise) {
        return (result as any)
          .then((resolved: any) => {
            recordStep(traceId, step, 'ok', {
              duration: performance.now() - start,
              data: summarize(resolved),
            });
            return resolved;
          })
          .catch((err: any) => {
            recordStep(traceId, step, 'failed', {
              duration: performance.now() - start,
              error: err?.message ?? String(err),
            });
            throw err;
          }) as unknown as TReturn;
      }

      recordStep(traceId, step, 'ok', {
        duration: performance.now() - start,
        data: summarize(result),
      });
      return result;
    } catch (err: any) {
      recordStep(traceId, step, 'failed', {
        duration: performance.now() - start,
        error: err?.message ?? String(err),
      });
      throw err;
    }
  };
}

// ─── Readers ──────────────────────────────────────────────────────────────────

export function getTrace(traceId: string): TraceStepRecord[] {
  return getTraceStepsByTraceId(traceId);
}

export function getTraceAsTimeline(traceId: string): string {
  const steps = getTrace(traceId);
  if (steps.length === 0) return `No steps recorded for trace: ${traceId}`;

  return steps
    .map(
      (s, i) =>
        `[${i + 1}] ${s.status.toUpperCase().padEnd(7)} | ${s.step}${s.duration != null ? ` (${s.duration.toFixed(1)}ms)` : ''}${s.error ? ` → ERR: ${s.error}` : ''}`
    )
    .join('\n');
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

function summarize(data: any): any {
  if (Array.isArray(data)) {
    return { type: 'array', length: data.length, sample: data.slice(0, 2) };
  }
  if (data && typeof data === 'object') {
    return { type: 'object', keys: Object.keys(data).slice(0, 10) };
  }
  return data;
}
