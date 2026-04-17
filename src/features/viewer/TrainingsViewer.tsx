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

// Training type normalization
const trainingTypeMap: Record<string, string> = {
  'REFRESHER_SO': 'Refresher',
  'REFRESHER_MANAGER': 'Refresher',
  'REFRESHER': 'Refresher',
  'CAPSULE': 'Capsule',
};

const normalizeTrainingType = (value?: string): string => {
  if (!value) return '';
  const upper = value.toUpperCase().trim();
  return trainingTypeMap[upper] || upper;
};

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
  const [tab, setTab] = useState('IP');
  const [search, setSearch] = useState('');
  const [selectedZone, setSelectedZone] = useState('All Zones');

  // Get unique zones
  const zones = useMemo(() => {
    const uniqueZones = new Set(STATE_ZONE.map(sz => sz.zone));
    return ['All Zones', ...Array.from(uniqueZones).sort()];
  }, []);

  const unified = useMemo(() => {
    // Filter by training type (normalized)
    const normalizedTab = normalizeTrainingType(tab);
    const filteredAtt = attendance.filter(a => {
      const normalized = normalizeTrainingType(a.trainingType);
      return normalized === normalizedTab;
    });
    const filteredScs = scores.filter(s => {
      const normalized = normalizeTrainingType(s.trainingType);
      return normalized === normalizedTab;
    });
    
    // Filter by zone
    const filteredEmployees = employees.filter(emp => {
      if (selectedZone === 'All Zones') return true;
      const empZone = emp.zone || getZoneFromState(emp.state);
      return empZone === selectedZone;
    });
    
    console.log(`📊 TRAININGS VIEWER: Training=${normalizedTab}, Zone=${selectedZone}, Employees=${filteredEmployees.length}, Attendance=${filteredAtt.length}`);
    
    return buildUnifiedDataset(filteredEmployees, filteredAtt, filteredScs, []);
  }, [employees, attendance, scores, tab, selectedZone]);

  const filtered = useMemo(() => {
    if (!search) return unified;
    const s = search.toLowerCase();
    return unified.filter(r => 
      r.employee.name.toLowerCase().includes(s) || 
      r.employee.employeeId.toLowerCase().includes(s) ||
      (r.employee.aadhaarNumber || '').includes(s)
    );
  }, [unified, search]);

  // KPI Calculations
  const totalRecords = filtered.length;
  const presentCount = filtered.filter(r => r.attendance.attendanceStatus === 'Present').length;
  const attendancePercent = totalRecords > 0 ? ((presentCount / totalRecords) * 100).toFixed(1) : 0;
  
  const avgScore = useMemo(() => {
    const validScores = filtered
      .filter(r => r.score?.scores)
      .flatMap(r => Object.values(r.score.scores).filter(v => typeof v === 'number'));
    
    if (validScores.length === 0) return 0;
    const sum = validScores.reduce((a: number, b: any) => a + (typeof b === 'number' ? b : 0), 0);
    return (sum / validScores.length).toFixed(1);
  }, [filtered]);

  const totalTrainings = unified.length;

  const schema = SCORE_SCHEMAS[tab] || [];
  const headers = [
    'Aadhaar', 'Emp ID', 'Mobile', 'Name', 'Trainer', 'Team', 'HQ', 'State', 'Date', 'Status', ...schema
  ];

  return (
    <div className="animate-fade-in" style={{ padding: '24px' }}>
      {/* Page Header */}
      <div style={{ marginBottom: '24px' }}>
        <h1 style={{ margin: 0, fontSize: '28px', fontWeight: 700 }}>Training Data</h1>
        <p style={{ color: 'var(--text-secondary)', margin: '8px 0 0 0', fontSize: '13px' }}>Standardized historical training records and participation data</p>
      </div>

      {/* Filter Controls Row */}
      <div style={{ marginBottom: '24px', display: 'flex', gap: '12px', alignItems: 'center', flexWrap: 'wrap' }}>
        {/* Training Type Tabs */}
        <Filters 
          options={['IP', 'AP', 'MIP', 'Refresher', 'Capsule']} 
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
        <KPIBox title="Total Records" value={totalRecords} icon={BookOpen} />
        <KPIBox title="Present %" value={`${attendancePercent}%`} color="var(--success)" icon={CheckCircle2} />
        <KPIBox title="Avg Score" value={typeof avgScore === 'number' ? avgScore.toFixed(1) : avgScore} color="var(--accent-primary)" icon={TrendingUp} />
        <KPIBox title="Total Trainings" value={totalTrainings} color="var(--warning)" icon={Users} />
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
          <button className="btn btn-secondary" style={{ padding: '8px 12px', display: 'flex', alignItems: 'center', gap: '6px' }}><Filter size={16} /></button>
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
    </div>
  );
};


