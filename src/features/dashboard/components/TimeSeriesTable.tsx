import React, { memo } from 'react';
import { TimeSeriesRow } from '../../../types/reports';
import { flagScore, flagClass, displayScore } from '../../../core/utils/scoreNormalizer';

interface TimeSeriesTableProps {
  rows: TimeSeriesRow[];
  months: string[];
  mode: 'count' | 'score';
  onModeToggle: () => void;
}

const formatMonth = (yyyyMM: string): string => {
  if (!yyyyMM) return '';
  const [y, m] = yyyyMM.split('-');
  const months = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
  return `${months[parseInt(m) - 1]} ${y.slice(2)}`;
};

export const TimeSeriesTable: React.FC<TimeSeriesTableProps> = memo(({ rows, months, mode, onModeToggle }) => {
  if (months.length === 0 || rows.length === 0) {
    return (
      <div style={{ textAlign: 'center', padding: '48px' }} className="text-muted">
        No time-series data available. Upload attendance data to see trends.
      </div>
    );
  }

  return (
    <div>
      <div style={{ display: 'flex', justifyContent: 'flex-end', marginBottom: '12px' }}>
        <button
          onClick={onModeToggle}
          className="btn btn-secondary"
          style={{ fontSize: '12px', padding: '6px 14px' }}
        >
          {mode === 'score' ? '📊 Switch to Count' : '🎯 Switch to Score'}
        </button>
      </div>
      <div style={{ overflowX: 'auto' }}>
        <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '13px' }}>
          <thead>
            <tr>
              <th style={{ textAlign: 'left', padding: '10px 16px', background: 'var(--bg-card)', borderBottom: '2px solid var(--border-color)', position: 'sticky', left: 0, zIndex: 2, minWidth: '140px' }}>
                Team / Cluster
              </th>
              {months.map(mo => (
                <th key={mo} style={{ padding: '10px 12px', background: 'var(--bg-card)', borderBottom: '2px solid var(--border-color)', textAlign: 'center', minWidth: '80px', color: 'var(--text-secondary)', fontWeight: 600, textTransform: 'uppercase', fontSize: '11px' }}>
                  {formatMonth(mo)}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {rows.map((row, ri) => (
              <tr key={ri} style={{ borderBottom: '1px solid var(--border-color)' }}>
                <td style={{ padding: '10px 16px', fontWeight: 600, position: 'sticky', left: 0, background: 'var(--bg-card)', zIndex: 1 }}>
                  {row.label}
                </td>
                {months.map(mo => {
                  const val = row.cells[mo];
                  const flag = val != null && mode === 'score' ? flagScore(val) : null;
                  return (
                    <td key={mo} style={{ padding: '8px 12px', textAlign: 'center', background: flag === 'green' ? 'rgba(16,185,129,0.08)' : flag === 'amber' ? 'rgba(245,158,11,0.08)' : flag === 'red' ? 'rgba(239,68,68,0.08)' : 'transparent' }}>
                      {val != null ? (
                        <span className={`tabular-nums`} style={{ fontWeight: 600, color: flag === 'green' ? 'var(--success)' : flag === 'amber' ? 'var(--warning)' : flag === 'red' ? 'var(--danger)' : 'var(--text-primary)' }}>
                          {mode === 'score' ? displayScore(val) : val}
                          {mode === 'score' && flag && <span style={{ fontSize: '10px', marginLeft: '4px' }}>{flag === 'green' ? '●' : flag === 'amber' ? '●' : '●'}</span>}
                        </span>
                      ) : <span className="text-muted">—</span>}
                    </td>
                  );
                })}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
});






