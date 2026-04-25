import React from 'react';
import { CheckCircle, AlertCircle } from 'lucide-react';
import { UploadResult } from '../services/attendanceUploadService';
import styles from './UploadResultSummary.module.css';

interface UploadResultSummaryProps {
  result: UploadResult;
  fileName: string;
  trainingType: string;
  mode: 'append' | 'replace';
}

export const UploadResultSummary: React.FC<UploadResultSummaryProps> = ({
  result,
  fileName,
  trainingType,
  mode
}) => {
  const hasErrors = result.failedChunks.length > 0;
  const successRate = result.totalProcessed > 0
    ? Math.round((result.successCount / result.totalProcessed) * 100)
    : 0;

  return (
    <div className={`animate-fade-in ${styles.container}`}>
      {/* Header */}
      <div className={styles.header}>
        <div
          className={`${styles.iconWrapper} ${hasErrors ? styles.iconWrapperError : styles.iconWrapperSuccess}`}
        >
          {hasErrors ? (
            <AlertCircle size={48} color="var(--warning)" />
          ) : (
            <CheckCircle size={48} color="var(--success)" />
          )}
        </div>
        <h2 className={styles.title}>
          {hasErrors ? 'Upload Completed with Warnings' : 'Upload Successful'}
        </h2>
        <p className="text-muted">
          {fileName} ({trainingType} • {mode})
        </p>
      </div>

      {/* Key metrics */}
      <div className={`glass-panel ${styles.metricsPanel}`}>
        <div className={styles.keyMetricsGrid}>
          <div className={styles.metricCol}>
            <div className={`${styles.metricValue} ${styles.successValue}`}>
              {result.successCount}
            </div>
            <div className={styles.metricLabel}>
              Successfully Uploaded
            </div>
          </div>
          <div className={styles.metricCol}>
            <div className={`${styles.metricValue} ${hasErrors ? styles.warningValue : styles.successValue}`}>
              {successRate}%
            </div>
            <div className={styles.metricLabel}>
              Success Rate
            </div>
          </div>
        </div>

        {/* Details */}
        <div className={styles.detailsGrid}>
          <div className={styles.detailBox}>
            <div className={styles.detailLabel}>Total Processed</div>
            <div className={styles.detailValue}>{result.totalProcessed}</div>
          </div>
          <div className={styles.detailBox}>
            <div className={styles.detailLabel}>Duration</div>
            <div className={styles.detailValue}>{result.duration}ms</div>
          </div>
          <div className={styles.detailBox}>
            <div className={styles.detailLabel}>Payload Size</div>
            <div className={styles.detailValue}>{result.payloadSizeKB} KB</div>
          </div>
        </div>
      </div>

      {/* Failed chunks details */}
      {hasErrors && (
        <div className={`glass-panel ${styles.errorPanel}`}>
          <div className={styles.errorHeader}>
            <AlertCircle size={20} color="var(--warning)" />
            <h3 className={styles.errorTitle}>
              {result.failedChunks.length} Chunk(s) Failed
            </h3>
          </div>

          <div className={styles.errorList}>
            {result.failedChunks.map((chunk, idx) => (
              <div
                key={idx}
                className={styles.errorItem}
              >
                <div className={styles.errorItemTitle}>
                  Chunk {chunk.chunkIndex + 1}
                </div>
                <div className={styles.errorItemRows}>
                  Rows: {chunk.rowIndices.join(', ')}
                </div>
                <div className={styles.errorItemMsg}>
                  {chunk.error}
                </div>
              </div>
            ))}
          </div>

          <div className={styles.errorInfo}>
            ℹ️ Successfully uploaded {result.successCount} records. Failed chunks will need to be
            retried or corrected before re-upload.
          </div>
        </div>
      )}

      {/* Success message */}
      {!hasErrors && (
        <div className={styles.successPanel}>
          <CheckCircle size={20} color="var(--success)" className={styles.successIcon} />
          <div className={styles.successMsg}>
            All {result.successCount} records were successfully uploaded and synced to the database with
            deterministic IDs for safe deduplication.
          </div>
        </div>
      )}
    </div>
  );
};

export default UploadResultSummary;
