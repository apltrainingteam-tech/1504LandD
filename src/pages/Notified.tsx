import React, { useState, useMemo } from 'react';
import { Mail, UploadCloud, AlertCircle, FileText, CheckCircle, AlertTriangle, XCircle, Users, BarChart2 } from 'lucide-react';
import { ParsedRow, parseNominationExcel } from '../services/parsingService';
import { addBatch } from '../services/firestoreService';
import { Employee } from '../types/employee';
import { Attendance, TrainingNomination, TrainingType } from '../types/attendance';
import { DataTable } from '../components/DataTable';
import { KPIBox } from '../components/KPIBox';

interface NotifiedProps {
  employees: Employee[];
  attendance: Attendance[];
  nominations: TrainingNomination[];
  onUploadComplete?: () => void;
}

const TRAINING_TYPES = ['IP', 'AP', 'MIP', 'Capsule'];

export const Notified: React.FC<NotifiedProps> = ({ employees, attendance, nominations, onUploadComplete }) => {
  const [tab, setTab] = useState<'upload' | 'summary' | 'defaulters' | 'drilldown'>('upload');
  const [trainingFilter, setTrainingFilter] = useState<string>('AP');

  // UPLOAD STATE
  const [fileStep, setFileStep] = useState<'upload' | 'preview' | 'done'>('upload');
  const [dragOver, setDragOver] = useState(false);
  const [fileName, setFileName] = useState('');
  const [selectedUploadType, setSelectedUploadType] = useState(TRAINING_TYPES[0]);
  const [rows, setRows] = useState<ParsedRow[]>([]);
  const [uploading, setUploading] = useState(false);
  const [uploadProgress, setUploadProgress] = useState(0);

  // NOTIFICATION AGGREGATION ENGINE (In-Memory Map)
  const stats = useMemo(() => {
    // 1. Group Nominations
    const filteredNoms = nominations.filter(n => n.trainingType === trainingFilter);
    const nomMap = new Map<string, TrainingNomination[]>(); // Map employeeId to array of nominations
    
    filteredNoms.forEach(n => {
      if (!nomMap.has(n.employeeId)) nomMap.set(n.employeeId, []);
      nomMap.get(n.employeeId)!.push(n);
    });

    // 2. Count Attended
    const filteredAtt = attendance.filter(a => a.trainingType === trainingFilter && a.attendanceStatus === 'Present');
    const attMap = new Set(filteredAtt.map(a => a.employeeId));

    // 3. Compute Defaulters & Meta metrics
    let notifiedCount = nomMap.size; // Total Unique Employees Notified
    let attendedCount = 0;
    
    const defaulters: any[] = [];
    const drilldown: any[] = [];

    nomMap.forEach((userNoms, empId) => {
      const isAttended = attMap.has(empId);
      if (isAttended) attendedCount++;

      const nCount = userNoms.length;
      
      const empData = employees.find(e => e.employeeId === empId) || userNoms[0]; // Fallback to raw nom data
      
      if (nCount >= 3 && !isAttended) {
        defaulters.push({
           employeeId: empId,
           name: empData.name,
           team: empData.team,
           cluster: empData.state || empData.cluster || '-',
           count: nCount,
           status: 'Defaulter'
        });
      }

      drilldown.push({
        employeeId: empId,
        name: empData.name,
        latestDate: userNoms.sort((a,b) => b.notificationDate.localeCompare(a.notificationDate))[0].notificationDate,
        count: nCount,
        attended: isAttended
      });
    });

    return {
      notifiedCount,
      attendedCount,
      attendance: notifiedCount > 0 ? (attendedCount / notifiedCount) * 100 : 0,
      defaulterCount: defaulters.length,
      defaulters: defaulters.sort((a, b) => b.count - a.count),
      drilldown: drilldown.sort((a, b) => b.count - a.count)
    };
  }, [nominations, attendance, employees, trainingFilter]);


  // UPLOAD HANDLERS
  const processFile = async (file: File) => {
    setFileName(file.name);
    try {
      const { rows: processed } = await parseNominationExcel(file, selectedUploadType, employees);
      setRows(processed);
      setFileStep('preview');
    } catch (err: any) {
      alert('Parse failed: ' + err.message);
      console.error(err);
    }
  };

  const doUpload = async () => {
    setUploading(true);
    setUploadProgress(0);
    try {
      const uploadable = rows.filter(r => r.status !== 'error').map(r => r.data);
      const total = uploadable.length;
      
      const chunkSize = 50; 
      for (let i = 0; i < total; i += chunkSize) {
         const chunk = uploadable.slice(i, i + chunkSize);
         await addBatch('training_nominations', chunk);
         setUploadProgress(Math.round(((i + chunk.length) / total) * 100));
      }
      
      setFileStep('done');
      onUploadComplete?.();
    } catch (err: any) {
      alert('Upload failed: ' + err.message);
    } finally {
      setUploading(false);
    }
  };

  const resetUpload = () => {
    setFileStep('upload');
    setRows([]);
    setFileName('');
  };


  return (
    <div className="animate-fade-in">
      <div className="header mb-8">
        <div>
          <h2 style={{ fontSize: '24px' }}>Notified Candidates Module</h2>
          <p className="text-muted">Upload and track invited candidates against actual attendance metrics.</p>
        </div>
      </div>

      {/* TOP NAVIGATION */}
      <div className="tabs mb-8" style={{ display: 'flex', gap: '16px', borderBottom: '1px solid var(--border-color)', paddingBottom: '12px' }}>
        <button className={`tab ${tab === 'upload' ? 'active' : ''}`} onClick={() => setTab('upload')} style={{ background: 'none', border: 'none', color: tab === 'upload' ? 'var(--text-primary)' : 'var(--text-secondary)', fontWeight: tab === 'upload' ? 600 : 400, borderBottom: tab === 'upload' ? '2px solid var(--accent-primary)' : 'none', padding: '8px 16px', cursor: 'pointer' }}>
           Upload Nominations
        </button>
        <button className={`tab ${tab === 'summary' ? 'active' : ''}`} onClick={() => setTab('summary')} style={{ background: 'none', border: 'none', color: tab === 'summary' ? 'var(--text-primary)' : 'var(--text-secondary)', fontWeight: tab === 'summary' ? 600 : 400, borderBottom: tab === 'summary' ? '2px solid var(--accent-primary)' : 'none', padding: '8px 16px', cursor: 'pointer' }}>
           Summary Metrics
        </button>
        <button className={`tab ${tab === 'defaulters' ? 'active' : ''}`} onClick={() => setTab('defaulters')} style={{ background: 'none', border: 'none', color: tab === 'defaulters' ? 'var(--text-primary)' : 'var(--text-secondary)', fontWeight: tab === 'defaulters' ? 600 : 400, borderBottom: tab === 'defaulters' ? '2px solid var(--danger)' : 'none', padding: '8px 16px', cursor: 'pointer' }}>
           Defaulters ({stats.defaulterCount})
        </button>
        <button className={`tab ${tab === 'drilldown' ? 'active' : ''}`} onClick={() => setTab('drilldown')} style={{ background: 'none', border: 'none', color: tab === 'drilldown' ? 'var(--text-primary)' : 'var(--text-secondary)', fontWeight: tab === 'drilldown' ? 600 : 400, borderBottom: tab === 'drilldown' ? '2px solid var(--accent-primary)' : 'none', padding: '8px 16px', cursor: 'pointer' }}>
           Drilldown Log
        </button>
      </div>

      {/* GLOBAL FILTER FOR ANALYTICS TABS */}
      {tab !== 'upload' && (
        <div style={{ marginBottom: '24px', display: 'flex', gap: '12px', alignItems: 'center' }}>
          <span style={{ fontSize: '13px', fontWeight: 600, color: 'var(--text-secondary)', textTransform: 'uppercase' }}>Focus Training:</span>
          <div style={{ display: 'flex', background: 'var(--bg-card)', borderRadius: '8px', padding: '4px' }}>
            {TRAINING_TYPES.map(t => (
              <button 
                key={t}
                onClick={() => setTrainingFilter(t)}
                style={{ padding: '6px 16px', borderRadius: '6px', background: trainingFilter === t ? 'var(--accent-primary)' : 'transparent', color: trainingFilter === t ? '#fff' : 'var(--text-secondary)', border: 'none', fontWeight: 600, cursor: 'pointer' }}
              >
                {t}
              </button>
            ))}
          </div>
        </div>
      )}


      {/* UPLOAD VIEW */}
      {tab === 'upload' && (
        <div>
          {fileStep === 'upload' && (
            <div className="glass-panel" style={{ padding: '32px', textAlign: 'center' }}>
              <div style={{ marginBottom: '24px' }}>
                <label style={{ display: 'block', marginBottom: '8px', fontWeight: 600, color: 'var(--text-secondary)' }}>1. Select Target Training Type</label>
                <select 
                  className="form-input" 
                  value={selectedUploadType} 
                  onChange={e => setSelectedUploadType(e.target.value)}
                  style={{ width: '200px', margin: '0 auto' }}
                >
                  {TRAINING_TYPES.map(t => <option key={t} value={t}>{t}</option>)}
                </select>
              </div>

              <div 
                className={`upload-zone ${dragOver ? 'over' : ''}`}
                onDragOver={e => { e.preventDefault(); setDragOver(true); }}
                onDragLeave={() => setDragOver(false)}
                onDrop={e => { e.preventDefault(); setDragOver(false); if (e.dataTransfer.files[0]) processFile(e.dataTransfer.files[0]); }}
                onClick={() => document.getElementById('nom-file-input')?.click()}
                style={{ maxWidth: '600px', margin: '0 auto', background: 'rgba(255,255,255,0.02)' }}
              >
                <div className="upload-icon" style={{ background: 'rgba(99,102,241,0.1)', color: 'var(--accent-primary)' }}><Mail size={32} /></div>
                <h3 style={{ fontSize: '18px', fontWeight: 600 }}>2. Drop Notification List Excel</h3>
                <p className="text-muted">Ensure it contains 'Employee ID' and 'Notification Date'</p>
                <input id="nom-file-input" type="file" accept=".xlsx" style={{ display: 'none' }} onChange={e => { if (e.target.files?.[0]) processFile(e.target.files[0]); }} />
              </div>
            </div>
          )}

          {fileStep === 'preview' && (() => {
            const valid = rows.filter(r => r.status === 'valid').length;
            const warn = rows.filter(r => r.status === 'warn').length;
            const err = rows.filter(r => r.status === 'error').length;
            const uploadable = rows.filter(r => r.status !== 'error').length;

            return (
              <div className="glass-panel" style={{ padding: '32px' }}>
                <h3 className="mb-8" style={{ fontSize: '20px' }}>Previewing: {selectedUploadType} Invitations ({fileName})</h3>
                
                <div className="dashboard-grid" style={{ gridTemplateColumns: 'repeat(3, 1fr)', marginBottom: '32px' }}>
                  <div style={{ padding: '16px', background: 'rgba(16,185,129,0.1)', borderRadius: '12px', border: '1px solid var(--success)' }}>
                    <div style={{ color: 'var(--success)', fontWeight: 600, fontSize: '12px', textTransform: 'uppercase' }}>Valid Rows</div>
                    <div style={{ fontSize: '28px', fontWeight: 700 }}>{valid}</div>
                  </div>
                  <div style={{ padding: '16px', background: 'rgba(245,158,11,0.1)', borderRadius: '12px', border: '1px solid var(--warning)' }}>
                    <div style={{ color: 'var(--warning)', fontWeight: 600, fontSize: '12px', textTransform: 'uppercase' }}>Warnings</div>
                    <div style={{ fontSize: '28px', fontWeight: 700 }}>{warn}</div>
                  </div>
                  <div style={{ padding: '16px', background: 'rgba(239, 68, 68, 0.1)', borderRadius: '12px', border: '1px solid var(--danger)' }}>
                    <div style={{ color: 'var(--danger)', fontWeight: 600, fontSize: '12px', textTransform: 'uppercase' }}>Errors</div>
                    <div style={{ fontSize: '28px', fontWeight: 700 }}>{err}</div>
                  </div>
                </div>

                <div className="flex-center flex-col gap-4">
                  <button 
                    className="btn btn-primary w-full max-w-sm" 
                    onClick={doUpload} 
                    disabled={uploading || err > 0 || uploadable === 0}
                    style={{ position: 'relative', overflow: 'hidden' }}
                  >
                    {uploading ? (
                      <>
                        <div style={{ position: 'absolute', left: 0, top: 0, bottom: 0, width: `${uploadProgress}%`, background: 'rgba(255,255,255,0.3)', transition: 'width 0.2s', zIndex: 0 }} />
                        <span style={{ position: 'relative', zIndex: 1, fontWeight: 700 }}>Uploading Append Log... {uploadProgress}%</span>
                      </>
                    ) : err > 0 ? "Fix Errors Before Uploading" : `Confirm ${uploadable} Target Invitations`}
                  </button>
                  <button className="btn btn-secondary w-full max-w-sm" onClick={resetUpload} disabled={uploading}>Cancel</button>
                </div>
              </div>
            );
          })()}

          {fileStep === 'done' && (
            <div className="glass-panel text-center" style={{ padding: '60px' }}>
              <CheckCircle size={48} color="var(--success)" style={{ margin: '0 auto 16px' }} />
              <h2>Log Appended Successfully</h2>
              <p className="text-muted mb-8">The notification records have been firmly attached to your intelligence engine.</p>
              <button className="btn btn-primary" onClick={resetUpload}>Upload Additional Log</button>
            </div>
          )}
        </div>
      )}


      {/* SUMMARY TAB */}
      {tab === 'summary' && (
        <div className="dashboard-grid">
          <KPIBox title="Total Notified (Unique)" value={stats.notifiedCount} icon={Users} color="var(--accent-primary)" />
          <KPIBox title="Total Attended" value={stats.attendedCount} icon={CheckCircle} color="var(--success)" />
          <KPIBox title="Attendance %" value={`${stats.attendance.toFixed(1)}%`} icon={BarChart2} color="var(--accent-secondary)" />
          <KPIBox title="Defaulters (>=3 strikes)" value={stats.defaulterCount} icon={AlertCircle} color="var(--danger)" />
        </div>
      )}

      {/* DEFAULTERS TAB */}
      {tab === 'defaulters' && (
        <div className="glass-panel">
          <div style={{ borderBottom: '1px solid var(--border-color)', padding: '20px' }}>
            <h3 style={{ margin: 0, color: 'var(--danger)' }}>Critical Defaulter Roster</h3>
            <p className="text-muted" style={{ fontSize: '13px' }}>Employees mapped to 3+ unfulfilled notifications resulting in 0 attendance counts.</p>
          </div>
          <DataTable headers={['Employee ID', 'Name', 'Team', 'Cluster', 'Invites Dropped', 'Action Status']}>
            {stats.defaulters.length === 0 ? (
               <tr><td colSpan={6} style={{ textAlign: 'center', padding: '40px' }} className="text-muted">No Defaulters located for {trainingFilter}.</td></tr>
            ) : (
              stats.defaulters.map(d => (
                <tr key={d.employeeId}>
                   <td style={{ fontWeight: 600 }}>{d.employeeId}</td>
                   <td>{d.name}</td>
                   <td>{d.team}</td>
                   <td>{d.cluster}</td>
                   <td><span className="badge badge-danger" style={{ fontWeight: 700 }}>{d.count} Misses</span></td>
                   <td><span className="badge" style={{ background: 'rgba(239,68,68,0.2)', color: 'var(--danger)' }}>🚨 Escalate</span></td>
                </tr>
              ))
            )}
          </DataTable>
        </div>
      )}

      {/* DRILLDOWN TAB */}
      {tab === 'drilldown' && (
        <div className="glass-panel">
          <div style={{ borderBottom: '1px solid var(--border-color)', padding: '20px' }}>
            <h3 style={{ margin: 0 }}>Invitation Roll-up Engine</h3>
          </div>
          <DataTable headers={['Employee ID', 'Name', 'Latest Invite Date', 'Metric Count', 'Attended']}>
            {stats.drilldown.length === 0 ? (
               <tr><td colSpan={5} style={{ textAlign: 'center', padding: '40px' }} className="text-muted">No specific notification events mapped.</td></tr>
            ) : (
              stats.drilldown.map(d => (
                <tr key={d.employeeId}>
                   <td style={{ fontWeight: 600 }}>{d.employeeId}</td>
                   <td>{d.name}</td>
                   <td>{d.latestDate}</td>
                   <td><span className="badge badge-primary">{d.count} Invitations</span></td>
                   <td>
                     {d.attended 
                        ? <CheckCircle size={18} color="var(--success)" /> 
                        : <XCircle size={18} color="var(--text-muted)" />
                     }
                   </td>
                </tr>
              ))
            )}
          </DataTable>
        </div>
      )}
    </div>
  );
};
