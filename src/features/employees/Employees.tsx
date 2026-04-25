import React, { useState, useMemo } from 'react';
import { Users, UploadCloud, CheckCircle, X, Check, AlertTriangle, XCircle, Upload, Search, Database } from 'lucide-react';
import { parseEmployeeMasterExcel, ParsedRow } from '../../services/parsingService';
import { validateFileSize, MAX_UPLOAD_SIZE_BYTES } from '../../utils/fileValidation';
import { clearCollection, addBatch } from '../../services/apiClient';
import { Employee } from '../../types/employee';
import { parseAnyDate } from '../../utils/dateParser';
import styles from './Employees.module.css';

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
      <div className={`animate-fade-in ${styles.successStep}`}>
        <div className={styles.successIconCircle}>
          <Database size={48} color="var(--success)" />
        </div>
        <h2 className={styles.successTitleLarge}>Master Index Replaced</h2>
        <div className={`glass-panel ${styles.successPanel}`}>
          <p className={`text-muted ${styles.successTextMuted}`}>The active employee roster has been completely overwritten with your new dataset.</p>
          <p className={styles.successCount}>{employees.length} Active Personnel Synced</p>
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
            <h2 className={styles.title}>Review Index: {fileName}</h2>
            <p className="text-muted">
              You are about to completely <strong className={styles.dangerText}>wipe the current Master database</strong> and replace it with {uploadableCount} rows.
            </p>
          </div>
          <button className="btn btn-secondary" onClick={reset}>Cancel</button>
        </div>

        <div className={styles.previewStats}>
          <div className={`glass-panel ${styles.statBox} ${styles.statBoxSuccess}`}>
            <div className={`${styles.statIcon} ${styles.statIconSuccess}`}><Check size={18} /></div>
            <div>
              <div className={styles.statLabel}>Valid Rows</div>
              <div className={styles.statValue}>{validCount}</div>
            </div>
          </div>
          <div className={`glass-panel ${styles.statBox} ${styles.statBoxWarning}`}>
            <div className={`${styles.statIcon} ${styles.statIconWarning}`}><AlertTriangle size={18} /></div>
            <div>
              <div className={styles.statLabel}>Warnings</div>
              <div className={styles.statValue}>{warnCount}</div>
            </div>
          </div>
          <div className={`glass-panel ${styles.statBox} ${styles.statBoxDanger}`}>
            <div className={`${styles.statIcon} ${styles.statIconDanger}`}><XCircle size={18} /></div>
            <div>
              <div className={styles.statLabel}>Errors</div>
              <div className={styles.statValue}>{errCount}</div>
            </div>
          </div>
        </div>

        <div className={styles.uploadActionArea}>
          <button 
            className={`btn btn-primary ${styles.destructiveBtn} ${errCount > 0 ? styles.destructiveBtnMuted : styles.destructiveBtnNormal}`} 
            onClick={doUpload} 
            disabled={uploading || uploadableCount === 0 || errCount > 0}
          >
            {uploading ? (
                <>
                  <div 
                    ref={(el) => { if (el) el.style.width = `${uploadProgress}%`; }}
                    className={styles.progressOverlay} 
                  />
                 <span className={styles.btnText}>Destructive Replace... {uploadProgress}%</span>
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
          <h2 className={styles.title}>Employee Master Index</h2>
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
          <h3 className={styles.dropZoneTitle}>Drop Master Excel data here</h3>
          <p className="text-muted">or click to browse local files (.xlsx)</p>
          <input id="master-file-input" type="file" accept=".xlsx" className={styles.hiddenInput} onChange={handleFileInput} title="Upload Master Excel" aria-label="Upload Master Excel" />
        </div>
      )}

      {/* Roster View */}
      <div className={`glass-panel ${styles.glassOverflowHidden}`}>
        <div className={styles.toolbar}>
          {/* Search */}
          <div className={styles.searchWrapper}>
            <Search size={16} className={styles.searchIcon} />
            <input
              type="text"
              className={`form-input ${styles.searchInput}`}
              placeholder="Search name or ID…"
              value={searchQuery}
              onChange={e => onSearchChange?.(e.target.value)}
            />
          </div>

          {/* Designation filter */}
          <select
            className={`form-input ${styles.filterSelect} ${filterDesignation ? styles.filterSelectActive : styles.filterSelectInactive}`}
            value={filterDesignation}
            onChange={e => onFilterDesignationChange?.(e.target.value)}
            title="Filter Designation"
            aria-label="Filter Designation"
          >
            <option value="">All Designations</option>
            {designationOptions.map(d => <option key={d} value={d}>{d}</option>)}
          </select>

          {/* Team filter */}
          <select
            className={`form-input ${styles.filterSelect} ${filterTeam ? styles.filterSelectActive : styles.filterSelectInactive}`}
            value={filterTeam}
            onChange={e => onFilterTeamChange?.(e.target.value)}
            title="Filter Team"
            aria-label="Filter Team"
          >
            <option value="">All Teams</option>
            {teamOptions.map(t => <option key={t} value={t}>{t}</option>)}
          </select>

          {/* Zone filter */}
          <select
            className={`form-input ${styles.filterSelect} ${filterZone ? styles.filterSelectActive : styles.filterSelectInactive}`}
            value={filterZone}
            onChange={e => onFilterZoneChange?.(e.target.value)}
            title="Filter Zone"
            aria-label="Filter Zone"
          >
            <option value="">All Zones</option>
            {zoneOptions.map(z => <option key={z} value={z}>{z}</option>)}
          </select>

          {/* Clear filters */}
          {hasActiveFilters && (
            <button
              className={`btn btn-secondary ${styles.clearFiltersBtn}`}
              onClick={resetFilters}
            >
              <X size={14} /> Clear
            </button>
          )}

          <div className={`badge badge-info ${styles.badgeInfo}`}>
            {filteredEmployees.length} / {employees.length}
          </div>
        </div>
        <div className={styles.tableContainer}>
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
                  <td className={styles.tdEmpId}>{emp.employeeId}</td>
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
                  <td colSpan={9} className={`text-muted ${styles.emptyRow}`}>
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


