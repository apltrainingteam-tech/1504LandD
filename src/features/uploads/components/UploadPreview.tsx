import React, { useMemo, useState } from 'react';
import { DataTable } from '../../../components/DataTable';
import { displayScore } from '../../../utils/scoreNormalizer';
import { SCORE_SCHEMAS } from '../../../types/reports';
import { Check, AlertTriangle, XCircle, Download } from 'lucide-react';
import { exportUnmatchedRows, exportFullDiagnostics } from '../../../utils/exportUnmatched';

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
          <div>
            <div className="summary-label">Match Quality</div>
            <div className="summary-matches">
              <span className="match-badge" style={{ background: 'rgba(16,185,129,0.1)', color: 'var(--success)' }}>Perfect: {summary.perfectCount}</span>
              <span className="match-badge" style={{ background: 'rgba(245,158,11,0.1)', color: 'var(--warning)' }}>Partial: {summary.partialCount}</span>
              <span className="match-badge" style={{ background: 'rgba(239,68,68,0.1)', color: 'var(--danger)' }}>Unmatched: {summary.noMatchCount}</span>
            </div>
          </div>
        </div>
      </div>

      {/* Strict Mode Toggle & Export Options */}
      {showStrictOption && (
        <div style={{
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          padding: '16px',
          background: 'var(--bg-card)',
          border: '1px solid var(--border-color)',
          borderRadius: '8px',
          marginBottom: '16px',
          gap: '16px'
        }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
            <input 
              type="checkbox" 
              id="strict-mode"
              checked={strictMode}
              onChange={(e) => onStrictModeChange?.(e.target.checked)}
              style={{ width: '18px', height: '18px', cursor: 'pointer' }}
            />
            <label htmlFor="strict-mode" style={{ cursor: 'pointer', fontWeight: 500 }}>
              🔒 Strict Mode: Upload only perfectly matched records (ID-matched)
            </label>
            <span style={{ fontSize: '12px', color: 'var(--text-secondary)' }}>
              ({summary.perfectCount} of {summary.totalProcessed} available)
            </span>
          </div>

          <div style={{ display: 'flex', gap: '8px' }}>
            {summary.partialCount > 0 || summary.noMatchCount > 0 ? (
              <button 
                className="btn btn-secondary"
                onClick={() => {
                  console.log('Export triggered', rows.length, 'rows');
                  exportUnmatchedRows(transformForExport(rows.filter(r => r.data._matchQuality !== 'PERFECT')), 'Unmatched_Records.xlsx');
                }}
                style={{ padding: '8px 12px', fontSize: '12px' }}
                title="Download Excel with problematic records for fixing"
              >
                <Download size={14} style={{ marginRight: '6px' }} />
                Export Unmatched
              </button>
            ) : null}
            
            <button 
              className="btn btn-secondary"
              onClick={() => {
                console.log('Export triggered', rows.length, 'rows');
                exportFullDiagnostics(transformForExport(rows), 'Full_Diagnostics.xlsx');
              }}
              style={{ padding: '8px 12px', fontSize: '12px' }}
              title="Download comprehensive diagnostic report"
            >
              <Download size={14} style={{ marginRight: '6px' }} />
              Export All Diagnostics
            </button>
          </div>
        </div>
      )}

      {/* Data Table */}
      <div style={{ marginTop: '16px' }}>
        {strictMode && summary.perfectCount === 0 ? (
          <div style={{
            padding: '24px',
            textAlign: 'center',
            background: 'var(--bg-card)',
            border: '1px dashed var(--border-color)',
            borderRadius: '8px',
            color: 'var(--text-secondary)'
          }}>
            <XCircle size={32} style={{ marginBottom: '12px', opacity: 0.5 }} />
            <div style={{ fontWeight: 600, marginBottom: '4px' }}>No Perfectly Matched Records</div>
            <div style={{ fontSize: '13px' }}>
              Disable Strict Mode to upload partially matched records, or export to fix manually.
            </div>
          </div>
        ) : (
          <DataTable headers={headers} maxHeight="420px">
            {displayRows.map((r, i) => (
              <tr key={i} style={{
                borderLeft: r.status === 'error' ? '3px solid var(--danger)' : r.status === 'warn' ? '3px solid var(--warning)' : '3px solid var(--success)',
                background: r.status === 'error' ? 'rgba(239, 68, 68, 0.04)' : r.status === 'warn' ? 'rgba(245, 158, 11, 0.04)' : 'transparent'
              }}>
                <td style={{ fontSize: '12px', color: 'var(--text-secondary)' }}>{r.rowNum || i + 1}</td>
                <td>
                  {r.status === 'valid' ? (
                    <span className="badge badge-success">✓</span>
                  ) : r.status === 'warn' ? (
                    <span className="badge badge-warning">⚠</span>
                  ) : (
                    <span className="badge badge-danger">✕</span>
                  )}
                </td>
                <td style={{ fontSize: '12px', fontWeight: 500 }}>
                  {r.data._matchedBy ? (
                    <span className="match-indicator" title={`Matched by ${r.data._matchedBy}`}>
                      {r.data._matchedBy}
                    </span>
                  ) : (
                    <span style={{ opacity: 0.3 }}>—</span>
                  )}
                </td>
                <td style={{ fontSize: '12px', fontWeight: 500 }}>
                  {r.data._matchQuality === 'PERFECT' ? (
                    <span style={{ color: 'var(--success)', fontWeight: 600 }}>PERFECT</span>
                  ) : r.data._matchQuality === 'PARTIAL' ? (
                    <span style={{ color: 'var(--warning)', fontWeight: 600 }}>PARTIAL</span>
                  ) : (
                    <span style={{ color: 'var(--danger)', fontWeight: 600 }}>NONE</span>
                  )}
                </td>
                <td style={{ fontSize: '12px', fontWeight: 500 }}>
                  {r.data.employeeStatus === 'ACTIVE' ? (
                    <span style={{ color: 'var(--success)', fontWeight: 600 }}>ACTIVE</span>
                  ) : (
                    <span style={{ color: 'var(--text-secondary)', fontWeight: 600 }}>INACTIVE</span>
                  )}
                </td>
                <td style={{ fontSize: '12px' }}>
                  <span style={{ 
                    padding: '2px 6px',
                    borderRadius: '3px',
                    background: r.data._matchStrength === 'HIGH' ? 'rgba(16,185,129,0.1)' 
                      : r.data._matchStrength === 'MEDIUM' ? 'rgba(245,158,11,0.1)' 
                      : 'rgba(239,68,68,0.1)',
                    color: r.data._matchStrength === 'HIGH' ? 'var(--success)' 
                      : r.data._matchStrength === 'MEDIUM' ? 'var(--warning)' 
                      : 'var(--danger)',
                    fontWeight: 600,
                    fontSize: '11px'
                  }}>
                    {r.data._matchStrength}
                  </span>
                </td>
                <td style={{ fontSize: '12px' }}>{r.data.aadhaarNumber || <span style={{ opacity: 0.3 }}>—</span>}</td>
                <td style={{ fontWeight: 600 }}>{r.data.employeeId || <span style={{ opacity: 0.3 }}>—</span>}</td>
                <td style={{ fontSize: '12px' }}>{r.data.mobileNumber || <span style={{ opacity: 0.3 }}>—</span>}</td>
                <td>{r.data.name || <span style={{ opacity: 0.3 }}>—</span>}</td>
                <td style={{ fontSize: '12px' }}>{r.data.trainerId || '—'}</td>
                <td style={{ fontSize: '12px' }}>{r.data.team || '—'}</td>
                <td style={{ fontSize: '12px' }}>{r.data.hq || '—'}</td>
                <td style={{ fontSize: '12px' }}>{r.data.state || '—'}</td>
                <td>{r.data.attendanceDate || <span style={{ color: 'var(--danger)' }}>INVALID</span>}</td>
                <td>
                  <span className={`badge ${r.data.attendanceStatus === 'Present' ? 'badge-success' : 'badge-danger'}`}>
                    {r.data.attendanceStatus === 'Present' ? 'P' : 'A'}
                  </span>
                </td>
                {scoreSchema.map(key => (
                  <td key={key} style={{ fontWeight: 600 }}>{displayScore(r.data._scores[key])}</td>
                ))}
                <td style={{ fontSize: '11px', color: r.status === 'error' ? 'var(--danger)' : 'var(--warning)' }}>
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


