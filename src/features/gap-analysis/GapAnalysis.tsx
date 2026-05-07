import React, { useState, useMemo, useEffect } from 'react';
import { ChevronRight, ChevronDown, Users, CheckCircle2, AlertTriangle, TrendingUp, Search, X, MapPin } from 'lucide-react';
import { usePlanningFlow } from '../../core/context/PlanningFlowContext';
import { Employee } from '../../types/employee';
import { Attendance, TrainingScore, TrainingNomination } from '../../types/attendance';
import { STATE_ZONE } from '../../seed/masterData';
import { useGapAnalysisData } from './hooks/useGapAnalysisData';
import { KPIBox } from '../../shared/components/ui/KPIBox';
import { InsightStrip } from '../../features/dashboard/components/InsightStrip';
import TopRightControls from '../../shared/components/ui/TopRightControls';
import { GlobalFilters, getActiveFilterCount, INITIAL_FILTERS } from '../../core/context/filterContext';
import { useFilterOptions } from '../../shared/hooks/computationHooks';
import { useMasterData } from '../../core/context/MasterDataContext';
import { sortClusters, CLUSTER_ORDER, formatDisplayText } from '../../core/engines/normalizationEngine';
import { GapAnalysisData } from '../../core/engines/gapEngine';
import { useGlobalFilters } from '../../core/context/GlobalFilterContext';
import styles from './GapAnalysis.module.css';

// Zone lookup from state
const getZoneFromState = (state?: string): string => {
  if (!state) return 'Unknown';
  const normalized = state.toUpperCase().trim();
  const stateZone = STATE_ZONE.find(sz => sz.state.toUpperCase() === normalized);
  return stateZone?.zone || 'Unknown';
};

interface GapAnalysisProps {
  employees: Employee[];
  attendance: Attendance[];
  nominations: TrainingNomination[];
  onNavigate?: (view: any) => void;
}

type TrainingTab = 'AP' | 'MIP' | 'Refresher' | 'Capsule';

export const GapAnalysis: React.FC<GapAnalysisProps> = ({ employees, attendance, nominations, onNavigate }) => {
  const { trainers: masterTrainers, teams: masterTeams, clusters: masterClusters } = useMasterData();
  const { setSelectionSession } = usePlanningFlow();
  // ✅ Single Source of Truth — read tab and FY from GlobalFilterContext
  const { filters: globalFilters } = useGlobalFilters();
  const tab = (globalFilters.trainingType !== 'ALL' ? globalFilters.trainingType : 'AP') as TrainingTab;
  const selectedFY = globalFilters.fiscalYear;

  const [expanded, setExpanded] = useState(new Set<string>());
  const [zoneFilter, setZoneFilter] = useState<string>('');
  const [selectedTeams, setSelectedTeams] = useState<string[]>([]);
  const [pageFilters, setPageFilters] = useState<GlobalFilters>(INITIAL_FILTERS);
  const activeFilterCount = getActiveFilterCount(pageFilters);
  const [sortConfig, setSortConfig] = useState<{ key: 'total' | 'mr90', direction: 'asc' | 'desc' }>({ key: 'total', direction: 'desc' });

  // Orchestrated Data
  const { data, drilldownData } = useGapAnalysisData(tab, employees, attendance, nominations, masterTeams, pageFilters, zoneFilter);

  // Reset team selection when the global training type changes
  useEffect(() => {
    setSelectedTeams([]);
  }, [tab]);

  const toggleExpanded = (key: string) => {
    const newExpanded = new Set(expanded);
    if (newExpanded.has(key)) newExpanded.delete(key);
    else newExpanded.add(key);
    setExpanded(newExpanded);
  };

  const toggleTeamSelection = (teamId: string) => {
    setSelectedTeams(prev => prev.includes(teamId) ? prev.filter(t => t !== teamId) : [...prev, teamId]);
  };

  // Get unique zones from masterData
  const zones = useMemo(() => {
    const uniqueZones = new Set(STATE_ZONE.map(sz => sz.zone));
    return ['All Zones', ...Array.from(uniqueZones).sort()];
  }, []);

  // dynamic lists for global filters
  const { allTeams, allTrainers } = useFilterOptions(employees, attendance, tab as any, masterTrainers);
  const allClusters = useMemo(() => masterClusters.map(c => c.name), [masterClusters]);
  const months = useMemo(() => {
    const m = new Set<string>();
    attendance.forEach(a => { 
      if (a.month) m.add(a.month); 
      if (a.attendanceDate) m.add((a.attendanceDate || '').substring(0,7)); 
    });
    return [...m].sort();
  }, [attendance]);

  // Handlers for GlobalFilterPanel (page-scoped)
  const handleGlobalApply = (f: GlobalFilters) => {
    setPageFilters(f);
  };

  const handleGlobalClear = () => {
    setPageFilters(INITIAL_FILTERS);
  };

  const sortedData = useMemo(() => {
    const clusters = data.filter(d => d.team === '');
    const teams = data.filter(d => d.team !== '');
    
    const getValue = (row: GapAnalysisData) => {
      if (sortConfig.key === 'total') return row.untrained || 0;
      if (sortConfig.key === 'mr90') return row.mrOver90 || 0;
      return 0;
    };

    clusters.sort((a, b) => {
      const valA = getValue(a);
      const valB = getValue(b);
      
      // If a metric sort is active and values are different, use that
      if (sortConfig.key !== null && valA !== valB) {
        return sortConfig.direction === 'desc' ? valB - valA : valA - valB;
      }

      // Default/Fallback to Cluster Order
      const orderMap = new Map(CLUSTER_ORDER.map((c, i) => [c.toLowerCase(), i]));
      const idxA = orderMap.get(a.cluster.toLowerCase()) ?? 999;
      const idxB = orderMap.get(b.cluster.toLowerCase()) ?? 999;
      return idxA - idxB || a.cluster.localeCompare(b.cluster);
    });

    const finalData: GapAnalysisData[] = [];
    clusters.forEach(c => {
      finalData.push(c);
      const cTeams = teams.filter(t => t.cluster === c.cluster);
      cTeams.sort((a, b) => {
        const valA = getValue(a);
        const valB = getValue(b);
        return sortConfig.direction === 'desc' ? valB - valA : valA - valB;
      });
      finalData.push(...cTeams);
    });
    return finalData;
  }, [data, sortConfig]);

  const renderZoneFilter = () => {
    if (tab !== 'Refresher') return null;
    return (
      <div className={styles.zoneFilter}>
        <span className={styles.zoneFilterLabel}>
          <MapPin size={16} />
          Zone:
        </span>
        <select
          value={zoneFilter}
          onChange={(e) => setZoneFilter(e.target.value)}
          className={styles.zoneSelect}
          title="Zone Filter"
          aria-label="Zone Filter"
        >
          {zones.map(zone => (
            <option key={zone} value={zone === 'All Zones' ? '' : zone}>
              {zone}
            </option>
          ))}
        </select>
      </div>
    );
  };

  const renderEmptyState = () => {
    if (data.length > 0) return null;
    return (
      <div className={styles.emptyState}>
        <div className={styles.emptyIcon}>📊</div>
        <div className={styles.emptyTitle}>No Data Available</div>
        <p>No eligible employees found for {tab} training</p>
      </div>
    );
  };

  const handleSort = (key: 'total' | 'mr90') => {
    if (sortConfig.key === key) {
      setSortConfig({ key, direction: sortConfig.direction === 'desc' ? 'asc' : 'desc' });
    } else {
      setSortConfig({ key, direction: 'desc' });
    }
  };

  const renderSortIndicator = (key: 'total' | 'mr90') => {
    if (sortConfig.key !== key) return null;
    return sortConfig.direction === 'desc' ? '↓' : '↑';
  };

  const getAgingClass = (val?: number) => {
    if (!val) return styles.agingNormal;
    if (val > 15) return styles.agingDanger;
    if (val >= 5) return styles.agingWarning;
    return styles.agingSuccess;
  };

  const getTotalStyle = (val: number) => {
    if (val > 10) return styles.totalHigh;
    if (val > 0 && val <= 3) return styles.totalLow;
    return styles.totalNormal;
  };

  const renderTable = () => {
    return (
      <div className={`glass-panel ${styles.tableCard}`}>
        <div className={styles.tableScrollWrapper}>
          <table className={styles.table}>
            <thead>
              <tr>
                <th className={styles.thCheck}></th>
                <th className={styles.thSticky}>Cluster / Team</th>
                <th 
                  className={`${styles.thInteractive} ${styles.tdCenter} ${styles.thTotal} ${styles.thStickyTotal}`}
                  onClick={() => handleSort('total')}
                >
                  Total {renderSortIndicator('total')}
                </th>
                <th className={styles.tdCenter}>MR</th>
                <th 
                  className={`${styles.thInteractive} ${styles.tdCenter}`}
                  onClick={() => handleSort('mr90')}
                >
                  MR &gt;90 {renderSortIndicator('mr90')}
                </th>
                <th className={styles.tdCenter}>FLM</th>
                <th className={styles.tdCenter}>FLM &gt;90</th>
                <th className={styles.tdCenter}>SLM</th>
                <th className={styles.tdCenter}>SLM &gt;90</th>
                <th className={styles.tdCenter} title="Ceil(Total / 40)">Batches</th>
              </tr>
            </thead>
            <tbody>
              {sortedData.map((row: GapAnalysisData, index: number) => {
                const isCluster = row.team === '';
                const isExpanded = expanded.has(row.cluster);

                if (!isCluster && !isExpanded) return null;

                const totalValue = row.untrained || 0;

                return (
                  <tr 
                    key={index} 
                    className={`${isCluster ? styles.trCluster : styles.trTeam} ${selectedTeams.includes(row.teamId || '') ? styles.trSelected : ''}`}
                  >
                    <td className={styles.tdCheckCell}>
                      {isCluster ? (
                        <button
                          onClick={() => toggleExpanded(row.cluster)}
                          className={`${styles.expandBtn} ${isExpanded ? styles.expanded : ''}`}
                        >
                          <ChevronRight size={14} strokeWidth={2.5} />
                        </button>
                      ) : (
                        <input 
                          type="checkbox" 
                          checked={selectedTeams.includes(row.teamId || '')}
                          onChange={() => toggleTeamSelection(row.teamId || '')}
                          className={styles.checkbox}
                        />
                      )}
                    </td>
                    <td className={`${styles.td} ${styles.thSticky} ${isCluster ? styles.tdClusterName : styles.tdTeamName}`}>
                      <span>
                        {isCluster ? formatDisplayText(row.cluster) : formatDisplayText(row.team)}
                      </span>
                    </td>
                    <td className={`${styles.td} ${styles.tdCenter} ${styles.tdTotal} ${styles.thStickyTotal} ${getTotalStyle(totalValue)}`}>
                      {totalValue}
                    </td>
                    
                    <td className={`${styles.td} ${styles.tdCenter} ${styles.valCell}`}>{row.mrUntrained || '-'}</td>
                    <td className={`${styles.td} ${styles.tdCenter} ${getAgingClass(row.mrOver90)}`}>{row.mrOver90 || '-'}</td>
                    
                    <td className={`${styles.td} ${styles.tdCenter} ${styles.valCell}`}>{row.flmUntrained || '-'}</td>
                    <td className={`${styles.td} ${styles.tdCenter} ${getAgingClass(row.flmOver90)}`}>{row.flmOver90 || '-'}</td>
                    
                    <td className={`${styles.td} ${styles.tdCenter} ${styles.valCell}`}>{row.slmUntrained || '-'}</td>
                    <td className={`${styles.td} ${styles.tdCenter} ${getAgingClass(row.slmOver90)}`}>{row.slmOver90 || '-'}</td>
                    
                    <td className={`${styles.td} ${styles.tdCenter} ${styles.batchCountCell}`}>{Math.ceil(totalValue / 40)}</td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </div>
    );
  };

  return (
    <div className={`animate-fade-in ${styles.page}`}>
      {/* Page Header */}
      <div className={styles.header}>
        <div>
          <h1 className={styles.title}>Training Requirement</h1>
          <p className={styles.subtitle}>Untrained population requiring training</p>
        </div>
        <TopRightControls
          onExport={() => alert('Export not available for Training Requirements (UI placeholder)')}
          activeFilterCount={activeFilterCount}
        />
      </div>

      {/* TABS REMOVED - Driven by GlobalFilterContext */}
      
      {selectedTeams.length > 0 && (
        <div className={styles.selectionBanner}>
          <div className={styles.selectionText}>Selected Teams: <strong>{selectedTeams.length}</strong></div>
          <button 
            className={styles.selectionBtn}
            onClick={() => {
              const selectedTeamNames = selectedTeams.map(id => masterTeams.find(t => t.id === id)?.teamName || 'Unknown');
              setSelectionSession({ trainingType: tab, fiscalYear: selectedFY, teams: selectedTeamNames, teamIds: selectedTeams });
              onNavigate?.('calendar');
            }}
          >
            Proceed to Planning →
          </button>
        </div>
      )}

      {renderZoneFilter()}

      {renderEmptyState()}
      {data.length > 0 && renderTable()}
    </div>
  );
};










