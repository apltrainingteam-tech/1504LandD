import React, { useMemo } from 'react';
import { useGlobalFilters } from '../../core/context/GlobalFilterContext';
import { getFiscalMonths, formatMonthLabel, isWithinFY } from '../../core/utils/fiscalYear';
import { normalizeTrainingType } from '../../core/engines/normalizationEngine';
import styles from './TOE.module.css';

interface TOEProps {
  employees: any[];
  attendance: any[];
  scores: any[];
}

/**
 * getBatchId - Stable identifier for grouping attendees into a single training session
 */
const getBatchId = (
  trainingType: string,
  trainingDate: string,
  team: string,
  trainer: string
) => {
  if (!trainingDate) return 'unknown';
  const d = new Date(trainingDate);
  const year = d.getFullYear();
  const month = d.getMonth(); 

  const fiscalMonth = (month + 9) % 12;
  const fiscalYear = month >= 3 ? year : year - 1;

  const type = normalizeTrainingType(trainingType);
  if (type === 'IP' || type === 'MIP') {
    // Session-based trainings are grouped by Type + Trainer + Date
    return `${type}_${trainer}_${trainingDate}`;
  }
  // Monthly trainings are grouped by Type + Trainer + Team + Fiscal Period
  return `${type}_${trainer}_${team}_${fiscalYear}_${fiscalMonth}`;
};

export const TOE: React.FC<TOEProps> = ({ employees, attendance, scores }) => {
  const { filters } = useGlobalFilters();
  const selectedFY = filters.fiscalYear || '2024-25';
  const activeType = normalizeTrainingType(filters.trainingType);
  const isIpMip = activeType === 'IP' || activeType === 'MIP';

  // Get months for columns
  const months = useMemo(() => getFiscalMonths(selectedFY), [selectedFY]);

  // Transform Data
  const { tableData, trainers } = useMemo(() => {
    // 1. Filter by Fiscal Year
    const fyAttendance = attendance.filter(a => isWithinFY(a.attendanceDate || a.date || a.month, selectedFY));
    
    // 2. Filter by Global Training Type (or all if 'ALL')
    const typeFiltered = filters.trainingType === 'ALL' 
      ? fyAttendance 
      : fyAttendance.filter(a => normalizeTrainingType(a.trainingType) === activeType);

    const uniqueTrainers = [...new Set(typeFiltered.map(a => a.sessionTrainer || a.trainer).filter(Boolean))].sort();

    // 3. Batch/Session Grouping
    const batchesMap = new Map<string, { type: string, trainer: string, month: string, team: string, count: number }>();

    typeFiltered.forEach(a => {
      const type = normalizeTrainingType(a.trainingType);
      const trainer = a.sessionTrainer || a.trainer || 'Unassigned';
      
      // Handle Date object or string safely
      const dateVal = a.attendanceDate || a.date || a.month;
      if (!dateVal) return;
      
      const d = new Date(dateVal);
      if (isNaN(d.getTime())) return;
      
      const monthKey = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;
      const dateStr = d.toISOString().split('T')[0];
      const team = a.team || a.sessionTeam || 'Unknown';
      
      const bid = getBatchId(a.trainingType, dateStr, team, trainer);
      
      if (!batchesMap.has(bid)) {
        batchesMap.set(bid, { type, trainer, month: monthKey, team, count: 0 });
      }
      batchesMap.get(bid)!.count++;
    });

    // 4. Cell Aggregation
    const data: Record<string, string> = {};
    
    batchesMap.forEach(b => {
      const key = `${b.trainer}_${b.month}`;
      if (b.type === 'IP' || b.type === 'MIP') {
        const current = parseInt(data[key] || '0');
        data[key] = String(current + b.count);
      } else {
        const entry = `${b.team} ${b.count}`;
        if (!data[key]) {
          data[key] = entry;
        } else {
          // Comma-separated list for others
          data[key] += `, ${entry}`;
        }
      }
    });

    return { tableData: data, trainers: uniqueTrainers };
  }, [attendance, selectedFY, activeType, filters.trainingType]);

  // Render Section
  return (
    <div className={styles.container}>
      <div className={styles.header}>
        <div className={styles.titleSection}>
          <h1 className={styles.title}>TOE Analytics</h1>
          <p className={styles.subtitle}>
            {isIpMip ? 'Participant Coverage Report' : 'Team Training Distribution'} · FY {selectedFY}
          </p>
        </div>
      </div>

      <div className={styles.reportSection}>
        <div className={styles.tableContainer}>
          <div className={styles.scrollWrapper}>
            <table className={styles.toeTable}>
              <thead>
                <tr>
                  <th className={styles.stickyCol}>Trainer</th>
                  {months.map(m => (
                    <th key={m}>{formatMonthLabel(m)}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {trainers.length === 0 ? (
                  <tr>
                    <td colSpan={months.length + 1} className={styles.emptyState}>
                      No training activity found for {filters.trainingType === 'ALL' ? 'the selected' : filters.trainingType} type in {selectedFY}.
                    </td>
                  </tr>
                ) : (
                  trainers.map(trainer => (
                    <tr key={trainer}>
                      <td className={styles.stickyCol}>{trainer}</td>
                      {months.map(m => {
                        const cellValue = tableData[`${trainer}_${m}`];
                        return (
                          <td key={m} className={cellValue ? styles.activeCell : styles.emptyCell}>
                            {cellValue && (
                              <div className={styles.cellContent}>
                                {isIpMip ? (
                                  <span className={styles.badge}>{cellValue}</span>
                                ) : (
                                  <span className={styles.teamEntry}>{cellValue}</span>
                                )}
                              </div>
                            )}
                          </td>
                        );
                      })}
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </div>
      </div>
    </div>
  );
};
