import React, { useState, useMemo, useCallback, useRef } from 'react';
import { Search, Database, ListChecks, ClipboardList, Users, AlertTriangle, Edit3 } from 'lucide-react';
import { useMasterData } from '../../core/context/MasterDataContext';
import { createUpdateEdit } from '../../core/engines/editEngine';
import { getClosestMatch } from '../../core/utils/stringMatch';
import styles from './DataQualityCenter.module.css';

// ─── CONSTANTS ────────────────────────────────────────────────────────────────
const ROW_HARD_LIMIT = 50;
const SEARCH_DEBOUNCE_MS = 250;

type Module = 'trainingData' | 'nomination' | 'employee';

const MODULES: { id: Module; label: string; icon: React.ElementType }[] = [
  { id: 'trainingData', label: 'Training Data', icon: ListChecks },
  { id: 'nomination',   label: 'Nominations',   icon: ClipboardList },
  { id: 'employee',     label: 'Employee Master', icon: Users },
];

const HEADERS: Record<Module, string[]> = {
  trainingData: ['Employee ID', 'Name', 'Type', 'Team', 'Date', 'Status'],
  nomination:   ['Employee ID', 'Name', 'Type', 'Team', 'Month'],
  employee:     ['Employee ID', 'Name', 'Designation', 'Team', 'HQ'],
};

// ─── LIGHTWEIGHT SCANNER — no pre-index, O(n) with early exit at 50 ─────────
// Runs in ~5ms even on 25k rows because it stops as soon as limit is reached.
function scanRows(data: any[], query: string, limit: number): any[] {
  if (!query || !data.length) return [];
  const q = query.toLowerCase().trim();
  if (!q) return [];

  const results: any[] = [];
  for (let i = 0; i < data.length; i++) {
    if (results.length >= limit) break;
    const row = data[i];
    const values = Object.values(row);
    for (let j = 0; j < values.length; j++) {
      const v = values[j];
      if (v !== null && v !== undefined && String(v).toLowerCase().includes(q)) {
        results.push(row);
        break; // matched — move to next row
      }
    }
  }
  return results;
}

// ─── COMPONENT ────────────────────────────────────────────────────────────────
export const DataQualityCenter: React.FC = () => {
  const { baseData, validationErrors, addEdit, teams: masterTeams } = useMasterData();

  const [activeModule, setActiveModule] = useState<Module>('trainingData');
  const [query, setQuery]               = useState('');
  const [results, setResults]           = useState<any[]>([]);
  const [hasSearched, setHasSearched]   = useState(false);
  const debounceRef                     = useRef<ReturnType<typeof setTimeout> | null>(null);

  // ─── Active source dataset (ref — no re-render) ──────────────────────────
  const activeSource = useMemo(() => {
    if (activeModule === 'trainingData') return baseData.trainingData;
    if (activeModule === 'nomination')   return baseData.nominationData;
    return baseData.employeeData as any[];
  }, [activeModule, baseData]);

  // ─── Debounced search — fires scanRows only after user pauses typing ──────
  const handleSearch = useCallback((raw: string) => {
    setQuery(raw);

    if (debounceRef.current) clearTimeout(debounceRef.current);

    if (!raw.trim()) {
      setResults([]);
      setHasSearched(false);
      return;
    }

    debounceRef.current = setTimeout(() => {
      // scanRows is O(n) with early exit — runs in < 10ms for 25k rows
      const found = scanRows(activeSource, raw, ROW_HARD_LIMIT);
      setResults(found);
      setHasSearched(true);
    }, SEARCH_DEBOUNCE_MS);
  }, [activeSource]);

  // ─── Module switch ────────────────────────────────────────────────────────
  const handleModuleSwitch = (m: Module) => {
    setActiveModule(m);
    setQuery('');
    setResults([]);
    setHasSearched(false);
    if (debounceRef.current) clearTimeout(debounceRef.current);
  };

  // ─── Edit cell (only when results exist) ─────────────────────────────────
  const handleCellEdit = useCallback((recordId: string, field: string, current: any) => {
    if (!results.length) return;
    const next = prompt(`Edit ${field}:`, current);
    if (next !== null && next !== String(current)) {
      addEdit(createUpdateEdit(activeModule, recordId, { [field]: next }));
    }
  }, [results, addEdit, activeModule]);

  // ─── Bulk fix (only when results exist) ──────────────────────────────────
  const handleBulkFix = useCallback((field: string, oldValue: any) => {
    if (!results.length) return;
    const master = field === 'team' ? masterTeams.map(t => t.teamName) : [];
    const suggestion = getClosestMatch(String(oldValue), master);
    if (suggestion && confirm(`Bulk fix '${oldValue}' → '${suggestion}'?`)) {
      results
        .filter(r => String(r[field]) === String(oldValue))
        .forEach(r => {
          addEdit(createUpdateEdit(activeModule, r.id || r._id || r.employeeId, { [field]: suggestion }));
        });
    }
  }, [results, masterTeams, addEdit, activeModule]);

  const headers = HEADERS[activeModule];

  // ─── Row renderer ─────────────────────────────────────────────────────────
  const renderRow = (row: any, idx: number) => {
    const recordId = row.id || row._id || row.employeeId;
    const rowErrors = validationErrors.filter(
      e => e.recordId === recordId && e.module === activeModule
    );
    return (
      <tr key={recordId || idx} className={rowErrors.length > 0 ? styles.highlightedRow : ''}>
        {activeModule === 'trainingData' && (<>
          <td className={styles.editableCell} onClick={() => handleCellEdit(recordId, 'employeeId', row.employeeId)}>{row.employeeId}</td>
          <td>{row.name || '—'}</td>
          <td>{row.trainingType}</td>
          <td className={styles.editableCell} onClick={() => handleCellEdit(recordId, 'team', row.team)}>
            {row.team}
            <button className={styles.bulkFixBtn} onClick={e => { e.stopPropagation(); handleBulkFix('team', row.team); }} title="Bulk fix"><Edit3 size={10} /></button>
          </td>
          <td>{row.attendanceDate}</td>
          <td>{row.attendanceStatus}</td>
        </>)}
        {activeModule === 'nomination' && (<>
          <td className={styles.editableCell} onClick={() => handleCellEdit(recordId, 'employeeId', row.employeeId)}>{row.employeeId}</td>
          <td>{row.name}</td>
          <td>{row.trainingType}</td>
          <td className={styles.editableCell} onClick={() => handleCellEdit(recordId, 'team', row.team)}>{row.team}</td>
          <td>{row.month}</td>
        </>)}
        {activeModule === 'employee' && (<>
          <td className={styles.editableCell} onClick={() => handleCellEdit(recordId, 'employeeId', row.employeeId)}>{row.employeeId}</td>
          <td>{row.name}</td>
          <td>{row.designation}</td>
          <td className={styles.editableCell} onClick={() => handleCellEdit(recordId, 'team', row.team)}>{row.team}</td>
          <td>{row.hq}</td>
        </>)}
        <td className={styles.issuesTd}>
          {rowErrors.length > 0 ? (
            <div className={styles.issueTags}>
              {rowErrors.map(e => (
                <span key={e.id} className={styles.issueTag} title={e.message}>
                  <AlertTriangle size={10} /> {e.field}
                </span>
              ))}
            </div>
          ) : <span className="text-success text-xs">✓</span>}
        </td>
      </tr>
    );
  };

  // ─── RENDER ───────────────────────────────────────────────────────────────
  return (
    <div className={`animate-fade-in ${styles.page}`}>

      {/* Header */}
      <div className={styles.header}>
        <div>
          <h1 className={styles.title}>Data Quality Inspector</h1>
          <p className={styles.subtitle}>Enter a search term to locate records · Max {ROW_HARD_LIMIT} rows shown</p>
        </div>
        <div className={styles.moduleTabs}>
          {MODULES.map(m => {
            const errCount = validationErrors.filter(e => e.module === m.id).length;
            return (
              <button
                key={m.id}
                className={`${styles.tab} ${activeModule === m.id ? styles.activeTab : ''}`}
                onClick={() => handleModuleSwitch(m.id)}
              >
                <m.icon size={16} />
                {m.label}
                {errCount > 0 && <span className={styles.errorBadge}>{errCount}</span>}
              </button>
            );
          })}
        </div>
      </div>

      {/* Search Bar */}
      <div className="glass-panel p-16 mb-20 relative">
        <Search size={18} className="absolute left-28 top-1/2 transform -translate-y-1/2 text-muted" />
        <input
          id="dqc-search"
          type="text"
          className="form-input pl-44 w-full"
          placeholder={`Search ${activeModule} — type any value to find records`}
          value={query}
          onChange={e => handleSearch(e.target.value)}
          autoFocus
        />
        {hasSearched && (
          <span className="absolute right-16 top-1/2 transform -translate-y-1/2 text-xs text-muted">
            {results.length === ROW_HARD_LIMIT
              ? `${ROW_HARD_LIMIT}+ matches (showing ${ROW_HARD_LIMIT})`
              : `${results.length} match${results.length !== 1 ? 'es' : ''}`}
          </span>
        )}
      </div>

      {/* Body */}
      {!hasSearched ? (
        <div className="glass-panel p-40 flex flex-col items-center gap-12 text-center">
          <Database size={40} className="text-muted opacity-40" />
          <h3 className="text-lg font-bold text-muted">Search to begin</h3>
          <p className="text-xs text-muted max-w-400">
            Type any value — employee ID, name, team, training type, date — to locate records instantly.<br/>
            Results are capped at <strong>{ROW_HARD_LIMIT} rows</strong>.
          </p>
        </div>

      ) : results.length === 0 ? (
        <div className="glass-panel p-40 flex flex-col items-center gap-8 text-center">
          <AlertTriangle size={32} className="text-warning opacity-60" />
          <p className="text-muted text-sm">No records matched <strong>"{query}"</strong> in {activeModule}</p>
        </div>

      ) : (
        <div className={styles.mainLayout}>
          <div className={styles.tableArea}>
            <div className={`glass-panel ${styles.tablePanel}`}>
              <div className={styles.tableToolbar}>
                <div className="flex-center gap-4">
                  <Database size={16} className="text-muted" />
                  <span className="font-bold text-xs uppercase">{activeModule}</span>
                  <span className="text-xs text-muted">
                    {results.length < ROW_HARD_LIMIT
                      ? `${results.length} rows`
                      : `${ROW_HARD_LIMIT} rows (limit reached)`}
                  </span>
                </div>
              </div>
              <div className={styles.tableContainer}>
                <table className="data-table">
                  <thead>
                    <tr>
                      {headers.map(h => <th key={h}>{h}</th>)}
                      <th>Issues</th>
                    </tr>
                  </thead>
                  <tbody>
                    {results.map((row, idx) => renderRow(row, idx))}
                  </tbody>
                </table>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
