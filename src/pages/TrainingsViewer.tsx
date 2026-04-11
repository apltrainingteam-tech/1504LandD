import React, { useState, useMemo } from 'react';
import { Search, Filter } from 'lucide-react';
import { Employee } from '../types/employee';
import { Attendance, TrainingScore } from '../types/attendance';
import { SCORE_SCHEMAS } from '../types/reports';
import { buildUnifiedDataset } from '../services/reportService';
import { DataTable } from '../components/DataTable';
import { Filters } from '../components/Filters';
import { formatDateForDisplay } from '../utils/dateParser';
import { displayScore } from '../utils/scoreNormalizer';

interface TrainingsViewerProps {
  employees: Employee[];
  attendance: Attendance[];
  scores: TrainingScore[];
}

export const TrainingsViewer: React.FC<TrainingsViewerProps> = ({ employees, attendance, scores }) => {
  const [tab, setTab] = useState('IP');
  const [search, setSearch] = useState('');

  const unified = useMemo(() => {
    const filteredAtt = attendance.filter(a => a.trainingType === tab);
    const filteredScs = scores.filter(s => s.trainingType === tab);
    return buildUnifiedDataset(employees, filteredAtt, filteredScs, []);
  }, [employees, attendance, scores, tab]);

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
        options={['IP', 'AP', 'MIP']} 
        activeOption={tab} 
        onChange={setTab} 
      />

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
