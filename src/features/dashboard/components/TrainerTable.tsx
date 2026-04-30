import React, { useState, memo, useCallback } from 'react';
import { TrainerStat } from '../../../types/reports';
import { flagScore, flagClass, flagLabel } from '../../../core/utils/scoreNormalizer';
import { ChevronUp, ChevronDown, User } from 'lucide-react';
import TrainerAvatar from '../../../shared/components/ui/TrainerAvatar';
import API_BASE from '../../../config/api';
import styles from './TrainerTable.module.css';

interface TrainerTableProps {
  stats: TrainerStat[];
  tab?: string;
}

type SortKey = 'trainerId' | 'trainingsConducted' | 'totalTrainees' | 'avgScore' | 'attendancePct';

export const TrainerTable: React.FC<TrainerTableProps> = memo(({ stats, tab }) => {
  const [sortKey, setSortKey] = useState<SortKey>('avgScore');
  const [sortDir, setSortDir] = useState<'asc' | 'desc'>('desc');

  const handleSort = useCallback((key: SortKey) => {
    setSortKey(prevKey => {
      if (prevKey === key) {
        setSortDir(d => d === 'asc' ? 'desc' : 'asc');
        return prevKey;
      } else {
        setSortDir('desc');
        return key;
      }
    });
  }, []);

  const sorted = [...stats].sort((a, b) => {
    const va = a[sortKey]; const vb = b[sortKey];
    if (typeof va === 'string') return sortDir === 'asc' ? va.localeCompare(vb as string) : (vb as string).localeCompare(va);
    return sortDir === 'asc' ? (va as number) - (vb as number) : (vb as number) - (va as number);
  });

  const SortIcon = ({ colKey }: { colKey: SortKey }) =>
    sortKey === colKey ? (sortDir === 'asc' ? <ChevronUp size={12} /> : <ChevronDown size={12} />) : null;

  const th = (label: string, key: SortKey) => (
    <th
      onClick={() => handleSort(key)}
      className={`${styles.th} ${sortKey === key ? styles.thActive : styles.thInactive}`}
    >
      <span className={styles.thContent}>{label}<SortIcon colKey={key} /></span>
    </th>
  );

  if (stats.length === 0) {
    return <div className={`text-muted ${styles.emptyState}`}>No trainer data found. Ensure attendance uploads include a Trainer column.</div>;
  }

  return (
    <div className={styles.tableWrapper}>
      <table className={styles.table}>
        <thead>
          <tr className={styles.theadTr}>
            {th('Trainer ID / Name', 'trainerId')}
            {th('Sessions', 'trainingsConducted')}
            {th('Trainees', 'totalTrainees')}
            {th(tab === 'IP' ? 'Avg T Score / %' : 'Avg Score', 'avgScore')}
            {th('Attendance %', 'attendancePct')}
            <th className={styles.thNoSort}>Flag</th>
          </tr>
        </thead>
        <tbody>
          {sorted.map((s, i) => {
            const flag = flagScore(s.avgScore);
            return (
              <tr key={i} className={styles.tbodyTr}>
                <td className={styles.tdBold}>
                  <TrainerAvatar 
                    trainer={{
                      id: s.trainerId,
                      name: s.trainerId,
                      avatarUrl: s.avatarUrl
                    }}
                    size={28}
                    showName={true}
                  />
                </td>
                <td className={styles.td}>{s.trainingsConducted}</td>
                <td className={styles.td}>{s.totalTrainees}</td>
                <td className={`${styles.tdScore} ${flag === 'green' ? styles.success : flag === 'amber' ? styles.warning : styles.danger}`}>
                  {s.avgScore > 0 ? s.avgScore.toFixed(1) + '%' : '—'}
                </td>
                <td className={styles.td}>{s.attendancePct.toFixed(1)}%</td>
                <td className={styles.td}>
                  {s.avgScore > 0 && <span className={`badge ${flagClass(flag)}`}>{flagLabel(flag)}</span>}
                </td>
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
});




