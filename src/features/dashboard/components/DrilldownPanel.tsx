import React, { useState } from 'react';
import { DrilldownNode } from '../../../types/reports';
import { flagScore, flagClass } from '../../../core/utils/scoreNormalizer';
import { ChevronRight, ChevronDown, MapPin, Users, User } from 'lucide-react';

interface DrilldownPanelProps {
  nodes: DrilldownNode[];
  tab: string;
}

export const DrilldownPanel: React.FC<DrilldownPanelProps> = ({ nodes, tab }) => {
  const [openClusters, setOpenClusters] = useState(new Set<string>());
  const [openTeams, setOpenTeams] = useState(new Set<string>());

  const toggleCluster = (key: string) => {
    const next = new Set(openClusters);
    next.has(key) ? next.delete(key) : next.add(key);
    setOpenClusters(next);
  };

  const toggleTeam = (key: string) => {
    const next = new Set(openTeams);
    next.has(key) ? next.delete(key) : next.add(key);
    setOpenTeams(next);
  };

  if (nodes.length === 0) {
    return <div style={{ textAlign: 'center', padding: '48px' }} className="text-muted">No drill-down data available.</div>;
  }

  return (
    <div style={{ fontFamily: 'inherit', fontSize: '13px' }}>
      {nodes.map(cluster => {
        const clusterOpen = openClusters.has(cluster.key);
        const clusterFlag = flagScore(cluster.metric);
        return (
          <div key={cluster.key} style={{ marginBottom: '4px' }}>
            {/* Cluster Row */}
            <div
              onClick={() => toggleCluster(cluster.key)}
              style={{ display: 'flex', alignItems: 'center', gap: '12px', padding: '12px 16px', background: 'var(--bg-card)', borderRadius: '10px', cursor: 'pointer', border: `1px solid ${clusterOpen ? 'var(--accent-primary)' : 'transparent'}`, transition: 'border-color 0.2s' }}
            >
              {clusterOpen ? <ChevronDown size={16} color="var(--accent-primary)" /> : <ChevronRight size={16} />}
              <MapPin size={16} color="var(--accent-primary)" />
              <span style={{ fontWeight: 700, flex: 1 }}>{cluster.label}</span>
              <span className="text-muted" style={{ fontSize: '12px' }}>{cluster.count} trained</span>
              {cluster.metric > 0 && (
                <span className={`badge ${flagClass(clusterFlag)}`} style={{ fontWeight: 700 }}>
                  {cluster.metric.toFixed(1)}
                </span>
              )}
            </div>

            {/* Team Children */}
            {clusterOpen && (cluster.children || []).map(team => {
              const teamOpen = openTeams.has(team.key);
              const teamFlag = flagScore(team.metric);
              return (
                <div key={team.key} style={{ marginLeft: '24px', marginTop: '3px' }}>
                  <div
                    onClick={() => toggleTeam(team.key)}
                    style={{ display: 'flex', alignItems: 'center', gap: '12px', padding: '10px 16px', background: 'rgba(255,255,255,0.03)', borderRadius: '8px', cursor: 'pointer', borderLeft: '2px solid var(--border-color)' }}
                  >
                    {teamOpen ? <ChevronDown size={14} color="var(--accent-secondary)" /> : <ChevronRight size={14} />}
                    <Users size={14} color="var(--accent-secondary)" />
                    <span style={{ fontWeight: 600, flex: 1 }}>{team.label}</span>
                    <span className="text-muted" style={{ fontSize: '12px' }}>{team.count} trained</span>
                    {team.metric > 0 && (
                      <span className={`badge ${flagClass(teamFlag)}`}>
                        {team.metric.toFixed(1)}
                      </span>
                    )}
                  </div>

                  {/* Employee Records */}
                  {teamOpen && (team.records || [])
                    .filter(r => r.attendance.attendanceStatus === 'Present')
                    .slice(0, 50)
                    .map((r, i) => (
                      <div key={i} style={{ marginLeft: '24px', marginTop: '2px', display: 'flex', alignItems: 'center', gap: '12px', padding: '8px 16px', borderLeft: '2px solid rgba(34,45,104,0.2)', background: 'rgba(255,255,255,0.01)', borderRadius: '0 6px 6px 0' }}>
                        <User size={12} color="var(--text-muted)" />
                        <span style={{ fontWeight: 600, fontSize: '12px', minWidth: '80px' }}>{r.employee.employeeId}</span>
                        <span style={{ flex: 1 }}>{r.employee.name}</span>
                        <span className="text-muted" style={{ fontSize: '11px' }}>{r.attendance.attendanceDate}</span>
                        {r.score?.scores && (
                          <span style={{ fontSize: '11px', fontWeight: 600, color: 'var(--accent-primary)' }}>
                            {tab === 'IP' ? 'T Score / %: ' : 'Score: '}
                            {(Object.values(r.score.scores).filter(v => v != null)[0] as number | undefined)?.toFixed(1) ?? '—'}
                          </span>
                        )}
                      </div>
                    ))
                  }
                  {teamOpen && (team.records || []).filter(r => r.attendance.attendanceStatus === 'Present').length > 50 && (
                    <div style={{ marginLeft: '48px', padding: '6px', fontSize: '11px' }} className="text-muted">
                      + {(team.records || []).filter(r => r.attendance.attendanceStatus === 'Present').length - 50} more employees...
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        );
      })}
    </div>
  );
};






