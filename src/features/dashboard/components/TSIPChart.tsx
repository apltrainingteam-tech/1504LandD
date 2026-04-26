import React, { useMemo } from 'react';
import { calculateTSvsIPMatrix } from '../../../core/utils/srmCalculations';
import styles from './TSIPChart.module.css';

interface TSIPChartProps {
  records: any[];
  className?: string;
}

export const TSIPChart: React.FC<TSIPChartProps> = ({ records, className = '' }) => {
  const matrixData = useMemo(() => {
    return calculateTSvsIPMatrix(records);
  }, [records]);

  if (matrixData.length === 0 || matrixData.every(m => m.count === 0)) {
    return (
      <div className={`glass-panel ${styles.empty}`}>
        No data available
      </div>
    );
  }

  // Find max value for scaling
  const maxValue = Math.max(
    ...matrixData.map(m => Math.max(
      m.distribution.below50,
      m.distribution.range50_75,
      m.distribution.range75_90,
      m.distribution.above90
    ))
  );

  return (
    <div className={`glass-panel ${styles.panel} ${className}`}>
      <h3 className={styles.title}>TS vs IP Distribution (Stacked Bar)</h3>

      <div className={styles.bars}>
        {matrixData.map(row => (
          <div key={row.tsRange} className={styles.barGroup}>
            <div className={styles.barTrack}>
              {row.distribution.below50 > 0 && (
                <div
                  className={`${styles.barSegment} ${styles.segBelow50}`}
                  ref={(el) => el?.style.setProperty('--segment-height', `${(row.distribution.below50 / maxValue) * 100}%`)}
                  title={`<50: ${row.distribution.below50}`}
                >
                  {row.distribution.below50 > maxValue * 0.15 && row.distribution.below50}
                </div>
              )}
              {row.distribution.range50_75 > 0 && (
                <div
                  className={`${styles.barSegment} ${styles.seg50to75}`}
                  ref={(el) => el?.style.setProperty('--segment-height', `${(row.distribution.range50_75 / maxValue) * 100}%`)}
                  title={`50-75: ${row.distribution.range50_75}`}
                >
                  {row.distribution.range50_75 > maxValue * 0.15 && row.distribution.range50_75}
                </div>
              )}
              {row.distribution.range75_90 > 0 && (
                <div
                  className={`${styles.barSegment} ${styles.seg75to90}`}
                  ref={(el) => el?.style.setProperty('--segment-height', `${(row.distribution.range75_90 / maxValue) * 100}%`)}
                  title={`75-90: ${row.distribution.range75_90}`}
                >
                  {row.distribution.range75_90 > maxValue * 0.15 && row.distribution.range75_90}
                </div>
              )}
              {row.distribution.above90 > 0 && (
                <div
                  className={`${styles.barSegment} ${styles.segAbove90}`}
                  ref={(el) => el?.style.setProperty('--segment-height', `${(row.distribution.above90 / maxValue) * 100}%`)}
                  title={`>90: ${row.distribution.above90}`}
                >
                  {row.distribution.above90 > maxValue * 0.15 && row.distribution.above90}
                </div>
              )}
            </div>

            <div className={styles.barLabels}>
              <div className={styles.barLabelMain}>TS {row.tsRange}</div>
              <div className={styles.barLabelSub}>n={row.count}</div>
            </div>
          </div>
        ))}
      </div>

      <div className={styles.legend}>
        <div className={styles.legendItem}>
          <div className={`${styles.legendSwatch} ${styles.swatchBelow50}`} />
          <span className={styles.legendLabel}>IP &lt;50</span>
        </div>
        <div className={styles.legendItem}>
          <div className={`${styles.legendSwatch} ${styles.swatch50to75}`} />
          <span className={styles.legendLabel}>IP 50-75</span>
        </div>
        <div className={styles.legendItem}>
          <div className={`${styles.legendSwatch} ${styles.swatch75to90}`} />
          <span className={styles.legendLabel}>IP 75-90</span>
        </div>
        <div className={styles.legendItem}>
          <div className={`${styles.legendSwatch} ${styles.swatchAbove90}`} />
          <span className={styles.legendLabel}>IP &gt;90</span>
        </div>
      </div>
    </div>
  );
};
