import React, { useState, useMemo } from 'react';
import { Search, Filter, MapPin } from 'lucide-react';
import { Employee } from '../../types/employee';
import { Attendance, TrainingScore } from '../../types/attendance';
import { SCORE_SCHEMAS } from '../../types/reports';
import { STATE_ZONE } from '../../seed/masterData';
import { buildUnifiedDataset } from '../../services/reportService';
import { DataTable } from '../../components/DataTable';
import { Filters } from '../../components/Filters';
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

  const schema = SCORE_SCHEMAS[tab] || [];
  const headers = [
    'Aadhaar', 'Emp ID', 'Mobile', 'Name', 'Trainer', 'Team', 'HQ', 'State', 'Date', 'Status', ...schema
  ];

  return (
    <div className="animate-fade-in">
      <div className="header">
        <div>
          <h2 style={{ fontSize: '24px' }}>Trainings Viewer</h2>
          <p className="text-muted">Standardized historical training records</p>
        </div>
      </div>

      <Filters 
        options={['IP', 'AP', 'MIP', 'Refresher', 'Capsule']} 
        activeOption={tab} 
        onChange={setTab} 
      />

      {/* Zone Filter */}
      <div className="glass-panel" style={{ padding: '12px 24px', marginBottom: '16px', display: 'flex', alignItems: 'center', gap: '12px' }}>
        <MapPin size={16} style={{ color: 'var(--text-secondary)' }} />
        <select 
          value={selectedZone} 
          onChange={(e) => setSelectedZone(e.target.value)}
          className="gap-select"
          style={{ maxWidth: '200px' }}
        >
          {zones.map(zone => (
            <option key={zone} value={zone}>{zone}</option>
          ))}
        </select>
      </div>

      <div className="glass-panel" style={{ padding: 0, overflow: 'hidden' }}>
        <div style={{ padding: '20px 24px', borderBottom: '1px solid var(--border-color)', display: 'flex', gap: '16px' }}>
          <div style={{ position: 'relative', flex: 1, maxWidth: '320px' }}>
            <Search size={16} style={{ position: 'absolute', left: '12px', top: '50%', transform: 'translateY(-50%)', color: 'var(--text-secondary)' }} />
            <input 
              type="text" 
              className="form-input" 
              placeholder="Search by name, ID, or Aadhaar…" 
              value={search}
              onChange={e => setSearch(e.target.value)}
              style={{ paddingLeft: '40px', fontSize: '14px', borderRadius: '10px' }}
            />
          </div>
          <button className="btn btn-secondary" style={{ padding: '8px 12px' }}><Filter size={16} /></button>
        </div>

        <DataTable headers={headers} maxHeight="calc(100vh - 400px)">
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


