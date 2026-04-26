import React, { useState, useMemo, useEffect, Fragment } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import {
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, Legend,
  LineChart, Line, Cell, PieChart, Pie, ScatterChart, Scatter, ZAxis, ComposedChart
} from 'recharts';
import {
  BarChart3, TrendingUp, Users, Target, Table, Trophy, GraduationCap, AlertTriangle, Calendar, Zap, CheckCircle2, Filter, ListOrdered, Info
} from 'lucide-react';

import { Employee } from '../../types/employee';
import { Attendance, TrainingScore, TrainingNomination, TrainingType, EligibilityRule, Demographics } from '../../types/attendance';
import { getCurrentFYString, getFiscalYears } from '../../core/utils/fiscalYear';
import { useMasterData } from '../../core/context/MasterDataContext';
import { GlobalFilterPanel } from '../../shared/components/ui/GlobalFilterPanel';
import { GlobalFilters, getActiveFilterCount } from '../../core/context/filterContext';
import { useFilterOptions, useMonthsFromData } from '../../shared/hooks/computationHooks';
import { usePerformanceData } from './hooks/usePerformanceData';
import { useChartData } from './hooks/useChartData';

import styles from './PerformanceCharts.module.css';

// --- INTERFACES ---
interface MatrixTeam {
  name: string;
  total: number;
  score: number;
  metrics: Record<string, number>;
  monthly: Record<string, any>;
}

interface MatrixCluster {
  cluster: string;
  teams: MatrixTeam[];
  avgScore: number;
}

interface PerformanceChartsProps {
  employees: Employee[];
  attendance: Attendance[];
  scores: TrainingScore[];
  nominations: TrainingNomination[];
  demographics: Demographics[];
  onNavigate?: (view: any) => void;
}

const ALL_TRAINING_TYPES = ['IP', 'AP', 'MIP', 'Refresher', 'Capsule', 'PRE_AP'];
const FY_OPTIONS = getFiscalYears(2015);

/**
 * Robust Month Normalizer
 */
const normalizeMonthStr = (m: any): string => {
  if (!m) return '';
  let str = String(m).trim();
  if (/^\d{4}-\d{2}/.test(str)) return str.substring(0, 7);
  const monthNames: Record<string, string> = { jan: '01', feb: '02', mar: '03', apr: '04', may: '05', jun: '06', jul: '07', aug: '08', sep: '09', oct: '10', nov: '11', dec: '12' };
  const slashMatch = str.match(/^(\d{1,2})\/(\d{2,4})$/);
  if (slashMatch) {
    let mm = slashMatch[1].padStart(2, '0');
    let yy = slashMatch[2];
    let yyyy = yy.length === 2 ? (parseInt(yy) > 50 ? `19${yy}` : `20${yy}`) : yy;
    return `${yyyy}-${mm}`;
  }
  const wordMatch = str.match(/^([A-Za-z]{3})[-\s](\d{2,4})$/);
  if (wordMatch) {
    let mm = monthNames[wordMatch[1].toLowerCase()] || '00';
    let yy = wordMatch[2];
    let yyyy = yy.length === 2 ? (parseInt(yy) > 50 ? `19${yy}` : `20${yy}`) : yy;
    return `${yyyy}-${mm}`;
  }
  return str;
};

/**
 * Determine Fiscal Year from YYYY-MM
 */
const getFYFromMonth = (month: string): string => {
  if (!month || month.length < 7) return getCurrentFYString();
  const [y, m] = month.split('-').map(Number);
  const startYear = m >= 4 ? y : y - 1;
  return `${startYear}-${String(startYear + 1).slice(-2)}`;
};

export const PerformanceCharts: React.FC<PerformanceChartsProps> = ({
  employees, attendance, scores, nominations, onNavigate
}) => {
  const { teams: masterTeams, clusters: masterClusters, trainers: masterTrainers, eligibilityRules: rules } = useMasterData();
  const [tab, setTab] = useState<string>('IP');
  const [subView, setSubView] = useState<string>('performance');
  const [selectedFY, setSelectedFY] = useState<string>(getCurrentFYString());
  const [pageFilters, setPageFilters] = useState<GlobalFilters>({ cluster: '', team: '', trainer: '', month: '' });
  const [showGlobalFilters, setShowGlobalFilters] = useState(false);
  const activeFilterCount = getActiveFilterCount(pageFilters);
  const [tsMode, setTsMode] = useState<'score' | 'count'>('score');

  // --- SYNC GLOBAL MONTH FILTER WITH FISCAL YEAR SELECTOR ---
  useEffect(() => {
    if (pageFilters.month) {
      const targetFY = getFYFromMonth(normalizeMonthStr(pageFilters.month));
      if (targetFY !== selectedFY) {
        setSelectedFY(targetFY);
      }
    }
  }, [pageFilters.month]);

  const {
    MONTHS,
    activeNT,
    rawUnified,
    unified,
    ipData,
    apAttData,
    mipAttData,
    refresherAttData,
    capsuleAttData,
    apPerfData,
    mipPerfData,
    refresherPerfData,
    capsulePerfData,
    eligibilityResults,
    gapMetrics,
    groups,
    trainerStats,
    months: dataMonths,
    timeSeries
  } = usePerformanceData({
    employees, attendance, scores, nominations, rules, masterTeams,
    tab, selectedFY, filter: {
      monthFrom: pageFilters.month ? normalizeMonthStr(pageFilters.month) : '', 
      monthTo: pageFilters.month ? normalizeMonthStr(pageFilters.month) : '',
      teams: pageFilters.team ? [pageFilters.team] : [],
      clusters: pageFilters.cluster ? [pageFilters.cluster] : [],
      trainer: pageFilters.trainer || ''
    }, viewBy: 'Month', tsMode, pageMode: 'performance-charts'
  });

  const activeAttData = activeNT === 'AP' ? apAttData : activeNT === 'MIP' ? mipAttData : activeNT === 'Refresher' ? refresherAttData : (activeNT === 'Pre_AP' ? apAttData : capsuleAttData);
  const activePerfData = activeNT === 'AP' ? apPerfData : activeNT === 'MIP' ? mipPerfData : activeNT === 'Refresher' ? refresherPerfData : (activeNT === 'Pre_AP' ? apPerfData : capsulePerfData);

  const {
    matrixData,
    kpis,
    distributionData,
    rankingData,
    trendData,
    attFunnelData,
    diagnostics
  } = useChartData({
    tab, activeNT, ipData, activePerfData, activeAttData, MONTHS, normalizedAttendance: attendance, rawUnified, unified
  });

  const tsChartData = useMemo(() => timeSeries.map((r) => ({ label: r.label, ...r.cells })), [timeSeries]);
  const tsKeys = useMemo(() => {
    const keys = new Set<string>();
    timeSeries.forEach((r) => Object.keys(r.cells).forEach(k => keys.add(k)));
    return Array.from(keys);
  }, [timeSeries]);

  const trainerScatterData = useMemo(() => {
    return trainerStats.map((t) => ({ name: t.trainerId, volume: t.trainingsConducted, score: t.avgScore })).sort((a, b) => b.volume - a.volume).slice(0, 30);
  }, [trainerStats]);
  const { allTeams, allTrainers } = useFilterOptions(employees, attendance, tab, masterTeams, masterTrainers);
  const allClusters = useMemo(() => masterClusters.map(c => c.name), [masterClusters]);
  const monthsOptions = useMonthsFromData(rawUnified);

  return (
    <div className={`${styles.chartsContainer} animate-fade-in`}>
      <div className="mb-24">
        <h1 className="text-2xl font-bold m-0">Performance Insights</h1>
        <p className="text-subtitle">Analysis for {tab} Training • {selectedFY}</p>
      </div>

      <div className="flex-between mb-20">
        <div className={styles.subViewNav}>
          <button className={`${styles.subViewBtn} ${subView === 'performance' ? styles.subViewBtnActive : ''}`} onClick={() => setSubView('performance')}><TrendingUp size={14} /> Performance</button>
          {tab !== 'IP' && (
            <button className={`${styles.subViewBtn} ${subView === 'attendance' ? styles.subViewBtnActive : ''}`} onClick={() => setSubView('attendance')}><CheckCircle2 size={14} /> Attendance</button>
          )}
          <button className={`${styles.subViewBtn} ${subView === 'timeseries' ? styles.subViewBtnActive : ''}`} onClick={() => setSubView('timeseries')}><Calendar size={14} /> Trends</button>
          <button className={`${styles.subViewBtn} ${subView === 'trainer' ? styles.subViewBtnActive : ''}`} onClick={() => setSubView('trainer')}><GraduationCap size={14} /> Trainers</button>
          <button className={`${styles.subViewBtn} ${subView === 'gap' ? styles.subViewBtnActive : ''}`} onClick={() => setSubView('gap')}><AlertTriangle size={14} /> Gap Analysis</button>
        </div>

        <div className="flex-center gap-2">
          <button className="btn btn-secondary" onClick={() => onNavigate?.('performance-tables')} title="Switch to Tables"><Table size={16} /></button>
          <div className="v-divider mx-1" />
          <div className="flex-center gap-2 glass-panel px-3 py-1 rounded-lg">
            <Calendar size={14} className="text-primary" />
            <label htmlFor="fy-select-main" className="sr-only">Fiscal Year</label>
            <select 
              id="fy-select-main"
              name="fy-select"
              value={selectedFY} 
              onChange={(e) => {
                setSelectedFY(e.target.value);
                setPageFilters(prev => ({ ...prev, month: '' })); // Clear conflicting month filter
              }} 
              className="form-select border-none bg-transparent font-bold" 
              title="Fiscal Year"
            >
              {FY_OPTIONS.map(fy => <option key={fy} value={fy}>{fy}</option>)}
            </select>
          </div>
          <button className={`btn btn-secondary ${activeFilterCount > 0 ? 'active' : ''}`} onClick={() => setShowGlobalFilters(true)} title="Advanced Filters">
            <Filter size={16} />
            {activeFilterCount > 0 && <span className="text-xs-bold ml-1">{activeFilterCount}</span>}
          </button>
        </div>
      </div>

      <div className="tab-row mb-20">
        {ALL_TRAINING_TYPES.map(t => (
          <button key={t} onClick={() => setTab(t)} className={`btn btn-tab ${tab === t ? 'btn-primary' : 'btn-secondary'}`}>{t}</button>
        ))}
      </div>

      <AnimatePresence mode="wait">
        <motion.div key={`${tab}-${subView}-${selectedFY}`} initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -10 }} transition={{ duration: 0.2 }}>
          
          {subView === 'performance' && (
            <div className={styles.chartGrid}>
              <div className="col-span-12 grid grid-cols-1 md:grid-cols-4 gap-4 mb-4">
                <KPICard title="TOTAL TRAINED" value={kpis.total} icon={<Users size={20} />} colorType="primary" />
                <KPICard title="AVG SCORE" value={kpis.score > 0 ? kpis.score.toFixed(1) : '—'} icon={<Zap size={20} />} colorType="success" />
                <KPICard title="TOP TEAM" value={kpis.best} icon={<Trophy size={20} />} colorType="warning" />
                <KPICard title="LOW TEAM" value={kpis.worst} icon={<AlertTriangle size={20} />} colorType="danger" />
              </div>

              {matrixData.length === 0 ? (
                <div className="col-span-12 glass-panel p-24 text-center">
                  <div className="mb-24 flex-center flex-col">
                    <BarChart3 size={48} className="text-muted mb-4 opacity-20" />
                    <h3 className="text-muted">No Performance Data Found</h3>
                    <p className="text-subtitle max-w-400 mx-auto">No records found for {tab} in FY {selectedFY}. This usually means the scores aren't linking to the attendance or the fiscal year filter is excluding all records.</p>
                  </div>
                  
                  {/* Diagnostics Panel */}
                  <div className="max-w-600 mx-auto glass-panel p-20 text-left bg-warning-subtle border-warning">
                    <div className="flex-center gap-2 mb-12 text-warning">
                      <Info size={18} />
                      <h4 className="m-0 font-bold">Data Diagnostics</h4>
                    </div>
                    <div className="grid grid-cols-2 gap-y-3 text-sm">
                      <span className="text-secondary">Total Matching Type ({diagnostics.activeNT}):</span> <span className="font-mono font-bold">{diagnostics.typeMatched}</span>
                      <span className="text-secondary">Records with Linked Scores (Global):</span> <span className="font-mono font-bold">{diagnostics.hasScoresTotal}</span>
                      <div className="col-span-2 h-px bg-warning opacity-20 my-1" />
                      <span className="text-warning font-bold">Selected Year ({diagnostics.selectedFY}):</span> <span className="font-mono font-bold">{diagnostics.fyMatched}</span>
                      <span className="text-secondary"> - Linked Scores in Year:</span> <span className="font-mono font-bold">{diagnostics.withScoresInFY}</span>
                      <span className="text-secondary"> - Passed Normalization:</span> <span className="font-mono font-bold text-primary">{diagnostics.ipNormalizedCount}</span>
                    </div>
                    <p className="mt-16 text-xs text-secondary italic">If "Linked Scores" is 0 but "Matching Type" is high, check if Training Type names match exactly in both Attendance and Score sheets.</p>
                  </div>
                </div>
              ) : (
                <>
                  <div className={`${styles.chartCard} ${styles.chartCardLarge}`}>
                    <div className={styles.chartHeader}><h3 className={styles.chartTitle}><BarChart3 size={18} className={styles.chartTitleIcon} /> Distribution Profile</h3></div>
                    <div className={styles.vizWrapper}>
                      <div className={styles.chartScrollWrapper}>
                        {tab === 'IP' ? (
                          <BarChart width={1000} height={330} data={distributionData} margin={{ top: 10, right: 10, left: -20, bottom: 0 }}>
                            <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="rgba(255,255,255,0.05)" />
                            <XAxis dataKey="label" axisLine={false} tickLine={false} tick={{ fill: 'var(--text-secondary)', fontSize: 11 }} />
                            <YAxis axisLine={false} tickLine={false} tick={{ fill: 'var(--text-secondary)', fontSize: 11 }} domain={[0, 100]} />
                            <Tooltip cursor={{ fill: 'rgba(255,255,255,0.05)' }} contentStyle={{ backgroundColor: 'var(--bg-card)', border: '1px solid var(--border-color)', borderRadius: '12px' }} />
                            <Legend wrapperStyle={{ paddingTop: '10px' }} />
                            <Bar minPointSize={0} dataKey="Elite" stackId="a" fill="#22c55e" />
                            <Bar minPointSize={0} dataKey="High" stackId="a" fill="#3b82f6" />
                            <Bar minPointSize={0} dataKey="Medium" stackId="a" fill="#f59e0b" />
                            <Bar minPointSize={0} dataKey="Low" stackId="a" fill="#ef4444" />
                          </BarChart>
                        ) : activeNT === 'AP' ? (
                          <BarChart width={1000} height={330} data={distributionData} margin={{ top: 10, right: 10, left: -20, bottom: 0 }}>
                            <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="rgba(255,255,255,0.05)" />
                            <XAxis dataKey="label" axisLine={false} tickLine={false} tick={{ fill: 'var(--text-secondary)', fontSize: 11 }} />
                            <YAxis axisLine={false} tickLine={false} tick={{ fill: 'var(--text-secondary)', fontSize: 11 }} domain={[0, 100]} />
                            <Tooltip cursor={{ fill: 'rgba(255,255,255,0.05)' }} contentStyle={{ backgroundColor: 'var(--bg-card)', border: '1px solid var(--border-color)', borderRadius: '12px' }} />
                            <Legend wrapperStyle={{ paddingTop: '10px' }} />
                            <Bar minPointSize={0} dataKey="Knowledge" fill="#3b82f6" barSize={20} />
                            <Bar minPointSize={0} dataKey="BSE" fill="#22c55e" barSize={20} />
                          </BarChart>
                        ) : (activeNT === 'MIP' || activeNT === 'Refresher') ? (
                          <BarChart width={1000} height={330} data={distributionData} margin={{ top: 10, right: 10, left: -20, bottom: 0 }}>
                            <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="rgba(255,255,255,0.05)" />
                            <XAxis dataKey="label" axisLine={false} tickLine={false} tick={{ fill: 'var(--text-secondary)', fontSize: 11 }} />
                            <YAxis axisLine={false} tickLine={false} tick={{ fill: 'var(--text-secondary)', fontSize: 11 }} domain={[0, 100]} />
                            <Tooltip cursor={{ fill: 'rgba(255,255,255,0.05)' }} contentStyle={{ backgroundColor: 'var(--bg-card)', border: '1px solid var(--border-color)', borderRadius: '12px' }} />
                            <Legend wrapperStyle={{ paddingTop: '10px' }} />
                            <Bar minPointSize={0} dataKey="Science" fill="#8b5cf6" barSize={20} />
                            <Bar minPointSize={0} dataKey="Skill" fill="#06b6d4" barSize={20} />
                          </BarChart>
                        ) : (
                          <BarChart width={1000} height={330} data={distributionData} margin={{ top: 10, right: 10, left: -20, bottom: 0 }}>
                            <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="rgba(255,255,255,0.05)" />
                            <XAxis dataKey="label" axisLine={false} tickLine={false} tick={{ fill: 'var(--text-secondary)', fontSize: 11 }} />
                            <YAxis axisLine={false} tickLine={false} tick={{ fill: 'var(--text-secondary)', fontSize: 11 }} domain={[0, 100]} />
                            <Tooltip cursor={{ fill: 'rgba(255,255,255,0.05)' }} contentStyle={{ backgroundColor: 'var(--bg-card)', border: '1px solid var(--border-color)', borderRadius: '12px' }} />
                            <Legend wrapperStyle={{ paddingTop: '10px' }} />
                            <Bar minPointSize={0} dataKey="Score" fill="#3b82f6" barSize={30} />
                          </BarChart>
                        )}
                      </div>
                    </div>
                  </div>
                  <div className={`${styles.chartCard} ${styles.chartCardSmall}`}>
                    <div className={styles.chartHeader}><h3 className={styles.chartTitle}><ListOrdered size={18} className="text-warning" /> Ranking</h3></div>
                    <div className={styles.vizWrapper}>
                      <div className={styles.chartHiddenOverflow}>
                        <BarChart width={350} height={330} layout="vertical" data={rankingData} margin={{ top: 5, right: 10, left: 20, bottom: 5 }}>
                          <XAxis type="number" hide domain={[0, 100]} /><YAxis dataKey="name" type="category" axisLine={false} tickLine={false} tick={{ fill: 'var(--text-primary)', fontSize: 10 }} width={80} />
                          <Tooltip cursor={{ fill: 'rgba(255,255,255,0.05)' }} contentStyle={{ backgroundColor: 'var(--bg-card)', border: '1px solid var(--border-color)', borderRadius: '12px' }} />
                          <Bar minPointSize={0} dataKey="score" fill="#3b82f6" barSize={14}>
                            {rankingData.map((e, i) => <Cell key={i} fill={i < 3 ? '#22c55e' : i < 7 ? '#3b82f6' : '#f59e0b'} opacity={Math.max(0.5, 1 - (i * 0.04))} />)}
                          </Bar>
                        </BarChart>
                      </div>
                    </div>
                  </div>
                  <div className={`${styles.chartCard} ${styles.chartCardFull}`}>
                    <div className={styles.chartHeader}><h3 className={styles.chartTitle}><TrendingUp size={18} className="text-accent-primary" /> Cluster Benchmarking</h3></div>
                    <div className={styles.vizWrapper}>
                      <div className={styles.chartScrollWrapper}>
                        <LineChart width={1000} height={330} data={trendData.data} margin={{ top: 10, right: 30, left: -20, bottom: 0 }}>
                          <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="rgba(255,255,255,0.05)" />
                          <XAxis dataKey="label" axisLine={false} tickLine={false} tick={{ fill: 'var(--text-secondary)', fontSize: 11 }} />
                          <YAxis axisLine={false} tickLine={false} tick={{ fill: 'var(--text-secondary)', fontSize: 11 }} domain={[0, 100]} />
                          <Tooltip contentStyle={{ backgroundColor: 'var(--bg-card)', border: '1px solid var(--border-color)', borderRadius: '12px' }} /><Legend />
                          {trendData.clusters.map((c, i) => (
                            <Line key={c} type="monotone" dataKey={c} stroke={['#3b82f6', '#22c55e', '#f59e0b', '#ef4444', '#8b5cf6', '#06b6d4'][i % 6]} strokeWidth={3} dot={{ r: 4, strokeWidth: 2, fill: 'var(--bg-card)' }} activeDot={{ r: 6 }} connectNulls />
                          ))}
                        </LineChart>
                      </div>
                    </div>
                  </div>
                </>
              )}
            </div>
          )}

          {subView === 'attendance' && activeAttData && (
             <div className={styles.chartGrid}>
              <div className="col-span-12 grid grid-cols-1 md:grid-cols-3 gap-4 mb-4">
                <KPICard title="NOTIFIED" value={(activeAttData.globalKPIs as any).totalNotified || (activeAttData.globalKPIs as any).totalEmployeesNotified || 0} icon={<Users size={20} />} colorType="primary" />
                <KPICard title="ATTENDED" value={(activeAttData.globalKPIs as any).totalAttended || (activeAttData.globalKPIs as any).totalEmployeesAttended || 0} icon={<CheckCircle2 size={20} />} colorType="success" />
                <KPICard title="ATTENDANCE %" value={`${activeAttData.globalKPIs.attendancePercent.toFixed(1)}%`} icon={<Target size={20} />} colorType="accent" />
              </div>
              <div className={`${styles.chartCard} ${styles.chartCardFull}`}>
                <div className={styles.chartHeader}><h3 className={styles.chartTitle}><BarChart3 size={18} className="text-primary" /> Attendance Funnel Over Time</h3></div>
                <div className={styles.vizWrapper}>
                  <div className={styles.chartScrollWrapper}>
                    <ComposedChart width={1000} height={330} data={attFunnelData}>
                      <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="rgba(255,255,255,0.05)" />
                      <XAxis dataKey="label" axisLine={false} tickLine={false} tick={{ fill: 'var(--text-secondary)', fontSize: 11 }} />
                      <YAxis axisLine={false} tickLine={false} tick={{ fill: 'var(--text-secondary)', fontSize: 11 }} />
                      <Tooltip contentStyle={{ backgroundColor: 'var(--bg-card)', border: '1px solid var(--border-color)', borderRadius: '12px' }} /><Legend />
                      <Bar minPointSize={0} dataKey="Notified" fill="#3b82f6" barSize={40} /><Bar minPointSize={0} dataKey="Attended" fill="#22c55e" barSize={40} />
                    </ComposedChart>
                  </div>
                </div>
              </div>
            </div>
          )}

          {subView === 'gap' && (
            <div className={styles.chartGrid}>
              <div className="col-span-12 grid grid-cols-1 md:grid-cols-3 gap-4 mb-4">
                <KPICard title="ELIGIBLE" value={gapMetrics.eligibleCount} icon={<Users size={20} />} colorType="primary" />
                <KPICard title="TRAINED" value={gapMetrics.trainedCount} icon={<CheckCircle2 size={20} />} colorType="success" />
                <KPICard title="GAP" value={gapMetrics.gapCount} icon={<AlertTriangle size={20} />} colorType="danger" />
              </div>
              <div className={`${styles.chartCard} ${styles.chartCardSmall}`}>
                <div className={styles.chartHeader}><h3 className={styles.chartTitle}>Overall Gap</h3></div>
                <div className={styles.vizWrapper}>
                  <ResponsiveContainer>
                    <PieChart>
                      <Pie data={[{ name: 'Trained', value: gapMetrics.trainedCount }, { name: 'Gap', value: gapMetrics.gapCount }]} cx="50%" cy="50%" innerRadius={60} outerRadius={90} paddingAngle={5} dataKey="value">
                        <Cell fill="#22c55e" /><Cell fill="#ef4444" />
                      </Pie>
                      <Tooltip contentStyle={{ borderRadius: '12px' }} /><Legend />
                    </PieChart>
                  </ResponsiveContainer>
                </div>
              </div>
              <div className={`${styles.chartCard} ${styles.chartCardLarge}`}>
                <div className={styles.chartHeader}><h3 className={styles.chartTitle}>Gap by Cluster</h3></div>
                <div className={styles.vizWrapper}>
                  <ResponsiveContainer>
                    <BarChart data={matrixData.map(c => ({ name: c.cluster, Trained: c.teams.reduce((s, t) => s + t.total, 0) }))}>
                      <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="rgba(255,255,255,0.05)" />
                      <XAxis dataKey="name" axisLine={false} tickLine={false} tick={{ fill: 'var(--text-secondary)', fontSize: 11 }} />
                      <YAxis axisLine={false} tickLine={false} tick={{ fill: 'var(--text-secondary)', fontSize: 11 }} />
                      <Tooltip cursor={{ fill: 'rgba(255,255,255,0.05)' }} contentStyle={{ borderRadius: '12px' }} /><Bar dataKey="Trained" fill="#22c55e" barSize={40} />
                    </BarChart>
                  </ResponsiveContainer>
                </div>
              </div>
            </div>
          )}

          {subView === 'timeseries' && (
            <div className={`${styles.chartCard} ${styles.chartCardFull}`}>
              <div className={styles.chartHeader}>
                <h3 className={styles.chartTitle}><Calendar size={18} className="text-primary" /> Longitudinal Analysis</h3>
                <button className="btn btn-secondary text-xs" onClick={() => setTsMode(m => m === 'score' ? 'count' : 'score')}>Show {tsMode === 'score' ? 'Volume' : 'Score'}</button>
              </div>
              <div className={styles.vizWrapperTall}>
                <ResponsiveContainer>
                  <LineChart data={tsChartData}>
                    <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="rgba(255,255,255,0.05)" />
                    <XAxis dataKey="label" axisLine={false} tickLine={false} tick={{ fill: 'var(--text-secondary)', fontSize: 11 }} />
                    <YAxis axisLine={false} tickLine={false} tick={{ fill: 'var(--text-secondary)', fontSize: 11 }} />
                    <Tooltip contentStyle={{ borderRadius: '12px' }} /><Legend />
                    {tsKeys.map((k, i) => <Line key={k} type="monotone" dataKey={k} stroke={['#3b82f6', '#22c55e', '#f59e0b', '#ef4444', '#8b5cf6', '#06b6d4'][i % 6]} strokeWidth={3} dot={{ r: 3 }} activeDot={{ r: 5 }} />)}
                  </LineChart>
                </ResponsiveContainer>
              </div>
            </div>
          )}

          {subView === 'trainer' && (
            <div className={`${styles.chartCard} ${styles.chartCardFull}`}>
              <div className={styles.chartHeader}><h3 className={styles.chartTitle}><GraduationCap size={18} className="text-primary" /> Trainer Scatter Analysis</h3></div>
              <div className={styles.vizWrapperTall}>
                <ResponsiveContainer>
                  <ScatterChart margin={{ top: 20, right: 20, bottom: 20, left: 20 }}>
                    <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.05)" />
                    <XAxis type="number" dataKey="volume" name="Volume" axisLine={false} tickLine={false} />
                    <YAxis type="number" dataKey="score" name="Avg Score" domain={[0, 100]} axisLine={false} tickLine={false} />
                    <ZAxis type="category" dataKey="name" name="Trainer" />
                    <Tooltip cursor={{ strokeDasharray: '3 3' }} contentStyle={{ borderRadius: '12px' }} />
                    <Scatter name="Trainers" data={trainerScatterData}>
                      {trainerScatterData.map((e, i) => <Cell key={i} fill={e.score >= 80 ? '#22c55e' : e.score >= 60 ? '#f59e0b' : '#ef4444'} />)}
                    </Scatter>
                  </ScatterChart>
                </ResponsiveContainer>
              </div>
            </div>
          )}

        </motion.div>
      </AnimatePresence>

      <GlobalFilterPanel
        isOpen={showGlobalFilters} onClose={() => setShowGlobalFilters(false)}
        onApply={(f) => setPageFilters(f)} initialFilters={pageFilters}
        clusterOptions={allClusters} teamOptions={allTeams} trainerOptions={allTrainers} monthOptions={monthsOptions}
        onClearAll={() => setPageFilters({ cluster: '', team: '', trainer: '', month: '' })}
      />
    </div>
  );
};

const KPICard = ({ title, value, icon, colorType }: { title: string, value: string | number, icon: React.ReactNode, colorType: 'primary' | 'success' | 'warning' | 'danger' | 'accent' }) => {
  const typeClass = colorType === 'primary' ? styles.kpiPrimary : 
                   colorType === 'success' ? styles.kpiSuccess : 
                   colorType === 'warning' ? styles.kpiWarning : 
                   colorType === 'danger' ? styles.kpiDanger : styles.kpiAccent;
  
  return (
    <div className={`${styles.kpiCard} ${typeClass}`}>
      <div className={styles.kpiHeader}>
        <div><p className={styles.kpiLabel}>{title}</p><h4 className={styles.kpiValue}>{value}</h4></div>
        <div className={styles.kpiIconWrapper}>{icon}</div>
      </div>
      <div className={styles.kpiGlow} />
    </div>
  );
};








