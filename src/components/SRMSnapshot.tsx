import React, { useMemo } from 'react';
import { BarChart3 } from 'lucide-react';
import { KPIBox } from './KPIBox';
import { calculateIPDistribution, calculateTSDistribution } from '../utils/srmCalculations';

interface SRMSnapshotProps {
  records: any[];
  className?: string;
}

export const SRMSnapshot: React.FC<SRMSnapshotProps> = ({ records, className = '' }) => {
  const metrics = useMemo(() => {
    if (records.length === 0) {
      return {
        avgTS: 0,
        avgIP: 0,
        totalCount: 0,
        ipDist: null,
        tsDist: null
      };
    }

    const ipScores = records.map(r => r.ipScore);
    const tsScores = records.map(r => r.tsScore);

    const avgIP = Math.round(ipScores.reduce((a, b) => a + b, 0) / ipScores.length);
    const avgTS = Math.round(tsScores.reduce((a, b) => a + b, 0) / tsScores.length * 100) / 100;

    const ipDist = calculateIPDistribution(records);
    const tsDist = calculateTSDistribution(records);

    return {
      avgTS,
      avgIP,
      totalCount: records.length,
      ipDist,
      tsDist
    };
  }, [records]);

  return (
    <div className={`dashboard-grid ${className}`} style={{ gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: '16px', marginBottom: '24px' }}>
      <KPIBox
        label="Avg TS"
        value={metrics.avgTS.toString()}
        unit=""
        trend="stable"
        icon={<BarChart3 size={20} />}
      />
      <KPIBox
        label="Avg IP Score"
        value={metrics.avgIP.toString()}
        unit="/100"
        trend="stable"
        icon={<BarChart3 size={20} />}
      />
      <KPIBox
        label="Total Candidates"
        value={metrics.totalCount.toString()}
        unit={`IP Present`}
        trend="stable"
        icon={<BarChart3 size={20} />}
      />
      {metrics.ipDist && (
        <div className="glass-panel" style={{ padding: '16px', display: 'flex', flexDirection: 'column' }}>
          <div style={{ fontSize: '11px', textTransform: 'uppercase', color: 'var(--text-secondary)', marginBottom: '12px', fontWeight: 600 }}>IP Distribution</div>
          <div style={{ display: 'flex', gap: '8px', fontSize: '12px' }}>
            <div style={{ flex: 1, textAlign: 'center' }}>
              <div style={{ fontWeight: 600, color: 'var(--danger)' }}>{metrics.ipDist.below50Pct}%</div>
              <div style={{ fontSize: '10px', color: 'var(--text-secondary)' }}>&lt;50</div>
            </div>
            <div style={{ flex: 1, textAlign: 'center' }}>
              <div style={{ fontWeight: 600, color: 'var(--warning)' }}>{metrics.ipDist.range50_75Pct}%</div>
              <div style={{ fontSize: '10px', color: 'var(--text-secondary)' }}>50-75</div>
            </div>
            <div style={{ flex: 1, textAlign: 'center' }}>
              <div style={{ fontWeight: 600, color: 'var(--accent-primary)' }}>{metrics.ipDist.range75_90Pct}%</div>
              <div style={{ fontSize: '10px', color: 'var(--text-secondary)' }}>75-90</div>
            </div>
            <div style={{ flex: 1, textAlign: 'center' }}>
              <div style={{ fontWeight: 600, color: 'var(--success)' }}>{metrics.ipDist.above90Pct}%</div>
              <div style={{ fontSize: '10px', color: 'var(--text-secondary)' }}>&gt;90</div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
