import React, { useState, useMemo, useEffect } from 'react';
import { ChevronRight, ChevronDown, Users, CheckCircle2, AlertTriangle, TrendingUp, Search, X, MapPin } from 'lucide-react';
import { usePlanningFlow } from '../../context/PlanningFlowContext';
import { Employee } from '../../types/employee';
import { Attendance, TrainingScore, TrainingNomination } from '../../types/attendance';
import { STATE_ZONE } from '../../seed/masterData';
import { computeGapAnalysis, GapAnalysisData, EmployeeGapDetail } from '../../services/gapAnalysisService';
import { applyEligibilityRules } from '../../services/applyEligibilityRules';
import { KPIBox } from '../../components/KPIBox';
import { InsightStrip } from '../../components/InsightStrip';
import TopRightControls from '../../components/TopRightControls';
import { GlobalFilterPanel } from '../../components/GlobalFilterPanel';
import { GlobalFilters, getActiveFilterCount } from '../../context/filterContext';
import { getFiscalYears } from '../../utils/fiscalYear';
import { TEAM_CLUSTER_MAP } from '../../services/clusterMap';
import { useFilterOptions } from '../../utils/computationHooks';
import { useMasterData } from '../../context/MasterDataContext';

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
    // Apply page-scoped filters to employees/attendance/nominations prior to gap computation
    let filteredEmployees = employees;
    if (pageFilters.cluster) filteredEmployees = filteredEmployees.filter(emp => (emp.state || '') === pageFilters.cluster);
    if (pageFilters.team) filteredEmployees = filteredEmployees.filter(emp => (emp.team || '') === pageFilters.team);

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
      filteredNominations
    );

    const result = computeGapAnalysis(tab, strictlyEligibleEmployees, filteredAttendance, filteredNominations, masterTeams, zoneFilter);
    console.log(`✓ RESULT for ${tab}: ${result.data.length} rows`);
    if (result.data.length > 0) {
      console.log(`  - Total Active: ${result.data.reduce((s, d) => s + d.totalActive, 0)}`);
      console.log(`  - Total Eligible: ${result.data.reduce((s, d) => s + d.eligible, 0)}`);
    }
    return result;
  }, [tab, employees, attendance, nominations, zoneFilter, masterTeams]);

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
      <div className="gap-filter-container">
        <span className="gap-filter-label">
          <MapPin size={16} />
          Zone:
        </span>
        <select
          value={zoneFilter}
          onChange={(e) => setZoneFilter(e.target.value)}
          className="gap-select"
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
      <div className="gap-empty-state">
        <div className="gap-empty-icon">📊</div>
        <div className="gap-empty-title">No Data Available</div>
        <div className="gap-empty-text">No eligible employees found for {tab} training</div>
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

  const getAgingColor = (val?: number) => {
    if (!val) return 'inherit';
    if (val > 15) return 'var(--danger)';
    if (val >= 5) return 'var(--warning)';
    return 'var(--success)';
  };

  const renderTable = () => {
    return (
      <div className="gap-table-container glass-panel">
        <table className="data-table gap-data-table">
          <thead>
            <tr>
              <th style={{ width: '40px' }}></th>
              <th>Cluster / Team</th>
              <th 
                style={{ textAlign: 'center', cursor: 'pointer', userSelect: 'none' }}
                onClick={() => handleSort('total')}
              >
                Total {renderSortIndicator('total')}
              </th>
              <th style={{ textAlign: 'center' }}>MR</th>
              <th 
                style={{ textAlign: 'center', cursor: 'pointer', userSelect: 'none' }}
                onClick={() => handleSort('mr90')}
              >
                MR &gt;90 {renderSortIndicator('mr90')}
              </th>
              <th style={{ textAlign: 'center' }}>FLM</th>
              <th style={{ textAlign: 'center' }}>FLM &gt;90</th>
              <th style={{ textAlign: 'center' }}>SLM</th>
              <th style={{ textAlign: 'center' }}>SLM &gt;90</th>
              <th style={{ textAlign: 'center' }} title="Ceil(Total / 40)">Batches</th>
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
                  style={{ background: isCluster ? 'rgba(0,0,0,0.1)' : 'transparent' }}
                >
                  <td>
                    {isCluster ? (
                      <button
                        onClick={() => toggleExpanded(row.cluster)}
                        style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--text-secondary)' }}
                      >
                        {isExpanded ? <ChevronDown size={16} /> : <ChevronRight size={16} />}
                      </button>
                    ) : (
                      <input 
                        type="checkbox" 
                        checked={selectedTeams.includes(row.teamId || '')}
                        onChange={() => toggleTeamSelection(row.teamId || '')}
                        style={{ cursor: 'pointer', marginLeft: '12px' }}
                      />
                    )}
                  </td>
                  <td 
                    style={{ paddingLeft: `${indent}px`, fontWeight: isCluster ? 600 : 400, color: !isCluster ? 'var(--accent-primary)' : 'inherit' }}
                  >
                    {isCluster ? row.cluster : `↳ ${row.team}`}
                  </td>
                  <td style={{ textAlign: 'center', fontWeight: 600 }}>{row.untrained}</td>
                  
                  <td style={{ textAlign: 'center' }}>{row.mrUntrained || '-'}</td>
                  <td style={{ textAlign: 'center', color: getAgingColor(row.mrOver90), fontWeight: row.mrOver90 ? 600 : 400 }}>{row.mrOver90 || '-'}</td>
                  
                  <td style={{ textAlign: 'center' }}>{row.flmUntrained || '-'}</td>
                  <td style={{ textAlign: 'center', color: getAgingColor(row.flmOver90), fontWeight: row.flmOver90 ? 600 : 400 }}>{row.flmOver90 || '-'}</td>
                  
                  <td style={{ textAlign: 'center' }}>{row.slmUntrained || '-'}</td>
                  <td style={{ textAlign: 'center', color: getAgingColor(row.slmOver90), fontWeight: row.slmOver90 ? 600 : 400 }}>{row.slmOver90 || '-'}</td>
                  
                  <td style={{ textAlign: 'center', fontWeight: 600, color: 'var(--accent-secondary)' }}>{Math.ceil((row.untrained || 0) / 40)}</td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    );
  };

  return (
    <div style={{ padding: '24px' }}>
      {/* Page Header */}
      <div style={{ marginBottom: '24px', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
        <div>
          <h1 style={{ margin: 0, fontSize: '28px', fontWeight: 700 }}>Training Requirement</h1>
          <p style={{ color: 'var(--text-secondary)', margin: '8px 0 0 0', fontSize: '13px' }}>Untrained population requiring training</p>
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
      <div className="gap-tabs">
        {(['AP', 'MIP', 'Refresher', 'Capsule'] as TrainingTab[]).map(t => (
          <button
            key={t}
            className={`gap-tab ${tab === t ? 'gap-tab-active' : ''}`}
            onClick={() => setTab(t)}
          >
            {t}
          </button>
        ))}
      </div>

      {selectedTeams.length > 0 && (
        <div style={{ background: 'var(--accent-primary)', color: 'white', padding: '16px 24px', borderRadius: '8px', marginBottom: '24px', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <div>Selected Teams: <strong>{selectedTeams.length}</strong></div>
          <button 
            className="btn" 
            style={{ background: 'white', color: 'var(--accent-primary)', fontWeight: 600, border: 'none' }}
            onClick={() => {
              setSelectionSession({ trainingType: tab, fiscalYear: selectedFY, teams: selectedTeams });
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

