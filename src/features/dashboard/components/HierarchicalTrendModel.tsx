import React from 'react';
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
  // Use global filters to determine if a selection is active
  const hasSelection = !!filters.cluster || !!filters.team;

  return (
    <div style={{ backgroundColor: '#FFFFFF', border: '1px solid #E4E8F0', borderRadius: '12px', height: '520px', padding: '16px', boxShadow: '0 1px 3px 0 rgba(0, 0, 0, 0.1), 0 1px 2px 0 rgba(0, 0, 0, 0.06)' }}>
      <div style={{ width: '100%', height: '100%', backgroundColor: '#F8FAFF', borderRadius: '8px', display: 'flex', alignItems: 'center', justifyContent: 'center', overflow: 'hidden' }}>
        {hasSelection ? (
          <div style={{ width: '100%', height: '100%', padding: '16px' }}>
            <PerformanceTrendChart 
              trainingType={tab} 
              rawUnified={rawUnified} 
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
