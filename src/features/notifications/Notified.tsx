import React, { useState, useMemo } from 'react';
import { Mail, CheckCircle, AlertCircle, Users, BarChart2, ChevronDown, ChevronRight } from 'lucide-react';
import { ParsedRow, parseNominationExcel } from '../../services/parsingService';
import { addBatch } from '../../services/firestoreService';
import { TEAM_CLUSTER_MAP } from '../../services/clusterMap';
import { Employee } from '../../types/employee';
import { Attendance, TrainingNomination } from '../../types/attendance';
import { DataTable } from '../../components/DataTable';
import { KPIBox } from '../../components/KPIBox';
import { normalizeText } from '../../utils/textNormalizer';

interface NotifiedProps {
  employees: Employee[];
  attendance: Attendance[];
  nominations: TrainingNomination[];
  onUploadComplete?: () => void;
}

const TRAINING_TYPES = ['IP', 'AP', 'MIP', 'Capsule'];
const normalizeType = (value?: string) => (value || '').toUpperCase();

// Pre-process and map designations to standardized abbreviations
const standardizeDesignation = (designation?: string) => {
  if (!designation) return 'OTHER';

  // Step 1: Remove bracket content and normalize
  const normalized = designation
    .toUpperCase()
    .replace(/\(.*?\)/g, '') // remove brackets and content
    .trim();

  // Step 2: Map to predefined abbreviations
  const designationMap: Record<string, string> = {
    "REGIONAL SALES MANAGER": "SLM",
    "SR. REGIONAL SALES MANAGER": "SLM",

    "AREA SALES MANAGER": "FLM",
    "DISTRICT MANAGER": "FLM",

    "TERRITORY EXECUTIVE": "MR",
    "AREA BUSINESS EXECUTIVE": "MR",
    "SALES OFFICER": "MR",
    "TRAINEE SALES OFFICER": "MR",

    "SALES MANAGER": "SR. MANAGER",
    "SR. SALES MANAGER": "SR. MANAGER",
    "DIVISIONAL SALES MANAGER": "SR. MANAGER"
  };

  return designationMap[normalized] || 'OTHER';
};

const countDesignation = (designation?: string) => {
  const normalized = (designation || '').toUpperCase().replace(/\(.*?\)/g, '').trim();
  const abbreviationSet = new Set(['SLM', 'FLM', 'MR', 'SR. MANAGER']);
  if (abbreviationSet.has(normalized)) return normalized;
  return standardizeDesignation(designation);
};

type DefaulterRecord = {
  employeeId: string;
  name: string;
  team: string;
  cluster: string;
  designation: string;
  notificationCount: number;
};

type GroupMetrics = {
  total: number;
  SLM: number;
  FLM: number;
  MR: number;
  "SR. MANAGER": number;
};

type TeamGroup = {
  teamName: string;
  metrics: GroupMetrics;
  defaulters: DefaulterRecord[];
};

type ClusterGroup = {
  clusterName: string;
  metrics: GroupMetrics;
  teams: TeamGroup[];
};

export const Notified: React.FC<NotifiedProps> = ({ employees, attendance, nominations, onUploadComplete }) => {
  const [tab, setTab] = useState<'upload' | 'summary' | 'defaulters' | 'drilldown'>('upload');
  const [trainingFilter, setTrainingFilter] = useState<string>('AP');
  const [selectedTeam, setSelectedTeam] = useState<string | null>(null);

  // Upload state
  const [fileStep, setFileStep] = useState<'upload' | 'preview' | 'done'>('upload');
  const [dragOver, setDragOver] = useState(false);
  const [fileName, setFileName] = useState('');
  const [selectedUploadType, setSelectedUploadType] = useState(TRAINING_TYPES[0]);
  const [rows, setRows] = useState<ParsedRow[]>([]);
  const [uploading, setUploading] = useState(false);
  const [uploadProgress, setUploadProgress] = useState(0);

  // Expand state
  const [expandedClusters, setExpandedClusters] = useState<Set<string>>(new Set());
  const [expandedTeams, setExpandedTeams] = useState<Set<string>>(new Set());

  // Core statistics
  const stats = useMemo(() => {
    const filteredNoms = nominations.filter(n => normalizeType(n.trainingType) === normalizeType(trainingFilter));
    const nomMap = new Map<string, TrainingNomination[]>();
    
    filteredNoms.forEach(n => {
      if (!nomMap.has(n.employeeId)) nomMap.set(n.employeeId, []);
      nomMap.get(n.employeeId)!.push(n);
    });

    const filteredAtt = attendance.filter(a => 
      normalizeType(a.trainingType) === normalizeType(trainingFilter) && 
      normalizeType(a.attendanceStatus) === 'PRESENT'
    );
    const attSet = new Set(filteredAtt.map(a => a.employeeId));

    let notifiedCount = nomMap.size;
    let attendedCount = 0;
    const defaulters: DefaulterRecord[] = [];
    const drilldown: any[] = [];

    nomMap.forEach((userNoms, empId) => {
      const isAttended = attSet.has(empId);
      if (isAttended) attendedCount++;

      const empData = employees.find(e => e.employeeId === empId) || userNoms[0];
      const nCount = userNoms.length;
      const teamName = empData.team || 'Unknown';
      const normalizedTeam = normalizeText(teamName);
      const cluster = TEAM_CLUSTER_MAP[normalizedTeam] || 'Unmapped';

      if (nCount >= 3 && !isAttended) {
        defaulters.push({
          employeeId: empId,
          name: empData.name || 'Unknown',
          team: teamName,
          cluster: cluster,
          designation: standardizeDesignation(empData.designation),
          notificationCount: nCount
        });
      }

      drilldown.push({
        employeeId: empId,
        name: empData.name || 'Unknown',
        team: teamName,
        designation: standardizeDesignation(empData.designation),
        notificationCount: nCount,
        hasAttended: isAttended
      });
    });

    return {
      notifiedCount,
      attendedCount,
      attendance: notifiedCount > 0 ? (attendedCount / notifiedCount) * 100 : 0,
      defaulterCount: defaulters.length,
      defaulters,
      drilldown
    };
  }, [nominations, attendance, employees, trainingFilter]);

  // Build cluster hierarchy
  const clusterHierarchy = useMemo(() => {
    const clusters = new Map<string, Map<string, DefaulterRecord[]>>();

    stats.defaulters.forEach(d => {
      if (!clusters.has(d.cluster)) {
        clusters.set(d.cluster, new Map());
      }
      const teamMap = clusters.get(d.cluster)!;
      if (!teamMap.has(d.team)) {
        teamMap.set(d.team, []);
      }
      teamMap.get(d.team)!.push(d);
    });

    const result: ClusterGroup[] = [];
    clusters.forEach((teamMap, clusterName) => {
      let clusterMetrics: GroupMetrics = { total: 0, SLM: 0, FLM: 0, MR: 0, "SR. MANAGER": 0 };
      const teams: TeamGroup[] = [];

      teamMap.forEach((defaulters, teamName) => {
        let teamMetrics: GroupMetrics = { total: 0, SLM: 0, FLM: 0, MR: 0, "SR. MANAGER": 0 };
        defaulters.forEach(d => {
          const bucket = countDesignation(d.designation);
          teamMetrics.total += 1;
          if (bucket !== 'OTHER') {
            teamMetrics[bucket as keyof GroupMetrics] += 1;
          }
        });
        clusterMetrics.total += teamMetrics.total;
        clusterMetrics.SLM += teamMetrics.SLM;
        clusterMetrics.FLM += teamMetrics.FLM;
        clusterMetrics.MR += teamMetrics.MR;
        clusterMetrics["SR. MANAGER"] += teamMetrics["SR. MANAGER"];

        teams.push({
          teamName,
          metrics: teamMetrics,
          defaulters: defaulters.sort((a, b) => b.notificationCount - a.notificationCount)
        });
      });

      result.push({
        clusterName,
        metrics: clusterMetrics,
        teams: teams.sort((a, b) => b.metrics.total - a.metrics.total)
      });
    });

    return result.sort((a, b) => b.metrics.total - a.metrics.total);
  }, [stats.defaulters]);

  // Filter drilldown by team
  const filteredDrilldown = useMemo(() => {
    let result = stats.drilldown;
    if (selectedTeam) {
      result = result.filter(d => d.team === selectedTeam);
    }
    return result.sort((a, b) => b.notificationCount - a.notificationCount);
  }, [stats.drilldown, selectedTeam]);

  const availableTeams = useMemo(() => {
    const teams = new Set(stats.drilldown.map(d => d.team));
    return Array.from(teams).sort();
  }, [stats.drilldown]);

  // Handlers
  const processFile = async (file: File) => {
    setFileName(file.name);
    try {
      const { rows: processed } = await parseNominationExcel(file, selectedUploadType, employees);
      setRows(processed);
      setFileStep('preview');
    } catch (err: any) {
      alert('Parse failed: ' + err.message);
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

  const toggleCluster = (clusterName: string) => {
    const newSet = new Set(expandedClusters);
    newSet.has(clusterName) ? newSet.delete(clusterName) : newSet.add(clusterName);
    setExpandedClusters(newSet);
  };

  const toggleTeam = (teamKey: string) => {
    const newSet = new Set(expandedTeams);
    newSet.has(teamKey) ? newSet.delete(teamKey) : newSet.add(teamKey);
    setExpandedTeams(newSet);
  };

  return (
    <div className="animate-fade-in">
      <div className="header mb-8">
        <div>
          <h2 style={{ fontSize: '24px' }}>Notified Candidates Module</h2>
          <p className="text-muted">Upload and track invited candidates against actual attendance metrics.</p>
        </div>
      </div>

      {/* TABS */}
      <div className="tabs mb-8" style={{ display: 'flex', gap: '16px', borderBottom: '1px solid var(--border-color)', paddingBottom: '12px' }}>
        {['upload', 'summary', 'defaulters', 'drilldown'].map(t => (
          <button key={t}
            className={`tab ${tab === t ? 'active' : ''}`}
            onClick={() => setTab(t as any)}
            style={{
              background: 'none', border: 'none',
              color: tab === t ? 'var(--text-primary)' : 'var(--text-secondary)',
              fontWeight: tab === t ? 600 : 400,
              borderBottom: tab === t ? '2px solid var(--accent-primary)' : 'none',
              padding: '8px 16px', cursor: 'pointer'
            }}
          >
            {t === 'upload' && 'Upload Nominations'}
            {t === 'summary' && 'Summary Metrics'}
            {t === 'defaulters' && `Defaulters (${stats.defaulterCount})`}
            {t === 'drilldown' && 'Drilldown Log'}
          </button>
        ))}
      </div>

      {/* TRAINING FILTER */}
      {tab !== 'upload' && (
        <div style={{ marginBottom: '24px', display: 'flex', gap: '12px', alignItems: 'center' }}>
          <span style={{ fontSize: '13px', fontWeight: 600, color: 'var(--text-secondary)', textTransform: 'uppercase' }}>Focus Training:</span>
          <div style={{ display: 'flex', background: 'var(--bg-card)', borderRadius: '8px', padding: '4px' }}>
            {TRAINING_TYPES.map(t => (
              <button key={t}
                onClick={() => setTrainingFilter(t)}
                style={{
                  padding: '6px 16px', borderRadius: '6px',
                  background: trainingFilter === t ? 'var(--accent-primary)' : 'transparent',
                  color: trainingFilter === t ? '#fff' : 'var(--text-secondary)',
                  border: 'none', fontWeight: 600, cursor: 'pointer'
                }}
              >
                {t}
              </button>
            ))}
          </div>
        </div>
      )}

      {/* UPLOAD TAB */}
      {tab === 'upload' && (
        <div>
          {fileStep === 'upload' && (
            <div className="glass-panel" style={{ padding: '32px', textAlign: 'center' }}>
              <div style={{ marginBottom: '24px' }}>
                <label style={{ display: 'block', marginBottom: '8px', fontWeight: 600 }}>Select Training Type</label>
                <select className="form-input" value={selectedUploadType} onChange={e => setSelectedUploadType(e.target.value)} style={{ width: '200px', margin: '0 auto' }}>
                  {TRAINING_TYPES.map(t => <option key={t} value={t}>{t}</option>)}
                </select>
              </div>
              <div className="upload-zone" onDragOver={e => { e.preventDefault(); setDragOver(true); }} onDragLeave={() => setDragOver(false)} onClick={() => document.getElementById('nom-file')?.click()} style={{ maxWidth: '600px', margin: '0 auto', cursor: 'pointer' }}>
                <Mail size={32} style={{ margin: '0 auto 12px', color: 'var(--accent-primary)' }} />
                <h3>Drop Notification List Excel</h3>
                <input id="nom-file" type="file" accept=".xlsx" style={{ display: 'none' }} onChange={e => e.target.files?.[0] && processFile(e.target.files[0])} />
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
                <h3 className="mb-8">Previewing: {selectedUploadType} ({fileName})</h3>
                <div className="dashboard-grid" style={{ gridTemplateColumns: 'repeat(3, 1fr)', marginBottom: '32px' }}>
                  <div style={{ padding: '16px', background: 'rgba(16,185,129,0.1)', borderRadius: '12px', border: '1px solid var(--success)' }}>
                    <div style={{ color: 'var(--success)', fontWeight: 600, fontSize: '12px', textTransform: 'uppercase' }}>Valid</div>
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
                  <button className="btn btn-primary w-full max-w-sm" onClick={doUpload} disabled={uploading || err > 0} style={{ position: 'relative', overflow: 'hidden' }}>
                    {uploading ? <>
                      <div style={{ position: 'absolute', left: 0, top: 0, bottom: 0, width: `${uploadProgress}%`, background: 'rgba(255,255,255,0.3)', zIndex: 0 }} />
                      <span style={{ position: 'relative', zIndex: 1 }}>Uploading... {uploadProgress}%</span>
                    </> : `Confirm ${uploadable} Invitations`}
                  </button>
                  <button className="btn btn-secondary w-full max-w-sm" onClick={resetUpload} disabled={uploading}>Cancel</button>
                </div>
              </div>
            );
          })()}

          {fileStep === 'done' && (
            <div className="glass-panel text-center" style={{ padding: '60px' }}>
              <CheckCircle size={48} color="var(--success)" style={{ margin: '0 auto 16px' }} />
              <h2>Success!</h2>
              <button className="btn btn-primary mt-6" onClick={resetUpload}>Upload Another</button>
            </div>
          )}
        </div>
      )}

      {/* SUMMARY TAB */}
      {tab === 'summary' && (
        <div className="dashboard-grid">
          <KPIBox title="Total Notified" value={stats.notifiedCount} icon={Users} color="var(--accent-primary)" />
          <KPIBox title="Total Attended" value={stats.attendedCount} icon={CheckCircle} color="var(--success)" />
          <KPIBox title="Attendance %" value={`${stats.attendance.toFixed(1)}%`} icon={BarChart2} color="var(--accent-secondary)" />
          <KPIBox title="Defaulters (≥3)" value={stats.defaulterCount} icon={AlertCircle} color="var(--danger)" />
        </div>
      )}

      {/* DEFAULTERS TAB - CLUSTER VIEW */}
      {tab === 'defaulters' && (
        <div className="space-y-4">
          {clusterHierarchy.length === 0 ? (
            <div className="glass-panel text-center" style={{ padding: '60px' }}>
              <AlertCircle size={48} style={{ margin: '0 auto 16px', color: 'var(--success)' }} />
              <p className="text-muted">No defaulters for {trainingFilter}. Excellent performance!</p>
            </div>
          ) : (
            clusterHierarchy.map(cluster => (
              <div key={cluster.clusterName} className="glass-panel">
                <div
                  onClick={() => toggleCluster(cluster.clusterName)}
                  style={{ padding: '16px', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'space-between', borderBottom: '1px solid var(--border-color)' }}
                >
                  <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
                    {expandedClusters.has(cluster.clusterName) ? <ChevronDown size={20} /> : <ChevronRight size={20} />}
                    <strong>{cluster.clusterName}</strong>
                    <span className="badge">{cluster.metrics.total}</span>
                  </div>
                  <div style={{ display: 'flex', gap: '16px', fontSize: '13px' }}>
                    <span><strong>SLM:</strong> {cluster.metrics.SLM}</span>
                    <span><strong>FLM:</strong> {cluster.metrics.FLM}</span>
                    <span><strong>MR:</strong> {cluster.metrics.MR}</span>
                    <span><strong>SR. MANAGER:</strong> {cluster.metrics["SR. MANAGER"]}</span>
                  </div>
                </div>

                {expandedClusters.has(cluster.clusterName) && (
                  <div className="space-y-2" style={{ padding: '12px' }}>
                    {cluster.teams.map(team => (
                      <div key={team.teamName} style={{ borderLeft: '2px solid var(--border-color)', paddingLeft: '12px' }}>
                        <div
                          onClick={() => toggleTeam(team.teamName)}
                          style={{ padding: '12px', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'space-between', background: 'var(--bg-card)', borderRadius: '8px' }}
                        >
                          <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                            {expandedTeams.has(team.teamName) ? <ChevronDown size={16} /> : <ChevronRight size={16} />}
                            <span>{team.teamName}</span>
                            <span className="badge badge-info" style={{ fontSize: '11px' }}>{team.metrics.total}</span>
                          </div>
                          <div style={{ display: 'flex', gap: '12px', fontSize: '12px' }}>
                            <span>SLM: {team.metrics.SLM}</span>
                            <span>FLM: {team.metrics.FLM}</span>
                            <span>MR: {team.metrics.MR}</span>
                            <span>SR. MANAGER: {team.metrics["SR. MANAGER"]}</span>
                          </div>
                        </div>

                        {expandedTeams.has(team.teamName) && (
                          <div style={{ marginTop: '8px', paddingLeft: '8px' }}>
                            <DataTable headers={['Employee ID', 'Name', 'Designation', 'Invites Dropped']}>
                              {team.defaulters.map(d => (
                                <tr key={d.employeeId}>
                                  <td style={{ fontWeight: 600 }}>{d.employeeId}</td>
                                  <td>{d.name}</td>
                                  <td>{d.designation}</td>
                                  <td><span className="badge badge-danger">{d.notificationCount}</span></td>
                                </tr>
                              ))}
                            </DataTable>
                          </div>
                        )}
                      </div>
                    ))}
                  </div>
                )}
              </div>
            ))
          )}
        </div>
      )}

      {/* DRILLDOWN TAB */}
      {tab === 'drilldown' && (
        <div>
          <div style={{ marginBottom: '16px', display: 'flex', gap: '12px', alignItems: 'center' }}>
            <label style={{ fontSize: '13px', fontWeight: 600, color: 'var(--text-secondary)' }}>Filter by Team:</label>
            <select
              className="form-input"
              value={selectedTeam || ''}
              onChange={e => setSelectedTeam(e.target.value || null)}
              style={{ width: '250px' }}
            >
              <option value="">All Teams ({stats.drilldown.length})</option>
              {availableTeams.map(team => {
                const count = stats.drilldown.filter(d => d.team === team).length;
                return <option key={team} value={team}>{team} ({count})</option>;
              })}
            </select>
          </div>

          <div className="glass-panel">
            <DataTable headers={['Employee ID', 'Name', 'Team', 'Designation', 'Invites', 'Status']}>
              {filteredDrilldown.length === 0 ? (
                <tr><td colSpan={6} style={{ textAlign: 'center', padding: '40px' }} className="text-muted">No records</td></tr>
              ) : (
                filteredDrilldown.map(d => (
                  <tr key={d.employeeId}>
                    <td style={{ fontWeight: 600 }}>{d.employeeId}</td>
                    <td>{d.name}</td>
                    <td>{d.team}</td>
                    <td>{d.designation}</td>
                    <td><span className="badge badge-warning">{d.notificationCount}</span></td>
                    <td>{d.hasAttended ? <span className="badge badge-success">Attended</span> : <span className="badge badge-danger">Defaulter</span>}</td>
                  </tr>
                ))
              )}
            </DataTable>
          </div>
        </div>
      )}
    </div>
  );
};


