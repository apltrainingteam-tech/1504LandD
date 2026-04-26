import React, { useState, useMemo } from 'react';
import { Users, UploadCloud, CheckCircle, X, Check, AlertTriangle, XCircle, Upload, Search, Database, Edit3 } from 'lucide-react';
import { useMasterData } from '../../core/context/MasterDataContext';
import { useErrorFilter } from '../../shared/hooks/useErrorFilter';
import { ErrorPanel } from '../../shared/components/ui/ErrorPanel';
import { createUpdateEdit } from '../../core/engines/editEngine';
import { getClosestMatch } from '../../core/utils/stringMatch';
import { useEmployeeUpload } from './hooks/useEmployeeUpload';
import { validateFileSize, MAX_UPLOAD_SIZE_BYTES } from '../../core/utils/fileValidation';
import { ParsedRow } from '../../core/engines/parsingEngine';
import { Employee } from '../../types/employee';
import { parseAnyDate } from '../../core/utils/dateParser';
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
  const { 
    finalData, 
    activeError, 
    setActiveError, 
    addEdit, 
    teams: masterTeams,
    refreshTransactional 
  } = useMasterData();

  const { uploading, uploadProgress, performUpload, parseFile } = useEmployeeUpload(() => {
    refreshTransactional();
    onUploadComplete?.();
  });
  const [step, setStep] = useState<'view' | 'upload' | 'preview' | 'done'>('view');
  const [dragOver, setDragOver] = useState(false);
  const [fileName, setFileName] = useState('');
  const [rows, setRows] = useState<ParsedRow[]>([]);

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
    const res = await parseFile(file);
    if (res.success && res.rows) {
      setRows(res.rows);
      setStep('preview');
    } else {
      alert('Parse failed: ' + res.error);
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
    const res = await performUpload(rows);
    if (res.success) {
      setStep('done');
    } else {
      alert('Database Replacement failed: ' + res.error);
    }
  };

  const reset = () => {
    setStep('view');
    setRows([]);
    setFileName('');
  };
  
  // Integration with Validation Trace
  const { 
    filteredData: errorFilteredData, 
    isFiltered: isValidationErrorFiltered, 
    highlights 
  } = useErrorFilter(activeError, filteredFromParent || [], 'employee');

  const displayEmployees = isValidationErrorFiltered ? errorFilteredData : (filteredFromParent || []);

  const handleCellEdit = (recordId: string, field: string, currentValue: any) => {
    const newValue = prompt(`Edit ${field}:`, currentValue);
    if (newValue !== null && newValue !== currentValue) {
      addEdit(createUpdateEdit('employee', recordId, { [field]: newValue }));
    }
  };

  const handleBulkFix = (field: string, oldValue: any) => {
    const masterValues = field === 'team' ? masterTeams.map(t => t.teamName) : [];
    const suggestion = getClosestMatch(String(oldValue), masterValues);
    
    if (suggestion && confirm(`Bulk fix '${oldValue}' to '${suggestion}' for all matching records?`)) {
      const affected = employees.filter(e => String((e as any)[field]) === String(oldValue));
      affected.forEach((emp: any) => {
        addEdit(createUpdateEdit('employee', emp.id || (emp as any)._id || emp.employeeId, { [field]: suggestion }));
      });
    }
  };

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
    const validCount = rows.filter((r: any) => r.status === 'valid').length;
    const warnCount = rows.filter((r: any) => r.status === 'warn').length;
    const errCount = rows.filter((r: any) => r.status === 'error').length;
    const uploadableCount = rows.filter((r: any) => r.status !== 'error').length;

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

      <div className="grid grid-cols-1 lg:grid-cols-4 gap-8 mb-8">
        <div className="lg:col-span-3">
          {/* Main Content Area */}
        </div>
        <div className="lg:col-span-1">
          <ErrorPanel />
        </div>
      </div>

      {/* Roster View */}
      <div className={`glass-panel ${styles.glassOverflowHidden}`}>
        <div className={styles.toolbar}>
          {/* Search */}
          <div className={styles.searchWrapper}>
            <Search size={16} className={styles.searchIcon} />
            <label htmlFor="employee-search" className="sr-only">Search name or ID</label>
            <input
              id="employee-search"
              name="search"
              type="text"
              className={`form-input ${styles.searchInput}`}
              placeholder="Search name or ID…"
              value={searchQuery}
              onChange={e => onSearchChange?.(e.target.value)}
            />
          </div>

          {/* Designation filter */}
          <label htmlFor="roster-filter-designation" className="sr-only">Filter Designation</label>
          <select
            id="roster-filter-designation"
            name="designation"
            className={`form-input ${styles.filterSelect} ${filterDesignation ? styles.filterSelectActive : styles.filterSelectInactive}`}
            value={filterDesignation}
            onChange={e => onFilterDesignationChange?.(e.target.value)}
            title="Filter Designation"
            aria-label="Filter Designation"
          >
            <option value="">All Designations</option>
            {designationOptions.map((d: any) => <option key={d} value={d}>{d}</option>)}
          </select>

          {/* Team filter */}
          <label htmlFor="roster-filter-team" className="sr-only">Filter Team</label>
          <select
            id="roster-filter-team"
            name="team"
            className={`form-input ${styles.filterSelect} ${filterTeam ? styles.filterSelectActive : styles.filterSelectInactive}`}
            value={filterTeam}
            onChange={e => onFilterTeamChange?.(e.target.value)}
            title="Filter Team"
            aria-label="Filter Team"
          >
            <option value="">All Teams</option>
            {teamOptions.map((t: any) => <option key={t} value={t}>{t}</option>)}
          </select>

          {/* Zone filter */}
          <label htmlFor="roster-filter-zone" className="sr-only">Filter Zone</label>
          <select
            id="roster-filter-zone"
            name="zone"
            className={`form-input ${styles.filterSelect} ${filterZone ? styles.filterSelectActive : styles.filterSelectInactive}`}
            value={filterZone}
            onChange={e => onFilterZoneChange?.(e.target.value)}
            title="Filter Zone"
            aria-label="Filter Zone"
          >
            <option value="">All Zones</option>
            {zoneOptions.map((z: any) => <option key={z} value={z}>{z}</option>)}
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
            {displayEmployees.length} / {employees.length}
          </div>
          {isValidationErrorFiltered && (
            <button className="btn btn-secondary btn-sm" onClick={() => setActiveError(null)}>
              Clear Validation Filter <X size={14} />
            </button>
          )}
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
              {displayEmployees.map((emp: any) => (
                <tr key={emp.employeeId} className={highlights.rowIds.has(emp.id || emp._id || emp.employeeId) ? styles.highlightedRow : ''}>
                  <td className={`${styles.tdEmpId} ${highlights.activeField === 'employeeId' ? styles.errorCell : ''}`} onClick={() => handleCellEdit(emp.id || emp._id || emp.employeeId, 'employeeId', emp.employeeId)}>{emp.employeeId}</td>
                  <td className={highlights.activeField === 'name' ? styles.errorCell : ''} onClick={() => handleCellEdit(emp.id || emp._id || emp.employeeId, 'name', emp.name)}>{emp.name}</td>
                  <td className={highlights.activeField === 'mobileNumber' ? styles.errorCell : ''} onClick={() => handleCellEdit(emp.id || emp._id || emp.employeeId, 'mobileNumber', emp.mobileNumber)}>{emp.mobileNumber}</td>
                  <td>
                    <span className={`badge badge-secondary ${highlights.activeField === 'designation' ? styles.errorCell : ''}`} onClick={() => handleCellEdit(emp.id || emp._id || emp.employeeId, 'designation', emp.designation)}>
                      {emp.designation}
                    </span>
                  </td>
                  <td className={`${highlights.activeField === 'team' ? styles.errorCell : ''} ${styles.editableCell}`} onClick={() => handleCellEdit(emp.id || emp._id || emp.employeeId, 'team', emp.team)}>
                    {emp.team}
                    {highlights.activeField === 'team' && <button className={styles.bulkFixBtn} onClick={(e) => { e.stopPropagation(); handleBulkFix('team', emp.team); }} title="Bulk Fix Similarity"><Edit3 size={10} /></button>}
                  </td>
                  <td className={highlights.activeField === 'hq' ? styles.errorCell : ''} onClick={() => handleCellEdit(emp.id || emp._id || emp.employeeId, 'hq', emp.hq)}>{emp.hq}</td>
                  <td className={highlights.activeField === 'state' ? styles.errorCell : ''} onClick={() => handleCellEdit(emp.id || emp._id || emp.employeeId, 'state', emp.state)}>{emp.state}</td>
                  <td className={highlights.activeField === 'doj' ? styles.errorCell : ''} onClick={() => handleCellEdit(emp.id || emp._id || emp.employeeId, 'doj', emp.doj)}>{emp.doj || '--'}</td>
                  <td>
                    <span className="badge badge-info" title={emp.doj || ''}>
                      {calcTenure(emp.doj)}
                    </span>
                  </td>
                </tr>
              ))}
              {displayEmployees.length === 0 && (
                <tr>
                  <td colSpan={9} className={`text-muted ${styles.emptyRow}`}>
                    {isValidationErrorFiltered ? 'No records match this specific validation error.' : 'No employees active or matching search.'}
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






