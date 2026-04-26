import React, { useMemo } from 'react';
import { BarChart3 } from 'lucide-react';
import { KPIBox } from '../../../shared/components/ui/KPIBox';
import { calculateIPDistribution, calculateTSDistribution } from '../../../core/utils/srmCalculations';
import styles from './SRMSnapshot.module.css';

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
    <div className={`dashboard-grid ${className} ${styles.container}`}>
      <KPIBox
        title="Avg TS"
        value={metrics.avgTS.toString()}
        icon={BarChart3}
      />
      <KPIBox
        title="Avg IP Score"
        value={`${metrics.avgIP}/100`}
        icon={BarChart3}
      />
      <KPIBox
        title="Total Candidates"
        value={metrics.totalCount.toString()}
        subValue="IP Present"
        icon={BarChart3}
      />
      {metrics.ipDist && (
        <div className={`glass-panel ${styles.distPanel}`}>
          <div className={styles.distHeader}>IP Distribution</div>
          <div className={styles.distRow}>
            <div className={styles.distCol}>
              <div className={`${styles.distVal} ${styles.danger}`}>{metrics.ipDist.below50Pct}%</div>
              <div className={styles.distLabel}>&lt;50</div>
            </div>
            <div className={styles.distCol}>
              <div className={`${styles.distVal} ${styles.warning}`}>{metrics.ipDist.range50_75Pct}%</div>
              <div className={styles.distLabel}>50-75</div>
            </div>
            <div className={styles.distCol}>
              <div className={`${styles.distVal} ${styles.primary}`}>{metrics.ipDist.range75_90Pct}%</div>
              <div className={styles.distLabel}>75-90</div>
            </div>
            <div className={styles.distCol}>
              <div className={`${styles.distVal} ${styles.success}`}>{metrics.ipDist.above90Pct}%</div>
              <div className={styles.distLabel}>&gt;90</div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
