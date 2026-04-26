import React, { useState } from 'react';
import { Database, ListChecks, ClipboardList, Users, AlertTriangle, Edit3, X } from 'lucide-react';
import { useMasterData } from '../../core/context/MasterDataContext';
import { useErrorFilter } from '../../shared/hooks/useErrorFilter';
import { ErrorPanel } from '../../shared/components/ui/ErrorPanel';
import { createUpdateEdit } from '../../core/engines/editEngine';
import { getClosestMatch } from '../../core/utils/stringMatch';
import styles from './DataQualityCenter.module.css';

type Module = 'trainingData' | 'nomination' | 'employee';

export const DataQualityCenter: React.FC = () => {
  const { 
    finalData, 
    activeError, 
    setActiveError, 
    addEdit, 
    validationErrors,
    teams: masterTeams 
  } = useMasterData();

  const [activeModule, setActiveModule] = useState<Module>('trainingData');

  const moduleData = {
    trainingData: finalData.trainingData,
    nomination: finalData.nominationData,
    employee: finalData.employeeData
  }[activeModule];

  const { 
    filteredData: errorFilteredData, 
    isFiltered: isValidationErrorFiltered, 
    highlights 
  } = useErrorFilter(activeError, moduleData, activeModule);

  const handleCellEdit = (recordId: string, field: string, currentValue: any) => {
    const newValue = prompt(`Edit ${field}:`, currentValue);
    if (newValue !== null && newValue !== currentValue) {
      addEdit(createUpdateEdit(activeModule, recordId, { [field]: newValue }));
    }
  };

  const handleBulkFix = (field: string, oldValue: any) => {
    const masterValues = field === 'team' ? masterTeams.map(t => t.teamName) : [];
    const suggestion = getClosestMatch(String(oldValue), masterValues);
    
    if (suggestion && confirm(`Bulk fix '${oldValue}' to '${suggestion}' for all matching records in ${activeModule}?`)) {
      const affected = moduleData.filter(row => String(row[field]) === String(oldValue));
      affected.forEach(row => {
        addEdit(createUpdateEdit(activeModule, row.id || row._id || row.employeeId, { [field]: suggestion }));
      });
    }
  };

  const modules: { id: Module; label: string; icon: React.ElementType }[] = [
    { id: 'trainingData', label: 'Training Data', icon: ListChecks },
    { id: 'nomination', label: 'Nominations', icon: ClipboardList },
    { id: 'employee', label: 'Employee Master', icon: Users },
  ];

  const headers = {
    trainingData: ['Employee ID', 'Name', 'Type', 'Team', 'Date', 'Status', 'Issues'],
    nomination: ['Employee ID', 'Name', 'Type', 'Team', 'Month', 'Issues'],
    employee: ['Employee ID', 'Name', 'Designation', 'Team', 'HQ', 'Issues']
  }[activeModule];

  return (
    <div className={`animate-fade-in ${styles.page}`}>
      <div className={styles.header}>
        <div>
          <h1 className={styles.title}>Data Quality & Correction</h1>
          <p className={styles.subtitle}>Trace validation errors to source records and apply corrective layers.</p>
        </div>
        <div className={styles.moduleTabs}>
          {modules.map(m => (
            <button 
              key={m.id}
              className={`${styles.tab} ${activeModule === m.id ? styles.activeTab : ''}`}
              onClick={() => { setActiveModule(m.id); setActiveError(null); }}
            >
              <m.icon size={16} />
              {m.label}
              {validationErrors.filter(e => e.module === m.id).length > 0 && (
                <span className={styles.errorBadge}>{validationErrors.filter(e => e.module === m.id).length}</span>
              )}
            </button>
          ))}
        </div>
      </div>

      <div className={styles.mainLayout}>
        <div className={styles.tableArea}>
          <div className={`glass-panel ${styles.tablePanel}`}>
            <div className={styles.tableToolbar}>
              <div className="flex-center gap-4">
                <Database size={18} className="text-muted" />
                <span className="font-bold">{activeModule.toUpperCase()} DATASET</span>
              </div>
              <div className="flex-center gap-4">
                <span className="text-sm text-muted">{errorFilteredData.length} records showing</span>
                {isValidationErrorFiltered && (
                  <button className="btn btn-secondary btn-sm" onClick={() => setActiveError(null)}>
                    Clear Filter <X size={14} />
                  </button>
                )}
              </div>
            </div>

            <div className={styles.tableContainer}>
              <table className="data-table">
                <thead>
                  <tr>
                    {headers.map(h => <th key={h}>{h}</th>)}
                  </tr>
                </thead>
                <tbody>
                  {errorFilteredData.map((row, idx) => {
                    const recordId = row.id || row._id || row.employeeId;
                    const rowErrors = validationErrors.filter(e => e.recordId === recordId && e.module === activeModule);
                    
                    return (
                      <tr key={recordId || idx} className={highlights.rowIds.has(recordId) ? styles.highlightedRow : ''}>
                        {activeModule === 'trainingData' && (
                          <>
                            <td className={highlights.activeField === 'employeeId' ? styles.errorCell : ''} onClick={() => handleCellEdit(recordId, 'employeeId', row.employeeId)}>{row.employeeId}</td>
                            <td>{row.name || '—'}</td>
                            <td>{row.trainingType}</td>
                            <td className={`${highlights.activeField === 'team' ? styles.errorCell : ''} ${styles.editableCell}`} onClick={() => handleCellEdit(recordId, 'team', row.team)}>
                              {row.team}
                              {highlights.activeField === 'team' && <button className={styles.bulkFixBtn} onClick={(e) => { e.stopPropagation(); handleBulkFix('team', row.team); }}><Edit3 size={10} /></button>}
                            </td>
                            <td>{row.attendanceDate}</td>
                            <td>{row.attendanceStatus}</td>
                          </>
                        )}
                        {activeModule === 'nomination' && (
                          <>
                            <td className={highlights.activeField === 'employeeId' ? styles.errorCell : ''} onClick={() => handleCellEdit(recordId, 'employeeId', row.employeeId)}>{row.employeeId}</td>
                            <td>{row.name}</td>
                            <td>{row.trainingType}</td>
                            <td className={highlights.activeField === 'team' ? styles.errorCell : ''} onClick={() => handleCellEdit(recordId, 'team', row.team)}>{row.team}</td>
                            <td>{row.month}</td>
                          </>
                        )}
                        {activeModule === 'employee' && (
                          <>
                            <td className={highlights.activeField === 'employeeId' ? styles.errorCell : ''} onClick={() => handleCellEdit(recordId, 'employeeId', row.employeeId)}>{row.employeeId}</td>
                            <td>{row.name}</td>
                            <td>{row.designation}</td>
                            <td className={highlights.activeField === 'team' ? styles.errorCell : ''} onClick={() => handleCellEdit(recordId, 'team', row.team)}>{row.team}</td>
                            <td>{row.hq}</td>
                          </>
                        )}
                        <td className={styles.issuesTd}>
                          {rowErrors.length > 0 ? (
                            <div className={styles.issueTags}>
                              {rowErrors.map(e => (
                                <span key={e.id} className={styles.issueTag} title={e.message}>
                                  <AlertTriangle size={10} /> {e.field}
                                </span>
                              ))}
                            </div>
                          ) : (
                            <span className="text-success text-xs">✓ Valid</span>
                          )}
                        </td>
                      </tr>
                    );
                  })}
                  {errorFilteredData.length === 0 && (
                    <tr>
                      <td colSpan={headers.length} className="td-center py-40 text-muted italic">
                        No records match the current validation filter.
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
          </div>
        </div>

        <div className={styles.sidePanel}>
          <ErrorPanel />
          
          <div className={`glass-panel p-16 mt-16 ${styles.editInfo}`}>
            <h4 className="text-xs font-bold uppercase text-muted mb-8">Edit Traceability</h4>
            <p className="text-xs text-muted mb-12">All corrections are stored as a virtual overlay. The original upload remains immutable.</p>
            <div className="flex justify-between items-center">
              <span className="text-xs font-bold">Active Corrections</span>
              <span className="badge badge-info">0</span>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};
