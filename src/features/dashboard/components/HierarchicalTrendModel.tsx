import React, { useState } from 'react';
import { PerformanceTrendChart } from './PerformanceTrendChart';

interface HierarchicalTrendModelProps {
  tab: string;
  selectedFY: string;
  resolutionLevel: 'Global' | 'Cluster' | 'Team';
  timeSeries: any[];
  ranked: any[];
  gapMetrics: any;
  activeNT: string;
  filters: any;
  masterTeams: any[];
  rawUnified: any[];
}

export const HierarchicalTrendModel: React.FC<HierarchicalTrendModelProps> = ({
  tab,
  rawUnified = [],
  filters
}) => {
  const [chartType, setChartType] = useState<"line" | "bar" | "hybrid">("line");

  // Use global filters to determine if a selection is active
  const hasSelection = !!filters.cluster || !!filters.team;

  return (
    <div style={{ backgroundColor: '#FFFFFF', border: '1px solid #E4E8F0', borderRadius: '12px', height: '520px', padding: '16px', boxShadow: '0 1px 3px 0 rgba(0, 0, 0, 0.1), 0 1px 2px 0 rgba(0, 0, 0, 0.06)', display: 'flex', flexDirection: 'column' }}>
      {/* CHART TYPE TOGGLE */}
      <div style={{ display: 'flex', gap: '8px', marginBottom: '12px' }}>
        <button 
          onClick={() => setChartType("line")}
          style={{ 
            padding: '4px 12px', 
            fontSize: '11px', 
            fontWeight: 600, 
            borderRadius: '6px', 
            border: '1px solid #E4E8F0',
            backgroundColor: chartType === 'line' ? '#3b82f6' : '#fff',
            color: chartType === 'line' ? '#fff' : '#64748b',
            cursor: 'pointer',
            transition: 'all 0.2s'
          }}
        >
          Line
        </button>
        <button 
          onClick={() => setChartType("bar")}
          style={{ 
            padding: '4px 12px', 
            fontSize: '11px', 
            fontWeight: 600, 
            borderRadius: '6px', 
            border: '1px solid #E4E8F0',
            backgroundColor: chartType === 'bar' ? '#3b82f6' : '#fff',
            color: chartType === 'bar' ? '#fff' : '#64748b',
            cursor: 'pointer',
            transition: 'all 0.2s'
          }}
        >
          Bar
        </button>
        <button 
          onClick={() => setChartType("hybrid")}
          style={{ 
            padding: '4px 12px', 
            fontSize: '11px', 
            fontWeight: 600, 
            borderRadius: '6px', 
            border: '1px solid #E4E8F0',
            backgroundColor: chartType === 'hybrid' ? '#3b82f6' : '#fff',
            color: chartType === 'hybrid' ? '#fff' : '#64748b',
            cursor: 'pointer',
            transition: 'all 0.2s'
          }}
        >
          Hybrid
        </button>
      </div>

      <div style={{ flex: 1, backgroundColor: '#F8FAFF', borderRadius: '8px', display: 'flex', alignItems: 'center', justifyContent: 'center', overflow: 'hidden' }}>
        {hasSelection ? (
          <div style={{ width: '100%', height: '100%', padding: '16px' }}>
            <PerformanceTrendChart 
              trainingType={tab} 
              rawUnified={rawUnified} 
              chartType={chartType}
            />
          </div>
        ) : (
          <span style={{ color: '#94a3b8', fontSize: '14px' }}>
            Select a Cluster or Team to view performance trends
          </span>
        )}
      </div>
    </div>
  );
};
