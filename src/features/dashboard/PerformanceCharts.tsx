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
import API_BASE from '../../config/api';

import styles from './PerformanceCharts.module.css';

// --- COMPONENTS ---
import { HierarchicalTrendModel } from './components/HierarchicalTrendModel';
import { HierarchyController } from './components/HierarchyController';

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

import { useGlobalFilters as useAppGlobalFilters } from '../../core/context/GlobalFilterContext';

export const PerformanceCharts: React.FC<PerformanceChartsProps> = ({
  employees, attendance, scores, nominations, onNavigate
}) => {
  const { filters: globalFilters, setFilters: setAppFilters } = useAppGlobalFilters();
  const { teams: masterTeams, clusters: masterClusters, trainers: masterTrainers, eligibilityRules: rules, loading: masterDataLoading } = useMasterData();
  
  const [tabState, setTabState] = useState<string>('IP');
  const tab = globalFilters.trainingType !== 'ALL' ? globalFilters.trainingType : tabState;

  const [subView, setSubView] = useState<string>('performance');
  
  const selectedFY = globalFilters.fiscalYear;

  const { filters: pageFilters, setFilters: setPageFilters, activeFilterCount, clearFilters } = useGlobalFilters();
  const [tsMode, setTsMode] = useState<'score' | 'count'>('score');
  const isEngineDebugActive = useDebugStore(state => state.enabled);
  const [presentationMode, setPresentationMode] = useState(false);

  if (isEngineDebugActive) return null;
  if (masterDataLoading) return <div>Loading master data...</div>;

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
  // In the new system, fiscal year is global.
  // We can keep this for month sync if needed, but it might conflict.
  useEffect(() => {
    if (pageFilters.month) {
      const targetFY = getFYFromMonth(normalizeMonthStr(pageFilters.month));
      // In the new system, we should probably update the global filter if we want consistency,
      // but the user said "Inject filters into orchestrator hooks ONLY".
      // Let's just leave it for now or remove if it causes loops.
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
    ranked,
    trainerStats,
    months: dataMonths,
    timeSeries,
    resolutionLevel
  } = usePerformanceData({
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

  const tsChartData = useMemo(() => timeSeries.map((r) => ({ label: r.label, ...r.cells })), [timeSeries]);
  const tsKeys = useMemo(() => {
    const keys = new Set<string>();
    timeSeries.forEach((r) => Object.keys(r.cells).forEach(k => keys.add(k)));
    return Array.from(keys);
  }, [timeSeries]);

  const trainerScatterData = useMemo(() => {
    return trainerStats.map((t: any) => ({ name: t.trainerId, volume: t.trainingsConducted, score: t.avgScore })).sort((a: any, b: any) => b.volume - a.volume).slice(0, 30);
  }, [trainerStats]);

  // Use master data to build the full cluster/team hierarchy for the selector
  const clusterTeamMap = useMemo(() => {
    const map: Record<string, Set<string>> = {};
    masterTeams.forEach(t => {
      const cluster = t.cluster || 'Others';
      if (!map[cluster]) map[cluster] = new Set();
      map[cluster].add(t.teamName);
    });
    // Ensure all master clusters are present
    masterClusters.forEach(c => {
      if (!map[c.name]) map[c.name] = new Set();
    });
    return Object.fromEntries(
      Object.entries(map).map(([k, v]) => [k, Array.from(v)])
    );
  }, [masterTeams, masterClusters]);

  return (
    <div className={`${styles.chartsContainer} animate-fade-in`}>
      <div className="mb-24">
        <h1 className="text-2xl font-bold m-0">Performance Insights</h1>
        <p className="text-subtitle">Analysis for {tab} Training • {selectedFY}</p>
      </div>

      <div className="flex-between mb-20">
        <div className={styles.subViewNav}>
          <button className={`${styles.subViewBtn} ${styles.subViewBtnActive}`}><TrendingUp size={14} /> Hierarchical Trend Model</button>
        </div>

        <div className="flex-center gap-2">
          <button className="btn btn-secondary" onClick={() => onNavigate?.('performance-tables')} title="Switch to Tables"><Table size={16} /></button>
          <div className="v-divider mx-1" />
          <button className={`btn ${presentationMode ? 'btn-primary' : 'btn-secondary'}`} onClick={() => setPresentationMode(!presentationMode)} title="Presentation Mode">
            <TrendingUp size={16} /> {presentationMode ? 'Exit Presentation' : 'Present'}
          </button>
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
              const topTeams = ranked.filter(r => r.score > 80).map(r => masterTeams.find(t => t.teamName === r.name)?.id).filter(Boolean) as string[];
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
              const lowTeams = ranked.filter(r => r.score < 60).map(r => masterTeams.find(t => t.teamName === r.name)?.id).filter(Boolean) as string[];
              setPageFilters({ ...pageFilters, teams: lowTeams, trainers: [], clusters: [], month: '' });
            }} 
            className={styles.scenarioBtn}
          >
            <AlertTriangle size={14} className="text-danger" /> Risk Focus
          </motion.button>
        </div>
      )}

      <div className="flex h-full gap-4"> 
        {/* LEFT PANEL */} 
        <div className="w-[280px] flex-shrink-0"> 
          <HierarchyController 
            clusterTeamMap={clusterTeamMap}
            selectedClusters={pageFilters.clusters}
            selectedTeams={pageFilters.teams}
            onSelectCluster={(c) => setPageFilters({ ...pageFilters, clusters: [c], teams: [] })}
            onSelectTeam={(tName) => setPageFilters({ ...pageFilters, teams: [masterTeams.find(mt => mt.teamName === tName)?.id || ''], clusters: [] })}
            onClear={clearFilters}
          />
        </div>
        {/* RIGHT PANEL */} 
        <div className="flex-1 min-w-0"> 
          <HierarchicalTrendModel 
            tab={tab}
            selectedFY={selectedFY}
            resolutionLevel={resolutionLevel}
            timeSeries={timeSeries}
            ranked={ranked}
            gapMetrics={gapMetrics}
            activeNT={activeNT}
            MONTHS={MONTHS}
            filters={pageFilters}
            masterTeams={masterTeams}
          />
        </div>
      </div>
    </div>
  );
};








