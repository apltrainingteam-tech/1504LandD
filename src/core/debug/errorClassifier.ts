/**
 * ERROR CLASSIFIER — Smart Error Classification Engine
 *
 * Turns any raw error into a structured, machine-readable diagnosis.
 * Used by the DebugAPI and all instrumentation layers.
 * NOT for users. For AI agents, developers, and debugging workflows.
 */

import type { DebugLayer, FailureSeverity } from './debugRegistry';

export interface ClassifiedError {
  type: string;
  layer: DebugLayer;
  severity: FailureSeverity;
  message: string;
  rootCause: string | 'UNKNOWN';
  fixHint: string;
  meta?: Record<string, any>;
}

// ─── HTTP Status → Diagnosis ──────────────────────────────────────────────────

const HTTP_DIAGNOSES: Record<number, { rootCause: string; fixHint: string; severity: FailureSeverity }> = {
  400: {
    rootCause: 'Bad request — malformed payload or missing required fields',
    fixHint: 'Check request body structure against API contract. Validate all required fields.',
    severity: 'high',
  },
  401: {
    rootCause: 'Unauthorized — missing or invalid authentication token',
    fixHint: 'Verify authentication headers are set correctly.',
    severity: 'critical',
  },
  403: {
    rootCause: 'Forbidden — user lacks permission for this resource',
    fixHint: 'Check RBAC rules. Confirm user role has access to this endpoint.',
    severity: 'high',
  },
  404: {
    rootCause: 'Route mismatch — endpoint does not exist on the server',
    fixHint: 'Verify the API_BASE URL and collection path. Check backend routing config.',
    severity: 'high',
  },
  409: {
    rootCause: 'Conflict — duplicate document or constraint violation',
    fixHint: 'Check for duplicate key fields. Review upsert logic.',
    severity: 'medium',
  },
  422: {
    rootCause: 'Unprocessable entity — server rejected the data shape',
    fixHint: 'Validate the request payload matches the schema the server expects.',
    severity: 'high',
  },
  429: {
    rootCause: 'Rate limited — too many requests in short time',
    fixHint: 'Implement request throttling or back-off strategy.',
    severity: 'medium',
  },
  500: {
    rootCause: 'Internal server error — backend threw an unhandled exception',
    fixHint: 'Check backend server logs. Likely a crash in a route handler or DB query.',
    severity: 'critical',
  },
  502: {
    rootCause: 'Bad gateway — upstream server (DB or proxy) is unreachable',
    fixHint: 'Check Render/MongoDB Atlas status. Server may be cold-starting.',
    severity: 'critical',
  },
  503: {
    rootCause: 'Service unavailable — backend is down or cold-starting',
    fixHint: 'Wait for cold start or check deployment health. Retry with back-off.',
    severity: 'critical',
  },
  504: {
    rootCause: 'Gateway timeout — backend did not respond in time',
    fixHint: 'Query may be too slow. Add indexes or optimize the database query.',
    severity: 'high',
  },
};

// ─── Error Message Pattern → Diagnosis ───────────────────────────────────────

interface PatternRule {
  pattern: RegExp;
  type: string;
  layer: DebugLayer;
  rootCause: string;
  fixHint: string;
  severity: FailureSeverity;
}

const PATTERN_RULES: PatternRule[] = [
  {
    pattern: /cannot read propert/i,
    type: 'NullReferenceError',
    layer: 'UI',
    rootCause: 'Property accessed on null or undefined — data not yet loaded or shape mismatch',
    fixHint: 'Add null guards or optional chaining (?.) before property access.',
    severity: 'high',
  },
  {
    pattern: /is not a function/i,
    type: 'TypeError',
    layer: 'Engine',
    rootCause: 'Called a non-function — likely an undefined import or wrong data shape',
    fixHint: 'Verify the export exists in the source module and the import path is correct.',
    severity: 'high',
  },
  {
    pattern: /network error|failed to fetch|load failed/i,
    type: 'NetworkError',
    layer: 'Network',
    rootCause: 'Network request failed — backend unreachable or CORS blocked',
    fixHint: 'Check API_BASE URL, CORS config, and network connectivity.',
    severity: 'critical',
  },
  {
    pattern: /api did not return json/i,
    type: 'NonJsonResponse',
    layer: 'API',
    rootCause: 'Server returned HTML/text instead of JSON — endpoint may be misconfigured or returning an error page',
    fixHint: 'Check backend route returns Content-Type: application/json. Look for 5xx error pages.',
    severity: 'critical',
  },
  {
    pattern: /timeout|timed out/i,
    type: 'TimeoutError',
    layer: 'Network',
    rootCause: 'Request timed out — backend is too slow or unreachable',
    fixHint: 'Increase timeout threshold or optimize the server-side query. Check cold start.',
    severity: 'high',
  },
  {
    pattern: /schema|validation|invalid.*data|expected.*received/i,
    type: 'SchemaError',
    layer: 'Schema',
    rootCause: 'Data shape does not match expected contract — upstream returned unexpected structure',
    fixHint: 'Inspect the data snapshot in the debug panel. Compare actual vs expected shape.',
    severity: 'high',
  },
  {
    pattern: /mongod|mongo|atlas/i,
    type: 'DatabaseError',
    layer: 'API',
    rootCause: 'MongoDB connection or query error',
    fixHint: 'Check MongoDB Atlas connection string and cluster status.',
    severity: 'critical',
  },
  {
    pattern: /cors/i,
    type: 'CORSError',
    layer: 'Network',
    rootCause: 'CORS policy blocked the request',
    fixHint: 'Verify backend CORS config allows the frontend origin. Check vercel.json headers.',
    severity: 'critical',
  },
  {
    pattern: /render.*component|react.*error|unmount/i,
    type: 'RenderError',
    layer: 'UI',
    rootCause: 'React render-phase exception — a component threw during render',
    fixHint: 'Check the component receiving props. Likely a null/undefined prop being accessed.',
    severity: 'high',
  },
  {
    pattern: /chunk|dynamic import|module/i,
    type: 'ChunkLoadError',
    layer: 'UI',
    rootCause: 'Code-split chunk failed to load — build or CDN issue',
    fixHint: 'Hard refresh the browser. Rebuild the project. Check Vite chunk config.',
    severity: 'high',
  },
];

// ─── Main Classifier ──────────────────────────────────────────────────────────

export function classifyError(
  error: unknown,
  context?: { layer?: DebugLayer; component?: string; httpStatus?: number }
): ClassifiedError {
  const message = extractMessage(error);
  const layer = context?.layer ?? inferLayer(message);
  const httpStatus = context?.httpStatus;

  // HTTP status takes priority
  if (httpStatus && HTTP_DIAGNOSES[httpStatus]) {
    const d = HTTP_DIAGNOSES[httpStatus];
    return {
      type: `HTTP_${httpStatus}`,
      layer: 'API',
      severity: d.severity,
      message,
      rootCause: d.rootCause,
      fixHint: d.fixHint,
      meta: { httpStatus },
    };
  }

  // Pattern matching
  for (const rule of PATTERN_RULES) {
    if (rule.pattern.test(message)) {
      return {
        type: rule.type,
        layer: rule.layer,
        severity: rule.severity,
        message,
        rootCause: rule.rootCause,
        fixHint: rule.fixHint,
      };
    }
  }

  // Fallback
  return {
    type: 'UnknownError',
    layer,
    severity: 'medium',
    message,
    rootCause: 'UNKNOWN',
    fixHint: 'Root cause could not be determined from error message alone. Inspect trace and data snapshot.',
  };
}

function extractMessage(error: unknown): string {
  if (typeof error === 'string') return error;
  if (error instanceof Error) return error.message;
  if (error && typeof error === 'object' && 'message' in error) return String((error as any).message);
  return JSON.stringify(error) ?? 'Unknown error';
}

function inferLayer(message: string): DebugLayer {
  if (/fetch|http|api|endpoint|status|cors|network/i.test(message)) return 'API';
  if (/render|component|jsx|react/i.test(message)) return 'UI';
  if (/schema|validation|shape|contract/i.test(message)) return 'Schema';
  if (/engine|compute|process|parse/i.test(message)) return 'Engine';
  return 'Unknown';
}
