import React, { useState } from 'react';
import { UploadCloud, CheckCircle, X, Check, AlertTriangle, XCircle, Upload } from 'lucide-react';
import { parseExcelFile, ParsedRow } from '../services/parsingService';
import { uploadAttendanceBatch } from '../services/attendanceService';
import { UploadPreview } from '../components/UploadPreview';

import { Employee } from '../types/employee';

interface AttendanceUploadProps {
  onUploadComplete?: () => void;
  masterEmployees: Employee[];
}

const TRAINING_TYPES = ['IP', 'AP', 'MIP', 'Refresher', 'Capsule', 'Pre_AP', 'GTG', 'HO', 'RTM'];

export const AttendanceUpload: React.FC<AttendanceUploadProps> = ({ onUploadComplete, masterEmployees }) => {
  const [step, setStep] = useState<'upload' | 'preview' | 'done'>('upload');
  const [dragOver, setDragOver] = useState(false);
  const [fileName, setFileName] = useState('');
  const [selectedUploadType, setSelectedUploadType] = useState(TRAINING_TYPES[0]);
  const [trainingType, setTrainingType] = useState('IP');
  const [autoDetected, setAutoDetected] = useState(false);
  const [rows, setRows] = useState<ParsedRow[]>([]);
  const [uploading, setUploading] = useState(false);
  const [uploadProgress, setUploadProgress] = useState(0);
  const [result, setResult] = useState<{ attCount: number, scoreCount: number } | null>(null);

  const processFile = async (file: File) => {
    setFileName(file.name);
    try {
      const { rows: processed, trainingType: finalType } = await parseExcelFile(file, selectedUploadType, masterEmployees);
      setTrainingType(finalType);
      setAutoDetected(true);
      setRows(processed);
      setStep('preview');
    } catch (err: any) {
      alert('Parse failed: ' + err.message);
      console.error(err);
    }
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    setDragOver(false);
    if (e.dataTransfer.files[0]) processFile(e.dataTransfer.files[0]);
  };

  const handleFileInput = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files?.[0]) processFile(e.target.files[0]);
  };

  const doUpload = async () => {
    setUploading(true);
    setUploadProgress(0);
    try {
      const uploadable = rows.filter(r => r.status !== 'error');
      const total = uploadable.length;
      
      const res = await uploadAttendanceBatch(uploadable, trainingType, (count) => {
        setUploadProgress(Math.round((count / total) * 100));
      });
      
      setResult(res);
      setStep('done');
      onUploadComplete?.();
    } catch (err: any) {
      alert('Upload failed: ' + err.message);
      setUploading(false); // Stop progress naturally handled here on failure
    }
  };

  const reset = () => {
    setStep('upload');
    setRows([]);
    setFileName('');
    setResult(null);
    setAutoDetected(false);
  };

  if (step === 'done' && result) {
    return (
      <div className="animate-fade-in" style={{ textAlign: 'center', padding: '60px' }}>
        <div style={{ width: '80px', height: '80px', borderRadius: '50%', background: 'rgba(16,185,129,0.1)', display: 'flex', alignItems: 'center', justifyContent: 'center', margin: '0 auto 24px' }}>
          <CheckCircle size={48} color="var(--success)" />
        </div>
        <h2 style={{ fontSize: '32px', marginBottom: '16px' }}>Upload Successful</h2>
        <div className="glass-panel" style={{ maxWidth: '400px', margin: '0 auto 32px', padding: '24px' }}>
          <p className="text-muted" style={{ marginBottom: '12px' }}>{result.attCount} Attendance records synced</p>
          <p className="text-muted">{result.scoreCount} Score records synced</p>
        </div>
        <button className="btn btn-primary" onClick={reset}>
          <Upload size={18} /> Upload Another File
        </button>
      </div>
    );
  }

  if (step === 'preview') {
    const validCount = rows.filter(r => r.status === 'valid').length;
    const warnCount = rows.filter(r => r.status === 'warn').length;
    const errCount = rows.filter(r => r.status === 'error').length;
    const uploadableCount = rows.filter(r => r.status !== 'error').length;

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

        <div className="mb-8">
          <UploadPreview rows={rows} trainingType={trainingType} />
        </div>

        <div className="flex-center w-full max-w-md mx-auto flex-col gap-2">
          <button 
            className="btn btn-primary w-full" 
            onClick={doUpload} 
            disabled={uploading || uploadableCount === 0}
            style={{ padding: '14px 32px', position: 'relative', overflow: 'hidden' }}
          >
            {uploading ? (
               <>
                 <div style={{ position: 'absolute', left: 0, top: 0, bottom: 0, width: `${uploadProgress}%`, background: 'rgba(255,255,255,0.3)', transition: 'width 0.2s', zIndex: 0 }} />
                 <span style={{ position: 'relative', zIndex: 1, fontWeight: 700 }}>Uploading... {uploadProgress}%</span>
               </>
            ) : `Accept & Sync ${uploadableCount} Rows`}
          </button>
          
          <button className="btn btn-secondary w-full" onClick={reset} disabled={uploading}>Discard & Reject</button>
          {errCount > 0 && <span className="text-muted text-center mt-2" style={{ fontSize: '13px' }}>{errCount} rows with errors will be skipped</span>}
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

      <div className="glass-panel mt-8" style={{ padding: '24px' }}>
        <h4 style={{ fontSize: '13px', fontWeight: 700, textTransform: 'uppercase', color: 'var(--text-secondary)', marginBottom: '16px', letterSpacing: '1px' }}>
          Data Standards
        </h4>
        <div style={{ display: 'flex', flexWrap: 'wrap', gap: '8px' }}>
          {['Aadhaar Number', 'Employee ID', 'Mobile Number', 'Name', 'Trainer', 'Team', 'Designation', 'HQ', 'State', 'Attendance Date', 'Attendance Status', 'Scores', 'Percent', 'T Score'].map(tag => (
            <span key={tag} className="badge badge-info">{tag}</span>
          ))}
        </div>
        <p className="text-muted" style={{ fontSize: '13px', marginTop: '16px' }}>
          Our intelligence layer automatically maps headers, parses disparate date formats, and normalizes scoring data. 
          Rows with missing dates will be rejected, while missing identity markers will trigger warnings.
        </p>
      </div>
    </div>
  );
};
