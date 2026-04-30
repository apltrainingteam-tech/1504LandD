import React, { useState, useRef, useCallback, useEffect } from 'react';
import { UploadCloud, CheckCircle, X, AlertTriangle, XCircle, Download } from 'lucide-react';
import { useUploadAction } from './hooks/useUploadAction';
import { UploadProgress, UploadResult as UploadResultEnriched } from '../../core/engines/uploadEngine';
import { getTemplateForDownload, getAllTemplateTypes } from '../../core/constants/uploadTemplates';
import * as XLSX from 'xlsx';
import styles from './AttendanceUploadStrict.module.css';

interface AttendanceUploadStrictProps {
  onUploadComplete?: () => void;
}

export const AttendanceUploadStrict: React.FC<AttendanceUploadStrictProps> = ({ onUploadComplete }) => {
  // ─── UI STATE ────────────────────────────────────────────────────────────
  const {
    step, setStep, uploadProgress, uploadResult, uploadMode,
    previewResult, startValidation, confirmUpload, testInsert, setUploadResult, setUploadProgress 
  } = useUploadAction(onUploadComplete);

  const [dragOver, setDragOver] = useState(false);
  const [selectedTemplateType, setSelectedTemplateType] = useState('IP');
  const [fileName, setFileName] = useState('');
  const isMountedRef = useRef(true);
  const currentFileRef = useRef<File | null>(null);

  // ─── DEBUG LOGGING ───────────────────────────────────────────────────────
  useEffect(() => {
    console.log('═══════════════════════════════════════════════════════════════');
    console.log('🚀 GUIDED DEBUG UPLOAD SYSTEM ACTIVE');
    console.log('═══════════════════════════════════════════════════════════════');
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
    startValidation(file);
  }, [startValidation]);

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

  const handleStartUpload = useCallback((file: File) => {
    confirmUpload(file);
  }, [confirmUpload]);


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
    currentFileRef.current = null;
  }, [setStep, setUploadResult, setUploadProgress]);

  const handleTestInsert = useCallback(async () => {
    const res = await testInsert();
    if (res.success) {
      alert('✅ Test insert succeeded!');
    } else {
      alert(`❌ TEST FAILED: ${res.error}`);
    }
  }, [testInsert]);

  // ─── RENDER: UPLOADING STAGE ──────────────────────────────────────────────
  if (step === 'uploading') {
    return (
      <div className={`animate-fade-in ${styles.uploadingContainer}`}>
        <h2 className={styles.uploadingTitle}>
          {uploadProgress.stage === 'complete' ? '✅ Complete' : 'Uploading...'}
        </h2>
        <p className={`text-muted ${styles.uploadingMessage}`}>
          {uploadProgress.message}
        </p>

        {/* Progress bar */}
        <div className={styles.progressTrack}>
          <div 
            ref={(el) => { if (el) el.style.width = `${uploadProgress.processed}%`; }}
            className={styles.progressBar}
          />
        </div>

        <div className={styles.progressPercent}>
          {uploadProgress.processed}%
        </div>
      </div>
    );
  }

  // ─── RENDER: PREVIEW STAGE ───────────────────────────────────────────────
  if (step === 'preview' && previewResult) {
    const errorRows = previewResult.rows.filter(r => r.errors.length > 0);
    const validCount = previewResult.rows.length - errorRows.length;

    return (
      <div className={`animate-fade-in ${styles.doneContainer}`}>
        <div className={styles.successHeader}>
          <div className={styles.successIconWrapper}>
            <AlertTriangle size={48} className="text-warning" />
          </div>
          <h2 className={styles.successTitle}>Validation Preview</h2>
          <p className="text-muted">Review file data before committing to the database</p>
          
          <div className={styles.statsRow}>
            <div className={`${styles.statBadge} ${styles.statBadgeSuccess}`}>
              <strong>{validCount}</strong> Ready to Upload ✅
            </div>
            {errorRows.length > 0 && (
              <div className={`${styles.statBadge} ${styles.statBadgeDanger}`}>
                <strong>{errorRows.length}</strong> Rejected/Invalid ❌
              </div>
            )}
          </div>
        </div>

        {errorRows.length > 0 && (
          <div className={styles.errorBox}>
            <h4 className={styles.errorLabel}>❌ Detected Errors (These rows will be skipped)</h4>
            <div className={styles.errorList}>
              {errorRows.slice(0, 8).map((r, i) => (
                <div key={i} className="mb-4">
                  <strong>Row {r.rowNum}:</strong> {r.errors.join('; ')}
                </div>
              ))}
              {errorRows.length > 8 && (
                <div className={styles.moreItemsText}>... and {errorRows.length - 8} more errors</div>
              )}
            </div>
          </div>
        )}

        <div className={styles.actionsRow}>
          <button className={`btn btn-secondary ${styles.actionBtnLarge}`} onClick={handleReset}>
            ↺ Cancel & Re-select
          </button>
          <button 
            className={`btn btn-primary ${styles.actionBtnLarge}`} 
            onClick={() => currentFileRef.current && handleStartUpload(currentFileRef.current)}
          >
            🚀 Confirm & Upload {validCount} Rows
          </button>
        </div>
      </div>
    );
  }

  // ─── RENDER: DONE STAGE ──────────────────────────────────────────────────

  if (step === 'done' && uploadResult) {
    const isSuccess = uploadResult.success;

    return (
      <div className={`animate-fade-in ${styles.doneContainer}`}>
        {/* SUCCESS HEADER */}
        {isSuccess ? (
          <div className={styles.successHeader}>
            <div className={styles.successIconWrapper}>
              <CheckCircle size={48} className={styles.successIcon} />
            </div>
            <h2 className={styles.successTitle}>
              Upload Successful
            </h2>
            <p className={styles.successMessage}>
              {uploadResult.uploadedRows} of {uploadResult.totalRows} rows uploaded to training_data collection
            </p>
            <div className={styles.statsRow}>
              <div className={`${styles.statBadge} ${styles.statBadgeSuccess}`}>
                <strong>{uploadResult.uploadedRows}</strong> Uploaded ✅
              </div>
              {uploadResult.rejectedRows > 0 && (
                <div className={`${styles.statBadge} ${styles.statBadgeDanger}`}>
                  <strong>{uploadResult.rejectedRows}</strong> Rejected ❌
                </div>
              )}
              <div className={`${styles.statBadge} ${styles.statBadgeHighlight}`}>
                👤 Active: <strong>{uploadResult.activeEmployees}</strong>
              </div>
              <div className={`${styles.statBadge} ${styles.statBadgeNeutral}`}>
                ⚠️ Inactive: <strong>{uploadResult.inactiveEmployees}</strong>
              </div>
            </div>
          </div>
        ) : (
          /* FAILURE HEADER */
          <div className={styles.errorHeader}>
            <div className={styles.errorIconWrapper}>
              <XCircle size={48} className={styles.errorIcon} />
            </div>
            <h2 className={styles.errorTitle}>
              Upload Failed
            </h2>
            <p className="text-muted">
              {uploadResult.errors[0]?.message || 'Unknown error'}
            </p>
          </div>
        )}

        {/* ERROR DETAILS */}
        {uploadResult.errors.length > 0 && (
          <div className={styles.errorBox}>
            <h4 className={styles.errorLabel}>
              ❌ Errors
            </h4>
            <div className={styles.errorList}>
              {uploadResult.errors.slice(0, 5).map((e, i) => (
                <div key={i}>Row {e.rowNum}: {e.message}</div>
              ))}
              {uploadResult.errors.length > 5 && (
                <div className={styles.moreItemsText}>
                  ... and {uploadResult.errors.length - 5} more errors
                </div>
              )}
            </div>
          </div>
        )}

        {/* WARNING DETAILS */}
        {uploadResult.warnings.length > 0 && (
          <div className={styles.warningBox}>
            <h4 className={styles.warningLabel}>
              ⚠️ Warnings
            </h4>
            <div className={styles.warningList}>
              {uploadResult.warnings.slice(0, 5).map((w, i) => (
                <div key={i}>{w}</div>
              ))}
              {uploadResult.warnings.length > 5 && (
                <div className={styles.moreItemsText}>
                  ... and {uploadResult.warnings.length - 5} more warnings
                </div>
              )}
            </div>
          </div>
        )}

        {/* DEBUG LOG (if errors) */}
        {!uploadResult.success && uploadResult.debugLog && (
          <details className={styles.debugDetails}>
            <summary className={styles.debugSummary}>
              Debug Log
            </summary>
            <pre className={styles.debugPre}>
              {uploadResult.debugLog}
            </pre>
          </details>
        )}

        {/* ACTIONS */}
        <div className={styles.actionsRow}>
          <button className={`btn btn-secondary ${styles.actionBtnLarge}`} onClick={handleReset}>
            ↺ Upload Another File
          </button>
          {isSuccess && (
            <button className={`btn btn-primary ${styles.actionBtnLarge}`} onClick={onUploadComplete}>
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
          <h2 className={styles.pageHeaderTitle}>📊 Training Attendance Upload</h2>
          <div className={styles.badgeRow}>
            <span className="badge badge-info">✓ Attendance</span>
          </div>
          <p className="text-muted">Upload attendance</p>
        </div>
      </div>

      {/* TEMPLATE TYPE SELECTOR */}
      <div className={`glass-panel mb-6 ${styles.templateSelector}`}>
        <label className={styles.templateLabel}>Auto-Detect Template Type</label>
        <select
          className={`form-select glass-panel ${styles.templateSelect}`}
          value={selectedTemplateType}
          onChange={(e) => setSelectedTemplateType(e.target.value)}
          title="Auto-Detect Template Type"
          aria-label="Auto-Detect Template Type"
        >
          {getAllTemplateTypes().map(type => <option key={type} value={type}>{type}</option>)}
        </select>
        <span className={`text-muted ${styles.templateNote}`}>
          (Selected for template download; actual type detected from file)
        </span>
      </div>

      {/* UPLOAD ZONE */}
      <div
        className={`upload-zone ${styles.uploadZone} ${dragOver ? 'over' : ''}`}
        onDragOver={(e) => { e.preventDefault(); setDragOver(true); }}
        onDragLeave={() => setDragOver(false)}
        onDrop={handleDrop}
        onClick={() => document.getElementById('file-input')?.click()}
      >
        <UploadCloud size={48} className={styles.uploadIcon} />
        <h3 className={styles.uploadTitle}>Drop Excel file here</h3>
        <p className="text-muted">or click to browse</p>
        <input id="file-input" type="file" accept=".xlsx,.xls,.csv" className={styles.hiddenInput} onChange={handleFileInput} title="Upload File" aria-label="Upload File" placeholder="Upload File" />
      </div>

      {/* DOWNLOAD TEMPLATE */}
      <div className={styles.downloadRow}>
        <button
          className={`btn btn-secondary ${styles.downloadBtn}`}
          onClick={handleDownloadTemplate}
        >
          <Download size={18} />
          📥 Download {selectedTemplateType} Template
        </button>
      </div>

      {/* UPLOAD MODE SELECTOR */}
      <div className={`glass-panel mb-6 ${styles.padding24}`}>
        <h4 className={styles.modeHeader}>
          📋 Upload Mode
        </h4>

        <div className={styles.modeGrid}>
          <div className={`glass-panel ${styles.modeBox} ${styles.modeBoxAppendActive}`}>
            <div className={styles.modeTitle}>➕ Append</div>
            <p className={`text-muted ${styles.modeDesc}`}>Add new records to existing data. Duplicates skipped.</p>
          </div>
        </div>
      </div>

      {/* INFO PANEL */}
      <div className={`glass-panel ${styles.infoPanel}`}>
        <h4 className={styles.infoTitle}>
          ℹ️ How It Works
        </h4>
        <ul className={styles.infoList}>
          <li>✅ Common columns required: {['Employee ID', 'Attendance Date', '+ 9 more'].join(', ')}</li>
          <li>✅ Template detected automatically from unique columns (Trainability Score → IP, BSE → AP, etc.)</li>
          <li>✅ All rows validated: missing Employee ID or invalid dates = REJECTED</li>
          <li>✅ Clean, flat records stored in MongoDB training_data collection</li>
          <li>✅ Deterministic: no guessing, no fallback, 100% transparent error reporting</li>
        </ul>
      </div>

      {/* ACTION BUTTONS */}
      <div className={styles.finalActions}>
        <button
          className={`btn btn-primary ${styles.startBtn} ${fileName ? styles.startBtnEnabled : styles.startBtnDisabled}`}
          onClick={() => currentFileRef.current && handleStartUpload(currentFileRef.current)}
          disabled={!fileName}
        >
          {!fileName ? '⬆️ Select File First' : '🚀 Start Upload'}
        </button>

        {/* TEST BUTTON - DEBUG */}
        <button
          className={`btn btn-secondary ${styles.testBtn}`}
          onClick={handleTestInsert}
          title="Test database connectivity by inserting a dummy record"
        >
          🧪 Test DB Insert
        </button>
      </div>
    </div>
  );
};


