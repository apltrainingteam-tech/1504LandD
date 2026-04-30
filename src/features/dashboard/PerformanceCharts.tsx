import React, { useState, useMemo, useEffect, Fragment } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import {
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, Legend,
  LineChart, Line, Cell, PieChart, Pie, ScatterChart, Scatter, ZAxis, ComposedChart, ResponsiveContainer
} from 'recharts';
import {
  BarChart3, TrendingUp, Users, Target, Table, Trophy, GraduationCap, AlertTriangle, Calendar, Zap, CheckCircle2, Filter, ListOrdered, Info
} from 'lucide-react';

import { Employee } from '../../types/employee';
import { Attendance, TrainingScore, TrainingNomination, TrainingType, EligibilityRule, Demographics } from '../../types/attendance';
import { getCurrentFYString, getFiscalYears } from '../../core/utils/fiscalYear';
import { useMasterData } from '../../core/context/MasterDataContext';
import { GlobalFilterPanel } from '../../shared/components/ui/GlobalFilterPanel';
import { GlobalFilters, useGlobalFilters } from '../../core/context/filterContext';
import { useFilterOptions, useMonthsFromData } from '../../shared/hooks/computationHooks';
import { useDebugStore } from '../../core/debug/debugStore';
import { usePerformanceData } from './hooks/usePerformanceData';
import { useChartData } from './hooks/useChartData';
import API_BASE from '../../config/api';

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
  const { filters: pageFilters, setFilters: setPageFilters, activeFilterCount, clearFilters } = useGlobalFilters();
  const [tsMode, setTsMode] = useState<'score' | 'count'>('score');
  const isEngineDebugActive = useDebugStore(state => state.enabled);
  const [presentationMode, setPresentationMode] = useState(false);
  const [expandedTrainerGroup, setExpandedTrainerGroup] = useState<'HO' | 'RTM' | null>(null);

  if (isEngineDebugActive) return null;

  // --- PRESENTATION MODE SIDEBAR HIDING ---
  useEffect(() => {
    if (presentationMode) {
      document.body.classList.add('presentation-active');
    } else {
      document.body.classList.remove('presentation-active');
    }
    return () => document.body.classList.remove('presentation-active');
  }, [presentationMode]);

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
    timeSeries,
    resolutionLevel
  } = usePerformanceData({
    employees, attendance, scores, nominations, rules, masterTeams, masterTrainers,
    tab, selectedFY, filter: {
      monthFrom: pageFilters.month ? normalizeMonthStr(pageFilters.month) : '', 
      monthTo: pageFilters.month ? normalizeMonthStr(pageFilters.month) : '',
      teams: pageFilters.teams.length > 0 ? pageFilters.teams : (pageFilters.team ? [pageFilters.team] : []),
      clusters: pageFilters.clusters.length > 0 ? pageFilters.clusters : (pageFilters.cluster ? [pageFilters.cluster] : []),
      trainers: pageFilters.trainers,
      trainerTypes: pageFilters.trainerTypes,
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
  } = useChartData({
    tab, activeNT, ipData, activePerfData, activeAttData, MONTHS
  });

  const tsChartData = useMemo(() => timeSeries.map((r) => ({ label: r.label, ...r.cells })), [timeSeries]);
  const tsKeys = useMemo(() => {
    const keys = new Set<string>();
    timeSeries.forEach((r) => Object.keys(r.cells).forEach(k => keys.add(k)));
    return Array.from(keys);
  }, [timeSeries]);

  const trainerScatterData = useMemo(() => {
    return trainerStats.map((t: any) => ({ name: t.trainerId, volume: t.trainingsConducted, score: t.avgScore })).sort((a: any, b: any) => b.volume - a.volume).slice(0, 30);
  }, [trainerStats]);
  const { allClusters, allTeams, allTrainers } = useFilterOptions(rawUnified, attendance, tab, masterTrainers, pageFilters.clusters);
  const monthsOptions = useMonthsFromData(rawUnified);

  useEffect(() => {
    console.log("UI CLUSTERS SOURCE:", allClusters);
    const engineClusters = [...new Set(unified.map(d => d.employee.cluster))];
    console.log("ENGINE CLUSTERS (RE-VERIFIED):", engineClusters);
    
    // Fail-safe check
    if (allClusters.length > 0 && engineClusters.length > 0) {
      const match = allClusters.every(c => engineClusters.includes(c));
      if (!match) console.error("[ARCHITECTURE VIOLATION] UI Clusters mismatch Engine Clusters!");
    }
  }, [allClusters, unified]);

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
          <button className={`btn ${presentationMode ? 'btn-primary' : 'btn-secondary'}`} onClick={() => setPresentationMode(!presentationMode)} title="Presentation Mode">
            <TrendingUp size={16} /> {presentationMode ? 'Exit Presentation' : 'Present'}
          </button>
        </div>
      </div>

      <div className={`${styles.segmentedControl} mb-20 ${presentationMode ? 'scale-110 mb-32' : ''}`}>
        {ALL_TRAINING_TYPES.map(t => (
          <button 
            key={t} 
            onClick={() => setTab(t)} 
            className={`${styles.segmentedBtn} ${tab === t ? styles.active : ''}`}
          >
            {t}
          </button>
        ))}
      </div>

      {/* COMMAND BAR - The Control Surface 30/40/30 Grid */}
      <div className={`glass-panel p-24 mb-16 sticky top-0 z-50 transition-all duration-300 ${presentationMode ? 'scale-105 shadow-2xl border-primary bg-black/60' : ''}`}>
        <div className={styles.commandBar}>
          
          {/* Section 1: Cluster (30%) - HIGHEST HIERARCHY */}
          <div className={styles.controlSection}>
            <span className={`${styles.sectionLabel} ${styles.clusterLabel}`}>Cluster</span>
            <div className="flex gap-2 flex-wrap">
              <motion.button 
                whileHover={{ scale: 1.05 }}
                whileTap={{ scale: 0.95 }}
                onClick={() => setPageFilters({ ...pageFilters, clusters: [], teams: [] })}
                className={`${styles.chipBtn} ${pageFilters.clusters.length === 0 ? styles.active : ''}`}
              >
                All Clusters
              </motion.button>
              {allClusters.map((c: string) => (
                <motion.button 
                  key={c}
                  whileHover={{ scale: 1.05, y: -2 }}
                  whileTap={{ scale: 0.95 }}
                  onClick={() => {
                    // Single select for Cluster as requested
                    setPageFilters({ ...pageFilters, clusters: [c], teams: [] });
                  }}
                  className={`${styles.chipBtn} ${pageFilters.clusters.includes(c) ? styles.active : ''}`}
                >
                  {c}
                </motion.button>
              ))}
            </div>
          </div>

          {/* Section 2: Team (40%) - CONTEXTUAL */}
          <div className={styles.controlSection}>
            <span className={`${styles.sectionLabel} ${styles.teamLabel}`}>Team {pageFilters.clusters.length > 0 ? `(${pageFilters.clusters[0]})` : ''}</span>
            <div className={`flex gap-2 flex-wrap max-h-32 overflow-y-auto pr-2 ${styles.customScrollbar}`}>
              {pageFilters.clusters.length === 0 ? (
                <span className="text-xs text-muted/60 italic p-2 border border-white/5 rounded-lg w-full text-center bg-white/5">Select a cluster to view teams</span>
              ) : allTeams.length > 0 ? (
                allTeams.map(t => (
                  <motion.button 
                    key={t.id}
                    initial={{ opacity: 0, y: 5 }}
                    animate={{ opacity: 1, y: 0 }}
                    whileHover={{ scale: 1.05 }}
                    whileTap={{ scale: 0.95 }}
                    onClick={() => {
                      const newTeams = pageFilters.teams.includes(t.id)
                        ? pageFilters.teams.filter(x => x !== t.id)
                        : [...pageFilters.teams, t.id];
                      setPageFilters({ ...pageFilters, teams: newTeams });
                    }}
                    className={`${styles.chipBtnSm} ${pageFilters.teams.includes(t.id) ? styles.active : ''}`}
                  >
                    {t.label}
                  </motion.button>
                ))
              ) : (
                <span className="text-xs text-muted italic">No teams found</span>
              )}
            </div>
          </div>

          {/* Section 3: Trainer (30%) - REFINEMENT */}
          <div className={styles.controlSection}>
            <span className={`${styles.sectionLabel} ${styles.trainerLabel}`}>Trainer Refinement</span>
            <div className="flex flex-col gap-3">
              <div className={styles.segmentedToggle}>
                <button 
                  className={`${styles.toggleBtn} ${expandedTrainerGroup === 'HO' ? styles.active : ''}`}
                  onClick={() => setExpandedTrainerGroup(expandedTrainerGroup === 'HO' ? null : 'HO')}
                >
                  HO
                </button>
                <button 
                  className={`${styles.toggleBtn} ${expandedTrainerGroup === 'RTM' ? styles.active : ''}`}
                  onClick={() => setExpandedTrainerGroup(expandedTrainerGroup === 'RTM' ? null : 'RTM')}
                >
                  RTM
                </button>
              </div>

              <AnimatePresence>
                {expandedTrainerGroup && (
                  <motion.div 
                    initial={{ opacity: 0, height: 0 }}
                    animate={{ opacity: 1, height: 'auto' }}
                    exit={{ opacity: 0, height: 0 }}
                    className="flex gap-2 flex-wrap pt-2 overflow-hidden"
                  >
                    {allTrainers
                      .filter((t: any) => t.label.includes(expandedTrainerGroup))
                      .map((t: any) => {
                        const initials = t.label.split(' ')[0].substring(0, 2).toUpperCase();
                        const isActive = pageFilters.trainers.includes(t.id);
                        const avatarSrc = t.avatarUrl ? (t.avatarUrl.startsWith('http') ? t.avatarUrl : `${API_BASE.replace('/api', '')}${t.avatarUrl}`) : null;
                        return (
                          <motion.button
                            key={t.id}
                            title={t.label}
                            whileHover={{ scale: 1.15, y: -2 }}
                            whileTap={{ scale: 0.9 }}
                            onClick={() => {
                              const newTrainers = isActive 
                                ? pageFilters.trainers.filter(x => x !== t.id)
                                : [...pageFilters.trainers, t.id];
                              setPageFilters({ ...pageFilters, trainers: newTrainers });
                            }}
                            className={`${styles.avatarChip} ${isActive ? styles.active : ''}`}
                            style={avatarSrc ? { backgroundImage: `url(${avatarSrc})`, backgroundSize: 'cover', color: 'transparent' } : {}}
                          >
                            {!avatarSrc && initials}
                          </motion.button>
                        );
                      })}
                  </motion.div>
                )}
              </AnimatePresence>
            </div>
          </div>

          {/* Global Controls & Reset - Fixed right */}
          <div className="absolute right-24 top-24 flex flex-col gap-3">
            <div className="flex-center gap-2 bg-white/5 px-3 py-1 rounded-lg border border-white/10">
              <Calendar size={12} className="text-primary" />
              <select 
                value={selectedFY} 
                title="Fiscal Year Selector"
                onChange={(e) => setSelectedFY(e.target.value)} 
                className="form-select border-none bg-transparent font-bold text-[10px] outline-none cursor-pointer" 
              >
                {FY_OPTIONS.map(fy => <option key={fy} value={fy} className="bg-gray-900">{fy}</option>)}
              </select>
            </div>
            <button 
              className="btn btn-secondary flex-center gap-2 px-3 py-1.5 hover:bg-danger/20 hover:text-danger border-white/10" 
              onClick={clearFilters}
            >
              <Zap size={12} /> <span className="text-[10px] font-bold uppercase">Reset</span>
            </button>
          </div>
        </div>
      </div>

      {/* VIEWING CONTEXT BAR */}
      <div className={styles.contextBar}>
        <div className={styles.contextText}>
          <TrendingUp size={14} className="mr-8 text-primary" />
          Viewing: 
          <span className={styles.contextHighlight}>
            {pageFilters.clusters.length === 0 ? 'All Clusters' : pageFilters.clusters[0]}
          </span>
          {pageFilters.clusters.length > 0 && (
            <>
              <span className={styles.contextArrow}>→</span>
              <span className={styles.contextHighlight}>
                {pageFilters.teams.length === 0 ? 'Teams' : (pageFilters.teams.length === 1 ? allTeams.find(t => t.id === pageFilters.teams[0])?.label : `${pageFilters.teams.length} Teams`)}
              </span>
            </>
          )}
          {pageFilters.trainers.length > 0 && (
            <>
              <span className={styles.contextArrow}>→</span>
              <span className={styles.contextHighlight}>{pageFilters.trainers.length} Trainers</span>
            </>
          )}
        </div>
        
        <div className="flex gap-2">
          <AnimatePresence>
            {pageFilters.month && (
              <motion.span initial={{ opacity: 0, x: 20 }} animate={{ opacity: 1, x: 0 }} exit={{ opacity: 0, x: 20 }} className={`${styles.filterTag} ${styles.month}`}>
                {pageFilters.month} <button onClick={() => setPageFilters({ ...pageFilters, month: '' })}>✕</button>
              </motion.span>
            )}
          </AnimatePresence>
        </div>
      </div>

      {/* QUICK SCENARIO BUTTONS */}
      {!presentationMode && (
        <div className="flex gap-3 mb-24 overflow-x-auto pb-2 px-2 no-scrollbar">
          <motion.button whileHover={{ y: -2 }} whileTap={{ scale: 0.98 }} onClick={clearFilters} className={styles.scenarioBtn}>
            <Users size={14} /> Full Snapshot
          </motion.button>
          <motion.button 
            whileHover={{ y: -2 }} 
            whileTap={{ scale: 0.98 }} 
            onClick={() => {
              // Scenario: Only show teams with Elite members
              const topTeams = rankingData.filter(r => r.score > 80).map(r => masterTeams.find(t => t.teamName === r.name)?.id).filter(Boolean) as string[];
              setPageFilters({ ...pageFilters, teams: topTeams, trainers: [], clusters: [], month: '' });
            }} 
            className={styles.scenarioBtn}
          >
            <Trophy size={14} className="text-success" /> Elite Squads
          </motion.button>
          <motion.button 
            whileHover={{ y: -2 }} 
            whileTap={{ scale: 0.98 }} 
            onClick={() => {
              // Scenario: Only show teams with significant gaps
              const lowTeams = rankingData.filter(r => r.score < 60).map(r => masterTeams.find(t => t.teamName === r.name)?.id).filter(Boolean) as string[];
              setPageFilters({ ...pageFilters, teams: lowTeams, trainers: [], clusters: [], month: '' });
            }} 
            className={styles.scenarioBtn}
          >
            <AlertTriangle size={14} className="text-danger" /> Risk Focus
          </motion.button>
          <motion.button whileHover={{ y: -2 }} whileTap={{ scale: 0.98 }} onClick={() => setSubView('gap')} className={styles.scenarioBtn}>
            <Target size={14} className="text-warning" /> High Gap Areas
          </motion.button>
        </div>
      )}

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
                  
                  {/* Help Panel — diagnostics removed from chart pipeline */}
                  <div className="max-w-600 mx-auto glass-panel p-20 text-left bg-warning-subtle border-warning">
                    <div className="flex-center gap-2 mb-12 text-warning">
                      <Info size={18} />
                      <h4 className="m-0 font-bold">No Data Available</h4>
                    </div>
                    <p className="text-sm text-secondary">No performance records found for <strong>{tab}</strong> in FY <strong>{selectedFY}</strong>. Check that Training Type names match exactly in both Attendance and Score uploads.</p>
                  </div>
                </div>
              ) : (
                <>
                  <div className={`${styles.chartCard} ${styles.chartCardLarge}`}>
                    <div className={styles.chartHeader}><h3 className={styles.chartTitle}><BarChart3 size={18} className={styles.chartTitleIcon} /> Distribution Profile</h3></div>
                    <div className={styles.vizWrapperFixed}>
                      <ResponsiveContainer width="100%" height="100%">
                        {tab === 'IP' ? (
                          <BarChart data={distributionData} margin={{ top: 10, right: 10, left: -20, bottom: 0 }} onClick={(data: any) => {
                            if (data?.activeLabel) {
                              const label = String(data.activeLabel);
                              setPageFilters({ ...pageFilters, month: pageFilters.month === label ? '' : label });
                            }
                          }}>
                            <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="rgba(255,255,255,0.05)" />
                            <XAxis dataKey="label" axisLine={false} tickLine={false} tick={{ fill: 'var(--text-secondary)', fontSize: 11 }} />
                            <YAxis axisLine={false} tickLine={false} tick={{ fill: 'var(--text-secondary)', fontSize: 11 }} domain={[0, 100]} />
                            <Tooltip cursor={{ fill: 'rgba(255,255,255,0.05)' }} contentStyle={{ backgroundColor: 'var(--bg-card)', border: '1px solid var(--border-color)', borderRadius: '12px' }} />
                            <Legend wrapperStyle={{ paddingTop: '10px' }} />
                            <Bar dataKey="Elite" stackId="a" fill="#22c55e" />
                            <Bar dataKey="High" stackId="a" fill="#3b82f6" />
                            <Bar dataKey="Medium" stackId="a" fill="#f59e0b" />
                            <Bar dataKey="Low" stackId="a" fill="#ef4444" />
                          </BarChart>
                        ) : activeNT === 'AP' ? (
                          <BarChart data={distributionData} margin={{ top: 10, right: 10, left: -20, bottom: 0 }} onClick={(data: any) => {
                            if (data?.activeLabel) {
                              const label = String(data.activeLabel);
                              setPageFilters({ ...pageFilters, month: pageFilters.month === label ? '' : label });
                            }
                          }}>
                            <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="rgba(255,255,255,0.05)" />
                            <XAxis dataKey="label" axisLine={false} tickLine={false} tick={{ fill: 'var(--text-secondary)', fontSize: 11 }} />
                            <YAxis axisLine={false} tickLine={false} tick={{ fill: 'var(--text-secondary)', fontSize: 11 }} domain={[0, 100]} />
                            <Tooltip cursor={{ fill: 'rgba(255,255,255,0.05)' }} contentStyle={{ backgroundColor: 'var(--bg-card)', border: '1px solid var(--border-color)', borderRadius: '12px' }} />
                            <Legend wrapperStyle={{ paddingTop: '10px' }} />
                            <Bar dataKey="Knowledge" fill="#3b82f6" barSize={20} />
                            <Bar dataKey="BSE" fill="#22c55e" barSize={20} />
                          </BarChart>
                        ) : (activeNT === 'MIP' || activeNT === 'Refresher') ? (
                          <BarChart data={distributionData} margin={{ top: 10, right: 10, left: -20, bottom: 0 }} onClick={(data: any) => {
                            if (data?.activeLabel) {
                              const label = String(data.activeLabel);
                              setPageFilters({ ...pageFilters, month: pageFilters.month === label ? '' : label });
                            }
                          }}>
                            <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="rgba(255,255,255,0.05)" />
                            <XAxis dataKey="label" axisLine={false} tickLine={false} tick={{ fill: 'var(--text-secondary)', fontSize: 11 }} />
                            <YAxis axisLine={false} tickLine={false} tick={{ fill: 'var(--text-secondary)', fontSize: 11 }} domain={[0, 100]} />
                            <Tooltip cursor={{ fill: 'rgba(255,255,255,0.05)' }} contentStyle={{ backgroundColor: 'var(--bg-card)', border: '1px solid var(--border-color)', borderRadius: '12px' }} />
                            <Legend wrapperStyle={{ paddingTop: '10px' }} />
                            <Bar dataKey="Science" fill="#8b5cf6" barSize={20} />
                            <Bar dataKey="Skill" fill="#06b6d4" barSize={20} />
                          </BarChart>
                        ) : (
                          <BarChart data={distributionData} margin={{ top: 10, right: 10, left: -20, bottom: 0 }} onClick={(data: any) => {
                            if (data?.activeLabel) {
                              const label = String(data.activeLabel);
                              setPageFilters({ ...pageFilters, month: pageFilters.month === label ? '' : label });
                            }
                          }}>
                            <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="rgba(255,255,255,0.05)" />
                            <XAxis dataKey="label" axisLine={false} tickLine={false} tick={{ fill: 'var(--text-secondary)', fontSize: 11 }} />
                            <YAxis axisLine={false} tickLine={false} tick={{ fill: 'var(--text-secondary)', fontSize: 11 }} domain={[0, 100]} />
                            <Tooltip cursor={{ fill: 'rgba(255,255,255,0.05)' }} contentStyle={{ backgroundColor: 'var(--bg-card)', border: '1px solid var(--border-color)', borderRadius: '12px' }} />
                            <Legend wrapperStyle={{ paddingTop: '10px' }} />
                            <Bar dataKey="Score" fill="#3b82f6" barSize={30} />
                          </BarChart>
                        )}
                      </ResponsiveContainer>
                    </div>
                  </div>
                  <div className={`${styles.chartCard} ${styles.chartCardSmall}`}>
                    <div className={styles.chartHeader}><h3 className={styles.chartTitle}><ListOrdered size={18} className="text-warning" /> Ranking</h3></div>
                    <div className={styles.vizWrapperFixed}>
                      <ResponsiveContainer width="100%" height="100%">
                        <BarChart layout="vertical" data={rankingData} margin={{ top: 5, right: 10, left: 20, bottom: 5 }} onClick={(data: any) => {
                          if (data && data.activePayload && data.activePayload.length > 0) {
                            const label = String(data.activePayload[0].payload.name);
                            if (resolutionLevel === 'Global') {
                              setPageFilters({ ...pageFilters, clusters: [label], teams: [] });
                            } else {
                              const teamId = masterTeams.find(t => t.teamName === label)?.id || label;
                              const newTeams = pageFilters.teams.includes(teamId)
                                ? pageFilters.teams.filter(x => x !== teamId)
                                : [...pageFilters.teams, teamId];
                              setPageFilters({ ...pageFilters, teams: newTeams });
                            }
                          }
                        }}>
                          <XAxis type="number" hide domain={[0, 100]} /><YAxis dataKey="name" type="category" axisLine={false} tickLine={false} tick={{ fill: 'var(--text-primary)', fontSize: 10 }} width={90} />
                          <Tooltip cursor={{ fill: 'rgba(255,255,255,0.05)' }} contentStyle={{ backgroundColor: 'var(--bg-card)', border: '1px solid var(--border-color)', borderRadius: '12px' }} />
                          <Bar dataKey="score" fill="#3b82f6" barSize={14}>
                            {rankingData.map((e, i) => <Cell key={i} fill={i < 3 ? '#22c55e' : i < 7 ? '#3b82f6' : '#f59e0b'} opacity={Math.max(0.5, 1 - (i * 0.04))} />)}
                          </Bar>
                        </BarChart>
                      </ResponsiveContainer>
                    </div>
                  </div>
                  <div className={`${styles.chartCard} ${styles.chartCardFull}`}>
                    <div className={styles.chartHeader}><h3 className={styles.chartTitle}><TrendingUp size={18} className="text-accent-primary" /> {resolutionLevel === 'Global' ? 'Cluster' : 'Team'} Benchmarking</h3></div>
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
                      <ResponsiveContainer width="99%" height={330}>
                        <ComposedChart data={attFunnelData}>
                          <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="rgba(255,255,255,0.05)" />
                          <XAxis dataKey="label" axisLine={false} tickLine={false} tick={{ fill: 'var(--text-secondary)', fontSize: 11 }} />
                          <YAxis axisLine={false} tickLine={false} tick={{ fill: 'var(--text-secondary)', fontSize: 11 }} />
                          <Tooltip contentStyle={{ backgroundColor: 'var(--bg-card)', border: '1px solid var(--border-color)', borderRadius: '12px' }} /><Legend />
                          <Bar dataKey="Notified" fill="#3b82f6" barSize={40} /><Bar dataKey="Attended" fill="#22c55e" barSize={40} />
                        </ComposedChart>
                      </ResponsiveContainer>
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
                      <BarChart data={matrixData.map(c => ({ name: c.cluster, Trained: c.teams.reduce((s, t) => s + t.total, 0) }))} onClick={(data: any) => {
                        if (data?.activeLabel) {
                          const label = String(data.activeLabel);
                          setPageFilters({ ...pageFilters, cluster: pageFilters.cluster === label ? '' : label, team: '' });
                        }
                      }}>
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
                    <Scatter name="Trainers" data={trainerScatterData} onClick={(data: any) => {
                      if (data && data.name) {
                        const tId = data.name;
                        const newTrainers = pageFilters.trainers.includes(tId)
                          ? pageFilters.trainers.filter(x => x !== tId)
                          : [...pageFilters.trainers, tId];
                        setPageFilters({ ...pageFilters, trainers: newTrainers });
                      }
                    }}>
                      {trainerScatterData.map((e: any, i: number) => <Cell key={i} fill={e.score >= 80 ? '#22c55e' : e.score >= 60 ? '#f59e0b' : '#ef4444'} />)}
                    </Scatter>
                  </ScatterChart>
                </ResponsiveContainer>
              </div>
            </div>
          )}

        </motion.div>
      </AnimatePresence>

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








