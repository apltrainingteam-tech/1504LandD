import React, { useState, useRef, useCallback, useEffect } from 'react';
import { UploadCloud, CheckCircle, X, AlertTriangle, XCircle, Download } from 'lucide-react';
import { uploadTrainingDataEnriched, UploadProgress, UploadResultEnriched } from '../../services/uploadServiceEnriched';
import { getTemplateForDownload, getAllTemplateTypes } from '../../services/uploadTemplatesStrict';
import { parseExcelDate } from '../../services/dateParserService';
import * as XLSX from 'xlsx';

interface AttendanceUploadStrictProps {
  onUploadComplete?: () => void;
}

export const AttendanceUploadStrict: React.FC<AttendanceUploadStrictProps> = ({ onUploadComplete }) => {
  // ─── UI STATE ────────────────────────────────────────────────────────────
  const [step, setStep] = useState<'upload' | 'uploading' | 'done'>('upload');
  const [dragOver, setDragOver] = useState(false);
  const [selectedTemplateType, setSelectedTemplateType] = useState('IP');
  const [fileName, setFileName] = useState('');
  
  // ─── UPLOAD STATE ────────────────────────────────────────────────────────
  const [uploadProgress, setUploadProgress] = useState<UploadProgress>({
    stage: 'parsing',
    processed: 0,
    total: 100,
    message: 'Ready to upload'
  });
  
  const [uploadResult, setUploadResult] = useState<UploadResultEnriched | null>(null);
  const [uploadMode, setUploadMode] = useState<'append' | 'replace'>('append');
  const [confirmReplace, setConfirmReplace] = useState(false);
  
  const isMountedRef = useRef(true);
  const currentFileRef = useRef<File | null>(null);

  // ─── DEBUG LOGGING ───────────────────────────────────────────────────────
  useEffect(() => {
    console.log('🚀 ENRICHED UPLOAD SYSTEM ACTIVE');
    console.log('🔍 STRICT TEMPLATE DETECTION: Deterministic (no fallback)');
    console.log('🔍 STRICT COLUMN MATCHING: Exact (no fuzzy matching)');
    console.log('✨ ENRICHED PARSER ACTIVE: Master data enrichment enabled');
    console.log('✨ DATE PARSER ACTIVE: Excel serial, ISO, common formats');
    console.log('✨ FLEXIBLE VALIDATION: Accept ANY identifier (ID, Aadhaar, Mobile)');
    console.log('✨ CONFLICT DETECTION: Enabled');
    console.log('Error reporting: Detailed with row numbers and enrichment status');
  }, []);

  // ─── HANDLERS ────────────────────────────────────────────────────────────

  const handleDownloadTemplate = useCallback(() => {
    try {
      const { headers, description, sample } = getTemplateForDownload(selectedTemplateType);
      
      // Create Excel workbook
      const ws = XLSX.utils.aoa_to_sheet([
        headers,
        description,
        headers.map(h => sample[h])
      ]);

      const wb = XLSX.utils.book_new();
      XLSX.utils.book_append_sheet(wb, ws, selectedTemplateType);
      
      // Save file
      const fileName = `${selectedTemplateType}_Training_Template.xlsx`;
      XLSX.writeFile(wb, fileName);
      console.log(`[UI] Downloaded template: ${fileName}`);
    } catch (err: any) {
      alert(`Failed to download template: ${err.message}`);
    }
  }, [selectedTemplateType]);

  const handleFileSelect = useCallback((file: File) => {
    setFileName(file.name);
    currentFileRef.current = file;
    // Auto-upload after selection (can be changed to preview step if needed)
    handleStartUpload(file);
  }, []);

  const handleDrop = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    setDragOver(false);
    const f = e.dataTransfer.files[0];
    if (f) handleFileSelect(f);
  }, [handleFileSelect]);

  const handleFileInput = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
    const f = e.target.files?.[0];
    if (f) handleFileSelect(f);
  }, [handleFileSelect]);

  const handleStartUpload = useCallback(async (file: File) => {
    setStep('uploading');
    setUploadResult(null);
    setUploadProgress({
      stage: 'parsing',
      processed: 0,
      total: 100,
      message: 'Starting upload process...'
    });

    try {
      const result = await uploadTrainingDataEnriched(file, {
        mode: uploadMode,
        onProgress: (progress) => {
          if (isMountedRef.current) {
            setUploadProgress(progress);
          }
        }
      });

      if (isMountedRef.current) {
        setUploadResult(result);
        setStep('done');
        
        if (result.success && onUploadComplete) {
          onUploadComplete();
        }
      }
    } catch (err: any) {
      if (isMountedRef.current) {
        const errorMsg = err?.message || 'Upload failed';
        setUploadResult({
          success: false,
          templateType: 'UNKNOWN',
          totalRows: 0,
          uploadedRows: 0,
          rejectedRows: 0,
          errors: [{ rowNum: 0, message: errorMsg }],
          warnings: [],
          debugLog: errorMsg
        });
        setStep('done');
      }
    }
  }, [uploadMode, onUploadComplete]);

  const handleReset = useCallback(() => {
    setStep('upload');
    setFileName('');
    setUploadResult(null);
    setUploadProgress({
      stage: 'parsing',
      processed: 0,
      total: 100,
      message: 'Ready to upload'
    });
    setUploadMode('append');
    setConfirmReplace(false);
    currentFileRef.current = null;
  }, []);

  // ─── RENDER: UPLOADING STAGE ──────────────────────────────────────────────
  if (step === 'uploading') {
    return (
      <div className="animate-fade-in" style={{ maxWidth: '600px', margin: '0 auto', paddingTop: '60px', textAlign: 'center' }}>
        <h2 style={{ fontSize: '24px', marginBottom: '8px' }}>
          {uploadProgress.stage === 'complete' ? '✅ Complete' : 'Uploading...'}
        </h2>
        <p className="text-muted" style={{ marginBottom: '32px' }}>
          {uploadProgress.message}
        </p>

        {/* Progress bar */}
        <div style={{
          width: '100%',
          height: '8px',
          background: 'var(--bg-secondary)',
          borderRadius: '4px',
          overflow: 'hidden',
          marginBottom: '24px'
        }}>
          <div style={{
            width: `${uploadProgress.processed}%`,
            height: '100%',
            background: 'linear-gradient(90deg, var(--accent-primary), var(--success))',
            transition: 'width 0.3s ease'
          }} />
        </div>

        <div style={{ fontSize: '14px', color: 'var(--text-secondary)' }}>
          {uploadProgress.processed}%
        </div>
      </div>
    );
  }

  // ─── RENDER: DONE STAGE ──────────────────────────────────────────────────
  if (step === 'done' && uploadResult) {
    const isSuccess = uploadResult.success;
    
    return (
      <div className="animate-fade-in" style={{ maxWidth: '700px', margin: '0 auto' }}>
        {/* SUCCESS HEADER */}
        {isSuccess ? (
          <div style={{
            padding: '32px 24px',
            background: 'rgba(34, 197, 94, 0.08)',
            border: '2px solid rgba(34, 197, 94, 0.3)',
            borderRadius: '12px',
            marginBottom: '24px',
            textAlign: 'center'
          }}>
            <div style={{ display: 'flex', justifyContent: 'center', marginBottom: '12px' }}>
              <CheckCircle size={48} style={{ color: 'var(--success)' }} />
            </div>
            <h2 style={{ fontSize: '22px', fontWeight: 700, color: 'var(--success)', marginBottom: '8px' }}>
              Upload Successful
            </h2>
            <p style={{ color: 'var(--text-secondary)', marginBottom: '16px' }}>
              {uploadResult.uploadedRows} of {uploadResult.totalRows} rows uploaded to training_data collection
            </p>
            <div style={{ display: 'flex', gap: '16px', justifyContent: 'center', fontSize: '14px', flexWrap: 'wrap' }}>
              <div style={{ padding: '8px 12px', background: 'rgba(34, 197, 94, 0.1)', borderRadius: '6px' }}>
                <strong>{uploadResult.uploadedRows}</strong> Uploaded ✅
              </div>
              {uploadResult.rejectedRows > 0 && (
                <div style={{ padding: '8px 12px', background: 'rgba(239, 68, 68, 0.1)', borderRadius: '6px' }}>
                  <strong>{uploadResult.rejectedRows}</strong> Rejected ❌
                </div>
              )}
              <div style={{ padding: '8px 12px', background: 'rgba(34, 197, 94, 0.15)', borderRadius: '6px', fontWeight: 600 }}>
                👤 Active: <strong>{uploadResult.activeEmployees}</strong>
              </div>
              <div style={{ padding: '8px 12px', background: 'rgba(156, 163, 175, 0.1)', borderRadius: '6px', fontWeight: 600 }}>
                ⚠️ Inactive: <strong>{uploadResult.inactiveEmployees}</strong>
              </div>
            </div>
          </div>
        ) : (
          /* FAILURE HEADER */
          <div style={{
            padding: '32px 24px',
            background: 'rgba(239, 68, 68, 0.08)',
            border: '2px solid rgba(239, 68, 68, 0.3)',
            borderRadius: '12px',
            marginBottom: '24px',
            textAlign: 'center'
          }}>
            <div style={{ display: 'flex', justifyContent: 'center', marginBottom: '12px' }}>
              <XCircle size={48} style={{ color: 'var(--danger)' }} />
            </div>
            <h2 style={{ fontSize: '22px', fontWeight: 700, color: 'var(--danger)', marginBottom: '8px' }}>
              Upload Failed
            </h2>
            <p style={{ color: 'var(--text-secondary)' }}>
              {uploadResult.errors[0]?.message || 'Unknown error'}
            </p>
          </div>
        )}

        {/* ERROR DETAILS */}
        {uploadResult.errors.length > 0 && (
          <div style={{
            background: 'rgba(239, 68, 68, 0.05)',
            border: '1px solid rgba(239, 68, 68, 0.2)',
            borderRadius: '8px',
            padding: '16px',
            marginBottom: '24px'
          }}>
            <h4 style={{ fontSize: '13px', fontWeight: 700, textTransform: 'uppercase', color: 'var(--danger)', marginBottom: '12px' }}>
              ❌ Errors
            </h4>
            <div style={{ fontSize: '13px', lineHeight: '1.8', color: 'var(--text-secondary)' }}>
              {uploadResult.errors.slice(0, 5).map((e, i) => (
                <div key={i}>Row {e.rowNum}: {e.message}</div>
              ))}
              {uploadResult.errors.length > 5 && (
                <div style={{ marginTop: '8px', fontStyle: 'italic' }}>
                  ... and {uploadResult.errors.length - 5} more errors
                </div>
              )}
            </div>
          </div>
        )}

        {/* WARNING DETAILS */}
        {uploadResult.warnings.length > 0 && (
          <div style={{
            background: 'rgba(245, 158, 11, 0.05)',
            border: '1px solid rgba(245, 158, 11, 0.2)',
            borderRadius: '8px',
            padding: '16px',
            marginBottom: '24px'
          }}>
            <h4 style={{ fontSize: '13px', fontWeight: 700, textTransform: 'uppercase', color: 'var(--warning)', marginBottom: '12px' }}>
              ⚠️ Warnings
            </h4>
            <div style={{ fontSize: '13px', lineHeight: '1.8', color: 'var(--text-secondary)' }}>
              {uploadResult.warnings.slice(0, 5).map((w, i) => (
                <div key={i}>Row {w.rowNum}: {w.message}</div>
              ))}
              {uploadResult.warnings.length > 5 && (
                <div style={{ marginTop: '8px', fontStyle: 'italic' }}>
                  ... and {uploadResult.warnings.length - 5} more warnings
                </div>
              )}
            </div>
          </div>
        )}

        {/* DEBUG LOG (if errors) */}
        {!uploadResult.success && uploadResult.debugLog && (
          <details style={{ marginBottom: '24px', padding: '12px', background: 'var(--bg-secondary)', borderRadius: '8px' }}>
            <summary style={{ cursor: 'pointer', fontWeight: 600, fontSize: '12px', textTransform: 'uppercase' }}>
              Debug Log
            </summary>
            <pre style={{
              fontSize: '11px',
              overflow: 'auto',
              marginTop: '12px',
              padding: '12px',
              background: 'var(--bg-tertiary)',
              borderRadius: '4px',
              maxHeight: '200px'
            }}>
              {uploadResult.debugLog}
            </pre>
          </details>
        )}

        {/* ACTIONS */}
        <div style={{ display: 'flex', gap: '12px', justifyContent: 'center' }}>
          <button className="btn btn-secondary" onClick={handleReset} style={{ padding: '12px 24px' }}>
            ↺ Upload Another File
          </button>
          {isSuccess && (
            <button className="btn btn-primary" onClick={onUploadComplete} style={{ padding: '12px 24px' }}>
              ✅ Done
            </button>
          )}
        </div>
      </div>
    );
  }

  // ─── RENDER: UPLOAD STAGE ────────────────────────────────────────────────
  return (
    <div className="animate-fade-in">
      <div className="header">
        <div>
          <h2 style={{ fontSize: '24px' }}>📊 Enriched Training Data Upload</h2>
          <p className="text-muted">Zero ambiguity. Master data enrichment. Flexible ID validation. Conflict detection.</p>
        </div>
      </div>

      {/* TEMPLATE TYPE SELECTOR */}
      <div className="glass-panel mb-6" style={{ padding: '16px', display: 'flex', gap: '16px', alignItems: 'center', flexWrap: 'wrap' }}>
        <label style={{ fontWeight: 600, fontSize: '14px', whiteSpace: 'nowrap' }}>Auto-Detect Template Type</label>
        <select
          className="form-select glass-panel"
          style={{ cursor: 'pointer', minWidth: '150px' }}
          value={selectedTemplateType}
          onChange={(e) => setSelectedTemplateType(e.target.value)}
        >
          {getAllTemplateTypes().map(type => <option key={type} value={type}>{type}</option>)}
        </select>
        <span className="text-muted" style={{ fontSize: '12px' }}>
          (Selected for template download; actual type detected from file)
        </span>
      </div>

      {/* UPLOAD ZONE */}
      <div
        className={`upload-zone ${dragOver ? 'over' : ''}`}
        onDragOver={(e) => { e.preventDefault(); setDragOver(true); }}
        onDragLeave={() => setDragOver(false)}
        onDrop={handleDrop}
        onClick={() => document.getElementById('file-input')?.click()}
        style={{ cursor: 'pointer', marginBottom: '24px' }}
      >
        <UploadCloud size={48} style={{ marginBottom: '12px', color: 'var(--accent-primary)' }} />
        <h3 style={{ fontSize: '18px', fontWeight: 600, marginBottom: '4px' }}>Drop Excel file here</h3>
        <p className="text-muted">or click to browse</p>
        <input id="file-input" type="file" accept=".xlsx,.xls,.csv" style={{ display: 'none' }} onChange={handleFileInput} />
      </div>

      {/* DOWNLOAD TEMPLATE */}
      <div style={{ display: 'flex', justifyContent: 'center', marginBottom: '32px' }}>
        <button
          className="btn btn-secondary"
          onClick={handleDownloadTemplate}
          style={{ display: 'flex', alignItems: 'center', gap: '8px', padding: '12px 24px' }}
        >
          <Download size={18} />
          📥 Download {selectedTemplateType} Template
        </button>
      </div>

      {/* UPLOAD MODE SELECTOR */}
      <div className="glass-panel mb-6" style={{ padding: '24px' }}>
        <h4 style={{ fontSize: '14px', fontWeight: 700, marginBottom: '16px', textTransform: 'uppercase', color: 'var(--text-secondary)' }}>
          📋 Upload Mode
        </h4>

        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '16px' }}>
          {/* APPEND MODE */}
          <div
            className={`glass-panel ${uploadMode === 'append' ? 'active-mode' : ''}`}
            style={{
              padding: '20px',
              cursor: 'pointer',
              border: uploadMode === 'append' ? '2px solid var(--accent-primary)' : '2px solid transparent',
              transition: 'all 0.2s'
            }}
            onClick={() => setUploadMode('append')}
          >
            <div style={{ fontWeight: 700, marginBottom: '8px', fontSize: '14px' }}>➕ Append</div>
            <p className="text-muted" style={{ fontSize: '13px' }}>Add new records to existing data. Duplicates skipped.</p>
          </div>

          {/* REPLACE MODE */}
          <div
            className={`glass-panel ${uploadMode === 'replace' ? 'active-mode' : ''}`}
            style={{
              padding: '20px',
              cursor: 'pointer',
              border: uploadMode === 'replace' ? '2px solid var(--danger)' : '2px solid transparent',
              transition: 'all 0.2s'
            }}
            onClick={() => setUploadMode('replace')}
          >
            <div style={{ fontWeight: 700, marginBottom: '8px', fontSize: '14px', color: 'var(--danger)' }}>🗑️ Replace</div>
            <p className="text-muted" style={{ fontSize: '13px' }}>Clear training_data collection first. ⚠️ DESTRUCTIVE</p>
          </div>
        </div>

        {/* REPLACE CONFIRMATION */}
        {uploadMode === 'replace' && (
          <div style={{
            marginTop: '16px',
            padding: '12px',
            background: 'rgba(239, 68, 68, 0.05)',
            border: '1px solid rgba(239, 68, 68, 0.2)',
            borderRadius: '6px',
            display: 'flex',
            gap: '12px',
            alignItems: 'center'
          }}>
            <input
              type="checkbox"
              id="confirm-replace"
              checked={confirmReplace}
              onChange={(e) => setConfirmReplace(e.target.checked)}
              style={{ cursor: 'pointer', width: '18px', height: '18px' }}
            />
            <label htmlFor="confirm-replace" style={{ cursor: 'pointer', fontSize: '13px', fontWeight: 600, color: 'var(--danger)' }}>
              I confirm: this will DELETE ALL existing training_data records
            </label>
          </div>
        )}
      </div>

      {/* INFO PANEL */}
      <div className="glass-panel" style={{ padding: '16px', background: 'rgba(59, 130, 246, 0.05)', borderColor: 'rgba(59, 130, 246, 0.2)' }}>
        <h4 style={{ fontSize: '12px', fontWeight: 700, textTransform: 'uppercase', color: 'var(--accent-primary)', marginBottom: '8px' }}>
          ℹ️ How It Works
        </h4>
        <ul style={{ fontSize: '13px', lineHeight: '1.8', color: 'var(--text-secondary)', marginLeft: '20px' }}>
          <li>✅ Common columns required: {['Employee ID', 'Attendance Date', '+ 9 more'].join(', ')}</li>
          <li>✅ Template detected automatically from unique columns (Trainability Score → IP, BSE → AP, etc.)</li>
          <li>✅ All rows validated: missing Employee ID or invalid dates = REJECTED</li>
          <li>✅ Clean, flat records stored in MongoDB training_data collection</li>
          <li>✅ Deterministic: no guessing, no fallback, 100% transparent error reporting</li>
        </ul>
      </div>

      {/* ACTION BUTTON */}
      <div style={{ display: 'flex', justifyContent: 'center', gap: '12px', marginTop: '32px' }}>
        <button
          className="btn btn-primary"
          onClick={() => currentFileRef.current && handleStartUpload(currentFileRef.current)}
          disabled={!fileName || (uploadMode === 'replace' && !confirmReplace)}
          style={{ padding: '12px 32px', cursor: fileName ? 'pointer' : 'not-allowed', opacity: fileName ? 1 : 0.5 }}
        >
          {!fileName ? '⬆️ Select File First' : '🚀 Start Upload'}
        </button>
      </div>
    </div>
  );
};
