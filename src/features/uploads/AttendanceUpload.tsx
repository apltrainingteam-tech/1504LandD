/**
 * ⚠️ DEPRECATED - DO NOT USE
 * 
 * This component uses LEGACY upload services and is NO LONGER ACTIVE in the application.
 * 
 * Legacy services used by this component:
 * ❌ parsingService (old parser)
 * ❌ attendanceUploadService (old upload handler)
 * ❌ uploadTemplates (old template system)
 * 
 * ✅ Use AttendanceUploadStrict instead:
 * - Uses uploadServiceEnriched (flexible validation, master data enrichment)
 * - Uses dateParserService (handles Excel dates correctly)
 * - Uses uploadTemplatesStrict (deterministic template detection)
 * - Accepts rows without Employee ID if Aadhaar/Mobile present
 * - No "YYYY-MM-DD required" validation errors
 * 
 * This file is kept for reference only and should be removed in future cleanup.
 * The application now uses AttendanceUploadStrict exclusively.
 */

import React, { useState, useEffect, useRef, useCallback } from 'react';
import { UploadCloud, CheckCircle, X, Check, AlertTriangle, XCircle, Upload, Info, Download } from 'lucide-react';
import { parseExcelFile, ParsedRow } from '../../services/parsingService';
import { uploadAttendanceData, UploadProgressState, UploadResult } from '../../services/attendanceUploadService';
import { UploadPreview } from './components/UploadPreview';
import { UploadProgressIndicator } from '../../components/UploadProgressIndicator';
import { UploadResultSummary } from '../../components/UploadResultSummary';
import { getSchema } from '../../services/trainingSchemas';
import { validateFileSize, MAX_UPLOAD_SIZE_BYTES } from '../../utils/fileValidation';
import { getTemplate, generateSampleTemplateData } from '../../services/uploadTemplates';
import * as XLSX from 'xlsx';

import { Employee } from '../../types/employee';
import styles from './AttendanceUpload.module.css';

interface AttendanceUploadProps {
  onUploadComplete?: () => void;
  masterEmployees: Employee[];
}

const TRAINING_TYPES = ['IP', 'AP', 'MIP', 'Refresher', 'Capsule', 'Pre_AP', 'GTG', 'HO', 'RTM'];

export const AttendanceUpload: React.FC<AttendanceUploadProps> = ({ onUploadComplete, masterEmployees }) => {
  const [step, setStep] = useState<'upload' | 'mode_select' | 'preview' | 'uploading' | 'done'>('upload');
  const [dragOver, setDragOver] = useState(false);
  const [fileName, setFileName] = useState('');
  const [selectedUploadType, setSelectedUploadType] = useState(TRAINING_TYPES[0]);
  const [trainingType, setTrainingType] = useState('IP');
  const [autoDetected, setAutoDetected] = useState(false);
  const [rows, setRows] = useState<ParsedRow[]>([]);
  
  // New: Progress tracking
  const [progressState, setProgressState] = useState<UploadProgressState>({
    totalRows: 0,
    uploadedRows: 0,
    currentChunk: 0,
    totalChunks: 0,
    status: 'idle'
  });
  
  // New: Detailed upload result
  const [result, setResult] = useState<UploadResult | null>(null);
  
  const [uploadMode, setUploadMode] = useState<'append' | 'replace'>('append');
  const [confirmReplace, setConfirmReplace] = useState(false);
  const [strictMode, setStrictMode] = useState(false);

  // Track mounted state to prevent updates on unmounted component
  const isMountedRef = useRef(true);

  useEffect(() => {
    return () => {
      isMountedRef.current = false;
    };
  }, []);

  const processFile = useCallback(async (file: File) => {
    // Validate size before any parsing (protect internal tool use)
    const valid = validateFileSize(file);
    if (!valid.ok) {
      alert(valid.reason || `Please use files smaller than ${MAX_UPLOAD_SIZE_BYTES / (1024 * 1024)} MB`);
      return;
    }
    setFileName(file.name);
    try {
      const { rows: processed, trainingType: finalType } = await parseExcelFile(file, selectedUploadType, masterEmployees);
      setTrainingType(finalType);
      setAutoDetected(true);
      setRows(processed);
      setStep('mode_select');
      setUploadMode('append');
      setConfirmReplace(false);
    } catch (err: any) {
      alert('Parse failed: ' + err.message);
      console.error(err);
    }
  }, [selectedUploadType, masterEmployees]);

  const handleDrop = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    setDragOver(false);
    const f = e.dataTransfer.files[0];
    if (f) {
      const valid = validateFileSize(f);
      if (!valid.ok) { alert(valid.reason || `Please use files smaller than ${MAX_UPLOAD_SIZE_BYTES / (1024 * 1024)} MB`); return; }
      processFile(f);
    }
  }, [processFile]);

  const handleFileInput = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
    const f = e.target.files?.[0];
    if (f) {
      const valid = validateFileSize(f);
      if (!valid.ok) { alert(valid.reason || `Please use files smaller than ${MAX_UPLOAD_SIZE_BYTES / (1024 * 1024)} MB`); return; }
      processFile(f);
    }
  }, [processFile]);

  // ✅ DOWNLOAD TEMPLATE HANDLER
  const handleDownloadTemplate = useCallback(() => {
    try {
      const template = getTemplate(selectedUploadType);
      const sampleData = generateSampleTemplateData(selectedUploadType, 5);
      
      // Create workbook with template and sample data
      const wsData = [
        template.columns.map(col => col.excelHeader),
        template.columns.map(col => col.description),
        ...sampleData.map(row => template.columns.map(col => row[col.excelHeader]))
      ];
      
      const ws = XLSX.utils.aoa_to_sheet(wsData);
      const wb = XLSX.utils.book_new();
      XLSX.utils.book_append_sheet(wb, ws, 'Template');
      
      // Save file
      XLSX.writeFile(wb, template.fileName);
      console.log(`[UI] Downloaded template: ${template.fileName}`);
    } catch (err: any) {
      alert(`Failed to download template: ${err.message}`);
      console.error(err);
    }
  }, [selectedUploadType]);

  const doUpload = useCallback(async () => {
    try {
      // Validate we have data
      if (!rows || rows.length === 0) {
        alert('No valid records to upload. Please check your file and try again.');
        return;
      }

      // Filter based on strict mode
      let uploadable = rows.filter(r => r.status !== 'error');
      
      if (uploadable.length === 0) {
        alert('All records have errors. Please fix the data and try again.');
        return;
      }
      
      if (strictMode) {
        const perfectMatches = rows.filter(r => r.data?._matchQuality === 'PERFECT');
        if (perfectMatches.length === 0) {
          alert('No perfectly matched records available for upload. Disable Strict Mode or fix the data.');
          return;
        }
        uploadable = perfectMatches;
      }
      
      // Validate training type
      if (!trainingType) {
        alert('Please select a training type before uploading.');
        return;
      }

      // Initialize progress state
      if (isMountedRef.current) {
        setProgressState({
          totalRows: uploadable.length,
          uploadedRows: 0,
          currentChunk: 0,
          totalChunks: Math.ceil(uploadable.length / 25),
          status: 'uploading'
        });
        setStep('uploading');
      }

      console.log(`[UI] Starting upload with ${uploadable.length} rows in ${uploadMode} mode for ${trainingType}`);
      
      // Call new service with progress callback
      const uploadResult = await uploadAttendanceData(
        uploadable,
        trainingType,
        uploadMode,
        (state: UploadProgressState) => {
          if (isMountedRef.current) {
            console.log(`[UI] Progress update:`, state);
            setProgressState(state);
          }
        },
        25 // chunkSize
      );
      
      // Store result and move to done
      if (isMountedRef.current) {
        setResult(uploadResult);
        setStep('done');
        onUploadComplete?.();
      }
      
    } catch (err: any) {
      const errorMsg = err?.message || String(err) || 'Unknown error occurred';
      console.error('Upload error:', err);
      
      if (isMountedRef.current) {
        alert('Upload failed: ' + errorMsg);
        
        // Update progress state with error
        setProgressState(prev => ({
          ...prev,
          status: 'error',
          currentError: errorMsg
        }));
        
        setStep('preview'); // Return to preview on error
      }
    }
  }, [rows, strictMode, trainingType, uploadMode, isMountedRef, onUploadComplete]);

  const reset = useCallback(() => {
    setStep('upload');
    setRows([]);
    setFileName('');
    setResult(null);
    setAutoDetected(false);
    setUploadMode('append');
    setConfirmReplace(false);
    setStrictMode(false);
    setProgressState({
      totalRows: 0,
      uploadedRows: 0,
      currentChunk: 0,
      totalChunks: 0,
      status: 'idle'
    });
  }, []);

  if (step === 'done' && result) {
    return (
      <div className="animate-fade-in">
        <UploadResultSummary 
          result={result}
          fileName={fileName}
          trainingType={trainingType}
          mode={uploadMode}
        />
        <div className={styles.doneWrapper}>
          <button className="btn btn-primary" onClick={reset}>
            <Upload size={18} /> Upload Another File
          </button>
        </div>
      </div>
    );
  }

  // New uploading step
  if (step === 'uploading') {
    return (
      <div className={`animate-fade-in ${styles.uploadingWrapper}`}>
        <h2 className={styles.uploadingTitle}>Uploading Data</h2>
        <p className={`text-muted ${styles.uploadingSubtitle}`}>
          Processing {progressState.totalRows} rows in chunks of 25 records...
        </p>
        
        <div className={styles.uploadingProgress}>
          <UploadProgressIndicator state={progressState} />
        </div>
      </div>
    );
  }

  if (step === 'preview') {
    const validCount = rows.filter(r => r.status === 'valid').length;
    const warnCount = rows.filter(r => r.status === 'warn').length;
    const errCount = rows.filter(r => r.status === 'error').length;
    const unmatchedCount = rows.filter(r => r.data._matchQuality === 'NONE').length;
    const perfectCount = rows.filter(r => r.data._matchQuality === 'PERFECT').length;
    const uploadableCount = rows.filter(r => r.status !== 'error').length;
    const strictUploadBlocked = strictMode && perfectCount === 0;
    const canUpload = uploadableCount > 0 && !strictUploadBlocked;

    return (
      <div className="animate-fade-in">
        <div className={styles.previewHeader}>
          <div>
            <h2 className={styles.previewTitle}>Review Data: {fileName}</h2>
            <p className="text-muted">
              Type: <strong className={styles.accentColor}>{trainingType}</strong> {autoDetected && '(auto)'} · {rows.length} rows detected
            </p>
          </div>
          <div className="flex-center">
            <select 
              className={`form-select ${styles.typeSelect}`} 
              value={trainingType} 
              onChange={e => setTrainingType(e.target.value)}
              title="Select training type for preview"
            >
              {TRAINING_TYPES.map(t => <option key={t} value={t}>{t}</option>)}
            </select>
            <button className="btn btn-secondary" onClick={reset}>Cancel</button>
          </div>
        </div>

        <div className={styles.grid3}>
          <div className={`glass-panel ${styles.statCard} ${styles.borderSuccess}`}>
            <div className={`${styles.statIconWrapper} ${styles.bgSuccess}`}><Check size={18} /></div>
            <div><div className={styles.statLabel}>Valid Rows</div><div className={styles.statValue}>{validCount}</div></div>
          </div>
          <div className={`glass-panel ${styles.statCard} ${styles.borderWarning}`}>
            <div className={`${styles.statIconWrapper} ${styles.bgWarning}`}><AlertTriangle size={18} /></div>
            <div><div className={styles.statLabel}>Warnings</div><div className={styles.statValue}>{warnCount}</div></div>
          </div>
          <div className={`glass-panel ${styles.statCard} ${styles.borderDanger}`}>
            <div className={`${styles.statIconWrapper} ${styles.bgDanger}`}><XCircle size={18} /></div>
            <div><div className={styles.statLabel}>Errors</div><div className={styles.statValue}>{errCount}</div></div>
          </div>
        </div>

        {strictUploadBlocked ? (
          <div className={`${styles.alertBox} ${styles.alertBoxDanger}`}>
            <XCircle size={20} className={`text-danger ${styles.alertIcon}`} />
            <div>
              <div className={`${styles.alertTitle} ${styles.textDanger}`}>Strict Mode Restricts Upload</div>
              <div className={styles.alertText}>
                Strict Mode is enabled but no perfectly matched records were found. Disable Strict Mode or correct the data to proceed.
              </div>
            </div>
          </div>
        ) : unmatchedCount > 0 ? (
          <div className={`${styles.alertBox} ${styles.alertBoxWarning}`}>
            <AlertTriangle size={20} className={`text-warning ${styles.alertIcon}`} />
            <div>
              <div className={`${styles.alertTitle} ${styles.textWarning}`}>Historical Records Detected</div>
              <div className={styles.alertText}>
                Some records are not found in active employee master. These will be treated as historical records and still uploaded.
              </div>
            </div>
          </div>
        ) : null}

        <div className="mb-8">
          <UploadPreview 
            rows={rows} 
            trainingType={trainingType}
            strictMode={strictMode}
            onStrictModeChange={setStrictMode}
          />
        </div>

        <div className={styles.footerActions}>
          <button 
            className={`btn btn-primary w-full ${styles.uploadBtn}`} 
            onClick={doUpload} 
            disabled={!canUpload}
            title={!canUpload ? strictUploadBlocked ? 'Strict Mode requires a perfect match' : 'No valid records to upload' : 'Accept and sync data'}
          >
            {`Accept & Sync ${uploadableCount} Rows (${uploadMode.toUpperCase()})`}
          </button>
          
          <button className="btn btn-secondary w-full" onClick={reset}>Discard & Reject</button>
          {errCount > 0 && <span className={styles.errorText}>❌ {errCount} rows with errors will NOT be uploaded</span>}
          {warnCount > 0 && <span className={styles.warningText}>⚠️ {warnCount} rows with warnings will be uploaded with caution</span>}
          <span className={styles.infoText}>Large uploads process in chunks of 25 records to prevent quota limits</span>
        </div>
      </div>
    );
  }

  if (step === 'mode_select') {
    return (
      <div className={`animate-fade-in ${styles.modeSelectWrapper}`}>
        <h2 className={styles.modeSelectTitle}>Select Upload Mode</h2>
        <p className={`text-muted ${styles.uploadingSubtitle}`}>How would you like to handle the incoming data?</p>

        <div className={styles.modeGrid}>
          <div 
            className={`glass-panel ${styles.modeCard} ${uploadMode === 'append' ? styles.modeCardActiveAppend : ''}`}
            onClick={() => setUploadMode('append')}
          >
            <div className={styles.modeHeader}>
              <div className={`${styles.modeIconWrapper} ${styles.modeIconAppend}`}>
                <CheckCircle size={24} />
              </div>
              <h3 className={styles.modeTitle}>Append Data</h3>
            </div>
            <p className={`text-muted ${styles.modeDescription}`}>
              Adds new records to the database. Identifies duplicates using <strong>Employee ID + Date + Type</strong> and automatically skips them to prevent double-counting.
            </p>
          </div>

          <div 
            className={`glass-panel ${styles.modeCard} ${uploadMode === 'replace' ? styles.modeCardActiveReplace : ''}`}
            onClick={() => {
              setUploadMode('replace');
              setConfirmReplace(false);
            }}
          >
            <div className={styles.modeHeader}>
              <div className={`${styles.modeIconWrapper} ${styles.modeIconReplace}`}>
                <AlertTriangle size={24} />
              </div>
              <h3 className={styles.modeTitle}>Replace All</h3>
            </div>
            <p className={`text-muted ${styles.modeDescription}`}>
              <strong>Destructive action.</strong> Deletes ALL existing attendance and score records system-wide before uploading the new dataset. Use for full resets.
            </p>
          </div>
        </div>

        {uploadMode === 'replace' && (
          <div className={`glass-panel ${styles.replaceConfirmBox}`}>
            <input 
              type="checkbox" 
              className={styles.replaceCheckbox}
              id="confirm-replace" 
              checked={confirmReplace} 
              onChange={e => setConfirmReplace(e.target.checked)}
            />
            <label htmlFor="confirm-replace" className={styles.replaceLabel}>
              I understand this will PERMANENTLY erase all existing attendance data.
            </label>
          </div>
        )}

        <div className={styles.stepActions}>
          <button className={`btn btn-secondary ${styles.stepBtn}`} onClick={reset}>Cancel</button>
          <button 
            className={`btn ${uploadMode === 'replace' ? 'btn-danger' : 'btn-primary'} ${styles.stepBtnPrimary}`} 
            onClick={() => setStep('preview')} 
            disabled={uploadMode === 'replace' && !confirmReplace}
            title="Continue to data preview"
          >
            Continue to Preview
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="animate-fade-in">
      <div className="header">
        <div>
          <h2 className={styles.portalTitle}>Attendance Portal</h2>
          <p className="text-muted">Automated field training ingestion engine</p>
        </div>
      </div>

      <div className={styles.typeSelectorBar}>
        <label className={styles.typeLabel} htmlFor="training-type-select">Target Training Type:</label>
        <select 
          id="training-type-select"
          className={`form-select glass-panel ${styles.typeSelectInput}`} 
          value={selectedUploadType}
          onChange={e => {
             setSelectedUploadType(e.target.value);
             setTrainingType(e.target.value);
          }}
          title="Select training type"
        >
          {TRAINING_TYPES.map(t => <option key={t} value={t}>{t}</option>)}
        </select>
      </div>

      <div 
        className={`upload-zone ${dragOver ? 'over' : ''}`}
        onDragOver={e => { e.preventDefault(); setDragOver(true); }}
        onDragLeave={() => setDragOver(false)}
        onDrop={handleDrop}
        onClick={() => document.getElementById('file-input')?.click()}
      >
        <div className={styles.uploadIconCircle}>
          <UploadCloud size={32} />
        </div>
        <h3 className={styles.dropZoneTitle}>Drop Excel data here</h3>
        <p className="text-muted">or click to browse local files (.xlsx, .xls, .csv)</p>
        <input id="file-input" type="file" accept=".xlsx,.xls,.csv" className={styles.hidden} onChange={handleFileInput} title="Upload Excel file" />
      </div>

      <div className={styles.templateActions}>
        <button 
          className={`btn btn-secondary ${styles.templateBtn}`}
          onClick={handleDownloadTemplate}
          title={`Download ${selectedUploadType} Excel template`}
        >
          <Download size={18} />
          📥 Download {selectedUploadType} Template
        </button>
      </div>

      <div className={`glass-panel ${styles.standardsPanel}`}>
        <h4 className={styles.standardsTitle}>
          <Info size={14} /> Data Standards · {selectedUploadType}
        </h4>

        <div className={styles.sectionWrapper}>
          <div className={styles.sectionTitle}>Required Columns</div>
          <div className={styles.badgeList}>
            {(() => {
              try {
                const template = getTemplate(selectedUploadType);
                return template.columns
                  .filter(col => col.required)
                  .map(col => (
                    <span key={col.excelHeader} className="badge badge-danger">
                      {col.excelHeader}
                    </span>
                  ));
              } catch {
                return <span className="text-muted">Template not available</span>;
              }
            })()}
          </div>
        </div>

        <div className={styles.sectionWrapper}>
          <div className={styles.sectionTitle}>Optional Columns</div>
          <div className={styles.badgeList}>
            {(() => {
              try {
                const template = getTemplate(selectedUploadType);
                return template.columns
                  .filter(col => !col.required)
                  .map(col => (
                    <span key={col.excelHeader} className="badge badge-info">
                      {col.excelHeader}
                    </span>
                  ));
              } catch {
                return <span className="text-muted">Template not available</span>;
              }
            })()}
          </div>
        </div>

        {(() => {
          const schema = getSchema(selectedUploadType);
          const scoreLabels = Object.values(schema.scoreLabels);
          if (scoreLabels.length === 0) return null;
          return (
            <div className={styles.sectionWrapper}>
              <div className={styles.sectionTitle}>Score Fields (Legacy)</div>
              <div className={styles.badgeList}>
                {scoreLabels.map(label => (
                  <span key={label} className={`badge ${styles.legacyScoreBadge}`}>{label}</span>
                ))}
              </div>
            </div>
          );
        })()}

        <p className={`text-muted ${styles.standardsFootnote}`}>
          <strong>✅ Strict Template Validation:</strong> Your file MUST use exact column headers from the official template. 
          Download the template using the button above to ensure your columns match exactly. 
          Missing required columns will be rejected with clear error messages.
        </p>
      </div>
    </div>
  );
};
