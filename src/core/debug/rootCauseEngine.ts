/**
 * ROOT CAUSE ENGINE — Upstream Failure Trace Analyzer
 *
 * Given a traceId, analyzes all registered signals to determine:
 * - Root cause
 * - Origin layer
 * - Upstream chain of events
 * - Recommended fix
 * NOT for users. For AI agents, developers, and debugging workflows.
 */

import {
  getFailureByTraceId,
  getApiCallsByTraceId,
  getSchemaErrorsByTraceId,
  getTraceStepsByTraceId,
  type FailureRecord,
} from './debugRegistry';

export interface RootCauseReport {
  traceId: string;
  rootCause: string | 'UNKNOWN';
  originLayer: string;
  upstream: UpstreamEvent[];
  fix: string;
  confidence: 'high' | 'medium' | 'low';
  analysisTime: string;
}

export interface UpstreamEvent {
  sequence: number;
  layer: string;
  step: string;
  status: 'ok' | 'failed' | 'skipped';
  detail?: string;
}

export function getRootCause(traceId: string): RootCauseReport {
  const analysisTime = new Date().toISOString();

  const failure = getFailureByTraceId(traceId);
  const apiCalls = getApiCallsByTraceId(traceId);
  const schemaErrors = getSchemaErrorsByTraceId(traceId);
  const traceSteps = getTraceStepsByTraceId(traceId);

  // Build upstream event chain
  const upstream: UpstreamEvent[] = [];
  let seq = 1;

  for (const step of traceSteps) {
    upstream.push({
      sequence: seq++,
      layer: deriveLayerFromStep(step.step),
      step: step.step,
      status: step.status,
      detail: step.error,
    });
  }

  for (const call of apiCalls) {
    upstream.push({
      sequence: seq++,
      layer: 'API',
      step: `${call.method} ${call.endpoint}`,
      status: call.status !== null && call.status < 400 ? 'ok' : 'failed',
      detail: call.error ?? call.diagnosis,
    });
  }

  for (const err of schemaErrors) {
    upstream.push({
      sequence: seq++,
      layer: 'Schema',
      step: `Schema check: ${err.source}.${err.field}`,
      status: 'failed',
      detail: err.message,
    });
  }

  // Sort by sequence
  upstream.sort((a, b) => a.sequence - b.sequence);

  // ─── Priority cascade: Schema > API > Network > UI ─────────────────────────

  // 1. Schema errors are definitive — data contract violation
  if (schemaErrors.length > 0) {
    const firstSchema = schemaErrors[0];
    return {
      traceId,
      rootCause: `Schema contract violation in ${firstSchema.source} — field "${firstSchema.field}" expected ${firstSchema.expected}, received ${JSON.stringify(firstSchema.received)}`,
      originLayer: firstSchema.layer,
      upstream,
      fix: `Inspect data returned by "${firstSchema.source}". Fix the field "${firstSchema.field}" to match type "${firstSchema.expected}". Check the upstream API response and data transformation pipeline.`,
      confidence: 'high',
      analysisTime,
    };
  }

  // 2. API failures
  const failedApiCall = apiCalls.find(c => c.status !== null && c.status >= 400);
  if (failedApiCall) {
    return {
      traceId,
      rootCause: failedApiCall.diagnosis ?? `HTTP ${failedApiCall.status} from ${failedApiCall.endpoint}`,
      originLayer: 'API',
      upstream,
      fix: getApiFixHint(failedApiCall.status),
      confidence: 'high',
      analysisTime,
    };
  }

  // 3. Network / response type errors
  const networkFail = apiCalls.find(c => c.responseType === 'network-error' || c.responseType === 'timeout' || c.responseType === 'html');
  if (networkFail) {
    const causes: Record<string, string> = {
      'network-error': 'Network unreachable — backend server is down or CORS is blocking the request',
      'timeout': 'Request timed out — backend cold start or slow query',
      'html': 'Server returned HTML instead of JSON — endpoint is broken or returning an error page',
    };
    return {
      traceId,
      rootCause: causes[networkFail.responseType] ?? 'Network-level failure',
      originLayer: 'Network',
      upstream,
      fix: 'Check API_BASE config, backend health, and CORS settings. Inspect the raw response in DevTools Network tab.',
      confidence: 'high',
      analysisTime,
    };
  }

  // 4. Failed trace steps
  const failedStep = traceSteps.find(s => s.status === 'failed');
  if (failedStep) {
    return {
      traceId,
      rootCause: failedStep.error ?? `Failure at execution step: ${failedStep.step}`,
      originLayer: deriveLayerFromStep(failedStep.step),
      upstream,
      fix: `Inspect the step "${failedStep.step}". Review the input data snapshot to identify what caused the failure.`,
      confidence: 'medium',
      analysisTime,
    };
  }

  // 5. Failure record fallback
  if (failure) {
    const knownCause = failure.rootCause !== 'UNKNOWN';
    return {
      traceId,
      rootCause: failure.rootCause,
      originLayer: failure.originLayer,
      upstream,
      fix: failure.fixHint,
      confidence: knownCause ? 'medium' : 'low',
      analysisTime,
    };
  }

  // 6. UNKNOWN — no signals found
  return {
    traceId,
    rootCause: 'UNKNOWN',
    originLayer: 'Unknown',
    upstream,
    fix: 'No debug signals were captured for this traceId. Ensure instrumentation is running and the failure was recorded through the Debug Layer.',
    confidence: 'low',
    analysisTime,
  };
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

function deriveLayerFromStep(step: string): string {
  if (/api|fetch|http|request|response/i.test(step)) return 'API';
  if (/hook|use[A-Z]/i.test(step)) return 'Hook';
  if (/engine|compute|process|parse/i.test(step)) return 'Engine';
  if (/render|component|ui|click/i.test(step)) return 'UI';
  if (/schema|validate/i.test(step)) return 'Schema';
  return 'Unknown';
}

function getApiFixHint(status: number | null): string {
  const hints: Record<number, string> = {
    404: 'Verify the API_BASE URL and collection/endpoint path. Check backend route registration.',
    500: 'Check backend server logs for unhandled exceptions. MongoDB query may have failed.',
    502: 'Backend gateway is down. Check Render deployment status and MongoDB Atlas connectivity.',
    503: 'Backend is unavailable. Allow cold start to complete or check deployment health.',
    504: 'Query timed out. Add database indexes or optimize the MongoDB aggregation.',
    401: 'Authentication failed. Check auth token or session configuration.',
    403: 'Access denied. Review RBAC permissions for this endpoint.',
    400: 'Bad request payload. Validate the request body matches the API contract.',
  };
  if (status && hints[status]) return hints[status];
  return `HTTP ${status}: Inspect the network response body for server-provided error details.`;
}
