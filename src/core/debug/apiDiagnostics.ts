/**
 * API DIAGNOSTICS — API Contract Debugger
 *
 * Intercepts all API calls and captures structured diagnostic records.
 * Auto-diagnoses HTTP status codes, response type mismatches, and timeouts.
 * Integrates with the Debug Registry for traceId-scoped API analysis.
 * NOT for users. For AI agents, developers, and debugging workflows.
 */

import {
  registerApiCall,
  getApiCallsByTraceId,
  getAllApiCalls,
  generateTraceId,
  type ApiCallRecord,
} from './debugRegistry';
import { classifyError } from './errorClassifier';

// ─── Response Type Detector ───────────────────────────────────────────────────

function detectResponseType(
  contentType: string | null,
  status: number,
  body: string
): ApiCallRecord['responseType'] {
  if (!contentType && !body) return 'empty';
  if (contentType?.includes('application/json')) return 'json';
  if (contentType?.includes('text/html') || body.trimStart().startsWith('<')) return 'html';
  if (contentType?.includes('text/')) return 'text';
  // Try JSON parse regardless of content-type
  try {
    JSON.parse(body);
    return 'json';
  } catch {
    return 'text';
  }
}

function buildDiagnosis(status: number | null, responseType: ApiCallRecord['responseType'], error?: string): string {
  if (error?.match(/network error|failed to fetch|load failed/i)) {
    return 'Network unreachable — backend server is down, CORS is blocking, or DNS resolution failed';
  }
  if (responseType === 'timeout') return 'Request timed out — server did not respond within the timeout window';
  if (responseType === 'html') return 'Server returned HTML instead of JSON — endpoint may be broken or returning an error page';
  if (responseType === 'empty') return 'Server returned an empty body — check if the endpoint responds correctly';
  if (status === 404) return 'Route not found — verify API_BASE URL and endpoint path match the backend routing config';
  if (status === 500) return 'Internal server error — backend threw an unhandled exception, check server logs';
  if (status === 502) return 'Bad gateway — upstream server (DB or proxy) is unreachable, check MongoDB Atlas';
  if (status === 503) return 'Service unavailable — backend is cold-starting or deployment failed';
  if (status === 504) return 'Gateway timeout — database query is too slow, add indexes or optimize';
  if (status !== null && status >= 400) return `HTTP ${status} error — inspect response body for server error details`;
  return 'API call succeeded';
}

// ─── Instrumented Fetch ───────────────────────────────────────────────────────

const DEFAULT_TIMEOUT_MS = 30000;

export async function instrumentedFetch(
  url: string,
  options: RequestInit = {},
  meta?: { traceId?: string; timeout?: number }
): Promise<Response> {
  const traceId = meta?.traceId ?? generateTraceId();
  const method = (options.method ?? 'GET').toUpperCase();
  const start = performance.now();

  // Timeout handling
  const timeoutMs = meta?.timeout ?? DEFAULT_TIMEOUT_MS;
  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), timeoutMs);
  const mergedOptions: RequestInit = { ...options, signal: controller.signal };

  let status: number | null = null;
  let responseType: ApiCallRecord['responseType'] = 'empty';
  let error: string | undefined;

  try {
    const response = await fetch(url, mergedOptions);
    clearTimeout(timeoutId);

    status = response.status;
    const contentType = response.headers.get('content-type');

    // Clone to read body without consuming
    const clone = response.clone();
    const body = await clone.text().catch(() => '');
    responseType = detectResponseType(contentType, status, body);

    const duration = performance.now() - start;
    const diagnosis = buildDiagnosis(status, responseType);

    registerApiCall({
      traceId,
      endpoint: url,
      method,
      status,
      responseType,
      duration,
      diagnosis: status >= 400 ? diagnosis : undefined,
      error: status >= 400 ? `HTTP ${status}` : undefined,
    });

    return response;
  } catch (err: any) {
    clearTimeout(timeoutId);
    const duration = performance.now() - start;

    if (err?.name === 'AbortError') {
      responseType = 'timeout';
      error = `Request timed out after ${timeoutMs}ms`;
    } else {
      responseType = 'network-error';
      error = err?.message ?? String(err);
    }

    const diagnosis = buildDiagnosis(null, responseType, error);

    registerApiCall({
      traceId,
      endpoint: url,
      method,
      status: null,
      responseType,
      duration,
      error,
      diagnosis,
    });

    throw err;
  }
}

// ─── DebugAPI Surface ─────────────────────────────────────────────────────────

export interface ApiDiagnosticsReport {
  traceId: string;
  calls: ApiCallRecord[];
  summary: {
    total: number;
    failed: number;
    slowest: { endpoint: string; duration: number } | null;
    primaryIssue: string | null;
  };
}

export function getApiDiagnostics(traceId: string): ApiDiagnosticsReport {
  const calls = getApiCallsByTraceId(traceId);

  const failed = calls.filter(c => (c.status !== null && c.status >= 400) || c.responseType === 'network-error' || c.responseType === 'timeout' || c.responseType === 'html');

  const slowest = calls.length > 0
    ? calls.reduce((max, c) => c.duration > max.duration ? c : max, calls[0])
    : null;

  const primaryIssue = failed.length > 0
    ? (failed[0].diagnosis ?? failed[0].error ?? 'API failure detected')
    : null;

  return {
    traceId,
    calls,
    summary: {
      total: calls.length,
      failed: failed.length,
      slowest: slowest ? { endpoint: slowest.endpoint, duration: slowest.duration } : null,
      primaryIssue,
    },
  };
}

export function getAllApiDiagnostics(): ApiCallRecord[] {
  return getAllApiCalls();
}
