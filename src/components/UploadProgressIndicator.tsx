import React, { useMemo } from 'react';
import { UploadProgressState } from '../services/attendanceUploadService';
import styles from './UploadProgressIndicator.module.css';

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
      <div className={styles.container}>
        <div className={styles.header}>
          <span className={styles.statusText}>
            {getStatusText()}
          </span>
          <span className={styles.countText}>
            {state.uploadedRows} / {state.totalRows} rows
          </span>
        </div>

        {/* Progress bar */}
        <div className={styles.track}>
          <div
            ref={(el) => { if (el) el.style.width = `${progressPercent}%`; }}
            className={`${styles.bar} ${
              state.status === 'uploading' ? styles.barUploading :
              state.status === 'completed' ? styles.barCompleted :
              state.status === 'error' ? styles.barError :
              styles.barDefault
            }`}
          />
        </div>

        {/* Percentage text */}
        <div className={styles.percentText}>
          {progressPercent}%
        </div>
      </div>

      {/* Chunk details */}
      {state.status === 'uploading' && (
        <div className={styles.chunkDetails}>
          Processing chunk {state.currentChunk} of {state.totalChunks} ({Math.round(25)} records per chunk)
        </div>
      )}

      {/* Error details */}
      {state.currentError && (
        <div className={styles.errorDetails}>
          ⚠️ {state.currentError}
        </div>
      )}
    </div>
  );
};

export default UploadProgressIndicator;
