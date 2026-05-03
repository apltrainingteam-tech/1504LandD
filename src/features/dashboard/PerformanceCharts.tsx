import React, { useState, useMemo, useEffect } from 'react';
import { motion } from 'framer-motion';
import { Table, TrendingUp, Trophy, Users, AlertTriangle } from 'lucide-react';

import { Employee } from '../../types/employee';
import { Attendance, TrainingScore, TrainingNomination, Demographics } from '../../types/attendance';
import { useMasterData } from '../../core/context/MasterDataContext';
import { useDebugStore } from '../../core/debug/debugStore';
import { usePerformanceData } from './hooks/usePerformanceData';
import { useGlobalFilters } from '../../core/context/GlobalFilterContext';

import styles from './PerformanceCharts.module.css';

// --- COMPONENTS ---
import { HierarchicalTrendModel } from './components/HierarchicalTrendModel';
import { HierarchyController } from './components/HierarchyController';

interface PerformanceChartsProps {
  employees: Employee[];
  attendance: Attendance[];
  scores: TrainingScore[];
  nominations: TrainingNomination[];
  demographics: Demographics[];
  onNavigate?: (view: any) => void;
}

export const PerformanceCharts: React.FC<PerformanceChartsProps> = ({
  employees,
  attendance,
  scores,
  nominations,
  onNavigate
}) => {
  const { filters: globalFilters, setFilters: setGlobalFilters } = useGlobalFilters();
  const { teams: masterTeams, clusters: masterClusters, loading: masterDataLoading } = useMasterData();
  
  const [tabState] = useState<string>('IP');
  const tab = globalFilters.trainingType !== 'ALL' ? globalFilters.trainingType : tabState;
  
  const selectedFY = globalFilters.fiscalYear;

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

  const {
    activeNT,
    rawUnified,
    ranked,
    timeSeries,
    resolutionLevel,
    gapMetrics
  } = usePerformanceData({
    tab,
    selectedFY,
    filter: {
      monthFrom: '', 
      monthTo: '',
      teams: globalFilters.team ? [globalFilters.team] : [],
      clusters: globalFilters.cluster ? [globalFilters.cluster] : [],
      trainer: globalFilters.trainer !== 'ALL' ? globalFilters.trainer : ''
    },
    viewBy: 'Month',
    tsMode: 'score',
    pageMode: 'performance-charts',
    employees,
    attendance,
    scores,
    nominations
  });

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

  // --- QUICK SCENARIO BUTTONS ---
  const handleClearAll = () => {
    setGlobalFilters({ cluster: null, team: null, trainer: 'ALL' });
  };

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
          <motion.button whileHover={{ y: -2 }} whileTap={{ scale: 0.98 }} onClick={handleClearAll} className={styles.scenarioBtn}>
            <Users size={14} /> Full Snapshot
          </motion.button>
          <motion.button 
            whileHover={{ y: -2 }} 
            whileTap={{ scale: 0.98 }} 
            onClick={() => {
              // Scenario: Only show teams with Elite members
              const topTeamId = ranked.filter(r => r.score > 80).map(r => masterTeams.find(t => t.teamName === r.name)?.id).filter(Boolean)[0];
              if (topTeamId) setGlobalFilters({ team: topTeamId, cluster: null });
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
              const lowTeamId = ranked.filter(r => r.score < 60).map(r => masterTeams.find(t => t.teamName === r.name)?.id).filter(Boolean)[0];
              if (lowTeamId) setGlobalFilters({ team: lowTeamId, cluster: null });
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
            selectedCluster={globalFilters.cluster}
            selectedTeam={globalFilters.team}
            onSelectCluster={(c) => setGlobalFilters({ cluster: c, team: null })}
            onSelectTeam={(cName, tName) => {
              // Resolve teamId if possible, else use name
              const teamId = masterTeams.find(mt => mt.teamName === tName)?.id || tName;
              setGlobalFilters({ cluster: cName, team: teamId });
            }}
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
            filters={globalFilters}
            masterTeams={masterTeams}
            rawUnified={rawUnified}
          />
        </div>
      </div>
    </div>
  );
};








