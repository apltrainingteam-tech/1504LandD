import React from 'react';
import { AlertCircle, ChevronRight, X } from 'lucide-react';
import { useMasterData } from '../../../core/context/MasterDataContext';
import styles from './ErrorPanel.module.css';

export const ErrorPanel: React.FC = () => {
  const { errorIndex, setActiveError, activeError } = useMasterData();

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
            className="btn btn-secondary btn-sm" 
            style={{ padding: '2px 8px', fontSize: '10px' }}
            onClick={() => setActiveError(null)}
          >
            Clear Filter <X size={12} />
          </button>
        )}
      </div>

      <div className={styles.content}>
        {Object.entries(errorIndex.byType).map(([type, errors]) => (
          <div key={type} className={styles.errorTypeGroup}>
            <div className={styles.typeTitle}>{type.replace(/_/g, ' ')}</div>
            <div className={styles.valueList}>
              {/* Group by value within type */}
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
