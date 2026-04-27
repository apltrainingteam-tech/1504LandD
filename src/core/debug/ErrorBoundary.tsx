/**
 * ERROR BOUNDARY — React Failure Boundary with Debug Layer Integration
 *
 * Wraps UI components and catches render-phase errors.
 * Every caught error is registered in the Debug Registry with:
 *   - layer: "UI"
 *   - component name
 *   - props snapshot
 *   - classified error
 * NOT for users. For AI agents, developers, and debugging workflows.
 */

import React, { Component, ErrorInfo, ReactNode } from 'react';
import {
  registerFailure,
  generateTraceId,
} from './debugRegistry';
import { classifyError } from './errorClassifier';

interface Props {
  children: ReactNode;
  componentName: string;
  propsSnapshot?: Record<string, any>;
  fallback?: ReactNode;
  onError?: (traceId: string, error: Error) => void;
}

interface State {
  hasError: boolean;
  traceId: string | null;
  errorMessage: string | null;
}

export class ErrorBoundary extends Component<Props, State> {
  state: State = {
    hasError: false,
    traceId: null,
    errorMessage: null,
  };

  static getDerivedStateFromError(error: Error): Partial<State> {
    return {
      hasError: true,
      errorMessage: error.message,
    };
  }

  componentDidCatch(error: Error, info: ErrorInfo) {
    const classified = classifyError(error, { layer: 'UI', component: this.props.componentName });
    const traceId = generateTraceId();

    registerFailure({
      traceId,
      layer: 'UI',
      component: this.props.componentName,
      type: classified.type,
      error: error.message,
      rootCause: classified.rootCause,
      originLayer: classified.layer,
      fixHint: classified.fixHint,
      severity: classified.severity,
      propsSnapshot: this.props.propsSnapshot,
      meta: {
        componentStack: info.componentStack?.slice(0, 500),
        errorName: error.name,
      },
    });

    this.setState({ traceId });
    this.props.onError?.(traceId, error);
  }

  render() {
    if (this.state.hasError) {
      if (this.props.fallback) return this.props.fallback;

      return (
        <div
          style={{
            border: '1px solid rgba(248, 81, 73, 0.4)',
            borderRadius: '8px',
            padding: '16px',
            background: 'rgba(248, 81, 73, 0.08)',
            fontFamily: 'ui-monospace, SFMono-Regular, Menlo, monospace',
            fontSize: '12px',
          }}
        >
          <div style={{ color: '#f85149', fontWeight: 'bold', marginBottom: '8px' }}>
            ⚠ Render failure: {this.props.componentName}
          </div>
          <div style={{ color: '#8b949e', marginBottom: '4px' }}>
            {this.state.errorMessage}
          </div>
          {this.state.traceId && (
            <div style={{ color: '#58a6ff', fontSize: '11px', marginTop: '8px' }}>
              Debug trace: <code>{this.state.traceId}</code>
            </div>
          )}
          <div style={{ color: '#3fb950', fontSize: '11px', marginTop: '4px' }}>
            Run <code>window.__DebugAPI.getLatestFailure()</code> in console to inspect
          </div>
        </div>
      );
    }

    return this.props.children;
  }
}

// ─── Convenience HOC ──────────────────────────────────────────────────────────

export function withErrorBoundary<P extends object>(
  WrappedComponent: React.ComponentType<P>,
  componentName: string,
  fallback?: ReactNode
): React.FC<P> {
  const displayName = componentName || WrappedComponent.displayName || WrappedComponent.name || 'Component';

  const Wrapped: React.FC<P> = (props) => (
    <ErrorBoundary
      componentName={displayName}
      propsSnapshot={Object.keys(props as any).reduce<Record<string, any>>((acc, key) => {
        const val = (props as any)[key];
        // Don't snapshot functions or deep objects
        acc[key] = typeof val === 'function' ? '[Function]' : typeof val === 'object' ? `[${Array.isArray(val) ? 'Array' : 'Object'}(${Array.isArray(val) ? val.length : Object.keys(val ?? {}).length})]` : val;
        return acc;
      }, {})}
      fallback={fallback}
    >
      <WrappedComponent {...props} />
    </ErrorBoundary>
  );

  Wrapped.displayName = `ErrorBoundary(${displayName})`;
  return Wrapped;
}
