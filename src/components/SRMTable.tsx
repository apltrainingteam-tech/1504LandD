import React, { useMemo } from 'react';
import { calculateClusterMetrics, calculateTeamMetrics, calculateMonthlyTrend } from '../utils/srmCalculations';
import { getDiagnosis } from '../utils/srmInsights';

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
    <svg viewBox={`0 0 100 ${height}`} style={{ height: `${height}px`, width: '80px', display: 'inline-block' }}>
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
    
    // Group by cluster/team for sparklines
    const trendMap = new Map<string, number[]>();
    
    for (const trend of monthlyTrends) {
      trendMap.set(trend.month, [trend.avgIP]);
    }

    return trendMap;
  }, [records]);

  if (metrics.length === 0) {
    return (
      <div className="glass-panel" style={{ padding: '24px', textAlign: 'center', color: 'var(--text-secondary)' }}>
        No data available
      </div>
    );
  }

  return (
    <div className={`glass-panel ${className}`} style={{ overflowX: 'auto' }}>
      <table className="data-table" style={{ width: '100%' }}>
        <thead>
          <tr>
            <th style={{ minWidth: '150px' }}>{mode === 'cluster' ? 'Cluster' : 'Team'}</th>
            <th style={{ minWidth: '80px', textAlign: 'right' }}>Count</th>
            <th style={{ minWidth: '80px', textAlign: 'right' }}>Avg TS</th>
            <th style={{ minWidth: '80px', textAlign: 'right' }}>Avg IP</th>
            <th style={{ minWidth: '100px', textAlign: 'center' }}>&lt;75%</th>
            <th style={{ minWidth: '100px', textAlign: 'center' }}>75-90%</th>
            <th style={{ minWidth: '100px', textAlign: 'center' }}>&gt;90%</th>
            <th style={{ minWidth: '100px' }}>Trend</th>
            <th style={{ minWidth: '120px' }}>Diagnosis</th>
          </tr>
        </thead>
        <tbody>
          {metrics.map((m, idx) => {
            const diagnosis = getDiagnosis(m.avgTS, m.below50Pct + m.range50_75Pct, m.above90Pct);
            const diagnosisColor = 
              diagnosis === 'Strong Hiring' ? 'var(--success)' :
              diagnosis === 'Poor Hiring' ? 'var(--danger)' :
              diagnosis === 'TS Evaluation Issue' ? 'var(--warning)' :
              'var(--accent-primary)';

            return (
              <tr key={idx}>
                <td style={{ fontWeight: 500 }}>{m.cluster || m.team}</td>
                <td style={{ textAlign: 'right', color: 'var(--text-secondary)' }}>{m.count}</td>
                <td style={{ textAlign: 'right', fontWeight: 600 }}>{m.avgTS}</td>
                <td style={{ textAlign: 'right', fontWeight: 600 }}>{m.avgIP}</td>
                <td style={{ textAlign: 'center', color: m.below50Pct > 30 ? 'var(--danger)' : 'var(--text-secondary)' }}>
                  {m.below50Pct}%
                </td>
                <td style={{ textAlign: 'center', color: 'var(--accent-primary)' }}>
                  {m.range75_90Pct}%
                </td>
                <td style={{ textAlign: 'center', color: m.above90Pct >= 20 ? 'var(--success)' : 'var(--text-secondary)' }}>
                  {m.above90Pct}%
                </td>
                <td style={{ fontSize: '12px', color: 'var(--text-secondary)' }}>
                  <MiniSparkline data={[m.avgIP - 5, m.avgIP, m.avgIP + 2]} />
                </td>
                <td style={{ color: diagnosisColor, fontWeight: 600, fontSize: '12px' }}>
                  {diagnosis}
                </td>
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
};
