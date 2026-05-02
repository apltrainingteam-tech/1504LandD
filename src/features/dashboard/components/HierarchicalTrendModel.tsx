import React, { useMemo } from 'react';
import { 
  XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, 
  LineChart, Line, Legend, AreaChart, Area
} from 'recharts';
import { 
  TrendingUp, Users, Trophy, Target, ArrowUpRight, ArrowDownRight,
  Activity, LayoutGrid, Info
} from 'lucide-react';
import { motion } from 'framer-motion';

import styles from '../PerformanceCharts.module.css';

interface HierarchicalTrendModelProps {
  tab: string;
  selectedFY: string;
  resolutionLevel: 'Global' | 'Cluster' | 'Team';
  timeSeries: any[];
  ranked: any[];
  gapMetrics: any;
  activeNT: string;
  MONTHS: string[];
  filters: any;
  masterTeams: any[];
}

export const HierarchicalTrendModel: React.FC<HierarchicalTrendModelProps> = ({
  tab,
  selectedFY,
  resolutionLevel,
  timeSeries = [],
  ranked = [],
  gapMetrics,
  activeNT,
  MONTHS = [],
  filters,
  masterTeams
}) => {
  // 1. Prepare Benchmark Trend (Average of all visible nodes)
  const benchmarkData = useMemo(() => {
    if (!Array.isArray(MONTHS)) return [];
    return MONTHS.map(month => {
      let total = 0;
      let count = 0;
      timeSeries.forEach(series => {
        if (series.cells && series.cells[month] !== undefined && series.cells[month] !== null) {
          total += series.cells[month];
          count++;
        }
      });
      return {
        month,
        avg: count > 0 ? Math.round(total / count) : null
      };
    });
  }, [timeSeries, MONTHS]);

  // 2. Prepare Dual Line Data
  // Line 1: Benchmark (Global/Cluster Avg)
  // Line 2: Current Selection (If specific team/cluster selected) or Top Performer (if All selected)
  const dualLineData = useMemo(() => {
    if (!Array.isArray(MONTHS)) return [];
    const safeFilters = filters || { teams: [], clusters: [] };
    const isSpecificSelected = (safeFilters.teams?.length || 0) > 0 || (safeFilters.clusters?.length || 0) > 0;
    
    // Resolve selected team names from IDs
    const selectedTeamNames = (safeFilters.teams || []).map((id: string) => (masterTeams || []).find(t => t.id === id)?.teamName).filter(Boolean);

    // Build a map of team names to their clusters for quick lookup
    const teamToClusterMap = new Map<string, string>();
    (masterTeams || []).forEach(t => {
      teamToClusterMap.set(t.teamName, t.cluster || 'Others');
    });

    return MONTHS.map((month, idx) => {
      let selectionValue: number | null = null;
      
      if (isSpecificSelected) {
        // Aggregate selected nodes
        let total = 0;
        let count = 0;
        timeSeries.forEach(series => {
          const teamCluster = teamToClusterMap.get(series.label);
          const isSelected = selectedTeamNames.includes(series.label) || 
                            (safeFilters.clusters || []).includes(series.label) ||
                            (teamCluster && (safeFilters.clusters || []).includes(teamCluster));

          if (isSelected && series.cells && series.cells[month] !== undefined && series.cells[month] !== null) {
            total += series.cells[month];
            count++;
          }
        });
        selectionValue = count > 0 ? Math.round(total / count) : null;
      } else {
        // Use top performer trend if nothing specific selected
        const topNode = ranked[0];
        const series = timeSeries.find(s => s.label === topNode?.key);
        selectionValue = series?.cells ? (series.cells[month] || null) : null;
      }

      return {
        month,
        benchmark: benchmarkData[idx]?.avg || null,
        selection: selectionValue
      };
    });
  }, [MONTHS, benchmarkData, timeSeries, filters, ranked, masterTeams]);

  const selectionLabel = useMemo(() => {
    const safeFilters = filters || { teams: [], clusters: [] };
    if ((safeFilters.teams?.length || 0) === 1) {
      const team = (masterTeams || []).find(t => t.id === safeFilters.teams[0]);
      return `Team: ${team?.teamName || 'Selected'}`;
    }
    if ((safeFilters.clusters?.length || 0) === 1) return `Cluster: ${safeFilters.clusters[0]}`;
    if ((safeFilters.teams?.length || 0) > 1 || (safeFilters.clusters?.length || 0) > 1) return 'Mixed Selection';
    return `Top Performer: ${ranked[0]?.key || 'N/A'}`;
  }, [filters, ranked, masterTeams]);

  // 3. Child Sparklines
  const childNodes = useMemo(() => {
    if (!Array.isArray(MONTHS)) return [];
    return timeSeries.map(series => {
      const sparklineData = MONTHS.map(month => ({
        month,
        value: series.cells ? (series.cells[month] || 0) : 0
      }));
      const currentScore = Math.round(ranked.find(r => r.key === series.label)?.metric || 0);
      return { name: series.label, currentScore, data: sparklineData };
    }).sort((a, b) => b.currentScore - a.currentScore);
  }, [timeSeries, MONTHS, ranked]);

  const hasSelection = dualLineData && dualLineData.length > 0 && dualLineData.some(d => d.selection !== null || d.benchmark !== null);

  return (
    <div style={{ backgroundColor: '#FFFFFF', border: '1px solid #E4E8F0', borderRadius: '12px', height: '520px', padding: '16px', boxShadow: '0 1px 3px 0 rgba(0, 0, 0, 0.1), 0 1px 2px 0 rgba(0, 0, 0, 0.06)' }}>
      <div style={{ width: '100%', height: '100%', backgroundColor: '#F8FAFF', borderRadius: '8px', display: 'flex', alignItems: 'center', justifyContent: 'center', overflow: 'hidden' }}>
        {hasSelection ? (
          <div style={{ width: '100%', height: '100%', padding: '16px' }}>
            <ResponsiveContainer width="100%" height="100%">
              <LineChart data={dualLineData} margin={{ top: 20, right: 30, left: 0, bottom: 10 }}>
                <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#E4E8F0" />
                <XAxis 
                  dataKey="month" 
                  axisLine={false} 
                  tickLine={false} 
                  tick={{ fill: '#64748b', fontSize: 10, fontWeight: 600 }}
                />
                <YAxis 
                  axisLine={false} 
                  tickLine={false} 
                  tick={{ fill: '#64748b', fontSize: 10, fontWeight: 600 }}
                  domain={[0, 100]}
                />
                <Tooltip 
                  contentStyle={{ 
                    backgroundColor: '#FFFFFF', 
                    border: '1px solid #E4E8F0', 
                    borderRadius: '8px',
                    boxShadow: '0 4px 6px -1px rgba(0, 0, 0, 0.1)',
                    fontSize: '12px'
                  }} 
                />
                <Legend 
                  verticalAlign="top" 
                  align="right" 
                  height={30}
                  iconType="circle"
                  wrapperStyle={{ fontSize: '10px', fontWeight: '700', textTransform: 'uppercase' }}
                />
                <Line 
                  name="Benchmark (Avg)" 
                  type="monotone" 
                  dataKey="benchmark" 
                  stroke="#94a3b8" 
                  strokeWidth={2}
                  strokeDasharray="5 5"
                  dot={{ r: 3, fill: '#fff', strokeWidth: 1.5 }}
                  activeDot={{ r: 5 }}
                />
                <Line 
                  name="Selection" 
                  type="monotone" 
                  dataKey="selection" 
                  stroke="#3b82f6" 
                  strokeWidth={3}
                  dot={{ r: 4, fill: '#3b82f6', strokeWidth: 1.5, stroke: '#fff' }}
                  activeDot={{ r: 6 }}
                />
              </LineChart>
            </ResponsiveContainer>
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

