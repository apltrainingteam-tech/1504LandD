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
  timeSeries,
  ranked,
  gapMetrics,
  activeNT,
  MONTHS,
  filters,
  masterTeams
}) => {
  // 0. Safeguard: Move empty check to top and handle missing ranked data
  if (timeSeries.length === 0 || !ranked || ranked.length === 0) {
    return (
      <div className="glass-panel p-40 text-center">
        <Activity size={48} className="text-muted mb-16 opacity-20" />
        <h3 className="text-muted">No Performance Data</h3>
        <p className="text-subtitle">Adjust filters or select a different hierarchy to see trends.</p>
      </div>
    );
  }

  // 1. Prepare Benchmark Trend (Average of all visible nodes)
  const benchmarkData = useMemo(() => {
    return MONTHS.map(month => {
      let total = 0;
      let count = 0;
      timeSeries.forEach(series => {
        if (series.cells[month] !== undefined && series.cells[month] !== null) {
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
    const isSpecificSelected = filters.teams.length > 0 || filters.clusters.length > 0;
    
    // Resolve selected team names from IDs
    const selectedTeamNames = filters.teams.map((id: string) => masterTeams.find(t => t.id === id)?.teamName).filter(Boolean);

    // Build a map of team names to their clusters for quick lookup
    const teamToClusterMap = new Map<string, string>();
    masterTeams.forEach(t => {
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
                            filters.clusters.includes(series.label) ||
                            (teamCluster && filters.clusters.includes(teamCluster));

          if (isSelected && series.cells[month] !== undefined && series.cells[month] !== null) {
            total += series.cells[month];
            count++;
          }
        });
        selectionValue = count > 0 ? Math.round(total / count) : null;
      } else {
        // Use top performer trend if nothing specific selected
        const topNode = ranked[0];
        const series = timeSeries.find(s => s.label === topNode?.key);
        selectionValue = series?.cells[month] || null;
      }

      return {
        month,
        benchmark: benchmarkData[idx].avg,
        selection: selectionValue
      };
    });
  }, [MONTHS, benchmarkData, timeSeries, filters, ranked, masterTeams]);

  const selectionLabel = useMemo(() => {
    if (filters.teams.length === 1) {
      const team = masterTeams.find(t => t.id === filters.teams[0]);
      return `Team: ${team?.teamName || 'Selected'}`;
    }
    if (filters.clusters.length === 1) return `Cluster: ${filters.clusters[0]}`;
    if (filters.teams.length > 1 || filters.clusters.length > 1) return 'Mixed Selection';
    return `Top Performer: ${ranked[0]?.key || 'N/A'}`;
  }, [filters, ranked, masterTeams]);

  // 3. Child Sparklines
  const childNodes = useMemo(() => {
    return timeSeries.map(series => {
      const sparklineData = MONTHS.map(month => ({
        month,
        value: series.cells[month]
      }));
      const currentScore = Math.round(ranked.find(r => r.key === series.label)?.metric || 0);
      return { name: series.label, currentScore, data: sparklineData };
    }).sort((a, b) => b.currentScore - a.currentScore);
  }, [timeSeries, MONTHS, ranked]);

  return (
    <div className="glass-panel overflow-hidden bg-white">
      {/* HEADER & CONTROLS */}
      <div className="p-20 border-bottom flex justify-between items-center bg-slate-50/50">
        <div className="flex items-center gap-12">
          <div className="p-8 rounded-lg bg-primary-subtle text-primary">
            <TrendingUp size={18} />
          </div>
          <div>
            <h3 className="m-0 text-base font-bold">Dual Line Trend Analysis</h3>
            <p className="m-0 text-xs text-secondary font-medium uppercase tracking-wider">
              {selectionLabel} vs {resolutionLevel} Average
            </p>
          </div>
        </div>
        <div className="flex items-center gap-12 text-xs font-bold text-secondary uppercase bg-white px-12 py-6 rounded-full border">
          <Activity size={14} className="text-primary" />
          <span>FY {selectedFY}</span>
        </div>
      </div>

      {/* KPI ROW - INTEGRATED */}
      <div className="grid grid-cols-1 md:grid-cols-3 border-bottom divide-x divide-slate-100">
        <div className="p-20 flex items-center gap-12">
          <div className="w-40 h-40 rounded-lg bg-success-subtle flex-center text-success">
            <Trophy size={20} />
          </div>
          <div>
            <div className="text-[10px] font-bold text-secondary uppercase tracking-widest">Selected Score</div>
            <div className="text-xl font-bold text-primary">
              {dualLineData.length > 0 ? (dualLineData[dualLineData.length - 1]?.selection ?? '—') : '—'}%
            </div>
          </div>
        </div>
        <div className="p-20 flex items-center gap-12">
          <div className="w-40 h-40 rounded-lg bg-primary-subtle flex-center text-primary">
            <Activity size={20} />
          </div>
          <div>
            <div className="text-[10px] font-bold text-secondary uppercase tracking-widest">Bench Variance</div>
            <div className={`text-xl font-bold ${
              dualLineData.length > 0 && (dualLineData[dualLineData.length - 1]?.selection ?? 0) >= (dualLineData[dualLineData.length - 1]?.benchmark ?? 0) 
              ? 'text-success' : 'text-danger'
            }`}>
              {dualLineData.length > 0 ? Math.round((dualLineData[dualLineData.length - 1]?.selection ?? 0) - (dualLineData[dualLineData.length - 1]?.benchmark ?? 0)) : 0}%
            </div>
          </div>
        </div>
        <div className="p-20 flex items-center gap-12">
          <div className="w-40 h-40 rounded-lg bg-warning-subtle flex-center text-warning">
            <Users size={20} />
          </div>
          <div>
            <div className="text-[10px] font-bold text-secondary uppercase tracking-widest">Total Nodes</div>
            <div className="text-xl font-bold text-primary">{ranked.length}</div>
          </div>
        </div>
      </div>
      
      {/* CHART AREA */}
      <div className="p-24 h-[500px]">
        {dualLineData.some(d => d.selection !== null || d.benchmark !== null) ? (
          <ResponsiveContainer width="100%" height="100%">
            <LineChart data={dualLineData} margin={{ top: 10, right: 10, left: -20, bottom: 0 }}>
              <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#E4E8F0" />
              <XAxis 
                dataKey="month" 
                axisLine={false} 
                tickLine={false} 
                tick={{ fill: '#64748b', fontSize: 11, fontWeight: 600 }}
                dy={10}
              />
              <YAxis 
                axisLine={false} 
                tickLine={false} 
                tick={{ fill: '#64748b', fontSize: 11, fontWeight: 600 }}
                domain={[0, 100]}
                dx={-10}
              />
              <Tooltip 
                contentStyle={{ 
                  backgroundColor: '#FFFFFF', 
                  border: '1px solid #E4E8F0', 
                  borderRadius: '12px',
                  boxShadow: '0 10px 15px -3px rgba(0, 0, 0, 0.1)',
                  padding: '12px'
                }} 
              />
              <Legend 
                verticalAlign="top" 
                align="right" 
                height={36}
                iconType="circle"
                wrapperStyle={{ paddingBottom: '20px', fontSize: '12px', fontWeight: '700', textTransform: 'uppercase' }}
              />
              <Line 
                name="Benchmark (Avg)" 
                type="monotone" 
                dataKey="benchmark" 
                stroke="#94a3b8" 
                strokeWidth={3}
                strokeDasharray="5 5"
                dot={{ r: 4, fill: '#fff', strokeWidth: 2 }}
                activeDot={{ r: 6 }}
                animationDuration={1000}
              />
              <Line 
                name="Current Selection" 
                type="monotone" 
                dataKey="selection" 
                stroke="#3b82f6" 
                strokeWidth="4"
                dot={{ r: 5, fill: '#3b82f6', strokeWidth: 2, stroke: '#fff' }}
                activeDot={{ r: 8 }}
                animationDuration={1500}
              />
            </LineChart>
          </ResponsiveContainer>
        ) : (
          <div className="w-full h-full flex-center flex-col bg-slate-50/50 rounded-xl border border-dashed border-slate-200">
            <Activity size={40} className="text-slate-300 mb-12" />
            <div className="text-slate-400 font-medium">No trend data available for this selection</div>
            <div className="text-slate-300 text-xs">Try selecting a different cluster or team</div>
          </div>
        )}
      </div>
    </div>
  );
};

