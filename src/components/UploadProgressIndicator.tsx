import React, { useMemo } from 'react';
import { UploadProgressState } from '../../services/attendanceUploadService';

interface UploadProgressIndicatorProps {
  state: UploadProgressState;
  className?: string;
}

export const UploadProgressIndicator: React.FC<UploadProgressIndicatorProps> = ({
  state,
  className = ''
}) => {
  const progressPercent = useMemo(() => {
    if (state.totalRows === 0) return 0;
    return Math.round((state.uploadedRows / state.totalRows) * 100);
  }, [state.uploadedRows, state.totalRows]);

  const getStatusColor = () => {
    switch (state.status) {
      case 'uploading':
        return '#3b82f6'; // blue
      case 'completed':
        return '#10b981'; // green
      case 'error':
        return '#ef4444'; // red
      default:
        return '#6b7280'; // gray
    }
  };

  const getStatusText = () => {
    switch (state.status) {
      case 'uploading':
        return `Uploading chunk ${state.currentChunk}/${state.totalChunks}...`;
      case 'completed':
        return '✓ Upload completed successfully!';
      case 'error':
        return '✗ Upload encountered errors (continuing with remaining chunks)';
      default:
        return 'Ready';
    }
  };

  return (
    <div className={className}>
      <div style={{ marginBottom: '12px' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '8px' }}>
          <span style={{ fontSize: '14px', fontWeight: 600 }}>
            {getStatusText()}
          </span>
          <span style={{ fontSize: '13px', color: 'var(--text-secondary)' }}>
            {state.uploadedRows} / {state.totalRows} rows
          </span>
        </div>

        {/* Progress bar */}
        <div
          style={{
            width: '100%',
            height: '6px',
            background: 'rgba(0, 0, 0, 0.1)',
            borderRadius: '3px',
            overflow: 'hidden'
          }}
        >
          <div
            style={{
              width: `${progressPercent}%`,
              height: '100%',
              background: getStatusColor(),
              transition: 'width 0.3s ease',
              borderRadius: '3px'
            }}
          />
        </div>

        {/* Percentage text */}
        <div
          style={{
            marginTop: '6px',
            fontSize: '12px',
            color: 'var(--text-secondary)',
            textAlign: 'right'
          }}
        >
          {progressPercent}%
        </div>
      </div>

      {/* Chunk details */}
      {state.status === 'uploading' && (
        <div
          style={{
            padding: '8px 12px',
            background: 'rgba(59, 130, 246, 0.08)',
            border: '1px solid rgba(59, 130, 246, 0.2)',
            borderRadius: '6px',
            fontSize: '12px',
            color: 'var(--text-secondary)'
          }}
        >
          Processing chunk {state.currentChunk} of {state.totalChunks} ({Math.round(25)} records per chunk)
        </div>
      )}

      {/* Error details */}
      {state.currentError && (
        <div
          style={{
            marginTop: '8px',
            padding: '8px 12px',
            background: 'rgba(239, 68, 68, 0.08)',
            border: '1px solid rgba(239, 68, 68, 0.3)',
            borderRadius: '6px',
            fontSize: '12px',
            color: 'var(--danger)'
          }}
        >
          ⚠️ {state.currentError}
        </div>
      )}
    </div>
  );
};

export default UploadProgressIndicator;
