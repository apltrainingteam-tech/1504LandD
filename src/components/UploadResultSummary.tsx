import React from 'react';
import { CheckCircle, AlertCircle, XCircle } from 'lucide-react';
import { UploadResult } from '../../services/attendanceUploadService';

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
    <div className="animate-fade-in" style={{ maxWidth: '600px', margin: '0 auto' }}>
      {/* Header */}
      <div style={{ textAlign: 'center', marginBottom: '32px' }}>
        <div
          style={{
            width: '80px',
            height: '80px',
            borderRadius: '50%',
            background: hasErrors ? 'rgba(245, 158, 11, 0.1)' : 'rgba(16, 185, 129, 0.1)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            margin: '0 auto 24px'
          }}
        >
          {hasErrors ? (
            <AlertCircle size={48} color="var(--warning)" />
          ) : (
            <CheckCircle size={48} color="var(--success)" />
          )}
        </div>
        <h2 style={{ fontSize: '28px', marginBottom: '8px' }}>
          {hasErrors ? 'Upload Completed with Warnings' : 'Upload Successful'}
        </h2>
        <p className="text-muted">
          {fileName} ({trainingType} • {mode})
        </p>
      </div>

      {/* Key metrics */}
      <div className="glass-panel" style={{ padding: '24px', marginBottom: '24px' }}>
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '16px', marginBottom: '20px' }}>
          <div style={{ textAlign: 'center' }}>
            <div style={{ fontSize: '32px', fontWeight: 700, color: 'var(--success)', marginBottom: '4px' }}>
              {result.successCount}
            </div>
            <div style={{ fontSize: '13px', color: 'var(--text-secondary)', textTransform: 'uppercase' }}>
              Successfully Uploaded
            </div>
          </div>
          <div style={{ textAlign: 'center' }}>
            <div style={{ fontSize: '32px', fontWeight: 700, color: hasErrors ? 'var(--warning)' : 'var(--success)', marginBottom: '4px' }}>
              {successRate}%
            </div>
            <div style={{ fontSize: '13px', color: 'var(--text-secondary)', textTransform: 'uppercase' }}>
              Success Rate
            </div>
          </div>
        </div>

        {/* Details */}
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: '12px' }}>
          <div style={{ padding: '8px', background: 'rgba(0,0,0,0.05)', borderRadius: '6px' }}>
            <div style={{ fontSize: '12px', color: 'var(--text-secondary)' }}>Total Processed</div>
            <div style={{ fontSize: '18px', fontWeight: 600 }}>{result.totalProcessed}</div>
          </div>
          <div style={{ padding: '8px', background: 'rgba(0,0,0,0.05)', borderRadius: '6px' }}>
            <div style={{ fontSize: '12px', color: 'var(--text-secondary)' }}>Duration</div>
            <div style={{ fontSize: '18px', fontWeight: 600 }}>{result.duration}ms</div>
          </div>
          <div style={{ padding: '8px', background: 'rgba(0,0,0,0.05)', borderRadius: '6px' }}>
            <div style={{ fontSize: '12px', color: 'var(--text-secondary)' }}>Payload Size</div>
            <div style={{ fontSize: '18px', fontWeight: 600 }}>{result.payloadSizeKB} KB</div>
          </div>
        </div>
      </div>

      {/* Failed chunks details */}
      {hasErrors && (
        <div className="glass-panel" style={{ padding: '20px', marginBottom: '24px', borderColor: 'rgba(245, 158, 11, 0.3)' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '12px', marginBottom: '16px' }}>
            <AlertCircle size={20} color="var(--warning)" />
            <h3 style={{ fontSize: '16px', fontWeight: 600, margin: 0 }}>
              {result.failedChunks.length} Chunk(s) Failed
            </h3>
          </div>

          <div style={{ maxHeight: '300px', overflowY: 'auto' }}>
            {result.failedChunks.map((chunk, idx) => (
              <div
                key={idx}
                style={{
                  padding: '12px',
                  background: 'rgba(239, 68, 68, 0.05)',
                  border: '1px solid rgba(239, 68, 68, 0.2)',
                  borderRadius: '4px',
                  marginBottom: '8px',
                  fontSize: '13px'
                }}
              >
                <div style={{ fontWeight: 600, color: 'var(--danger)', marginBottom: '4px' }}>
                  Chunk {chunk.chunkIndex + 1}
                </div>
                <div style={{ color: 'var(--text-secondary)', marginBottom: '4px' }}>
                  Rows: {chunk.rowIndices.join(', ')}
                </div>
                <div style={{ color: 'var(--text-secondary)', fontSize: '12px' }}>
                  {chunk.error}
                </div>
              </div>
            ))}
          </div>

          <div
            style={{
              marginTop: '12px',
              padding: '12px',
              background: 'rgba(59, 130, 246, 0.08)',
              border: '1px solid rgba(59, 130, 246, 0.2)',
              borderRadius: '4px',
              fontSize: '12px',
              color: 'var(--text-secondary)'
            }}
          >
            ℹ️ Successfully uploaded {result.successCount} records. Failed chunks will need to be
            retried or corrected before re-upload.
          </div>
        </div>
      )}

      {/* Success message */}
      {!hasErrors && (
        <div
          style={{
            padding: '16px',
            background: 'rgba(16, 185, 129, 0.08)',
            border: '1px solid rgba(16, 185, 129, 0.3)',
            borderRadius: '8px',
            marginBottom: '24px',
            display: 'flex',
            alignItems: 'flex-start',
            gap: '12px'
          }}
        >
          <CheckCircle size={20} color="var(--success)" style={{ flexShrink: 0, marginTop: '2px' }} />
          <div style={{ fontSize: '14px', color: 'var(--text-secondary)' }}>
            All {result.successCount} records were successfully uploaded and synced to Firestore with
            deterministic IDs for safe deduplication.
          </div>
        </div>
      )}
    </div>
  );
};

export default UploadResultSummary;
