import React, { useState, useMemo, useEffect } from 'react';
import { ChevronRight, ChevronDown, Users, CheckCircle2, AlertTriangle, TrendingUp, Search, X, MapPin } from 'lucide-react';
import { usePlanningFlow } from '../../context/PlanningFlowContext';
import { Employee } from '../../types/employee';
import { Attendance, TrainingScore, TrainingNomination } from '../../types/attendance';
import { STATE_ZONE } from '../../seed/masterData';
import { computeGapAnalysis, GapAnalysisData, EmployeeGapDetail } from '../../services/gapAnalysisService';
import { applyEligibilityRules } from '../../services/applyEligibilityRules';
import { getCollection } from '../../services/apiClient';
import { KPIBox } from '../../components/KPIBox';
import { InsightStrip } from '../../components/InsightStrip';
import TopRightControls from '../../components/TopRightControls';
import { GlobalFilterPanel } from '../../components/GlobalFilterPanel';
import { GlobalFilters, getActiveFilterCount } from '../../context/filterContext';
import { getFiscalYears } from '../../utils/fiscalYear';
import { useFilterOptions } from '../../utils/computationHooks';
import { useMasterData } from '../../context/MasterDataContext';
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
  const [tab, setTab] = useState<TrainingTab>('AP');
  const [expanded, setExpanded] = useState(new Set<string>());
  const [zoneFilter, setZoneFilter] = useState<string>('');
  const FY_OPTIONS = getFiscalYears(2015);
  const [selectedFY, setSelectedFY] = useState<string>(FY_OPTIONS[0]);
  const [selectedTeams, setSelectedTeams] = useState<string[]>([]);
  const [pageFilters, setPageFilters] = useState<GlobalFilters>({ cluster: '', team: '', trainer: '', month: '' });
  const activeFilterCount = getActiveFilterCount(pageFilters);
  const [showGlobalFilters, setShowGlobalFilters] = useState(false);
  const [sortConfig, setSortConfig] = useState<{ key: 'total' | 'mr90', direction: 'asc' | 'desc' }>({ key: 'total', direction: 'desc' });

  // DB-loaded eligibility rules (loaded once on mount, reloaded when tab changes)
  const [dbRules, setDbRules] = useState<Record<string, any>>({});

  /** Convert DB rule format → flat format used by applyEligibilityRules */
  const convertDbRule = (raw: any): Record<string, any> | null => {
    if (!raw) return null;
    // Designation
    const desMode = raw.designation?.mode;
    let designations: string[] | 'ALL' = 'ALL';
    if (desMode === 'INCLUDE' && Array.isArray(raw.designation?.values) && raw.designation.values.length > 0) {
      designations = raw.designation.values.map((v: string) => v.toUpperCase());
    } else if (desMode === 'EXCLUDE') {
      // EXCLUDE mode: treat as ALL (gap analysis shows all, designation filter is advisory only)
      designations = 'ALL';
    }
    // Previous training prerequisites
    const preTraining: string[] = [];
    const preTrainingApplicableTo: string[] = [];
    if (raw.previousTraining?.mode === 'INCLUDE' && Array.isArray(raw.previousTraining?.values)) {
      raw.previousTraining.values.forEach((v: any) => {
        const type = typeof v === 'string' ? v : v?.type;
        if (type) preTraining.push(type.toUpperCase());
        if (Array.isArray(v?.designations) && v.designations.length > 0) {
          v.designations.forEach((d: string) => {
            if (!preTrainingApplicableTo.includes(d.toUpperCase())) preTrainingApplicableTo.push(d.toUpperCase());
          });
        }
      });
    }
    // Experience bracket
    const aplMode = raw.aplExperience?.mode;
    const minYears = aplMode === 'RANGE' ? (raw.aplExperience?.min ?? null) : null;
    const maxYears = aplMode === 'RANGE' ? (raw.aplExperience?.max ?? null) : null;

    return {
      designations,
      preTraining,
      preTrainingApplicableTo: preTrainingApplicableTo.length > 0 ? preTrainingApplicableTo : 'ALL',
      minYears,
      maxYears,
      noAPInNext90Days: raw.specialConditions?.noAPInNext90Days ?? false,
      preAPOnlyIfNominated: raw.specialConditions?.preAPOnlyIfInvited ?? false,
      excludeIfAlreadyTrained: false, // gap analysis always shows untrained pool
    };
  };

  useEffect(() => {
    getCollection('eligibility_rules')
      .then(rows => {
        const map: Record<string, any> = {};
        rows.forEach((r: any) => {
          if (r.trainingType) map[r.trainingType] = r;
        });
        setDbRules(map);
        console.log('[GAP] Loaded eligibility_rules from DB:', Object.keys(map));
      })
      .catch(err => console.warn('[GAP] Could not load DB eligibility rules, using static fallback:', err.message));
  }, []);

  useEffect(() => {
    setSelectedTeams([]);
  }, [tab]);

  // Get unique zones from masterData
  const zones = useMemo(() => {
    const uniqueZones = new Set(STATE_ZONE.map(sz => sz.zone));
    return ['All Zones', ...Array.from(uniqueZones).sort()];
  }, []);

  // dynamic lists for global filters
  const { allTeams, allTrainers } = useFilterOptions(employees, attendance, tab as any, masterTeams, masterTrainers);
  const allClusters = useMemo(() => masterClusters.map(c => c.name), [masterClusters]);
  const months = useMemo(() => {
    const m = new Set<string>();
    attendance.forEach(a => { if (a.month) m.add(a.month); if (a.attendanceDate) m.add((a.attendanceDate || '').substring(0,7)); });
    return [...m].sort();
  }, [attendance]);

  // Handlers for GlobalFilterPanel (page-scoped)
  const handleGlobalApply = (f: GlobalFilters) => {
    setPageFilters(f);
    setShowGlobalFilters(false);
  };

  const handleGlobalClear = () => {
    const cleared: GlobalFilters = { cluster: '', team: '', trainer: '', month: '' };
    setPageFilters(cleared);
    setShowGlobalFilters(false);
  };

  const { data, drilldownData } = useMemo(() => {
    const teamMap = Object.fromEntries(masterTeams.map(t => [t.id, t]));

    // Apply page-scoped filters to employees/attendance/nominations prior to gap computation
    let filteredEmployees = employees;
    if (pageFilters.cluster) {
      filteredEmployees = filteredEmployees.filter(emp => {
        if (!emp.teamId) {
          console.error("Assertion failed: teamId must be defined for employee", emp.employeeId);
          return false;
        }
        const cluster = teamMap[emp.teamId]?.cluster;
        if (!cluster) {
          console.error("Unmapped teamId:", emp.teamId);
          return false;
        }
        return cluster === pageFilters.cluster;
      });
    }
    
    if (pageFilters.team) {
      filteredEmployees = filteredEmployees.filter(emp => {
        // Assume global filter provides team name or ID consistently.
        return emp.teamId === pageFilters.team || emp.team === pageFilters.team;
      });
    }

    // Filter by zone if Refresher tab and zone filter selected
    if (tab === 'Refresher' && zoneFilter) {
      filteredEmployees = filteredEmployees.filter(emp => {
        const empZone = emp.zone || getZoneFromState(emp.state);
        return empZone === zoneFilter;
      });
    }

    const filteredAttendance = attendance.filter(a => {
      if (pageFilters.trainer && a.trainerId !== pageFilters.trainer) return false;
      if (pageFilters.month) {
        const m = a.month || (a.attendanceDate || '').substring(0,7);
        if (m !== pageFilters.month) return false;
      }
      return true;
    });

    const filteredNominations = nominations.filter(n => {
      if (pageFilters.month) {
        const m = n.notificationDate ? n.notificationDate.substring(0,7) : '';
        if (m !== pageFilters.month) return false;
      }
      return true;
    });

    console.log(`📊 GAP ANALYSIS: Tab=${tab}, Zone=${zoneFilter || 'All'}, FilteredEmployees=${filteredEmployees.length}, TotalEmployees=${employees.length}`);

    const strictlyEligibleEmployees = applyEligibilityRules(
      tab,
      filteredEmployees,
      filteredAttendance,
      filteredNominations,
      convertDbRule(dbRules[tab] ?? dbRules[tab.toUpperCase()] ?? null)
    );

    const result = computeGapAnalysis(tab, strictlyEligibleEmployees, filteredAttendance, filteredNominations, masterTeams, zoneFilter);
    console.log(`✓ RESULT for ${tab}: ${result.data.length} rows`);
    if (result.data.length > 0) {
      console.log(`  - Total Active: ${result.data.reduce((s, d) => s + d.totalActive, 0)}`);
      console.log(`  - Total Eligible: ${result.data.reduce((s, d) => s + d.eligible, 0)}`);
    }
    return result;
  }, [tab, employees, attendance, nominations, zoneFilter, masterTeams, dbRules]);

  const toggleExpanded = (key: string) => {
    const newExpanded = new Set(expanded);
    if (newExpanded.has(key)) newExpanded.delete(key);
    else newExpanded.add(key);
    setExpanded(newExpanded);
  };

  const toggleTeamSelection = (teamId: string) => {
    setSelectedTeams(prev => prev.includes(teamId) ? prev.filter(t => t !== teamId) : [...prev, teamId]);
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
      return sortConfig.direction === 'desc' ? valB - valA : valA - valB;
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

  const renderTable = () => {
    return (
      <div className={`glass-panel ${styles.tableCard}`}>
        <table className={`data-table ${styles.table}`}>
          <thead>
            <tr>
              <th className={styles.thCheck}></th>
              <th>Cluster / Team</th>
              <th 
                className={`${styles.thInteractive} ${styles.tdCenter}`}
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
              const indent = isCluster ? 0 : 20;

              if (!isCluster && !isExpanded) return null;

              return (
                <tr 
                  key={index} 
                  className={isCluster ? styles.trCluster : ''}
                >
                  <td className={styles.td}>
                    {isCluster ? (
                      <button
                        onClick={() => toggleExpanded(row.cluster)}
                        className={styles.expandBtn}
                      >
                        {isExpanded ? <ChevronDown size={16} /> : <ChevronRight size={16} />}
                      </button>
                    ) : (
                      <input 
                        type="checkbox" 
                        checked={selectedTeams.includes(row.teamId || '')}
                        onChange={() => toggleTeamSelection(row.teamId || '')}
                        className={styles.checkbox}
                        title={`Select ${row.team}`}
                        aria-label={`Select ${row.team}`}
                      />
                    )}
                  </td>
                  <td 
                    className={`${styles.td} ${isCluster ? styles.indent0 : styles.indent1}`}
                  >
                    <span className={`${isCluster ? styles.teamNameCluster : styles.teamNameCell} ${!isCluster ? styles.teamNameIndented : ''}`}>
                      {isCluster ? row.cluster : `↳ ${row.team}`}
                    </span>
                  </td>
                  <td className={`${styles.td} ${styles.tdCenter} ${styles.valCellBold}`}>{row.untrained}</td>
                  
                  <td className={`${styles.td} ${styles.tdCenter} ${styles.valCell}`}>{row.mrUntrained || '-'}</td>
                  <td className={`${styles.td} ${styles.tdCenter} ${getAgingClass(row.mrOver90)}`}>{row.mrOver90 || '-'}</td>
                  
                  <td className={`${styles.td} ${styles.tdCenter} ${styles.valCell}`}>{row.flmUntrained || '-'}</td>
                  <td className={`${styles.td} ${styles.tdCenter} ${getAgingClass(row.flmOver90)}`}>{row.flmOver90 || '-'}</td>
                  
                  <td className={`${styles.td} ${styles.tdCenter} ${styles.valCell}`}>{row.slmUntrained || '-'}</td>
                  <td className={`${styles.td} ${styles.tdCenter} ${getAgingClass(row.slmOver90)}`}>{row.slmOver90 || '-'}</td>
                  
                  <td className={`${styles.td} ${styles.tdCenter} ${styles.batchCountCell}`}>{Math.ceil((row.untrained || 0) / 40)}</td>
                </tr>
              );
            })}
          </tbody>
        </table>
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
          fiscalOptions={FY_OPTIONS}
          selectedFY={selectedFY}
          onChangeFY={(v) => setSelectedFY(v)}
          onOpenGlobalFilters={() => setShowGlobalFilters(true)}
          onExport={() => alert('Export not available for Training Requirements (UI placeholder)')}
          activeFilterCount={activeFilterCount}
        />
      </div>

      {/* Tabs - Pill Style */}
      <div className={styles.tabs}>
        {(['AP', 'MIP', 'Refresher', 'Capsule'] as TrainingTab[]).map(t => (
          <button
            key={t}
            className={`${styles.tab} ${tab === t ? styles.tabActive : ''}`}
            onClick={() => setTab(t)}
          >
            {t}
          </button>
        ))}
      </div>

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
      <GlobalFilterPanel
        isOpen={showGlobalFilters}
        onClose={() => setShowGlobalFilters(false)}
        onApply={handleGlobalApply}
        initialFilters={pageFilters}
        clusterOptions={allClusters}
        teamOptions={allTeams}
        trainerOptions={allTrainers}
        monthOptions={months}
        onClearAll={handleGlobalClear}
      />
    </div>
  );
};

