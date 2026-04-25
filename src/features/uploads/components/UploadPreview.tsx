import React, { useMemo, useState } from 'react';
import { DataTable } from '../../../components/DataTable';
import { displayScore } from '../../../utils/scoreNormalizer';
import { SCORE_SCHEMAS } from '../../../types/reports';
import { Check, AlertTriangle, XCircle, Download } from 'lucide-react';
import { exportUnmatchedRows, exportFullDiagnostics } from '../../../utils/exportUnmatched';
import styles from './UploadPreview.module.css';

interface UploadPreviewProps {
  rows: any[];
  trainingType: string;
  strictMode?: boolean;
  onStrictModeChange?: (strict: boolean) => void;
}

export const UploadPreview: React.FC<UploadPreviewProps> = ({ rows, trainingType, strictMode = false, onStrictModeChange }) => {
  const scoreSchema = SCORE_SCHEMAS[trainingType] || [];
  const [showStrictOption, setShowStrictOption] = useState(true);
  
  // Calculate summary statistics
  const summary = useMemo(() => {
    const validCount = rows.filter(r => r.status === 'valid').length;
    const warningCount = rows.filter(r => r.status === 'warn').length;
    const errorCount = rows.filter(r => r.status === 'error').length;
    const matchedByIdCount = rows.filter(r => r.data._matchedBy === 'ID').length;
    const matchedByAadhaarCount = rows.filter(r => r.data._matchedBy === 'Aadhaar').length;
    const matchedByMobileCount = rows.filter(r => r.data._matchedBy === 'Mobile').length;
    const perfectCount = rows.filter(r => r.data._matchQuality === 'PERFECT').length;
    const partialCount = rows.filter(r => r.data._matchQuality === 'PARTIAL').length;
    const noMatchCount = rows.filter(r => r.data._matchQuality === 'NONE').length;
    
    return {
      validCount,
      warningCount,
      errorCount,
      matchedByIdCount,
      matchedByAadhaarCount,
      matchedByMobileCount,
      perfectCount,
      partialCount,
      noMatchCount,
      totalProcessed: rows.length
    };
  }, [rows]);
  
  const headers = [
    '#',
    'Status',
    'Match',
    'Quality',
    'Emp Status',
    'Strength',
    'Aadhaar',
    'Emp ID',
    'Mobile',
    'Name',
    'Trainer',
    'Team',
    'HQ',
    'State',
    'Date',
    'Att',
    ...scoreSchema,
    'Issues'
  ];

  // Filter rows based on strict mode
  const displayRows = strictMode 
    ? rows.filter(r => r.data._matchQuality === 'PERFECT')
    : rows;

  // Transform rows into flat export objects with full diagnostics
  const transformForExport = (rowsToExport: any[]) => {
    return rowsToExport.map(r => {
      const { data, ...wrapper } = r;
      return {
        ...data,
        ...wrapper,
        messages: Array.isArray(r.messages) ? r.messages : r.messages ? [r.messages] : []
      };
    });
  };

  const getMatchQualityClass = (quality: string) => {
    switch (quality) {
      case 'PERFECT': return 'text-success';
      case 'PARTIAL': return 'text-warning';
      default: return 'text-danger';
    }
  };

  const getStrengthClass = (strength: string) => {
    switch (strength) {
      case 'HIGH': return styles.bgSuccess;
      case 'MEDIUM': return styles.bgWarning;
      default: return styles.bgDanger;
    }
  };

  return (
    <div>
      {/* Summary Banner */}
      <div className="upload-summary-banner">
        <div className="summary-item summary-valid">
          <Check size={18} />
          <div>
            <div className="summary-label">Valid</div>
            <div className="summary-value">{summary.validCount}</div>
          </div>
        </div>
        
        <div className="summary-divider"></div>
        
        <div className="summary-item summary-warn">
          <AlertTriangle size={18} />
          <div>
            <div className="summary-label">Warnings</div>
            <div className="summary-value">{summary.warningCount}</div>
          </div>
        </div>
        
        <div className="summary-divider"></div>
        
        <div className="summary-item summary-error">
          <XCircle size={18} />
          <div>
            <div className="summary-label">Errors</div>
            <div className="summary-value">{summary.errorCount}</div>
          </div>
        </div>

        <div className="summary-divider"></div>

        <div className="summary-item summary-info">
          <div className={styles.summaryInfo}>
            <div className="summary-label">Match Quality</div>
            <div className={styles.matchQualityList}>
              <span className={`${styles.matchBadge} ${styles.bgSuccess}`}>Perfect: {summary.perfectCount}</span>
              <span className={`${styles.matchBadge} ${styles.bgWarning}`}>Partial: {summary.partialCount}</span>
              <span className={`${styles.matchBadge} ${styles.bgDanger}`}>Unmatched: {summary.noMatchCount}</span>
            </div>
          </div>
        </div>
      </div>

      {/* Strict Mode Toggle & Export Options */}
      {showStrictOption && (
        <div className={styles.actionPanel}>
          <div className={styles.checkboxGroup}>
            <input 
              type="checkbox" 
              className={styles.checkbox}
              id="strict-mode"
              checked={strictMode}
              onChange={(e) => onStrictModeChange?.(e.target.checked)}
            />
            <label htmlFor="strict-mode" className={styles.checkboxLabel}>
              🔒 Strict Mode: Upload only perfectly matched records (ID-matched)
            </label>
            <span className={styles.checkboxSubtext}>
              ({summary.perfectCount} of {summary.totalProcessed} available)
            </span>
          </div>

          <div className={styles.btnGroup}>
            {(summary.partialCount > 0 || summary.noMatchCount > 0) && (
              <button 
                className="btn btn-secondary actionBtn"
                onClick={() => exportUnmatchedRows(transformForExport(rows.filter(r => r.data._matchQuality !== 'PERFECT')), 'Unmatched_Records.xlsx')}
                title="Download Excel with problematic records for fixing"
              >
                <Download size={14} className={styles.btnIcon} />
                Export Unmatched
              </button>
            )}
            
            <button 
              className="btn btn-secondary actionBtn"
              onClick={() => exportFullDiagnostics(transformForExport(rows), 'Full_Diagnostics.xlsx')}
              title="Download comprehensive diagnostic report"
            >
              <Download size={14} className={styles.btnIcon} />
              Export All Diagnostics
            </button>
          </div>
        </div>
      )}

      {/* Data Table */}
      <div className={styles.tableContainer}>
        {strictMode && summary.perfectCount === 0 ? (
          <div className={styles.emptyState}>
            <XCircle size={32} className={styles.emptyIcon} />
            <div className={styles.emptyTitle}>No Perfectly Matched Records</div>
            <div className={styles.emptySubtitle}>
              Disable Strict Mode to upload partially matched records, or export to fix manually.
            </div>
          </div>
        ) : (
          <DataTable headers={headers} maxHeight="420px">
            {displayRows.map((r, i) => (
              <tr key={i} className={r.status === 'error' ? styles.rowError : r.status === 'warn' ? styles.rowWarning : styles.rowValid}>
                <td className={styles.tdMuted}>{r.rowNum || i + 1}</td>
                <td>
                  {r.status === 'valid' ? (
                    <span className="badge badge-success">✓</span>
                  ) : r.status === 'warn' ? (
                    <span className="badge badge-warning">⚠</span>
                  ) : (
                    <span className="badge badge-danger">✕</span>
                  )}
                </td>
                <td className={styles.tdSmallBold}>
                  {r.data._matchedBy ? (
                    <span className="match-indicator" title={`Matched by ${r.data._matchedBy}`}>
                      {r.data._matchedBy}
                    </span>
                  ) : (
                    <span className={styles.dimmed}>—</span>
                  )}
                </td>
                <td className={styles.tdSmallBold}>
                  <span className={getMatchQualityClass(r.data._matchQuality)}>
                    {r.data._matchQuality || 'NONE'}
                  </span>
                </td>
                <td className={styles.tdSmallBold}>
                  <span className={r.data.employeeStatus === 'ACTIVE' ? 'text-success' : 'text-secondary'}>
                    {r.data.employeeStatus || 'INACTIVE'}
                  </span>
                </td>
                <td>
                  <span className={`${styles.strengthBadge} ${getStrengthClass(r.data._matchStrength)}`}>
                    {r.data._matchStrength}
                  </span>
                </td>
                <td className={styles.tdMuted}>{r.data.aadhaarNumber || '—'}</td>
                <td className={styles.tdBold}>{r.data.employeeId || '—'}</td>
                <td className={styles.tdMuted}>{r.data.mobileNumber || '—'}</td>
                <td>{r.data.name || '—'}</td>
                <td className={styles.tdMuted}>{r.data.trainerId || '—'}</td>
                <td className={styles.tdMuted}>{r.data.team || '—'}</td>
                <td className={styles.tdMuted}>{r.data.hq || '—'}</td>
                <td className={styles.tdMuted}>{r.data.state || '—'}</td>
                <td>{r.data.attendanceDate || <span className="text-danger">INVALID</span>}</td>
                <td>
                  <span className={`badge ${r.data.attendanceStatus === 'Present' ? 'badge-success' : 'badge-danger'}`}>
                    {r.data.attendanceStatus === 'Present' ? 'P' : 'A'}
                  </span>
                </td>
                {scoreSchema.map(key => (
                  <td key={key} className={styles.tdBold}>{displayScore(r.data._scores[key])}</td>
                ))}
                <td className={`${styles.issueText} ${r.status === 'error' ? 'text-danger' : 'text-warning'}`}>
                  {r.messages.join(' · ') || '—'}
                </td>
              </tr>
            ))}
          </DataTable>
        )}
      </div>
    </div>
  );
};
