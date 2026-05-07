import React, { useMemo } from 'react';
import { motion } from 'framer-motion';
import { AlertTriangle, ShieldAlert, ChevronDown, Search, Filter } from 'lucide-react';
import { useMasterData } from '../../core/context/MasterDataContext';
import { formatDisplayText, sortClusters } from '../../core/engines/normalizationEngine';
import styles from './DefaulterTracking.module.css';

interface CandidateDefaulter {
  employeeId: string;
  name: string;
  team: string;
  hq: string;
  doj: string;
  notifications: string[];
  status: 'Critical' | 'Warning';
  lastNotificationDate: string;
  trainingType: string;
}

interface TeamDefaulter {
  team: string;
  totalDefaulters: number;
  critical: number;
  warning: number;
  candidates: CandidateDefaulter[];
}

interface ClusterDefaulter {
  cluster: string;
  totalDefaulters: number;
  critical: number;
  warning: number;
  teamsAffected: number;
  lastNotification: string;
  teams: TeamDefaulter[];
}

export const DefaulterTracking: React.FC = () => {
  const { finalData, teams: masterTeams } = useMasterData();
  const { employeeData, notificationHistory, trainingData } = finalData;

  const [expandedClusters, setExpandedClusters] = React.useState<Set<string>>(new Set());
  const [expandedTeams, setExpandedTeams] = React.useState<Set<string>>(new Set());

  const toggleCluster = (cluster: string) => {
    setExpandedClusters(prev => {
      const next = new Set(prev);
      if (next.has(cluster)) next.delete(cluster);
      else next.add(cluster);
      return next;
    });
  };

  const toggleTeam = (teamKey: string) => {
    setExpandedTeams(prev => {
      const next = new Set(prev);
      if (next.has(teamKey)) next.delete(teamKey);
      else next.add(teamKey);
      return next;
    });
  };

  const hierarchy = useMemo(() => {
    const candidateMap: Record<string, CandidateDefaulter> = {};

    notificationHistory.forEach(nh => {
      // FIX: If employeeId is missing or "Unknown", use a unique key combining Name + Team 
      // to prevent different unlinked employees from being merged into one row.
      const empId = nh.empId || nh.employeeId;
      const isUnlinked = !empId || String(empId).toLowerCase() === 'unknown' || String(empId).toLowerCase() === 'null' || String(empId).trim() === '';
      
      const key = isUnlinked 
        ? `unlinked_${nh.name}_${nh.team}_${nh.trainingType}`
        : `${empId}_${nh.trainingType}`;

      if (!candidateMap[key]) {
        const emp = employeeData.find(e => String(e.employeeId) === String(empId));
        candidateMap[key] = {
          employeeId: empId || 'Unknown',
          name: emp?.name || nh.name || 'Unknown',
          team: emp?.team || nh.team || 'Unknown',
          hq: emp?.hq || nh.hq || 'Unknown',
          doj: emp?.doj || 'Unknown',
          notifications: [],
          status: 'Warning',
          lastNotificationDate: '1970-01-01',
          trainingType: nh.trainingType
        };
      }
      // Only add if date is unique for this candidate/training pair
      if (!candidateMap[key].notifications.includes(nh.notificationDate)) {
        candidateMap[key].notifications.push(nh.notificationDate);
      }
      
      if (new Date(nh.notificationDate) > new Date(candidateMap[key].lastNotificationDate)) {
        candidateMap[key].lastNotificationDate = nh.notificationDate;
      }
    });

    // 2. Sort notifications chronologically for each candidate
    Object.values(candidateMap).forEach(c => {
      c.notifications.sort((a, b) => new Date(a).getTime() - new Date(b).getTime());
    });

    trainingData.forEach(td => {
      const key = `${td.employeeId}_${td.trainingType}`;
      if (candidateMap[key] && String(td.attendanceStatus).toLowerCase() === 'present') {
        delete candidateMap[key];
      }
    });

    const clusterMap: Record<string, ClusterDefaulter> = {};

    Object.values(candidateMap).forEach(c => {
      const emp = employeeData.find(e => String(e.employeeId) === String(c.employeeId));
      let clusterName = emp?.cluster;
      
      if (!clusterName) {
        const teamMaster = masterTeams.find(t => 
          t.teamName && (t.teamName.toUpperCase() === c.team.toUpperCase() || t.id === c.team)
        );
        clusterName = teamMaster?.cluster || 'Unassigned';
      }
      
      if (!clusterMap[clusterName]) {
        clusterMap[clusterName] = {
          cluster: clusterName,
          totalDefaulters: 0,
          critical: 0,
          warning: 0,
          teamsAffected: 0,
          lastNotification: c.lastNotificationDate,
          teams: []
        };
      }

      const cluster = clusterMap[clusterName];
      c.status = c.notifications.length >= 3 ? 'Critical' : 'Warning';
      
      cluster.totalDefaulters++;
      if (c.status === 'Critical') cluster.critical++;
      else cluster.warning++;
      
      if (new Date(c.lastNotificationDate) > new Date(cluster.lastNotification)) {
        cluster.lastNotification = c.lastNotificationDate;
      }

      let team = cluster.teams.find(t => t.team === c.team);
      if (!team) {
        team = {
          team: c.team,
          totalDefaulters: 0,
          critical: 0,
          warning: 0,
          candidates: []
        };
        cluster.teams.push(team);
        cluster.teamsAffected++;
      }

      team.totalDefaulters++;
      if (c.status === 'Critical') team.critical++;
      else team.warning++;
      team.candidates.push(c);
    });

    const sortedClusterNames = sortClusters(Object.keys(clusterMap));
    
    return sortedClusterNames.map((name: string) => {
      const cluster = clusterMap[name];
      cluster.teams.sort((a, b) => a.team.localeCompare(b.team));
      return cluster;
    });
  }, [employeeData, notificationHistory, trainingData, masterTeams]);

  const stats = useMemo(() => {
    let critical = 0, warning = 0;
    hierarchy.forEach((c: ClusterDefaulter) => {
      critical += c.critical;
      warning += c.warning;
    });
    return { total: critical, critical, warning };
  }, [hierarchy]);

  return (
    <div className={styles.page}>
      <div className={styles.header}>
        <div>
          <h1 className={styles.title}>
            <ShieldAlert size={32} className="text-danger" />
            Defaulter Tracking
          </h1>
          <p className={styles.subtitle}>Hierarchical operational view of unaddressed training requirements</p>
        </div>
      </div>

      <div className={styles.statsRow}>
        <motion.div whileHover={{ y: -5 }} className={`glass-panel ${styles.statCard}`}>
          <span className={styles.statLabel}>Defaulter Count (3+)</span>
          <span className={`${styles.statValue} ${styles.criticalText}`}>{stats.critical}</span>
        </motion.div>
        <motion.div whileHover={{ y: -5 }} className={`glass-panel ${styles.statCard}`}>
          <span className={styles.statLabel}>Warning Count (1-2)</span>
          <span className={`${styles.statValue} ${styles.warningText}`}>{stats.warning}</span>
        </motion.div>
        <motion.div whileHover={{ y: -5 }} className={`glass-panel ${styles.statCard}`}>
          <span className={styles.statLabel}>Total Defaulters</span>
          <span className={styles.statValue}>{stats.total}</span>
        </motion.div>
      </div>

      <div className={styles.mainContent}>
        {hierarchy.length === 0 ? (
          <div className={styles.emptyState}>
            No defaulter records found based on notification history and attendance audit.
          </div>
        ) : (
          hierarchy.map((cluster: ClusterDefaulter) => {
            const isClusterExpanded = expandedClusters.has(cluster.cluster);
            return (
              <div key={cluster.cluster} className={`${styles.clusterContainer} ${cluster.cluster === 'Unassigned' ? styles.unassignedCluster : ''}`}>
                <div 
                  className={`${styles.clusterHeader} ${isClusterExpanded ? styles.headerActive : ''}`}
                  onClick={() => toggleCluster(cluster.cluster)}
                >
                  <div className={styles.headerInfo}>
                    <ChevronDown size={18} className={`${styles.chevron} ${isClusterExpanded ? styles.rotate : ''}`} />
                    <span className={styles.clusterName}>{formatDisplayText(cluster.cluster)}</span>
                    {cluster.cluster === 'Unassigned' && (
                      <span className={styles.dqAlert}>
                        <AlertTriangle size={12} /> Data Sync Issue
                      </span>
                    )}
                  </div>
                  <div className={styles.headerMetrics}>
                    <div className={styles.hMetric}><strong>{cluster.critical}</strong> Defaulters</div>
                    <div className={styles.hMetric}><strong>{cluster.teamsAffected}</strong> Teams</div>
                    <div className={styles.hMetric}>Last: {cluster.lastNotification}</div>
                  </div>
                </div>

                {isClusterExpanded && (
                  <div className={styles.clusterContent}>
                    {cluster.teams.map((team: TeamDefaulter) => {
                      const teamKey = `${cluster.cluster}_${team.team}`;
                      const isTeamExpanded = expandedTeams.has(teamKey);
                      return (
                        <div key={teamKey} className={styles.teamCard}>
                          <div 
                            className={`${styles.teamHeader} ${isTeamExpanded ? styles.teamHeaderOpen : ''}`}
                            onClick={() => toggleTeam(teamKey)}
                          >
                            <div className={styles.teamBasic}>
                              <ChevronDown size={14} className={`${styles.chevron} ${isTeamExpanded ? styles.rotate : ''}`} />
                              <span className={styles.teamName}>{formatDisplayText(team.team)}</span>
                            </div>
                            <div className={styles.teamMetrics}>
                              <div className={styles.tMetric}><span>Defaulters:</span> <strong>{team.critical}</strong></div>
                              <div className={styles.tMetric}><span>Warnings:</span> <strong className="text-warning">{team.warning}</strong></div>
                              <div className={styles.tMetric}><span>Last:</span> {cluster.lastNotification}</div>
                            </div>
                          </div>

                          {isTeamExpanded && (
                            <div className={styles.matrixContainer}>
                              <div className={styles.matrixWrapper}>
                                <table className={styles.matrixTable}>
                                  <thead>
                                    <tr>
                                      <th className={styles.thEmpId}>Employee ID</th>
                                      <th className={styles.thName}>Employee</th>
                                      <th>HQ</th>
                                      <th>DOJ</th>
                                      <th className="text-center">Risk</th>
                                      <th>Notifications</th>
                                      <th className="text-center">Last Notified</th>
                                    </tr>
                                  </thead>
                                  <tbody>
                                    {team.candidates.map((cand: CandidateDefaulter) => (
                                      <tr key={cand.employeeId} className={styles.matrixRow}>
                                        <td className={styles.tdEmpId}>{cand.employeeId}</td>
                                        <td className={styles.tdName}>{formatDisplayText(cand.name)}</td>
                                        <td className={styles.tdSecondary}>{cand.hq}</td>
                                        <td className={styles.tdSecondary}>{cand.doj}</td>
                                        <td className="text-center">
                                          <span className={`${styles.riskBadge} ${cand.status === 'Critical' ? styles.riskCritical : styles.riskWarning}`}>
                                            {cand.status}
                                          </span>
                                        </td>
                                        <td>
                                          <div className={styles.notifiedList}>
                                            {cand.notifications.map((date: string, i: number) => (
                                              <span key={i} className={styles.notifiedDate}>{date}</span>
                                            ))}
                                          </div>
                                        </td>
                                        <td className={styles.tdDate}>{cand.lastNotificationDate}</td>
                                      </tr>
                                    ))}
                                  </tbody>
                                </table>
                              </div>
                            </div>
                          )}
                        </div>
                      );
                    })}
                  </div>
                )}
              </div>
            );
          })
        )}
      </div>
    </div>
  );
};
