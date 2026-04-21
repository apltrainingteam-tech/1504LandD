import React, { useState, useMemo } from 'react';
import { Search, Filter, MapPin, Users, CheckCircle2, TrendingUp, BookOpen } from 'lucide-react';
import { Employee } from '../../types/employee';
import { Attendance, TrainingScore } from '../../types/attendance';
import { SCORE_SCHEMAS } from '../../types/reports';
import { STATE_ZONE } from '../../seed/masterData';
import { buildUnifiedDataset } from '../../services/reportService';
import { DataTable } from '../../components/DataTable';
import { Filters } from '../../components/Filters';
import { KPIBox } from '../../components/KPIBox';
import { InsightStrip } from '../../components/InsightStrip';
import { formatDateForDisplay } from '../../utils/dateParser';
import { displayScore } from '../../utils/scoreNormalizer';
import TopRightControls from '../../components/TopRightControls';
import { GlobalFilters, getActiveFilterCount } from '../../context/filterContext';
import { getPrimaryMetricRaw, normalizeTrainingType } from '../../services/reportService';
import { GlobalFilterPanel } from '../../components/GlobalFilterPanel';
import { getFiscalYears, getFiscalYearFromDate } from '../../utils/fiscalYear';
import { normalizeText } from '../../utils/textNormalizer';
import { getSchema } from '../../services/trainingSchemas';
import { useFilterOptions } from '../../utils/computationHooks';
import { useMasterData } from '../../context/MasterDataContext';

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
  const [pageFilters, setPageFilters] = useState<GlobalFilters>({ cluster: '', team: '', trainer: '', month: '' });
  const activeFilterCount = getActiveFilterCount(pageFilters);
  const [showGlobalFilters, setShowGlobalFilters] = useState(false);

  // Get unique zones
  const zones = useMemo(() => {
    const uniqueZones = new Set(STATE_ZONE.map(sz => sz.zone));
    return ['All Zones', ...Array.from(uniqueZones).sort()];
  }, []);

  // ─── SINGLE SOURCE OF TRUTH: FILTERED DATASET ──────────────────────────
  const filtered = useMemo(() => {
    const normalizedTab = normalizeTrainingType(tab);
    let data = attendance.filter(a => normalizeTrainingType(a.trainingType) === normalizedTab);
    const scs = scores.filter(s => normalizeTrainingType(s.trainingType) === normalizedTab);
    
    // Build initial unified dataset for this tab
    let ds = buildUnifiedDataset(employees, data, scs, [], [], masterTeams);

    // 2. Filter by Fiscal Year
    if (selectedFY) {
      ds = ds.filter(r => getFiscalYearFromDate(r.attendance.attendanceDate) === selectedFY);
    }

    // 3. Filter by Zone
    if (selectedZone !== 'All Zones') {
      ds = ds.filter(r => {
        const empZone = r.employee.zone || getZoneFromState(r.employee.state);
        return empZone === selectedZone;
      });
    }

    // 4. Page-scoped Global Filters
    if (pageFilters.cluster) {
      ds = ds.filter(r => (r.employee.cluster || '') === pageFilters.cluster);
    }
    if (pageFilters.team) {
      ds = ds.filter(r => (r.employee.team || '') === pageFilters.team);
    }
    if (pageFilters.trainer) {
      ds = ds.filter(r => (r.attendance.trainerId || '') === pageFilters.trainer);
    }
    if (pageFilters.month) {
      ds = ds.filter(r => {
        const m = r.attendance.month || (r.attendance.attendanceDate || '').substring(0, 7);
        return m === pageFilters.month;
      });
    }

    // 5. Search Filter
    if (search) {
      const s = search.toLowerCase();
      ds = ds.filter(r => 
        r.employee.name.toLowerCase().includes(s) || 
        r.employee.employeeId.toLowerCase().includes(s) ||
        (r.employee.aadhaarNumber || '').includes(s)
      );
    }

    console.log(`🔍 [FILTER ENGINE] Tab=${normalizedTab}, FY=${selectedFY}, Zone=${selectedZone}, Count=${ds.length}`);
    return ds;
  }, [employees, attendance, scores, tab, selectedFY, selectedZone, pageFilters, search]);

  // ─── KPI CALCULATIONS ────────────────────────────────────────────────────
  const kpis = useMemo(() => {
    const total = filtered.length;
    const present = filtered.filter(r => r.attendance.attendanceStatus === 'Present');
    const attPercent = total > 0 ? ((present.length / total) * 100).toFixed(1) : '0';
    
    // Calculate avg score using the same metric logic as dashboard
    const avg = getPrimaryMetricRaw(filtered, tab);
    
    return {
      total,
      attPercent,
      avg: typeof avg === 'number' ? avg.toFixed(1) : avg,
      totalUnified: filtered.length // Total in this filtered view
    };
  }, [filtered, tab]);

  const { allTeams, allTrainers } = useFilterOptions(employees, attendance, tab, masterTeams, masterTrainers);
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
    setShowGlobalFilters(false);
  };

  const handleGlobalClear = () => {
    const cleared: GlobalFilters = { cluster: '', team: '', trainer: '', month: '' };
    setPageFilters(cleared);
    setShowGlobalFilters(false);
  };

  const schemaObj = getSchema(tab);
  const schema = schemaObj.scoreFields;
  const labels = schemaObj.scoreLabels;
  
  const headers = [
    'Aadhaar', 'Emp ID', 'Mobile', 'Name', 'Trainer', 'Team', 'HQ', 'State', 'Date', 'Status', 
    ...schema.map(k => labels[k] || k)
  ];

  return (
    <div className="animate-fade-in" style={{ padding: '24px' }}>
      {/* Page Header */}
      <div style={{ marginBottom: '24px', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
        <div>
          <h1 style={{ margin: 0, fontSize: '28px', fontWeight: 700 }}>Training Data</h1>
          <p style={{ color: 'var(--text-secondary)', margin: '8px 0 0 0', fontSize: '13px' }}>Standardized historical training records and participation data</p>
        </div>
        <TopRightControls
          fiscalOptions={FY_OPTIONS}
          selectedFY={selectedFY}
          onChangeFY={(v) => setSelectedFY(v)}
          onOpenGlobalFilters={() => setShowGlobalFilters(true)}
          onExport={() => alert('Export not implemented for Training Data (UI placeholder)')}
          activeFilterCount={activeFilterCount}
        />
      </div>

      {/* Filter Controls Row */}
      <div style={{ marginBottom: '24px', display: 'flex', gap: '12px', alignItems: 'center', flexWrap: 'wrap' }}>
        {/* Training Type Tabs */}
        <Filters 
          options={['IP', 'AP', 'MIP', 'REFRESHER', 'CAPSULE', 'PRE_AP']} 
          activeOption={tab} 
          onChange={setTab} 
        />

        {/* Zone Filter */}
        <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginLeft: 'auto' }}>
          <MapPin size={16} style={{ color: 'var(--text-secondary)' }} />
          <select 
            value={selectedZone} 
            onChange={(e) => setSelectedZone(e.target.value)}
            className="gap-select"
            style={{ maxWidth: '200px', padding: '6px 12px', fontSize: '13px', border: '1px solid var(--border-color)', borderRadius: '8px', background: 'transparent' }}
          >
            {zones.map(zone => (
              <option key={zone} value={zone}>{zone}</option>
            ))}
          </select>
        </div>
      </div>

      {/* KPI Cards */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: '16px', marginBottom: '24px' }}>
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
      <div className="glass-panel" style={{ padding: 0, overflow: 'hidden', marginTop: '24px' }}>
        {/* Table Toolbar */}
        <div style={{ padding: '16px 24px', borderBottom: '1px solid var(--border-color)', display: 'flex', gap: '12px', alignItems: 'center' }}>
          <div style={{ position: 'relative', flex: 1, maxWidth: '340px' }}>
            <Search size={16} style={{ position: 'absolute', left: '12px', top: '50%', transform: 'translateY(-50%)', color: 'var(--text-secondary)' }} />
            <input 
              type="text" 
              className="form-input" 
              placeholder="Search by name, ID, or Aadhaar…" 
              value={search}
              onChange={e => setSearch(e.target.value)}
              style={{ paddingLeft: '40px', fontSize: '13px', borderRadius: '8px', padding: '8px 12px 8px 40px', border: '1px solid var(--border-color)' }}
            />
          </div>
          {/* Inline toolbar filter removed — use GlobalFilterPanel via TopRightControls */}
        </div>

        {/* Data Table */}
        <DataTable headers={headers} maxHeight="calc(100vh - 500px)">
          {filtered.length === 0 ? (
            <tr><td colSpan={headers.length} style={{ textAlign: 'center', padding: '48px', color: 'var(--text-secondary)' }}>No training records found.</td></tr>
          ) : filtered.map((r, i) => (
            <tr key={i}>
              <td style={{ fontSize: '12px', color: 'var(--text-secondary)' }}>{r.employee.aadhaarNumber || '—'}</td>
              <td style={{ fontWeight: 600 }}>{r.employee.employeeId}</td>
              <td style={{ fontSize: '12px' }}>{r.employee.mobileNumber || '—'}</td>
              <td>{r.employee.name}</td>
              <td style={{ fontSize: '12px' }}>{r.attendance.trainerId || '—'}</td>
              <td style={{ fontSize: '12px' }}>{r.employee.team}</td>
              <td style={{ fontSize: '12px' }}>{r.employee.hq || '—'}</td>
              <td style={{ fontSize: '12px' }}>{r.employee.state || '—'}</td>
              <td>{formatDateForDisplay(r.attendance.attendanceDate)}</td>
              <td>
                <span className={`badge ${r.attendance.attendanceStatus === 'Present' ? 'badge-success' : 'badge-danger'}`}>
                  {r.attendance.attendanceStatus}
                </span>
              </td>
              {schema.map(key => (
                <td key={key} style={{ fontWeight: 600 }}>
                  {r.score?.scores ? displayScore(r.score.scores[key]) : '—'}
                </td>
              ))}
            </tr>
          ))}
        </DataTable>
      </div>
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


