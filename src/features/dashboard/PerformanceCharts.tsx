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
import { buildUnifiedDataset, applyFilters, normalizeTrainingType } from '../../services/reportService';
import { getFiscalMonths, getCurrentFY, buildIPAggregates } from '../../services/ipIntelligenceService';
import { buildEmployeeTimelines, buildAPMonthlyMatrix, filterTimelines } from '../../services/apIntelligenceService';
import { getAPPerformanceAggregates } from '../../services/apPerformanceService';
import { buildMIPAttendanceMatrix } from '../../services/mipAttendanceService';
import { getMIPPerformanceAggregates } from '../../services/mipPerformanceService';
import { buildRefresherAttendanceMatrix } from '../../services/refresherAttendanceService';
import { getRefresherPerformanceAggregates } from '../../services/refresherPerformanceService';
import { buildCapsuleAttendanceMatrix } from '../../services/capsuleAttendanceService';
import { getCapsulePerformanceAggregates } from '../../services/capsulePerformanceService';
import { getEligibleEmployees } from '../../services/eligibilityService';
import { getFiscalYears } from '../../utils/fiscalYear';
import { useMasterData } from '../../context/MasterDataContext';
import { GlobalFilterPanel } from '../../components/GlobalFilterPanel';
import { GlobalFilters, getActiveFilterCount } from '../../context/filterContext';
import { getCollection } from '../../services/apiClient';
import {
  useMonthsFromData, useFilterOptions, useGroupedData, useTrainerStats, useTimeSeries, useGapMetrics
} from '../../utils/computationHooks';

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
  if (!month || month.length < 7) return getCurrentFY();
  const [y, m] = month.split('-').map(Number);
  const startYear = m >= 4 ? y : y - 1;
  return `${startYear}-${String(startYear + 1).slice(-2)}`;
};

export const PerformanceCharts: React.FC<PerformanceChartsProps> = ({
  employees, attendance, scores, nominations, onNavigate
}) => {
  const { teams: masterTeams, clusters: masterClusters, trainers: masterTrainers } = useMasterData();
  const [tab, setTab] = useState<string>('IP');
  const [subView, setSubView] = useState<string>('performance');
  const [selectedFY, setSelectedFY] = useState<string>(getCurrentFY());
  const [pageFilters, setPageFilters] = useState<GlobalFilters>({ cluster: '', team: '', trainer: '', month: '' });
  const [showGlobalFilters, setShowGlobalFilters] = useState(false);
  const activeFilterCount = getActiveFilterCount(pageFilters);
  const [rules, setRules] = useState<EligibilityRule[]>([]);
  const [tsMode, setTsMode] = useState<'score' | 'count'>('score');

  useEffect(() => {
    getCollection('eligibility_rules').then(data => setRules(data as EligibilityRule[]));
  }, []);

  // --- SYNC GLOBAL MONTH FILTER WITH FISCAL YEAR SELECTOR ---
  useEffect(() => {
    if (pageFilters.month) {
      const targetFY = getFYFromMonth(normalizeMonthStr(pageFilters.month));
      if (targetFY !== selectedFY) {
        setSelectedFY(targetFY);
      }
    }
  }, [pageFilters.month]);

  const MONTHS = useMemo(() => getFiscalMonths(selectedFY), [selectedFY]);
  const activeNT = useMemo(() => normalizeTrainingType(tab), [tab]);

  // Data Normalization
  const normalizedAttendance = useMemo(() => {
    return attendance.map(a => ({ ...a, month: normalizeMonthStr(a.month || a.attendanceDate || '') }));
  }, [attendance]);

  const rawUnified = useMemo(() => {
    const att = normalizedAttendance.filter(a => normalizeTrainingType(a.trainingType) === activeNT);
    const scs = scores.filter(s => normalizeTrainingType(s.trainingType) === activeNT);
    const noms = nominations
      .map(n => ({ ...n, month: normalizeMonthStr(n.month || n.notificationDate || '') }))
      .filter(n => normalizeTrainingType(n.trainingType) === activeNT);
    return buildUnifiedDataset(employees, att, scs, noms, [], masterTeams);
  }, [activeNT, normalizedAttendance, scores, nominations, employees, masterTeams]);

  const unified = useMemo(() => {
    const filter = {
      monthFrom: pageFilters.month ? normalizeMonthStr(pageFilters.month) : '', 
      monthTo: pageFilters.month ? normalizeMonthStr(pageFilters.month) : '',
      teams: pageFilters.team ? [pageFilters.team] : [],
      clusters: pageFilters.cluster ? [pageFilters.cluster] : [],
      trainer: pageFilters.trainer || ''
    };
    let ds = applyFilters(rawUnified, filter, masterTeams);
    return ds.filter(r => MONTHS.includes(r.attendance.month || ''));
  }, [rawUnified, pageFilters, MONTHS, masterTeams]);

  // Engines
  const ipData = useMemo(() => buildIPAggregates(unified), [unified]);
  
  const rawTimelines = useMemo(() => {
    if (['AP', 'MIP', 'Refresher', 'Capsule', 'Pre_AP'].includes(activeNT)) {
      const normalizedNoms = nominations
        .map(n => ({ ...n, month: normalizeMonthStr(n.month || n.notificationDate || '') }))
        .filter(n => normalizeTrainingType(n.trainingType) === activeNT);
      
      return buildEmployeeTimelines(
        normalizedAttendance.filter(a => normalizeTrainingType(a.trainingType) === activeNT),
        normalizedNoms,
        masterTeams, activeNT,
        scores.filter(s => normalizeTrainingType(s.trainingType) === activeNT)
      );
    }
    return new Map();
  }, [normalizedAttendance, nominations, scores, activeNT, masterTeams]);

  const filteredTimelines = useMemo(() => {
    return filterTimelines(rawTimelines, { trainer: pageFilters.trainer, validMonths: MONTHS });
  }, [rawTimelines, pageFilters.trainer, MONTHS]);

  const apAttData = useMemo(() => (activeNT === 'AP' || activeNT === 'Pre_AP') ? buildAPMonthlyMatrix(filteredTimelines, MONTHS) : null, [activeNT, filteredTimelines, MONTHS]);
  const mipAttData = useMemo(() => activeNT === 'MIP' ? buildMIPAttendanceMatrix(filteredTimelines, MONTHS) : null, [activeNT, filteredTimelines, MONTHS]);
  const refAttData = useMemo(() => activeNT === 'Refresher' ? buildRefresherAttendanceMatrix(filteredTimelines, MONTHS) : null, [activeNT, filteredTimelines, MONTHS]);
  const capAttData = useMemo(() => activeNT === 'Capsule' ? buildCapsuleAttendanceMatrix(filteredTimelines, MONTHS) : null, [activeNT, filteredTimelines, MONTHS]);
  
  const apPerfData = useMemo(() => (activeNT === 'AP' || activeNT === 'Pre_AP') ? getAPPerformanceAggregates(filteredTimelines, MONTHS) : null, [activeNT, filteredTimelines, MONTHS]);
  const mipPerfData = useMemo(() => activeNT === 'MIP' ? getMIPPerformanceAggregates(filteredTimelines, MONTHS) : null, [activeNT, filteredTimelines, MONTHS]);
  const refPerfData = useMemo(() => activeNT === 'Refresher' ? getRefresherPerformanceAggregates(filteredTimelines, MONTHS) : null, [activeNT, filteredTimelines, MONTHS]);
  const capPerfData = useMemo(() => activeNT === 'Capsule' ? getCapsulePerformanceAggregates(filteredTimelines, MONTHS) : null, [activeNT, filteredTimelines, MONTHS]);

  const activeAttData = activeNT === 'AP' ? apAttData : activeNT === 'MIP' ? mipAttData : activeNT === 'Refresher' ? refAttData : (activeNT === 'Pre_AP' ? apAttData : capAttData);
  const activePerfData = activeNT === 'AP' ? apPerfData : activeNT === 'MIP' ? mipPerfData : activeNT === 'Refresher' ? refPerfData : (activeNT === 'Pre_AP' ? apPerfData : capPerfData);

  // --- TRANSFORMATION ---
  const matrixData: MatrixCluster[] = useMemo(() => {
    let clusterMap: Record<string, any> = {};
    if (tab === 'IP') {
      // IP service has separate clusterMonthMap and teamMonthMap
      // We need to merge them to fit the expected { cluster, teams: [...] } structure
      Object.entries(ipData.clusterMonthMap).forEach(([clusterName, clusterData]: [string, any]) => {
        clusterMap[clusterName] = { 
          ...clusterData, 
          teams: {} 
        };
      });
      
      // Add teams from teamMonthMap to their clusters
      Object.entries(ipData.teamMonthMap).forEach(([clusterName, teams]: [string, any]) => {
        if (clusterMap[clusterName]) {
          clusterMap[clusterName].teams = teams;
        }
      });
    } else if (activePerfData) {
      clusterMap = (activePerfData as any).clusterMap || (activePerfData as any).clusterMonthMap || {};
    }

    return Object.entries(clusterMap).map(([clusterName, clusterData]: [string, any]) => {
      const teams: MatrixTeam[] = [];
      const teamSources = Object.entries(clusterData.teams || {});

      teamSources.forEach(([teamName, teamData]: [string, any]) => {
        let score = 0;
        let metrics: Record<string, number> = {};
        const teamMonths = Object.values(teamData.months || {}) as any[];
        const activeMonths = teamMonths.filter(m => (m.count > 0 || m.attended > 0 || m.total > 0));
        
        const teamTotal = activeMonths.reduce((sum, m) => sum + (m.count || m.attended || 0), 0);

        if (tab === 'IP') {
          const tot = teamData.total || 1;
          score = ((teamData.elite * 98) + (teamData.high * 85) + (teamData.medium * 65) + (teamData.low * 35)) / tot;
          metrics = { Elite: (teamData.elite/tot)*100, High: (teamData.high/tot)*100, Medium: (teamData.medium/tot)*100, Low: (teamData.low/tot)*100 };
        } else if (activeNT === 'AP') {
          const avgK = activeMonths.reduce((s, m) => s + (m.avgKnowledge || 0), 0) / (activeMonths.length || 1);
          const avgB = activeMonths.reduce((s, m) => s + (m.avgBSE || 0), 0) / (activeMonths.length || 1);
          score = (avgK + avgB) / 2;
          metrics = { Knowledge: avgK, BSE: avgB };
        } else if (activeNT === 'MIP' || activeNT === 'Refresher') {
          const avgSci = activeMonths.reduce((s, m) => s + (m.avgScience ?? 0), 0) / (activeMonths.length || 1);
          const avgSki = activeMonths.reduce((s, m) => s + (m.avgSkill ?? 0), 0) / (activeMonths.length || 1);
          score = (avgSci + avgSki) / 2;
          metrics = { Science: avgSci, Skill: avgSki };
        } else if (activeNT === 'Capsule' || activeNT === 'Pre_AP') {
          score = activeMonths.reduce((s, m) => s + (m.avgScore ?? m.avgKnowledge ?? 0), 0) / (activeMonths.length || 1);
          metrics = { Score: score };
        }

        if (activeMonths.length > 0 || tab === 'IP') {
          teams.push({ name: teamName, total: teamTotal || teamData.total || 0, score, metrics, monthly: teamData.months || {} });
        }
      });

      return {
        cluster: clusterName,
        teams: teams.sort((a, b) => b.score - a.score),
        avgScore: teams.length > 0 ? teams.reduce((s, t) => s + t.score, 0) / teams.length : 0
      };
    }).filter(c => c.teams.length > 0).sort((a, b) => b.avgScore - a.avgScore);
  }, [tab, activeNT, ipData, activePerfData]);

  const kpis = useMemo(() => {
    const allTeams = matrixData.flatMap(c => c.teams);
    if (allTeams.length === 0) return { total: 0, score: 0, best: '—', worst: '—' };
    const total = allTeams.reduce((sum, t) => sum + t.total, 0);
    const avgScore = allTeams.reduce((sum, t) => sum + t.score, 0) / (allTeams.length || 1);
    const sorted = [...allTeams].sort((a, b) => b.score - a.score);
    return { total, score: avgScore, best: sorted[0]?.name || '—', worst: sorted[sorted.length - 1]?.name || '—' };
  }, [matrixData]);

  // --- DIAGNOSTICS ---
  const diagnostics = useMemo(() => {
    const totalRaw = normalizedAttendance.length;
    const typeMatched = normalizedAttendance.filter(a => normalizeTrainingType(a.trainingType) === activeNT).length;
    const fyMatched = rawUnified.filter(r => MONTHS.includes(r.attendance.month || '')).length;
    const hasScoresTotal = rawUnified.filter(r => !!r.score).length;
    
    // IP Specific drilldown for current FY
    const unifiedInFY = unified.length;
    const ipNormalizedCount = tab === 'IP' ? buildIPAggregates(unified).recordsCount : 0; // We'll add this count to service
    const withScoresInFY = unified.filter(r => !!r.score).length;
    
    return { 
      totalRaw, typeMatched, fyMatched, hasScoresTotal, 
      activeNT, selectedFY, 
      unifiedInFY, withScoresInFY, ipNormalizedCount
    };
  }, [normalizedAttendance, rawUnified, unified, activeNT, selectedFY, MONTHS, tab]);

  // --- CHART RESOLVERS ---
  const distributionData = useMemo(() => {
    return MONTHS.map(m => {
      const parts = m.split('-');
      const monthNames = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
      const label = `${monthNames[parseInt(parts[1]) - 1]} ${parts[0].slice(-2)}`;
      const buckets: any = { label };
      let foundData = false;
      let count = 0;
      matrixData.forEach(c => c.teams.forEach(t => {
        const mon = Object.entries(t.monthly).find(([k]) => normalizeMonthStr(k) === m)?.[1];
        if (mon && (mon.count > 0 || mon.attended > 0 || mon.total > 0)) {
          foundData = true;
          count++;
          if (tab === 'IP') {
            const tot = mon.total || 1;
            buckets.Elite = (buckets.Elite || 0) + (mon.elite / tot) * 100;
            buckets.High = (buckets.High || 0) + (mon.high / tot) * 100;
            buckets.Medium = (buckets.Medium || 0) + (mon.medium / tot) * 100;
            buckets.Low = (buckets.Low || 0) + (mon.low / tot) * 100;
          } else if (activeNT === 'AP') {
            buckets.Knowledge = (buckets.Knowledge || 0) + (mon.avgKnowledge || 0);
            buckets.BSE = (buckets.BSE || 0) + (mon.avgBSE || 0);
          } else if (activeNT === 'MIP' || activeNT === 'Refresher') {
            buckets.Science = (buckets.Science || 0) + (mon.avgScience ?? 0);
            buckets.Skill = (buckets.Skill || 0) + (mon.avgSkill ?? 0);
          } else if (activeNT === 'Capsule') {
            buckets.Score = (buckets.Score || 0) + (mon.avgScore ?? 0);
          }
        }
      }));
      if (foundData && count > 0) {
        Object.keys(buckets).forEach(k => { if (k !== 'label') buckets[k] /= count; });
        return buckets;
      }
      
      // Prevent Recharts minPointSize stack crash by providing 0s instead of undefined
      if (tab === 'IP') return { label, Elite: 0, High: 0, Medium: 0, Low: 0 };
      if (activeNT === 'AP') return { label, Knowledge: 0, BSE: 0 };
      if (activeNT === 'MIP' || activeNT === 'Refresher') return { label, Science: 0, Skill: 0 };
      return { label, Score: 0 };
    });
  }, [matrixData, MONTHS, tab, activeNT]);

  const rankingData = useMemo(() => { console.log('MATRIX DATA:', JSON.stringify(matrixData, null, 2));
    return matrixData.flatMap(c => c.teams).sort((a, b) => b.score - a.score).slice(0, 15)
      .map(t => ({ name: t.name, score: Math.round(t.score * 10) / 10 }));
  }, [matrixData]);

  const trendData = useMemo(() => {
    const data = MONTHS.map(m => {
      const parts = m.split('-');
      const monthNames = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
      const label = `${monthNames[parseInt(parts[1]) - 1]} ${parts[0].slice(-2)}`;
      const row: any = { label };
      let hasAny = false;
      matrixData.forEach(c => {
        let clusterScore = 0, count = 0;
        c.teams.forEach(t => {
          const mon = Object.entries(t.monthly).find(([k]) => normalizeMonthStr(k) === m)?.[1];
          if (mon && (mon.count > 0 || mon.attended > 0 || mon.total > 0)) {
            count++;
            if (tab === 'IP') {
              const tot = mon.total || 1;
              clusterScore += ((mon.elite * 98) + (mon.high * 85) + (mon.medium * 65) + (mon.low * 35)) / tot;
            } else if (activeNT === 'AP') {
              clusterScore += ((mon.avgKnowledge || 0) + (mon.avgBSE || 0)) / 2;
            } else if (activeNT === 'MIP' || activeNT === 'Refresher') {
              clusterScore += ((mon.avgScience ?? 0) + (mon.avgSkill ?? 0)) / 2;
            } else if (activeNT === 'Capsule') {
              clusterScore += (mon.avgScore ?? 0);
            }
          }
        });
        if (count > 0) {
          row[c.cluster] = Math.round((clusterScore / count) * 10) / 10;
          hasAny = true;
        }
      });
      return hasAny ? row : { label, empty: true };
    });
    return { data, clusters: matrixData.map(c => c.cluster) };
  }, [matrixData, MONTHS, tab, activeNT]);

  const attFunnelData = useMemo(() => {
    if (!activeAttData) return [];
    return MONTHS.map(m => {
      let notified = 0, attended = 0;
      Object.values(activeAttData.clusterMonthMap).forEach((c: any) => {
        const mData = Object.entries(c.months).find(([k]) => normalizeMonthStr(k) === m)?.[1];
        if (mData) {
          notified += (mData as any).notified || 0;
          attended += (mData as any).attended || 0;
        }
      });
      const parts = m.split('-');
      const monthNames = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
      const label = `${monthNames[parseInt(parts[1]) - 1]} ${parts[0].slice(-2)}`;
      return { label, Notified: notified, Attended: attended };
    });
  }, [activeAttData, MONTHS]);

  const eligibilityResults = useMemo(() => {
    const rule = rules.find(r => normalizeTrainingType(r.trainingType) === activeNT);
    return getEligibleEmployees(activeNT as TrainingType, rule, employees, attendance, nominations);
  }, [activeNT, rules, employees, attendance, nominations]);
  const gapMetrics = useGapMetrics(tab, eligibilityResults, attendance);

  const tabNoms = useMemo(() => nominations.filter(n => normalizeTrainingType(n.trainingType) === activeNT), [nominations, activeNT]);
  const groups = useGroupedData(unified, 'Month', tabNoms, employees, masterTeams);
  const dataMonths = useMonthsFromData(unified);
  const timeSeries = useTimeSeries(groups, dataMonths, tab, tsMode);
  const trainerStats = useTrainerStats(unified);

  const tsChartData = useMemo(() => timeSeries.map(r => ({ label: r.label, ...r.cells })), [timeSeries]);
  const tsKeys = useMemo(() => {
    const keys = new Set<string>();
    timeSeries.forEach(r => Object.keys(r.cells).forEach(k => keys.add(k)));
    return Array.from(keys);
  }, [timeSeries]);

  const trainerScatterData = useMemo(() => {
    return trainerStats.map(t => ({ name: t.trainerId, volume: t.trainingsConducted, score: t.avgScore })).sort((a, b) => b.volume - a.volume).slice(0, 30);
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
            <select value={selectedFY} onChange={(e) => {
              setSelectedFY(e.target.value);
              setPageFilters(prev => ({ ...prev, month: '' })); // Clear conflicting month filter
            }} className="form-select border-none bg-transparent font-bold" title="Fiscal Year">
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
