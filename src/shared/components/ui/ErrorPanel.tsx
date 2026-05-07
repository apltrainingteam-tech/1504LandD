import React from 'react';
import { AlertCircle, ChevronRight, X, Check, Zap } from 'lucide-react';
import { useMasterData } from '../../../core/context/MasterDataContext';
import styles from './ErrorPanel.module.css';

export const ErrorPanel: React.FC = () => {
  const { errorIndex, setActiveError, activeError, patchRecord } = useMasterData();

  const handleBulkFix = (field: string, oldValue: any, newValue: any) => {
    const affected = errorIndex.byValue[String(oldValue || 'NULL')] || [];
    affected.filter(e => e.field === field).forEach(e => {
      patchRecord(e.module, e.recordId, field, newValue);
    });
    setActiveError(null);
  };

  if (Object.keys(errorIndex.byType).length === 0) {
    return (
      <div className={`${styles.errorPanel} flex-center py-40 opacity-40 italic`}>
        <div className="flex flex-col items-center gap-2">
          <AlertCircle size={24} />
          <span>No Data Issues Detected</span>
        </div>
      </div>
    );
  }

  return (
    <div className={styles.errorPanel}>
      <div className={styles.header}>
        <div className="flex-center gap-2 text-danger font-bold">
          <AlertCircle size={18} />
          <span>Data Issues ({Object.values(errorIndex.byType).flat().length})</span>
        </div>
        {activeError && (
          <button 
            className={`${styles.clearBtn} btn btn-secondary btn-sm`} 
            onClick={() => setActiveError(null)}
          >
            Clear Filter <X size={12} />
          </button>
        )}
      </div>

      <div className={styles.content}>
        {activeError && (
          <div className={styles.activeErrorDetail}>
            <div className="text-xs-bold mb-4 text-danger">Active Troubleshooting</div>
            <div className="text-sm mb-8">
              <strong>{activeError.field}:</strong> <span className="text-muted">{String(activeError.value)}</span>
            </div>
            
            {activeError.suggestions && activeError.suggestions.length > 0 && (
              <div className={styles.suggestions}>
                <div className={styles.suggestionTitle}>Guided Suggestions</div>
                {activeError.suggestions.map(s => (
                  <button 
                    key={s} 
                    className={styles.suggestionBtn}
                    onClick={() => patchRecord(activeError.module, activeError.recordId, activeError.field, s)}
                  >
                    <div className="flex-between">
                      <span>Apply "{s}"</span>
                      <Check size={12} />
                    </div>
                  </button>
                ))}
                
                <button 
                  className="btn btn-primary btn-xs mt-8 w-full flex-center gap-2"
                  onClick={() => handleBulkFix(activeError.field, activeError.value, activeError.suggestions![0])}
                >
                  <Zap size={12} />
                  Bulk Fix All "{activeError.value}" → "{activeError.suggestions![0]}"
                </button>
              </div>
            )}
          </div>
        )}

        {Object.entries(errorIndex.byType).map(([type, errors]) => (
          <div key={type} className={styles.errorTypeGroup}>
            <div className={styles.typeTitle}>{type.replace(/_/g, ' ')}</div>
            <div className={styles.valueList}>
              {Array.from(new Set(errors.map(e => String(e.value || 'NULL')))).map(valStr => {
                const groupErrors = errors.filter(e => String(e.value || 'NULL') === valStr);
                const count = groupErrors.length;
                const field = groupErrors[0]?.field;
                const isActive = activeError?.value === (valStr === 'NULL' ? null : valStr) && activeError?.field === field;

                return (
                  <button 
                    key={valStr} 
                    className={`${styles.errorValueBtn} ${isActive ? styles.active : ''}`}
                    onClick={() => setActiveError(groupErrors[0])}
                  >
                    <span>{valStr} ({count})</span>
                    <ChevronRight size={14} />
                  </button>
                );
              })}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
};

