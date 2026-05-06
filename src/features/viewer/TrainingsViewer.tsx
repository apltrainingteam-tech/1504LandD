import React, { useState, useMemo } from 'react';
import { Search, Filter, MapPin, Users, CheckCircle2, TrendingUp, BookOpen } from 'lucide-react';
import { Employee } from '../../types/employee';
import { Attendance, TrainingScore } from '../../types/attendance';
import { SCORE_SCHEMAS } from '../../types/reports';
import { STATE_ZONE } from '../../seed/masterData';
import { useTrainingsViewerData } from './hooks/useTrainingsViewerData';
import { DataTable } from '../../shared/components/ui/DataTable';
import { Filters } from '../../shared/components/ui/Filters';
import { KPIBox } from '../../shared/components/ui/KPIBox';
import { InsightStrip } from '../../features/dashboard/components/InsightStrip';
import { formatDateForDisplay } from '../../core/utils/dateParser';
import { displayScore } from '../../core/utils/scoreNormalizer';
import TopRightControls from '../../shared/components/ui/TopRightControls';
import { GlobalFilters, getActiveFilterCount, INITIAL_FILTERS } from '../../core/context/filterContext';
import { getFiscalYears, getFiscalYearFromDate } from '../../core/utils/fiscalYear';
import { normalizeText } from '../../core/utils/textNormalizer';
import { getSchema } from '../../core/constants/trainingSchemas';
import { useFilterOptions } from '../../shared/hooks/computationHooks';
import { normalizeTrainingType } from '../../core/engines/normalizationEngine';
import { useMasterData } from '../../core/context/MasterDataContext';
import styles from './TrainingsViewer.module.css';

// Training type normalization
const trainingTypeMap: Record<string, string> = {
  'REFRESHER_SO': 'Refresher',
  'REFRESHER_MANAGER': 'Refresher',
  'REFRESHER': 'Refresher',
  'CAPSULE': 'Capsule',
};

const normalizeType = (value?: string) => normalizeTrainingType(value || '');

// Zone lookup from state
const getZoneFromState = (state?: string): string => {
  if (!state) return 'Unknown';
  const normalized = state.toUpperCase().trim();
  const stateZone = STATE_ZONE.find(sz => sz.state.toUpperCase() === normalized);
  return stateZone?.zone || 'Unknown';
};

interface TrainingsViewerProps {
  employees: Employee[];
  attendance: Attendance[];
  scores: TrainingScore[];
}

export const TrainingsViewer: React.FC<TrainingsViewerProps> = ({ employees, attendance, scores }) => {
  const { trainers: masterTrainers, teams: masterTeams, clusters: masterClusters } = useMasterData();
  const [tab, setTab] = useState('IP');
  const [search, setSearch] = useState('');
  const [selectedZone, setSelectedZone] = useState('All Zones');
  const FY_OPTIONS = getFiscalYears(2015);
  const [selectedFY, setSelectedFY] = useState<string>(FY_OPTIONS[0]);
  const [pageFilters, setPageFilters] = useState<GlobalFilters>(INITIAL_FILTERS);
  const activeFilterCount = getActiveFilterCount(pageFilters);

  // Get unique zones
  const zones = useMemo(() => {
    const uniqueZones = new Set(STATE_ZONE.map(sz => sz.zone));
    return ['All Zones', ...Array.from(uniqueZones).sort()];
  }, []);

  const { filtered, kpis } = useTrainingsViewerData(tab, employees, attendance, scores, selectedFY, selectedZone, pageFilters, search, masterTeams);

  const { allTeams, allTrainers } = useFilterOptions(employees, attendance, tab, masterTrainers);
  const allClusters = useMemo(() => masterClusters.map(c => c.name), [masterClusters]);
  const months = useMemo(() => {
    const s = new Set<string>();
    attendance.forEach(a => { 
      if (a.month) s.add(a.month); 
      if (a.attendanceDate) s.add((a.attendanceDate||'').substring(0,7)); 
    });
    return [...s].sort();
  }, [attendance]);

  // Handlers for GlobalFilterPanel (page-scoped)
  const handleGlobalApply = (f: GlobalFilters) => {
    setPageFilters(f);
  };

  const handleGlobalClear = () => {
    setPageFilters(INITIAL_FILTERS);
  };

  const schemaObj = getSchema(tab);
  const schema = schemaObj.scoreFields;
  const labels = schemaObj.scoreLabels;
  
  const headers = [
    'Aadhaar', 'Emp ID', 'Mobile', 'Name', 'Trainer', 'Team', 'HQ', 'State', 'Date', 'Status', 
    ...schema.map(k => labels[k] || k)
  ];

  return (
    <div className={`animate-fade-in ${styles.page}`}>
      {/* Page Header */}
      <div className={styles.header}>
        <div>
          <h1 className={styles.title}>Training Data</h1>
          <p className={styles.subtitle}>Standardized historical training records and participation data</p>
        </div>
        <TopRightControls
          fiscalOptions={FY_OPTIONS}
          selectedFY={selectedFY}
          onChangeFY={(v) => setSelectedFY(v)}
          onExport={() => alert('Export not implemented for Training Data (UI placeholder)')}
          activeFilterCount={activeFilterCount}
        />
      </div>

      {/* Filter Controls Row */}
      <div className={styles.filterRow}>
        {/* Training Type Tabs */}
        <Filters 
          options={['IP', 'AP', 'MIP', 'REFRESHER', 'CAPSULE', 'PRE_AP']} 
          activeOption={tab} 
          onChange={setTab} 
        />

        {/* Zone Filter */}
        <div className={styles.zoneFilter}>
          <MapPin size={16} style={{ color: 'var(--text-secondary)' }} />
          <select 
            value={selectedZone} 
            onChange={(e) => setSelectedZone(e.target.value)}
            className={`gap-select ${styles.zoneSelect}`}
            title="Selected Zone"
            aria-label="Selected Zone"
          >
            {zones.map(zone => (
              <option key={zone} value={zone}>{zone}</option>
            ))}
          </select>
        </div>
      </div>

      {/* KPI Cards */}
      <div className={styles.kpiGrid}>
        <KPIBox title="Total Records" value={kpis.total} icon={BookOpen} />
        <KPIBox title="Present %" value={`${kpis.attPercent}%`} color="var(--success)" icon={CheckCircle2} />
        <KPIBox title="Avg Score" value={kpis.avg} color="var(--accent-primary)" icon={TrendingUp} />
        <KPIBox title="Total Trainings" value={kpis.totalUnified} color="var(--warning)" icon={Users} />
      </div>

      {/* Insight Strip */}
      <InsightStrip
        text="Attendance strong overall; 15% records below performance threshold; Mumbai cluster shows variability."
        variant="primary"
        icon="trending"
      />

      {/* Table Container */}
      <div className={`glass-panel ${styles.tableContainer}`}>
        {/* Table Toolbar */}
        <div className={styles.toolbar}>
          <div className={styles.searchWrapper}>
            <Search size={16} className={styles.searchIcon} />
            <input 
              type="text" 
              className={`form-input ${styles.searchInput}`} 
              placeholder="Search by name, ID, or Aadhaar…" 
              value={search}
              onChange={e => setSearch(e.target.value)}
            />
          </div>
          {/* Inline toolbar filter removed — use GlobalFilterPanel via TopRightControls */}
        </div>

        {/* Data Table */}
        <DataTable headers={headers} maxHeight="calc(100vh - 500px)">
          {filtered.length === 0 ? (
            <tr><td colSpan={headers.length} className={styles.emptyRow}>No training records found.</td></tr>
          ) : filtered.map((r, i) => (
            <tr key={i}>
              <td className={styles.tdAadhaar}>{r.employee.aadhaarNumber || '—'}</td>
              <td className={styles.tdEmpId}>{r.employee.employeeId}</td>
              <td className={styles.tdMobile}>{r.employee.mobileNumber || '—'}</td>
              <td>{r.employee.name}</td>
              <td className={styles.tdSecondary}>{r.attendance.trainerId || '—'}</td>
              <td className={styles.tdSecondary}>{r.employee.team}</td>
              <td className={styles.tdSecondary}>{r.employee.hq || '—'}</td>
              <td className={styles.tdSecondary}>{r.employee.state || '—'}</td>
              <td>{formatDateForDisplay(r.attendance.attendanceDate)}</td>
              <td>
                <span className={`badge ${r.attendance.attendanceStatus === 'Present' ? 'badge-success' : 'badge-danger'}`}>
                  {r.attendance.attendanceStatus}
                </span>
              </td>
              {schema.map(key => (
                <td key={key} className={styles.tdScore}>
                  {r.score?.scores ? displayScore(r.score.scores[key]) : '—'}
                </td>
              ))}
            </tr>
          ))}
        </DataTable>
      </div>
    </div>
  );
};











