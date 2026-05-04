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
    // Filter by FY
    const fyAttendance = attendance.filter(a => isWithinFY(a.attendanceDate || a.date || a.month, selectedFY));
    
    // Also filter by global training type if not 'ALL'
    const typeFiltered = filters.trainingType === 'ALL' 
      ? fyAttendance 
      : fyAttendance.filter(a => normalizeTrainingType(a.trainingType) === activeType);

    const uniqueTrainers = [...new Set(typeFiltered.map(a => a.sessionTrainer || a.trainer).filter(Boolean))].sort();

    // Grouping by Batch
    const batchesMap = new Map<string, { type: string, trainer: string, month: string, team: string, count: number }>();

    typeFiltered.forEach(a => {
      const type = normalizeTrainingType(a.trainingType);
      const trainer = a.sessionTrainer || a.trainer || 'Unassigned';
      const date = a.attendanceDate || a.date || a.month || '';
      const team = a.team || a.sessionTeam || 'Unknown';
      const monthKey = date.substring(0, 7); // YYYY-MM
      
      const bid = getBatchId(a.trainingType, date, team, trainer);
      
      if (!batchesMap.has(bid)) {
        batchesMap.set(bid, { type, trainer, month: monthKey, team, count: 0 });
      }
      batchesMap.get(bid)!.count++;
    });

    // Aggregate into Cell Data
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
          if (!data[key].includes(b.team)) {
            data[key] += `,\n${entry}`;
          }
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
            {isIpMip ? 'In-Clinic / Mega In-Clinic Performance' : 'Monthly Training Performance Report'} · FY {selectedFY}
          </p>
        </div>
      </div>

      <div className={styles.reportSection}>
        <div className={styles.tableContainer}>
          <div className={styles.scrollWrapper}>
            <table className={`${styles.toeTable} ${isIpMip ? styles.yellowTheme : styles.blueTheme}`}>
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
                      No training data found for {filters.trainingType === 'ALL' ? 'any' : filters.trainingType} in {selectedFY}.
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
                                  cellValue.split('\n').map((line, i) => (
                                    <div key={i}>{line}</div>
                                  ))
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
