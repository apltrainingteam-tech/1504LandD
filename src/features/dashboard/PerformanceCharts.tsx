import React, { useState, useMemo, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { 
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer, 
  LineChart, Line, AreaChart, Area, ComposedChart, Cell, PieChart, Pie
} from 'recharts';
import { 
  BarChart3, TrendingUp, Users, Target, ChevronRight, ChevronDown, Filter, 
  Maximize2, LayoutGrid, ListOrdered, Download, Calendar
} from 'lucide-react';
import { Employee } from '../../types/employee';
import { Attendance, TrainingScore, TrainingNomination, Demographics, TrainingType } from '../../types/attendance';
import { 
  buildUnifiedDataset, applyFilters, normalizeTrainingType,
  calcIP, calcAP, calcMIP, calcRefresher, calcCapsule,
  getPrimaryMetricRaw
} from '../../services/reportService';
import { getFiscalMonths, getCurrentFY } from '../../utils/fiscalYear';
import { useMasterData } from '../../context/MasterDataContext';
import { GlobalFilterPanel } from '../../components/GlobalFilterPanel';
import { GlobalFilters, getActiveFilterCount } from '../../context/filterContext';
import { useFilterOptions, useMonthsFromData } from '../../utils/computationHooks';
import { normalizeScore } from '../../utils/scoreNormalizer';

interface PerformanceChartsProps {
  employees: Employee[];
  attendance: Attendance[];
  scores: TrainingScore[];
  nominations: TrainingNomination[];
  demographics: Demographics[];
  onNavigate?: (view: any) => void;
}

const ALL_TRAINING_TYPES = ['IP', 'AP', 'MIP', 'Refresher', 'Capsule', 'PRE_AP'];

export const PerformanceCharts: React.FC<PerformanceChartsProps> = ({
  employees, attendance, scores, nominations, demographics, onNavigate
}) => {
  const { teams: masterTeams, clusters: masterClusters, trainers: masterTrainers } = useMasterData();
  const [tab, setTab] = useState<string>('IP');
  const [selectedFY, setSelectedFY] = useState<string>(getCurrentFY());
  const [expandedClusters, setExpandedClusters] = useState<Set<string>>(new Set());
  
  // Filter state
  const [pageFilters, setPageFilters] = useState<GlobalFilters>({ cluster: '', team: '', trainer: '', month: '' });
  const [showGlobalFilters, setShowGlobalFilters] = useState(false);
  const activeFilterCount = getActiveFilterCount(pageFilters);

  const MONTHS = useMemo(() => getFiscalMonths(selectedFY), [selectedFY]);

  // Build unified dataset
  const rawUnified = useMemo(() => {
    const normalizedTab = normalizeTrainingType(tab);
    const att = attendance.filter(a => normalizeTrainingType(a.trainingType) === normalizedTab);
    const scs = scores.filter(s => normalizeTrainingType(s.trainingType) === normalizedTab);
    const noms = nominations.filter(n => normalizeTrainingType(n.trainingType) === normalizedTab);
    
    return buildUnifiedDataset(employees, att, scs, noms, [], masterTeams);
  }, [tab, attendance, scores, nominations, employees, masterTeams]);

  const unified = useMemo(() => {
    const filter = {
      monthFrom: pageFilters.month || '',
      monthTo: pageFilters.month || '',
      teams: pageFilters.team ? [pageFilters.team] : [],
      clusters: pageFilters.cluster ? [pageFilters.cluster] : [],
      trainer: pageFilters.trainer || ''
    };
    let ds = applyFilters(rawUnified, filter, masterTeams);
    return ds.filter(r => {
      const m = r.attendance.month || (r.attendance.attendanceDate || '').substring(0, 7);
      return MONTHS.includes(m);
    });
  }, [rawUnified, pageFilters, MONTHS, masterTeams]);

  // --- DATA TRANSFORMATIONS FOR CHARTS ---

  // 1. Distribution Data (Stacked Bar)
  const distributionData = useMemo(() => {
    const monthMap: Record<string, any> = {};
    MONTHS.forEach(m => {
      monthMap[m] = { month: m, label: m.split('-')[1], Elite: 0, High: 0, Medium: 0, Low: 0 };
    });

    unified.forEach(r => {
      const m = r.attendance.month || (r.attendance.attendanceDate || '').substring(0, 7);
      if (monthMap[m]) {
        const s = normalizeScore(
          r.score?.scores?.['percent'] ?? 
          r.score?.scores?.['Percent'] ??
          r.score?.scores?.['tScore'] ?? 
          r.score?.scores?.['T Score'] ??
          r.score?.scores?.['score'] ?? 
          r.score?.scores?.['Score'] ??
          r.score?.scores?.['scienceScore']
        );

        if (s !== null) {
          if (s >= 90) monthMap[m].Elite++;
          else if (s >= 75) monthMap[m].High++;
          else if (s >= 50) monthMap[m].Medium++;
          else monthMap[m].Low++;
        }
      }
    });

    return MONTHS.map(m => monthMap[m]);
  }, [unified, MONTHS]);

  // 2. Ranking Data (Horizontal Bar)
  const rankingData = useMemo(() => {
    const teamMap: Record<string, { name: string, sum: number, count: number }> = {};
    unified.forEach(r => {
      const team = r.employee.team;
      if (!teamMap[team]) teamMap[team] = { name: team, sum: 0, count: 0 };
      
      const metric = getPrimaryMetricRaw([r], tab);
      if (metric > 0) {
        teamMap[team].sum += metric;
        teamMap[team].count++;
      }
    });

    return Object.values(teamMap)
      .map(t => ({ name: t.name, score: t.count > 0 ? Math.round(t.sum / t.count * 10) / 10 : 0 }))
      .sort((a, b) => b.score - a.score)
      .slice(0, 15); // Show top 15
  }, [unified, tab]);

  // 3. Trend Data (Multi-line)
  const trendData = useMemo(() => {
    const clusters = Array.from(new Set(unified.map(r => r.employee.cluster))).sort();
    const data = MONTHS.map(m => {
      const row: any = { month: m, label: m.split('-')[1] };
      clusters.forEach(c => {
        const clusterRecs = unified.filter(r => r.employee.cluster === c && (r.attendance.month || (r.attendance.attendanceDate || '').substring(0, 7)) === m);
        row[c] = clusterRecs.length > 0 ? Math.round(getPrimaryMetricRaw(clusterRecs, tab) * 10) / 10 : null;
      });
      return row;
    });
    return { data, clusters };
  }, [unified, MONTHS, tab]);

  // 4. Cluster Dashboard Data
  const clusterDashboardData = useMemo(() => {
    const clusters = Array.from(new Set(unified.map(r => r.employee.cluster))).sort();
    return clusters.map(c => {
      const clusterRecs = unified.filter(r => r.employee.cluster === c);
      const teams = Array.from(new Set(clusterRecs.map(r => r.employee.team))).sort();
      
      const sparklineData = MONTHS.map(m => {
        const monthRecs = clusterRecs.filter(r => (r.attendance.month || (r.attendance.attendanceDate || '').substring(0, 7)) === m);
        return { month: m, score: monthRecs.length > 0 ? getPrimaryMetricRaw(monthRecs, tab) : null };
      });

      const teamData = teams.map(t => {
        const teamRecs = clusterRecs.filter(r => r.employee.team === t);
        return {
          name: t,
          score: Math.round(getPrimaryMetricRaw(teamRecs, tab) * 10) / 10,
          count: teamRecs.length
        };
      });

      return {
        name: c,
        score: Math.round(getPrimaryMetricRaw(clusterRecs, tab) * 10) / 10,
        count: clusterRecs.length,
        sparklineData,
        teams: teamData
      };
    });
  }, [unified, MONTHS, tab]);

  const toggleCluster = (clusterName: string) => {
    setExpandedClusters(prev => {
      const next = new Set(prev);
      if (next.has(clusterName)) next.delete(clusterName);
      else next.add(clusterName);
      return next;
    });
  };

  const { allTeams, allTrainers } = useFilterOptions(employees, attendance, tab, masterTeams, masterTrainers);
  const allClusters = useMemo(() => masterClusters.map(c => c.name), [masterClusters]);
  const monthsOptions = useMonthsFromData(rawUnified);

  return (
    <div className="performance-charts animate-fade-in">
      {/* Header & Controls */}
      <div className="flex-between mb-6">
        <div>
          <h1 className="text-2xl font-bold">Performance Analytics</h1>
          <p className="text-muted text-sm">Visualizing training effectiveness and team rankings</p>
        </div>
        
        <div className="flex-center gap-4">
          <div className="flex-center gap-2 glass-panel p-1 rounded-lg">
            {ALL_TRAINING_TYPES.map(t => (
              <button 
                key={t} 
                onClick={() => setTab(t)} 
                className={`px-4 py-1.5 rounded-md text-xs font-semibold transition-all ${tab === t ? 'bg-primary text-white shadow-lg' : 'hover:bg-white/5 text-muted'}`}
              >
                {t}
              </button>
            ))}
          </div>

          <button 
            className={`btn btn-secondary ${activeFilterCount > 0 ? 'active' : ''}`}
            onClick={() => setShowGlobalFilters(true)}
          >
            <Filter size={16} className="mr-2" />
            Filters {activeFilterCount > 0 && `(${activeFilterCount})`}
          </button>
          
          <button className="btn btn-secondary">
            <Download size={16} />
          </button>
        </div>
      </div>

      {/* Main Dashboard Grid */}
      <div className="grid grid-cols-12 gap-6">
        
        {/* KPI Row */}
        <div className="col-span-12 grid grid-cols-1 md:grid-cols-4 gap-4 mb-2">
          <KPICard title="Total Trained" value={unified.length} icon={<Users size={20} />} color="var(--primary)" />
          <KPICard title="Avg Performance" value={`${Math.round(getPrimaryMetricRaw(unified, tab) * 10) / 10}%`} icon={<TrendingUp size={20} />} color="var(--success)" />
          <KPICard title="Top Cluster" value={clusterDashboardData.sort((a, b) => b.score - a.score)[0]?.name || '—'} icon={<Target size={20} />} color="var(--warning)" />
          <KPICard title="Active Teams" value={new Set(unified.map(r => r.employee.team)).size} icon={<LayoutGrid size={20} />} color="var(--accent-primary)" />
        </div>

        {/* Distribution Chart (Stacked Bar) */}
        <div className="col-span-12 lg:col-span-7 glass-panel p-6" style={{ minHeight: '400px' }}>
          <div className="flex-between mb-6">
            <h3 className="font-bold flex-center gap-2">
              <BarChart3 size={18} className="text-primary" />
              Performance Distribution
            </h3>
            <div className="text-xs text-muted flex gap-4">
              <span className="flex-center gap-1"><div className="w-2 h-2 rounded-full bg-[#22c55e]" /> Elite</span>
              <span className="flex-center gap-1"><div className="w-2 h-2 rounded-full bg-[#3b82f6]" /> High</span>
              <span className="flex-center gap-1"><div className="w-2 h-2 rounded-full bg-[#f59e0b]" /> Medium</span>
              <span className="flex-center gap-1"><div className="w-2 h-2 rounded-full bg-[#ef4444]" /> Low</span>
            </div>
          </div>
          <div className="h-[320px] w-full">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={distributionData} margin={{ top: 10, right: 10, left: -20, bottom: 0 }}>
                <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="rgba(255,255,255,0.05)" />
                <XAxis dataKey="label" axisLine={false} tickLine={false} tick={{ fill: 'var(--text-secondary)', fontSize: 12 }} />
                <YAxis axisLine={false} tickLine={false} tick={{ fill: 'var(--text-secondary)', fontSize: 12 }} />
                <Tooltip 
                  cursor={{ fill: 'rgba(255,255,255,0.05)' }}
                  contentStyle={{ backgroundColor: 'var(--bg-card)', border: '1px solid var(--border-color)', borderRadius: '8px' }}
                />
                <Bar dataKey="Elite" stackId="a" fill="#22c55e" radius={[0, 0, 0, 0]} />
                <Bar dataKey="High" stackId="a" fill="#3b82f6" />
                <Bar dataKey="Medium" stackId="a" fill="#f59e0b" />
                <Bar dataKey="Low" stackId="a" fill="#ef4444" radius={[4, 4, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </div>

        {/* Ranking Chart (Horizontal Bar) */}
        <div className="col-span-12 lg:col-span-5 glass-panel p-6" style={{ minHeight: '400px' }}>
          <h3 className="font-bold flex-center gap-2 mb-6">
            <ListOrdered size={18} className="text-warning" />
            Top 15 Teams by Score
          </h3>
          <div className="h-[320px] w-full">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart layout="vertical" data={rankingData} margin={{ top: 5, right: 30, left: 40, bottom: 5 }}>
                <CartesianGrid strokeDasharray="3 3" horizontal={false} stroke="rgba(255,255,255,0.05)" />
                <XAxis type="number" hide />
                <YAxis 
                  dataKey="name" 
                  type="category" 
                  axisLine={false} 
                  tickLine={false} 
                  tick={{ fill: 'var(--text-primary)', fontSize: 11, fontWeight: 500 }}
                  width={100}
                />
                <Tooltip 
                  cursor={{ fill: 'rgba(255,255,255,0.05)' }}
                  contentStyle={{ backgroundColor: 'var(--bg-card)', border: '1px solid var(--border-color)', borderRadius: '8px' }}
                />
                <Bar dataKey="score" fill="var(--primary)" radius={[0, 4, 4, 0]} barSize={16}>
                  {rankingData.map((entry, index) => (
                    <Cell key={`cell-${index}`} fill={index < 3 ? 'var(--success)' : 'var(--primary)'} opacity={1 - (index * 0.04)} />
                  ))}
                </Bar>
              </BarChart>
            </ResponsiveContainer>
          </div>
        </div>

        {/* Trend Chart (Multi-line) */}
        <div className="col-span-12 glass-panel p-6" style={{ minHeight: '400px' }}>
          <h3 className="font-bold flex-center gap-2 mb-6">
            <TrendingUp size={18} className="text-accent-primary" />
            Cluster Performance Trends
          </h3>
          <div className="h-[320px] w-full">
            <ResponsiveContainer width="100%" height="100%">
              <LineChart data={trendData.data} margin={{ top: 10, right: 30, left: 0, bottom: 0 }}>
                <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="rgba(255,255,255,0.05)" />
                <XAxis dataKey="label" axisLine={false} tickLine={false} tick={{ fill: 'var(--text-secondary)', fontSize: 12 }} />
                <YAxis axisLine={false} tickLine={false} tick={{ fill: 'var(--text-secondary)', fontSize: 12 }} domain={[0, 100]} />
                <Tooltip 
                  contentStyle={{ backgroundColor: 'var(--bg-card)', border: '1px solid var(--border-color)', borderRadius: '8px' }}
                />
                <Legend iconType="circle" />
                {trendData.clusters.map((cluster, i) => (
                  <Line 
                    key={cluster} 
                    type="monotone" 
                    dataKey={cluster} 
                    stroke={`hsl(${i * 137.5 % 360}, 70%, 60%)`} 
                    strokeWidth={3}
                    dot={{ r: 4, strokeWidth: 2, fill: 'var(--bg-card)' }}
                    activeDot={{ r: 6, strokeWidth: 0 }}
                  />
                ))}
              </LineChart>
            </ResponsiveContainer>
          </div>
        </div>

        {/* Cluster Dashboard (Expandable Rows) */}
        <div className="col-span-12 glass-panel overflow-hidden">
          <div className="p-6 border-b border-white/5 bg-white/[0.02] flex-between">
            <h3 className="font-bold flex-center gap-2">
              <LayoutGrid size={18} className="text-primary" />
              Cluster-Team Intelligence Hub
            </h3>
            <span className="text-xs text-muted">Click a cluster to explore team-level data</span>
          </div>
          <div className="overflow-x-auto">
            <table className="w-full text-left">
              <thead>
                <tr className="bg-white/5 text-xs font-bold text-muted uppercase tracking-wider">
                  <th className="px-6 py-4 w-12"></th>
                  <th className="px-6 py-4">Cluster Name</th>
                  <th className="px-6 py-4">Volume</th>
                  <th className="px-6 py-4">Avg Score</th>
                  <th className="px-6 py-4 w-48">9-Month Trend</th>
                  <th className="px-6 py-4 text-right">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-white/5">
                {clusterDashboardData.map((cluster) => (
                  <React.Fragment key={cluster.name}>
                    <tr 
                      className={`hover:bg-white/[0.03] transition-colors cursor-pointer ${expandedClusters.has(cluster.name) ? 'bg-white/[0.02]' : ''}`}
                      onClick={() => toggleCluster(cluster.name)}
                    >
                      <td className="px-6 py-4">
                        {expandedClusters.has(cluster.name) ? <ChevronDown size={18} /> : <ChevronRight size={18} />}
                      </td>
                      <td className="px-6 py-4">
                        <div className="font-bold text-lg">{cluster.name}</div>
                        <div className="text-xs text-muted">{cluster.teams.length} teams active</div>
                      </td>
                      <td className="px-6 py-4">
                        <div className="text-lg font-medium">{cluster.count}</div>
                        <div className="text-xs text-muted">trainings</div>
                      </td>
                      <td className="px-6 py-4">
                        <div className={`text-lg font-bold ${cluster.score >= 80 ? 'text-success' : cluster.score >= 60 ? 'text-warning' : 'text-danger'}`}>
                          {cluster.score}%
                        </div>
                      </td>
                      <td className="px-6 py-4">
                        <div className="w-full" style={{ height: '48px' }}>
                          <ResponsiveContainer width="100%" height="100%">
                            <AreaChart data={cluster.sparklineData}>
                              <defs>
                                <linearGradient id={`grad-${cluster.name}`} x1="0" y1="0" x2="0" y2="1">
                                  <stop offset="5%" stopColor="var(--primary)" stopOpacity={0.3}/>
                                  <stop offset="95%" stopColor="var(--primary)" stopOpacity={0}/>
                                </linearGradient>
                              </defs>
                              <Area 
                                type="monotone" 
                                dataKey="score" 
                                stroke="var(--primary)" 
                                strokeWidth={2} 
                                fillOpacity={1} 
                                fill={`url(#grad-${cluster.name})`} 
                              />
                            </AreaChart>
                          </ResponsiveContainer>
                        </div>
                      </td>
                      <td className="px-6 py-4 text-right">
                        <button className="p-2 hover:bg-white/10 rounded-full transition-colors text-primary">
                          <Maximize2 size={16} />
                        </button>
                      </td>
                    </tr>
                    
                    {/* Expanded Teams View */}
                    <AnimatePresence>
                      {expandedClusters.has(cluster.name) && (
                        <motion.tr
                          initial={{ opacity: 0, height: 0 }}
                          animate={{ opacity: 1, height: 'auto' }}
                          exit={{ opacity: 0, height: 0 }}
                        >
                          <td colSpan={6} className="px-12 py-0 bg-black/20">
                            <div className="py-4 grid grid-cols-1 md:grid-cols-3 gap-4">
                              {cluster.teams.map(team => (
                                <div 
                                  key={team.name} 
                                  className="glass-panel p-4 border-white/5 flex-between hover:border-primary/30 transition-all group cursor-pointer"
                                  onClick={(e) => {
                                    e.stopPropagation();
                                    onNavigate?.('performance-tables');
                                  }}
                                >
                                  <div>
                                    <div className="text-sm font-bold group-hover:text-primary transition-colors">{team.name}</div>
                                    <div className="text-xs text-muted">{team.count} records</div>
                                  </div>
                                  <div className={`text-lg font-bold ${team.score >= 80 ? 'text-success' : team.score >= 60 ? 'text-warning' : 'text-danger'}`}>
                                    {team.score}%
                                  </div>
                                </div>
                              ))}
                            </div>
                          </td>
                        </motion.tr>
                      )}
                    </AnimatePresence>
                  </React.Fragment>
                ))}
              </tbody>
            </table>
          </div>
        </div>

      </div>

      <GlobalFilterPanel
        isOpen={showGlobalFilters}
        onClose={() => setShowGlobalFilters(false)}
        onApply={(f) => setPageFilters(f)}
        initialFilters={pageFilters}
        clusterOptions={allClusters}
        teamOptions={allTeams}
        trainerOptions={allTrainers}
        monthOptions={monthsOptions}
        onClearAll={() => setPageFilters({ cluster: '', team: '', trainer: '', month: '' })}
      />
    </div>
  );
};

// --- Sub Components ---

const KPICard = ({ title, value, icon, color }: { title: string, value: string | number, icon: React.ReactNode, color: string }) => (
  <div className="glass-panel p-5 relative overflow-hidden group hover:scale-[1.02] transition-all duration-300">
    <div className="flex-between relative z-10">
      <div>
        <p className="text-xs font-bold text-muted uppercase tracking-wider mb-1">{title}</p>
        <h4 className="text-2xl font-bold">{value}</h4>
      </div>
      <div 
        className="p-3 rounded-xl transition-all duration-300 group-hover:rotate-12"
        style={{ backgroundColor: `${color}15`, color: color }}
      >
        {icon}
      </div>
    </div>
    <div 
      className="absolute -bottom-4 -right-4 w-24 h-24 blur-2xl opacity-10 rounded-full"
      style={{ backgroundColor: color }}
    />
  </div>
);
