import React, { useMemo, useState } from 'react';
import { useGlobalFilters } from '../../core/context/GlobalFilterContext';
import { getFiscalMonths, formatMonthLabel, isWithinFY } from '../../core/utils/fiscalYear';
import { normalizeTrainingType, toProperCase, normalizeForMatch } from '../../core/engines/normalizationEngine';
import { useMasterData } from '../../core/context/MasterDataContext';
import { useTOEStats } from '../../shared/hooks/computationHooks';
import API_BASE from '../../config/api';
import { ChevronDown, ChevronUp, Users, Presentation } from 'lucide-react';
import TrainerAvatar from '../../shared/components/ui/TrainerAvatar';
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
  const { trainers: masterTrainers } = useMasterData();
  const selectedFY = filters.fiscalYear || '2024-25';
  const activeType = normalizeTrainingType(filters.trainingType);
  const isIpMip = activeType === 'IP' || activeType === 'MIP';

  const toeStats = useTOEStats(attendance, masterTrainers, selectedFY, filters);

  const [collapsedGroups, setCollapsedGroups] = useState<Record<string, boolean>>({
    HO: false,
    RTM: false
  });

  const toggleGroup = (group: string) => {
    setCollapsedGroups(prev => ({ ...prev, [group]: !prev[group] }));
  };

  const groupedStats = useMemo(() => {
    const groups: Record<string, any[]> = { HO: [], RTM: [] };
    toeStats.forEach(s => {
      const cat = s.category === 'RTM' ? 'RTM' : 'HO';
      groups[cat].push(s);
    });
    // Sort by Sessions (trainingsConducted) descending
    Object.keys(groups).forEach(key => {
      groups[key].sort((a, b) => b.trainingsConducted - a.trainingsConducted);
    });
    return groups;
  }, [toeStats]);

  // Get months for columns
  const months = useMemo(() => getFiscalMonths(selectedFY), [selectedFY]);

  // Transform Data
  const { tableData, trainers } = useMemo(() => {
    // 1. Filter by Fiscal Year
    const fyAttendance = attendance.filter(a => isWithinFY(a.attendanceDate || a.date || a.month, selectedFY));
    
    // 2. Filter by Global Training Type and Trainer
    const typeFiltered = fyAttendance.filter(a => {
      const typeMatch = filters.trainingType === 'ALL' || normalizeTrainingType(a.trainingType) === activeType;
      if (!typeMatch) return false;

      if (filters.trainer !== 'ALL') {
        const rawTrainer = a.sessionTrainer || a.trainer || 'Unassigned';
        const rawTrainerId = a.trainerId || '';
        const filterMT = masterTrainers.find(t => t.id === filters.trainer);
        const filterNorm = normalizeForMatch(filters.trainer);
        const recordNorm = normalizeForMatch(rawTrainer);
        const idNorm = normalizeForMatch(rawTrainerId);

        return recordNorm === filterNorm || 
               idNorm === filterNorm ||
               (filterMT && recordNorm === normalizeForMatch(filterMT.name));
      }
      return true;
    });

    const uniqueTrainers = [...new Set(typeFiltered.map(a => 
      toProperCase(a.sessionTrainer || a.trainer || a.trainerId) || 'Unassigned'
    ))].sort();

    // 3. Batch/Session Grouping
    const batchesMap = new Map<string, { type: string, trainer: string, month: string, team: string, count: number }>();

    typeFiltered.forEach(a => {
      const type = normalizeTrainingType(a.trainingType);
      const trainer = toProperCase(a.sessionTrainer || a.trainer || a.trainerId) || 'Unassigned';

      
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
          data[key] += `\n${entry}`;
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

      {/* Trainer KPI Groups */}
      <div className={styles.kpiContainer}>
        {['HO', 'RTM'].map(group => {
          const stats = groupedStats[group] || [];
          if (stats.length === 0) return null;
          const isCollapsed = collapsedGroups[group];

          return (
            <div key={group} className={styles.groupSection}>
                <div className={styles.groupHeader} onClick={() => toggleGroup(group)}>
                  <span className={styles.groupTitle}>{group} Trainers</span>
                  <span className={styles.groupCount}>{stats.length}</span>
                  <span style={{ marginLeft: '8px', display: 'flex', color: '#94A3B8' }}>
                    {isCollapsed ? <ChevronRight size={14} /> : <ChevronDown size={14} />}
                  </span>
                </div>

              {!isCollapsed && (
                <div className={styles.statsGrid}>
                  {stats.map(stat => {
                    const trainerObj = masterTrainers.find(t => normalizeForMatch(t.name) === normalizeForMatch(stat.trainerName));
                    return (
                      <div key={stat.trainerName} className={styles.statCard} title={stat.trainerName}>
                        <div className={styles.tileContent}>
                          <TrainerAvatar trainer={trainerObj || { id: stat.trainerName, name: stat.trainerName }} size={32} />
                          <div className={styles.metricsWrapper}>
                            <div className={styles.metricBlock}>
                              <div className={styles.metricInfo}>
                                <div className={styles.primaryValue}>{stat.trainingsConducted}</div>
                                <div className={styles.label}>Sessions</div>
                              </div>
                            </div>
                            <div className={styles.metricBlock}>
                              <div className={styles.metricInfo}>
                                <div className={styles.sessionsValue}>{stat.candidatesTrained}</div>
                                <div className={styles.label}>Trained</div>
                              </div>
                            </div>
                          </div>
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}
            </div>
          );
        })}
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
                  trainers.map(trainer => {
                    const trainerObj = masterTrainers.find(t => normalizeForMatch(t.name) === normalizeForMatch(trainer));
                    return (
                      <tr key={trainer}>
                        <td className={styles.stickyCol}>
                          <TrainerAvatar trainer={trainerObj || { id: trainer, name: trainer }} size={24} showName={true} />
                        </td>
                      {months.map(m => {
                        const cellValue = tableData[`${trainer}_${m}`];
                        return (
                          <td key={m} className={cellValue ? styles.activeCell : styles.emptyCell}>
                            {cellValue && (
                              <div className={styles.cellContent}>
                                {isIpMip ? (
                                  <span className={styles.badge}>{cellValue}</span>
                                ) : (
                                  <div className={styles.teamList}>
                                    {cellValue.split('\n').map((item, i) => (
                                      <span key={i} className={styles.teamEntry}>{item}</span>
                                    ))}
                                  </div>
                                )}
                              </div>
                            )}
                          </td>
                        );
                      })}
                    </tr>
                  );
                })
              )}
              </tbody>
            </table>
          </div>
        </div>
      </div>
    </div>
  );
};
