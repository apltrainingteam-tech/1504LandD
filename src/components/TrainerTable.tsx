import React, { useState } from 'react';
import { TrainerStat } from '../types/reports';
import { flagScore, flagClass, flagLabel } from '../utils/scoreNormalizer';
import { ChevronUp, ChevronDown } from 'lucide-react';

interface TrainerTableProps {
  stats: TrainerStat[];
}

type SortKey = 'trainerId' | 'trainingsConducted' | 'totalTrainees' | 'avgScore' | 'attendancePct';

export const TrainerTable: React.FC<TrainerTableProps> = ({ stats }) => {
  const [sortKey, setSortKey] = useState<SortKey>('avgScore');
  const [sortDir, setSortDir] = useState<'asc' | 'desc'>('desc');

  const handleSort = (key: SortKey) => {
    if (sortKey === key) setSortDir(d => d === 'asc' ? 'desc' : 'asc');
    else { setSortKey(key); setSortDir('desc'); }
  };

  const sorted = [...stats].sort((a, b) => {
    const va = a[sortKey]; const vb = b[sortKey];
    if (typeof va === 'string') return sortDir === 'asc' ? va.localeCompare(vb as string) : (vb as string).localeCompare(va);
    return sortDir === 'asc' ? (va as number) - (vb as number) : (vb as number) - (va as number);
  });

  const SortIcon = ({ key }: { key: SortKey }) =>
    sortKey === key ? (sortDir === 'asc' ? <ChevronUp size={12} /> : <ChevronDown size={12} />) : null;

  const th = (label: string, key: SortKey) => (
    <th
      onClick={() => handleSort(key)}
      style={{ padding: '12px 16px', textAlign: 'left', cursor: 'pointer', userSelect: 'none', background: sortKey === key ? 'rgba(99,102,241,0.08)' : 'var(--bg-card)' }}
    >
      <span style={{ display: 'flex', alignItems: 'center', gap: '4px' }}>{label}<SortIcon key={key} /></span>
    </th>
  );

  if (stats.length === 0) {
    return <div style={{ textAlign: 'center', padding: '48px' }} className="text-muted">No trainer data found. Ensure attendance uploads include a Trainer column.</div>;
  }

  return (
    <div style={{ overflowX: 'auto' }}>
      <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '13px' }}>
        <thead>
          <tr style={{ borderBottom: '2px solid var(--border-color)' }}>
            {th('Trainer ID / Name', 'trainerId')}
            {th('Sessions', 'trainingsConducted')}
            {th('Trainees', 'totalTrainees')}
            {th('Avg Score', 'avgScore')}
            {th('Attendance %', 'attendancePct')}
            <th style={{ padding: '12px 16px', background: 'var(--bg-card)' }}>Flag</th>
          </tr>
        </thead>
        <tbody>
          {sorted.map((s, i) => {
            const flag = flagScore(s.avgScore);
            return (
              <tr key={i} style={{ borderBottom: '1px solid var(--border-color)' }}>
                <td style={{ padding: '10px 16px', fontWeight: 600 }}>{s.trainerId || '—'}</td>
                <td style={{ padding: '10px 16px' }}>{s.trainingsConducted}</td>
                <td style={{ padding: '10px 16px' }}>{s.totalTrainees}</td>
                <td style={{ padding: '10px 16px', fontWeight: 700, color: flag === 'green' ? 'var(--success)' : flag === 'amber' ? 'var(--warning)' : 'var(--danger)' }}>
                  {s.avgScore > 0 ? s.avgScore.toFixed(1) + '%' : '—'}
                </td>
                <td style={{ padding: '10px 16px' }}>{s.attendancePct.toFixed(1)}%</td>
                <td style={{ padding: '10px 16px' }}>
                  {s.avgScore > 0 && <span className={`badge ${flagClass(flag)}`}>{flagLabel(flag)}</span>}
                </td>
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
};
