import React from 'react';
import { DataTable } from '../../../components/DataTable';
import { displayScore } from '../../../utils/scoreNormalizer';
import { SCORE_SCHEMAS } from '../../../types/reports';
import { Check, AlertTriangle, XCircle } from 'lucide-react';

interface UploadPreviewProps {
  rows: any[];
  trainingType: string;
}

export const UploadPreview: React.FC<UploadPreviewProps> = ({ rows, trainingType }) => {
  const scoreSchema = SCORE_SCHEMAS[trainingType] || [];
  
  const headers = [
    '#',
    'Status',
    'Aadhaar',
    'Emp ID',
    'Mobile',
    'Name',
    'Trainer',
    'Team',
    'HQ',
    'State',
    'Date',
    'Att',
    ...scoreSchema,
    'Issues'
  ];

  return (
    <DataTable headers={headers} maxHeight="420px">
      {rows.map((r, i) => (
        <tr key={i} className={r.status === 'error' ? 'row-err' : r.status === 'warn' ? 'row-warn' : ''} style={{
          borderLeft: r.status === 'error' ? '3px solid var(--danger)' : r.status === 'warn' ? '3px solid var(--warning)' : '3px solid var(--success)',
          background: r.status === 'error' ? 'rgba(239, 68, 68, 0.04)' : r.status === 'warn' ? 'rgba(245, 158, 11, 0.04)' : 'transparent'
        }}>
          <td style={{ fontSize: '12px', color: 'var(--text-secondary)' }}>{i + 1}</td>
          <td>
            {r.status === 'valid' ? (
              <span className="badge badge-success">OK</span>
            ) : r.status === 'warn' ? (
              <span className="badge badge-warning">WARN</span>
            ) : (
              <span className="badge badge-danger">ERR</span>
            )}
          </td>
          <td style={{ fontSize: '12px' }}>{r.data.aadhaarNumber || <span style={{ opacity: 0.3 }}>—</span>}</td>
          <td style={{ fontWeight: 600 }}>{r.data.employeeId || <span style={{ opacity: 0.3 }}>—</span>}</td>
          <td style={{ fontSize: '12px' }}>{r.data.mobileNumber || <span style={{ opacity: 0.3 }}>—</span>}</td>
          <td>{r.data.name || <span style={{ opacity: 0.3 }}>—</span>}</td>
          <td style={{ fontSize: '12px' }}>{r.data.trainerId || '—'}</td>
          <td style={{ fontSize: '12px' }}>{r.data.team || '—'}</td>
          <td style={{ fontSize: '12px' }}>{r.data.hq || '—'}</td>
          <td style={{ fontSize: '12px' }}>{r.data.state || '—'}</td>
          <td>{r.data.attendanceDate || <span style={{ color: 'var(--danger)' }}>INVALID</span>}</td>
          <td>
            <span className={`badge ${r.data.attendanceStatus === 'Present' ? 'badge-success' : 'badge-danger'}`}>
              {r.data.attendanceStatus}
            </span>
          </td>
          {scoreSchema.map(key => (
            <td key={key} style={{ fontWeight: 600 }}>{displayScore(r.data._scores[key])}</td>
          ))}
          <td style={{ fontSize: '11px', color: r.status === 'error' ? 'var(--danger)' : 'var(--warning)' }}>
            {r.messages.join(' · ') || '—'}
          </td>
        </tr>
      ))}
    </DataTable>
  );
};
