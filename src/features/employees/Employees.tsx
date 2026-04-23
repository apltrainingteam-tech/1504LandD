import React, { useState, useMemo } from 'react';
import { Users, UploadCloud, CheckCircle, X, Check, AlertTriangle, XCircle, Upload, Search, Database } from 'lucide-react';
import { parseEmployeeMasterExcel, ParsedRow } from '../../services/parsingService';
import { validateFileSize, MAX_UPLOAD_SIZE_BYTES } from '../../utils/fileValidation';
import { clearCollection, addBatch } from '../../services/apiClient';
import { Employee } from '../../types/employee';
import { parseAnyDate } from '../../utils/dateParser';

/**
 * Calculates tenure from a DOJ string to today.
 * Returns e.g. "3yr 4m", "0yr 7m", or "--" if DOJ is missing/invalid.
 */
function calcTenure(doj: string | undefined | null): string {
  if (!doj) return '--';
  const parsed = parseAnyDate(doj);
  if (!parsed) return '--';
  const start = new Date(parsed);
  if (isNaN(start.getTime())) return '--';
  const today = new Date();
  let years = today.getFullYear() - start.getFullYear();
  let months = today.getMonth() - start.getMonth();
  if (today.getDate() < start.getDate()) months -= 1;
  if (months < 0) { years -= 1; months += 12; }
  if (years < 0) return '--';
  return `${years}yr ${months}m`;
}

interface EmployeesProps {
  employees?: Employee[];
  onUploadComplete?: () => void;
  // Lifted filter props (controlled by App so KPI syncs)
  filteredEmployees?: Employee[];
  searchQuery?: string;
  onSearchChange?: (v: string) => void;
  filterDesignation?: string;
  onFilterDesignationChange?: (v: string) => void;
  filterTeam?: string;
  onFilterTeamChange?: (v: string) => void;
  filterZone?: string;
  onFilterZoneChange?: (v: string) => void;
}

export const Employees: React.FC<EmployeesProps> = ({
  employees = [],
  onUploadComplete,
  filteredEmployees: filteredFromParent,
  searchQuery = '',
  onSearchChange,
  filterDesignation = '',
  onFilterDesignationChange,
  filterTeam = '',
  onFilterTeamChange,
  filterZone = '',
  onFilterZoneChange,
}) => {
  const [step, setStep] = useState<'view' | 'upload' | 'preview' | 'done'>('view');
  const [dragOver, setDragOver] = useState(false);
  const [fileName, setFileName] = useState('');
  const [rows, setRows] = useState<ParsedRow[]>([]);
  const [uploading, setUploading] = useState(false);
  const [uploadProgress, setUploadProgress] = useState(0);

  // Derive unique sorted options from the employee list
  const designationOptions = useMemo(() =>
    [...new Set(employees.map(e => e.designation).filter(Boolean))].sort(), [employees]);
  const teamOptions = useMemo(() =>
    [...new Set(employees.map(e => e.team).filter(Boolean))].sort(), [employees]);
  const zoneOptions = useMemo(() =>
    [...new Set(employees.map(e => e.zone).filter(Boolean))].sort(), [employees]);

  const hasActiveFilters = filterDesignation || filterTeam || filterZone || searchQuery;

  const resetFilters = () => {
    onSearchChange?.('');
    onFilterDesignationChange?.('');
    onFilterTeamChange?.('');
    onFilterZoneChange?.('');
  };

  const processFile = async (file: File) => {
    const valid = validateFileSize(file);
    if (!valid.ok) {
      alert(valid.reason || `Please use files smaller than ${MAX_UPLOAD_SIZE_BYTES / (1024 * 1024)} MB`);
      return;
    }
    setFileName(file.name);
    try {
      const { rows: processed } = await parseEmployeeMasterExcel(file);
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
      const uploadable = rows.filter(r => r.status !== 'error').map(r => r.data);
      const total = uploadable.length;
      
      // Step 1: Wipe the active index! Full replace.
      await clearCollection('employees');
      
      // Step 2: Batch upload progressively
      const chunkSize = 50; 
      for (let i = 0; i < total; i += chunkSize) {
         const chunk = uploadable.slice(i, i + chunkSize);
         await addBatch('employees', chunk);
         setUploadProgress(Math.round(((i + chunk.length) / total) * 100));
      }
      
      setStep('done');
      onUploadComplete?.();
    } catch (err: any) {
      alert('Database Replacement failed: ' + err.message);
    } finally {
      setUploading(false);
    }
  };

  const reset = () => {
    setStep('view');
    setRows([]);
    setFileName('');
  };
  
  // Use pre-filtered list from parent if provided, otherwise compute locally (fallback)
  const filteredEmployees = filteredFromParent ?? employees.filter(e => {
    const q = (searchQuery || '').toLowerCase();
    const matchesSearch = !q ||
      (e.name || '').toLowerCase().includes(q) ||
      (e.employeeId || '').toLowerCase().includes(q);
    const matchesDesignation = !filterDesignation || e.designation === filterDesignation;
    const matchesTeam = !filterTeam || e.team === filterTeam;
    const matchesZone = !filterZone || e.zone === filterZone;
    return matchesSearch && matchesDesignation && matchesTeam && matchesZone;
  });

  if (step === 'done') {
    return (
      <div className="animate-fade-in" style={{ textAlign: 'center', padding: '60px' }}>
        <div style={{ width: '80px', height: '80px', borderRadius: '50%', background: 'rgba(16,185,129,0.1)', display: 'flex', alignItems: 'center', justifyContent: 'center', margin: '0 auto 24px' }}>
          <Database size={48} color="var(--success)" />
        </div>
        <h2 style={{ fontSize: '32px', marginBottom: '16px' }}>Master Index Replaced</h2>
        <div className="glass-panel" style={{ maxWidth: '400px', margin: '0 auto 32px', padding: '24px' }}>
          <p className="text-muted" style={{ marginBottom: '12px' }}>The active employee roster has been completely overwritten with your new dataset.</p>
          <p className="text-muted" style={{ fontSize: '18px', fontWeight: 600, color: 'var(--success)' }}>{employees.length} Active Personnel Synced</p>
        </div>
        <button className="btn btn-primary" onClick={reset}>
          Return to Master View
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
            <h2 style={{ fontSize: '24px' }}>Review Index: {fileName}</h2>
            <p className="text-muted">
              You are about to completely <strong style={{ color: 'var(--danger)' }}>wipe the current Master database</strong> and replace it with {uploadableCount} rows.
            </p>
          </div>
          <button className="btn btn-secondary" onClick={reset}>Cancel</button>
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

        <div className="flex-center w-full max-w-md mx-auto flex-col gap-2 mt-8">
          <button 
            className="btn btn-primary w-full" 
            onClick={doUpload} 
            disabled={uploading || uploadableCount === 0 || errCount > 0}
            style={{ padding: '14px 32px', position: 'relative', overflow: 'hidden', background: errCount > 0 ? 'var(--text-muted)' : 'var(--danger)' }}
          >
            {uploading ? (
               <>
                 <div style={{ position: 'absolute', left: 0, top: 0, bottom: 0, width: `${uploadProgress}%`, background: 'rgba(255,255,255,0.3)', transition: 'width 0.2s', zIndex: 0 }} />
                 <span style={{ position: 'relative', zIndex: 1, fontWeight: 700 }}>Destructive Replace... {uploadProgress}%</span>
               </>
            ) : errCount > 0 ? "Resolve Errors Before Syncing" : `ACCEPT FULL REPLACE (${uploadableCount} Rows)`}
          </button>
          <button className="btn btn-secondary w-full" onClick={reset} disabled={uploading}>Discard & Cancel</button>
        </div>
      </div>
    );
  }

  return (
    <div className="animate-fade-in">
      <div className="flex-between mb-8">
        <div>
          <h2 style={{ fontSize: '24px' }}>Employee Master Index</h2>
          <p className="text-muted">Single Source of Truth for identity, team assignments, and demographic intelligence</p>
        </div>
        <button className="btn btn-primary" onClick={() => setStep('upload')}>
          <UploadCloud size={18} /> Replace Master Database
        </button>
      </div>

      {step === 'upload' && (
        <div 
          className={`upload-zone mb-8 ${dragOver ? 'over' : ''}`}
          onDragOver={e => { e.preventDefault(); setDragOver(true); }}
          onDragLeave={() => setDragOver(false)}
          onDrop={handleDrop}
          onClick={() => document.getElementById('master-file-input')?.click()}
        >
          <div className="upload-icon"><UploadCloud size={32} /></div>
          <h3 style={{ fontSize: '18px', fontWeight: 600 }}>Drop Master Excel data here</h3>
          <p className="text-muted">or click to browse local files (.xlsx)</p>
          <input id="master-file-input" type="file" accept=".xlsx" style={{ display: 'none' }} onChange={handleFileInput} />
        </div>
      )}

      {/* Roster View */}
      <div className="glass-panel" style={{ overflow: 'hidden' }}>
        <div style={{ padding: '16px 20px', borderBottom: '1px solid var(--border-color)', display: 'flex', flexWrap: 'wrap', gap: '12px', alignItems: 'center' }}>
          {/* Search */}
          <div style={{ flex: '1 1 220px', position: 'relative', minWidth: '180px' }}>
            <Search size={16} style={{ position: 'absolute', left: '14px', top: '50%', transform: 'translateY(-50%)', color: 'var(--text-secondary)' }} />
            <input
              type="text"
              className="form-input"
              placeholder="Search name or ID…"
              value={searchQuery}
              onChange={e => onSearchChange?.(e.target.value)}
              style={{ width: '100%', paddingLeft: '40px', border: 'none', background: 'rgba(255,255,255,0.03)' }}
            />
          </div>

          {/* Designation filter */}
          <select
            className="form-input"
            value={filterDesignation}
            onChange={e => onFilterDesignationChange?.(e.target.value)}
            style={{ flex: '0 1 180px', border: 'none', background: 'rgba(255,255,255,0.03)', color: filterDesignation ? 'var(--text-primary)' : 'var(--text-secondary)' }}
          >
            <option value="">All Designations</option>
            {designationOptions.map(d => <option key={d} value={d}>{d}</option>)}
          </select>

          {/* Team filter */}
          <select
            className="form-input"
            value={filterTeam}
            onChange={e => onFilterTeamChange?.(e.target.value)}
            style={{ flex: '0 1 160px', border: 'none', background: 'rgba(255,255,255,0.03)', color: filterTeam ? 'var(--text-primary)' : 'var(--text-secondary)' }}
          >
            <option value="">All Teams</option>
            {teamOptions.map(t => <option key={t} value={t}>{t}</option>)}
          </select>

          {/* Zone filter */}
          <select
            className="form-input"
            value={filterZone}
            onChange={e => onFilterZoneChange?.(e.target.value)}
            style={{ flex: '0 1 140px', border: 'none', background: 'rgba(255,255,255,0.03)', color: filterZone ? 'var(--text-primary)' : 'var(--text-secondary)' }}
          >
            <option value="">All Zones</option>
            {zoneOptions.map(z => <option key={z} value={z}>{z}</option>)}
          </select>

          {/* Clear filters */}
          {hasActiveFilters && (
            <button
              className="btn btn-secondary"
              onClick={resetFilters}
              style={{ padding: '8px 14px', fontSize: '13px', display: 'flex', alignItems: 'center', gap: '6px', whiteSpace: 'nowrap' }}
            >
              <X size={14} /> Clear
            </button>
          )}

          <div className="badge badge-info" style={{ fontWeight: 700, whiteSpace: 'nowrap', marginLeft: 'auto' }}>
            {filteredEmployees.length} / {employees.length}
          </div>
        </div>
        <div style={{ overflowX: 'auto', maxHeight: '500px' }}>
          <table className="data-table">
            <thead>
              <tr>
                <th>ID</th>
                <th>Name</th>
                <th>Mobile</th>
                <th>Designation</th>
                <th>Team</th>
                <th>HQ</th>
                <th>State</th>
                <th>DOJ</th>
                <th>Tenure</th>
              </tr>
            </thead>
            <tbody>
              {filteredEmployees.map(emp => (
                <tr key={emp.employeeId}>
                  <td style={{ fontWeight: 600 }}>{emp.employeeId}</td>
                  <td>{emp.name}</td>
                  <td>{emp.mobileNumber}</td>
                  <td><span className="badge badge-secondary">{emp.designation}</span></td>
                  <td>{emp.team}</td>
                  <td>{emp.hq}</td>
                  <td>{emp.state}</td>
                  <td>{emp.doj || '--'}</td>
                  <td>
                    <span className="badge badge-info" title={emp.doj || ''}>
                      {calcTenure(emp.doj)}
                    </span>
                  </td>
                </tr>
              ))}
              {filteredEmployees.length === 0 && (
                <tr>
                  <td colSpan={9} style={{ textAlign: 'center', padding: '40px' }} className="text-muted">
                    No employees active or matching search.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
};


