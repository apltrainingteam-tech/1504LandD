import React, { useMemo } from 'react';
import { calculateClusterMetrics, calculateTeamMetrics, calculateMonthlyTrend } from '../../../core/utils/srmCalculations';
import { getDiagnosis } from '../../../core/utils/srmInsights';
import styles from './SRMTable.module.css';

interface SRMTableProps {
  records: any[];
  mode: 'cluster' | 'team';
  clusterFilter?: string;
  className?: string;
}

const MiniSparkline: React.FC<{ data: number[]; height?: number }> = ({ data, height = 30 }) => {
  if (data.length === 0) return <span>—</span>;

  const min = Math.min(...data);
  const max = Math.max(...data);
  const range = max - min || 1;

  const points = data.map((v, i) => {
    const x = (i / Math.max(data.length - 1, 1)) * 100;
    const y = 100 - ((v - min) / range) * 100;
    return `${x},${y}`;
  });

  return (
    <svg viewBox={`0 0 100 ${height}`} className={styles.sparkline}>
      <polyline
        points={points.join(' ')}
        fill="none"
        stroke="var(--accent-primary)"
        strokeWidth="2"
      />
    </svg>
  );
};

export const SRMTable: React.FC<SRMTableProps> = ({ records, mode, clusterFilter, className = '' }) => {
  const metrics = useMemo(() => {
    if (mode === 'cluster') {
      return calculateClusterMetrics(records);
    } else {
      return calculateTeamMetrics(records, clusterFilter);
    }
  }, [records, mode, clusterFilter]);

  const trends = useMemo(() => {
    const monthlyTrends = calculateMonthlyTrend(records);
    const trendMap = new Map<string, number[]>();
    for (const trend of monthlyTrends) {
      trendMap.set(trend.month, [trend.avgIP]);
    }
    return trendMap;
  }, [records]);

  const rankedMetrics = useMemo(
    () =>
      [...metrics]
        .sort((a, b) => (b.avgIP || 0) - (a.avgIP || 0))
        .map((m, idx) => ({ ...m, rank: idx + 1 })),
    [metrics]
  );

  if (metrics.length === 0) {
    return (
      <div className={`glass-panel ${styles.empty}`}>
        No data available
      </div>
    );
  }

  return (
    <div className={`glass-panel ${styles.wrapper} ${className}`}>
      <table className={`data-table ${styles.table}`}>
        <thead>
          <tr>
            <th className={styles.thCenter}>Rank</th>
            <th className={styles.thLabel}>{mode === 'cluster' ? 'Cluster' : 'Team'}</th>
            <th className={styles.thRight}>Count</th>
            <th className={styles.thRight}>Avg TS</th>
            <th className={styles.thRight}>Avg IP</th>
            <th className={styles.thGeneral}>Signal</th>
            <th className={styles.thCenter}>&lt;75%</th>
            <th className={styles.thCenter}>75-90%</th>
            <th className={styles.thCenter}>&gt;90%</th>
            <th className={styles.thGeneral}>Trend</th>
            <th className={styles.thGeneral}>Diagnosis</th>
          </tr>
        </thead>
        <tbody>
          {rankedMetrics.map((m, idx) => {
            const diagnosis = getDiagnosis(m.avgTS, m.below50Pct + m.range50_75Pct, m.above90Pct);
            const getDiagnosisClass = (diag: string) => {
              if (diag === 'Strong Hiring') return styles.textSuccess;
              if (diag === 'Poor Hiring') return styles.textDanger;
              if (diag === 'TS Evaluation Issue') return styles.textWarning;
              return styles.textAccent;
            };
            const diagnosisBadgeClass =
              diagnosis === 'Strong Hiring'
                ? 'status-completed'
                : diagnosis === 'Poor Hiring'
                ? 'status-cancelled'
                : diagnosis === 'TS Evaluation Issue'
                ? 'status-planned'
                : 'status-notified';
            const ipSignal = Math.max(0, Math.min(100, Number(m.avgIP) || 0));

            return (
              <tr key={idx}>
                <td className={styles.tdRank}>
                  <span className={styles.rankBadge}>#{m.rank}</span>
                </td>
                <td className={styles.tdName}>{m.cluster || m.team}</td>
                <td className={styles.tdCount}>{m.count}</td>
                <td className={styles.tdRight}>{m.avgTS}</td>
                <td className={styles.tdRight}>{m.avgIP}</td>
                <td className={styles.tdSignal}>
                  <div className="perf-bar" aria-hidden="true">
                    <div className="perf-bar-fill" style={{ width: `${ipSignal}%`, background: 'var(--accent-primary)' }} />
                  </div>
                </td>
                <td className={`${styles.tdCenter} ${m.below50Pct > 30 ? styles.textDanger : styles.textMuted}`}>
                  {m.below50Pct}%
                </td>
                <td className={`${styles.tdCenter} ${styles.textAccent}`}>
                  {m.range75_90Pct}%
                </td>
                <td className={`${styles.tdCenter} ${m.above90Pct >= 20 ? styles.textSuccess : styles.textMuted}`}>
                  {m.above90Pct}%
                </td>
                <td className={styles.tdTrend}>
                  <MiniSparkline data={[m.avgIP - 5, m.avgIP, m.avgIP + 2]} />
                </td>
                <td className={`${styles.tdDiagnosis} ${getDiagnosisClass(diagnosis)}`}>
                  <span className={`status-badge ${diagnosisBadgeClass}`}>{diagnosis}</span>
                </td>
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
};
