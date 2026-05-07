import React, { useState, useMemo, useEffect } from 'react';
import { motion } from 'framer-motion';
import { Table, TrendingUp, Trophy, Users, AlertTriangle } from 'lucide-react';

import { Employee } from '../../types/employee';
import { Attendance, TrainingScore, TrainingNomination, Demographics } from '../../types/attendance';
import { useMasterData } from '../../core/context/MasterDataContext';
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

  const [presentationMode, setPresentationMode] = useState(false);

  // --- PRESENTATION MODE SIDEBAR HIDING ---
  useEffect(() => {
    if (presentationMode) {
      document.body.classList.add('presentation-active');
    } else {
      document.body.classList.remove('presentation-active');
    }
    return () => document.body.classList.remove('presentation-active');
  }, [presentationMode]);

  // Early exit for loading states (after all hooks)
  if (masterDataLoading) return <div>Loading master data...</div>;

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
      {/* View navigation removed for integrated architecture */}
      {/* Action layers removed for streamlined executive dashboard */}


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








