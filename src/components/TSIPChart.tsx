import React, { useMemo } from 'react';
import { calculateTSvsIPMatrix } from '../utils/srmCalculations';

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
      <div className="glass-panel" style={{ padding: '24px', textAlign: 'center', color: 'var(--text-secondary)' }}>
        No data available
      </div>
    );
  }

  // Find max value for scaling
  const maxValue = Math.max(
    ...matrixData.map(m => Math.max(m.distribution.below50, m.distribution.range50_75, m.distribution.range75_90, m.distribution.above90))
  );

  return (
    <div className={`glass-panel ${className}`} style={{ padding: '24px', overflowX: 'auto' }}>
      <h3 style={{ fontSize: '16px', fontWeight: 600, marginBottom: '20px' }}>TS vs IP Distribution (Stacked Bar)</h3>
      
      <div style={{ display: 'flex', alignItems: 'flex-end', gap: '16px', minHeight: '300px', justifyContent: 'center' }}>
        {matrixData.map(row => (
          <div key={row.tsRange} style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '8px', flex: '0 0 120px' }}>
            {/* Stacked bar */}
            <div style={{ display: 'flex', flexDirection: 'column', width: '80px', height: '220px', border: '1px solid var(--border-color)', borderRadius: '4px', overflow: 'hidden', background: 'rgba(0,0,0,0.05)' }}>
              {/* Below 50 */}
              {row.distribution.below50 > 0 && (
                <div
                  style={{
                    height: `${(row.distribution.below50 / maxValue) * 100}%`,
                    background: 'rgba(239, 68, 68, 0.6)',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    color: 'white',
                    fontSize: '11px',
                    fontWeight: 600
                  }}
                  title={`<50: ${row.distribution.below50}`}
                >
                  {row.distribution.below50 > maxValue * 0.15 && row.distribution.below50}
                </div>
              )}

              {/* 50-75 */}
              {row.distribution.range50_75 > 0 && (
                <div
                  style={{
                    height: `${(row.distribution.range50_75 / maxValue) * 100}%`,
                    background: 'rgba(245, 158, 11, 0.6)',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    color: 'white',
                    fontSize: '11px',
                    fontWeight: 600
                  }}
                  title={`50-75: ${row.distribution.range50_75}`}
                >
                  {row.distribution.range50_75 > maxValue * 0.15 && row.distribution.range50_75}
                </div>
              )}

              {/* 75-90 */}
              {row.distribution.range75_90 > 0 && (
                <div
                  style={{
                    height: `${(row.distribution.range75_90 / maxValue) * 100}%`,
                    background: 'rgba(59, 130, 246, 0.6)',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    color: 'white',
                    fontSize: '11px',
                    fontWeight: 600
                  }}
                  title={`75-90: ${row.distribution.range75_90}`}
                >
                  {row.distribution.range75_90 > maxValue * 0.15 && row.distribution.range75_90}
                </div>
              )}

              {/* Above 90 */}
              {row.distribution.above90 > 0 && (
                <div
                  style={{
                    height: `${(row.distribution.above90 / maxValue) * 100}%`,
                    background: 'rgba(16, 185, 129, 0.6)',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    color: 'white',
                    fontSize: '11px',
                    fontWeight: 600
                  }}
                  title={`>90: ${row.distribution.above90}`}
                >
                  {row.distribution.above90 > maxValue * 0.15 && row.distribution.above90}
                </div>
              )}
            </div>

            {/* Labels */}
            <div style={{ textAlign: 'center' }}>
              <div style={{ fontSize: '12px', fontWeight: 600 }}>TS {row.tsRange}</div>
              <div style={{ fontSize: '11px', color: 'var(--text-secondary)' }}>n={row.count}</div>
            </div>
          </div>
        ))}
      </div>

      {/* Legend */}
      <div style={{ marginTop: '24px', display: 'flex', justifyContent: 'center', gap: '24px', flexWrap: 'wrap' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
          <div style={{ width: '16px', height: '16px', background: 'rgba(239, 68, 68, 0.6)', borderRadius: '2px' }} />
          <span style={{ fontSize: '12px' }}>IP &lt;50</span>
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
          <div style={{ width: '16px', height: '16px', background: 'rgba(245, 158, 11, 0.6)', borderRadius: '2px' }} />
          <span style={{ fontSize: '12px' }}>IP 50-75</span>
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
          <div style={{ width: '16px', height: '16px', background: 'rgba(59, 130, 246, 0.6)', borderRadius: '2px' }} />
          <span style={{ fontSize: '12px' }}>IP 75-90</span>
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
          <div style={{ width: '16px', height: '16px', background: 'rgba(16, 185, 129, 0.6)', borderRadius: '2px' }} />
          <span style={{ fontSize: '12px' }}>IP &gt;90</span>
        </div>
      </div>
    </div>
  );
};
