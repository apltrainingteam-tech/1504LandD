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
        <div style={{ display: 'flex', justifyContent: 'center', gap: '12px', marginTop: '32px' }}>
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
      <div className="animate-fade-in" style={{ maxWidth: '500px', margin: '0 auto', paddingTop: '60px', textAlign: 'center' }}>
        <h2 style={{ fontSize: '24px', marginBottom: '8px' }}>Uploading Data</h2>
        <p className="text-muted" style={{ marginBottom: '32px' }}>
          Processing {progressState.totalRows} rows in chunks of 25 records...
        </p>
        
        <div style={{ marginBottom: '32px' }}>
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
        <div className="flex-between mb-8">
          <div>
            <h2 style={{ fontSize: '24px' }}>Review Data: {fileName}</h2>
            <p className="text-muted">
              Type: <strong style={{ color: 'var(--accent-primary)' }}>{trainingType}</strong> {autoDetected && '(auto)'} · {rows.length} rows detected
            </p>
          </div>
          <div className="flex-center">
            <select 
              className="form-select" 
              value={trainingType} 
              onChange={e => setTrainingType(e.target.value)}
              style={{ width: 'auto' }}
            >
              {TRAINING_TYPES.map(t => <option key={t} value={t}>{t}</option>)}
            </select>
            <button className="btn btn-secondary" onClick={reset}>Cancel</button>
          </div>
        </div>

        <div className="dashboard-grid" style={{ gridTemplateColumns: 'repeat(3, 1fr)', marginBottom: '24px' }}>
          <div className="glass-panel" style={{ padding: '16px', display: 'flex', alignItems: 'center', gap: '12px', borderColor: 'var(--success)' }}>
            <div style={{ padding: '8px', borderRadius: '8px', background: 'rgba(16,185,129,0.1)', color: 'var(--success)' }}><Check size={18} /></div>
            <div><div style={{ fontSize: '11px', textTransform: 'uppercase', color: 'var(--text-secondary)' }}>Valid Rows</div><div style={{ fontSize: '20px', fontWeight: 700 }}>{validCount}</div></div>
          </div>
          <div className="glass-panel" style={{ padding: '16px', display: 'flex', alignItems: 'center', gap: '12px', borderColor: 'var(--warning)' }}>
            <div style={{ padding: '8px', borderRadius: '8px', background: 'rgba(245,158,11,0.1)', color: 'var(--warning)' }}><AlertTriangle size={18} /></div>
            <div><div style={{ fontSize: '11px', textTransform: 'uppercase', color: 'var(--text-secondary)' }}>Warnings</div><div style={{ fontSize: '20px', fontWeight: 700 }}>{warnCount}</div></div>
          </div>
          <div className="glass-panel" style={{ padding: '16px', display: 'flex', alignItems: 'center', gap: '12px', borderColor: 'var(--danger)' }}>
            <div style={{ padding: '8px', borderRadius: '8px', background: 'rgba(239, 68, 68, 0.1)', color: 'var(--danger)' }}><XCircle size={18} /></div>
            <div><div style={{ fontSize: '11px', textTransform: 'uppercase', color: 'var(--text-secondary)' }}>Errors</div><div style={{ fontSize: '20px', fontWeight: 700 }}>{errCount}</div></div>
          </div>
        </div>

        {strictUploadBlocked ? (
          <div style={{
            padding: '16px 20px',
            background: 'rgba(239, 68, 68, 0.08)',
            border: '1px solid rgba(239, 68, 68, 0.3)',
            borderRadius: '8px',
            marginBottom: '24px',
            display: 'flex',
            alignItems: 'flex-start',
            gap: '12px'
          }}>
            <XCircle size={20} style={{ color: 'var(--danger)', flexShrink: 0, marginTop: '2px' }} />
            <div>
              <div style={{ fontWeight: 600, color: 'var(--danger)', marginBottom: '4px' }}>Strict Mode Restricts Upload</div>
              <div style={{ color: 'var(--text-secondary)', fontSize: '14px', lineHeight: '1.5' }}>
                Strict Mode is enabled but no perfectly matched records were found. Disable Strict Mode or correct the data to proceed.
              </div>
            </div>
          </div>
        ) : unmatchedCount > 0 ? (
          <div style={{
            padding: '16px 20px',
            background: 'rgba(245, 158, 11, 0.08)',
            border: '1px solid rgba(245, 158, 11, 0.3)',
            borderRadius: '8px',
            marginBottom: '24px',
            display: 'flex',
            alignItems: 'flex-start',
            gap: '12px'
          }}>
            <AlertTriangle size={20} style={{ color: 'var(--warning)', flexShrink: 0, marginTop: '2px' }} />
            <div>
              <div style={{ fontWeight: 600, color: 'var(--warning)', marginBottom: '4px' }}>Historical Records Detected</div>
              <div style={{ color: 'var(--text-secondary)', fontSize: '14px', lineHeight: '1.5' }}>
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

        <div className="flex-center w-full max-w-md mx-auto flex-col gap-2">
          <button 
            className="btn btn-primary w-full" 
            onClick={doUpload} 
            disabled={!canUpload}
            title={!canUpload ? strictUploadBlocked ? 'Strict Mode requires a perfect match' : 'No valid records to upload' : ''}
            style={{ padding: '14px 32px', position: 'relative', overflow: 'hidden' }}
          >
            {`Accept & Sync ${uploadableCount} Rows (${uploadMode.toUpperCase()})`}
          </button>
          
          <button className="btn btn-secondary w-full" onClick={reset}>Discard & Reject</button>
          {errCount > 0 && <span className="text-muted text-center mt-2" style={{ fontSize: '13px', color: 'var(--danger)' }}>❌ {errCount} rows with errors will NOT be uploaded</span>}
          {warnCount > 0 && <span className="text-muted text-center mt-2" style={{ fontSize: '13px', color: 'var(--warning)' }}>⚠️ {warnCount} rows with warnings will be uploaded with caution</span>}
          <span className="text-muted text-center mt-2" style={{ fontSize: '12px' }}>Large uploads process in chunks of 25 records to prevent quota limits</span>
        </div>
      </div>
    );
  }

  if (step === 'mode_select') {
    return (
      <div className="animate-fade-in" style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', paddingTop: '40px' }}>
        <h2 style={{ fontSize: '28px', marginBottom: '8px' }}>Select Upload Mode</h2>
        <p className="text-muted" style={{ marginBottom: '32px' }}>How would you like to handle the incoming data?</p>

        <div className="dashboard-grid" style={{ gridTemplateColumns: '1fr 1fr', gap: '24px', maxWidth: '700px', width: '100%' }}>
          <div 
            className={`glass-panel ${uploadMode === 'append' ? 'active-mode' : ''}`}
            style={{ padding: '24px', cursor: 'pointer', border: uploadMode === 'append' ? '2px solid var(--accent-primary)' : '2px solid transparent', transition: 'all 0.2s' }}
            onClick={() => setUploadMode('append')}
          >
            <div style={{ display: 'flex', alignItems: 'center', gap: '12px', marginBottom: '16px' }}>
              <div style={{ padding: '10px', borderRadius: '50%', background: 'rgba(34,45,104,0.1)', color: 'var(--accent-primary)' }}>
                <CheckCircle size={24} />
              </div>
              <h3 style={{ fontSize: '18px', margin: 0 }}>Append Data</h3>
            </div>
            <p className="text-muted" style={{ fontSize: '14px', lineHeight: '1.5' }}>
              Adds new records to the database. Identifies duplicates using <strong>Employee ID + Date + Type</strong> and automatically skips them to prevent double-counting.
            </p>
          </div>

          <div 
            className={`glass-panel ${uploadMode === 'replace' ? 'active-mode' : ''}`}
            style={{ padding: '24px', cursor: 'pointer', border: uploadMode === 'replace' ? '2px solid var(--danger)' : '2px solid transparent', transition: 'all 0.2s' }}
            onClick={() => {
              setUploadMode('replace');
              setConfirmReplace(false);
            }}
          >
            <div style={{ display: 'flex', alignItems: 'center', gap: '12px', marginBottom: '16px' }}>
              <div style={{ padding: '10px', borderRadius: '50%', background: 'rgba(239,68,68,0.1)', color: 'var(--danger)' }}>
                <AlertTriangle size={24} />
              </div>
              <h3 style={{ fontSize: '18px', margin: 0 }}>Replace All</h3>
            </div>
            <p className="text-muted" style={{ fontSize: '14px', lineHeight: '1.5' }}>
              <strong>Destructive action.</strong> Deletes ALL existing attendance and score records system-wide before uploading the new dataset. Use for full resets.
            </p>
          </div>
        </div>

        {uploadMode === 'replace' && (
          <div className="glass-panel mt-6" style={{ background: 'rgba(239,68,68,0.05)', borderColor: 'var(--danger)', padding: '16px 24px', maxWidth: '700px', width: '100%', display: 'flex', alignItems: 'center', gap: '16px' }}>
            <input 
              type="checkbox" 
              id="confirm-replace" 
              checked={confirmReplace} 
              onChange={e => setConfirmReplace(e.target.checked)}
              style={{ width: '20px', height: '20px', cursor: 'pointer' }}
            />
            <label htmlFor="confirm-replace" style={{ cursor: 'pointer', fontWeight: 600, color: 'var(--danger)' }}>
              I understand this will PERMANENTLY erase all existing attendance data.
            </label>
          </div>
        )}

        <div style={{ display: 'flex', gap: '16px', marginTop: '32px' }}>
          <button className="btn btn-secondary" onClick={reset} style={{ padding: '12px 24px' }}>Cancel</button>
          <button 
            className={`btn ${uploadMode === 'replace' ? 'btn-danger' : 'btn-primary'}`} 
            onClick={() => setStep('preview')} 
            disabled={uploadMode === 'replace' && !confirmReplace}
            style={{ padding: '12px 32px' }}
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
          <h2 style={{ fontSize: '24px' }}>Attendance Portal</h2>
          <p className="text-muted">Automated field training ingestion engine</p>
        </div>
      </div>

      <div className="flex-center mb-6 mt-4 gap-4" style={{ background: 'var(--bg-card)', padding: '16px', borderRadius: '14px', border: '1px solid var(--border-color)' }}>
        <label style={{ fontWeight: 600, color: 'var(--text-secondary)' }}>Target Training Type:</label>
        <select 
          className="form-select glass-panel" 
          style={{ width: '250px', cursor: 'pointer', fontWeight: 600, color: 'var(--accent-primary)' }}
          value={selectedUploadType}
          onChange={e => {
             setSelectedUploadType(e.target.value);
             setTrainingType(e.target.value);
          }}
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
        <div className="upload-icon">
          <UploadCloud size={32} />
        </div>
        <h3 style={{ fontSize: '18px', fontWeight: 600 }}>Drop Excel data here</h3>
        <p className="text-muted">or click to browse local files (.xlsx, .xls, .csv)</p>
        <input id="file-input" type="file" accept=".xlsx,.xls,.csv" style={{ display: 'none' }} onChange={handleFileInput} />
      </div>

      {/* ✅ DOWNLOAD TEMPLATE BUTTON */}
      <div style={{ display: 'flex', justifyContent: 'center', marginTop: '24px', gap: '12px' }}>
        <button 
          className="btn btn-secondary"
          onClick={handleDownloadTemplate}
          style={{ display: 'flex', alignItems: 'center', gap: '8px', padding: '10px 20px' }}
        >
          <Download size={18} />
          📥 Download {selectedUploadType} Template
        </button>
      </div>

      {/* DATA STANDARDS — Dynamic based on selected training type */}
      <div className="glass-panel mt-8" style={{ padding: '24px' }}>
        <h4 style={{ fontSize: '13px', fontWeight: 700, textTransform: 'uppercase', color: 'var(--text-secondary)', marginBottom: '16px', letterSpacing: '1px', display: 'flex', alignItems: 'center', gap: '8px' }}>
          <Info size={14} /> Data Standards · {selectedUploadType}
        </h4>

        {/* Required base fields */}
        <div style={{ marginBottom: '14px' }}>
          <div style={{ fontSize: '11px', textTransform: 'uppercase', color: 'var(--text-secondary)', marginBottom: '8px', fontWeight: 600 }}>Required Columns</div>
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: '6px' }}>
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

        {/* Optional columns */}
        <div style={{ marginBottom: '14px' }}>
          <div style={{ fontSize: '11px', textTransform: 'uppercase', color: 'var(--text-secondary)', marginBottom: '8px', fontWeight: 600 }}>Optional Columns</div>
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: '6px' }}>
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

        {/* Schema-driven score fields for this training type */}
        {(() => {
          const schema = getSchema(selectedUploadType);
          const scoreLabels = Object.values(schema.scoreLabels);
          if (scoreLabels.length === 0) return null;
          return (
            <div style={{ marginBottom: '14px' }}>
              <div style={{ fontSize: '11px', textTransform: 'uppercase', color: 'var(--text-secondary)', marginBottom: '8px', fontWeight: 600 }}>Score Fields (Legacy)</div>
              <div style={{ display: 'flex', flexWrap: 'wrap', gap: '6px' }}>
                {scoreLabels.map(label => (
                  <span key={label} className="badge" style={{ background: 'rgba(34,45,104,0.15)', color: 'var(--accent-primary)', border: '1px solid rgba(34,45,104,0.3)' }}>{label}</span>
                ))}
              </div>
            </div>
          );
        })()}

        <p className="text-muted" style={{ fontSize: '13px', marginTop: '12px', lineHeight: '1.6' }}>
          <strong>✅ Strict Template Validation:</strong> Your file MUST use exact column headers from the official template. 
          Download the template using the button above to ensure your columns match exactly. 
          Missing required columns will be rejected with clear error messages.
        </p>
      </div>
    </div>
  );
};


