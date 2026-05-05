import React, { useState, useMemo } from 'react';
import { 
  Search, Filter, Calendar, Users, CheckCircle, Clock, AlertCircle, 
  ChevronRight, ArrowUpRight, ArrowDownRight, Activity, ClipboardList
} from 'lucide-react';
import { useMasterData } from '../../core/context/MasterDataContext';
import { usePlanningFlow } from '../../core/context/PlanningFlowContext';
import TrainerAvatar from '../../shared/components/ui/TrainerAvatar';
import { toProperCase } from '../../core/engines/normalizationEngine';
import styles from './TrackerPage.module.css';

interface ActivityRecord {
  id: string;
  trainingType: string;
  team: string;
  teamId: string;
  trainer: string;
  scheduledDate: string;
  actualDate?: string;
  status: 'Draft' | 'Approved' | 'Notified' | 'Ongoing' | 'Completed' | 'Cancelled';
  plannedCount: number;
  actualCount?: number;
  avgScore?: number;
  source: 'DRAFT' | 'BATCH';
}

const STATUS_CONFIG: Record<string, { className: string; icon: React.ElementType }> = {
  'Draft': { className: styles.statusDraft, icon: Clock },
  'Approved': { className: styles.statusApproved, icon: CheckCircle },
  'Notified': { className: styles.statusNotified, icon: AlertCircle },
  'Ongoing': { className: styles.statusOngoing, icon: Activity },
  'Completed': { className: styles.statusCompleted, icon: CheckCircle },
  'Cancelled': { className: styles.statusCancelled, icon: AlertCircle }
};

export const TrackerPage: React.FC = () => {
  const { finalData, trainers: masterTrainers } = useMasterData();
  const { drafts } = usePlanningFlow();
  
  const [search, setSearch] = useState('');
  const [filterType, setFilterType] = useState('ALL');
  const [filterStatus, setFilterStatus] = useState('ALL');

  const activities = useMemo(() => {
    const list: ActivityRecord[] = [];

    // Map Drafts
    drafts.forEach(d => {
      // If there's a corresponding batch, we'll prefer the batch data later or mark it as ongoing
      const status: ActivityRecord['status'] = d.isCancelled ? 'Cancelled' : 
                                               d.status === 'COMPLETED' ? 'Completed' :
                                               d.status === 'NOTIFIED' ? 'Notified' :
                                               d.status === 'APPROVED' ? 'Approved' : 'Draft';
      
      list.push({
        id: d.id,
        trainingType: d.trainingType,
        team: d.team,
        teamId: d.teamId,
        trainer: d.trainer || '',
        scheduledDate: d.startDate || '',
        status,
        plannedCount: d.candidates.length,
        source: 'DRAFT'
      });
    });

    // Map Batches (committed executions)
    finalData.trainingBatches.forEach(b => {
      // Find existing draft to update or add as new
      const existingIdx = list.findIndex(a => a.id === b.id || a.id === b.draftId);
      
      const presentCount = b.candidates.filter(c => c.attendance === 'present').length;
      const totalCount = b.candidates.length;
      const isCompleted = b.candidates.every(c => c.attendance !== 'pending');
      
      const scores = b.candidates
        .map(c => {
          const s = c.scores || {};
          const val = s.score ?? s.percent ?? s.tScore ?? Object.values(s).find(v => typeof v === 'number');
          return typeof val === 'number' ? val : parseFloat(val as any);
        })
        .filter(n => !isNaN(n));
      
      const avgScore = scores.length > 0 ? Math.round(scores.reduce((a, b) => a + b, 0) / scores.length) : undefined;

      const activity: ActivityRecord = {
        id: b.id,
        trainingType: b.trainingType,
        team: b.team,
        teamId: b.teamId,
        trainer: typeof b.trainer === 'string' ? b.trainer : (b.trainer as any)?.id || '',
        scheduledDate: b.startDate,
        actualDate: b.committedAt,
        status: b.isVoided ? 'Cancelled' : (isCompleted ? 'Completed' : 'Ongoing'),
        plannedCount: totalCount,
        actualCount: presentCount,
        avgScore,
        source: 'BATCH'
      };

      if (existingIdx > -1) {
        list[existingIdx] = activity;
      } else {
        list.push(activity);
      }
    });

    return list.sort((a, b) => new Date(b.scheduledDate).getTime() - new Date(a.scheduledDate).getTime());
  }, [drafts, finalData.trainingBatches]);

  const filteredActivities = useMemo(() => {
    return activities.filter(a => {
      const matchesSearch = !search || 
        a.trainingType.toLowerCase().includes(search.toLowerCase()) ||
        a.team.toLowerCase().includes(search.toLowerCase());
      const matchesType = filterType === 'ALL' || a.trainingType === filterType;
      const matchesStatus = filterStatus === 'ALL' || a.status === filterStatus;
      return matchesSearch && matchesType && matchesStatus;
    });
  }, [activities, search, filterType, filterStatus]);

  const stats = useMemo(() => {
    const total = activities.length;
    const completed = activities.filter(a => a.status === 'Completed').length;
    const ongoing = activities.filter(a => a.status === 'Ongoing' || a.status === 'Notified').length;
    const cancelled = activities.filter(a => a.status === 'Cancelled').length;
    
    return { total, completed, ongoing, cancelled };
  }, [activities]);

  const fmtDate = (d?: string) => {
    if (!d) return '—';
    return new Date(d).toLocaleDateString('en-IN', { day: '2-digit', month: 'short' });
  };

  const getTrainer = (id: string) => {
    return masterTrainers.find(t => t.id === id) || { id, name: id };
  };

  return (
    <div className={styles.page}>
      <div className={styles.header}>
        <div>
          <h1 className={styles.title}>Training Tracker</h1>
          <p className={styles.subtitle}>End-to-end execution monitoring of training activities</p>
        </div>
        <div className={styles.metricsContainer}>
           <div className={styles.summaryCard}>
              <span className={styles.cardLabel}>Success Rate</span>
              <span className={styles.cardValue}>{stats.total > 0 ? Math.round((stats.completed / stats.total) * 100) : 0}%</span>
           </div>
        </div>
      </div>

      <div className={styles.summaryCards}>
        <div className={styles.summaryCard}>
          <span className={styles.cardLabel}>Total Activities</span>
          <span className={styles.cardValue}>{stats.total}</span>
          <div className={`${styles.cardTrend} ${styles.trendUp}`}>
            <ArrowUpRight size={14} /> <span>Live tracking</span>
          </div>
        </div>
        <div className={styles.summaryCard}>
          <span className={styles.cardLabel}>Completed</span>
          <span className={styles.cardValue}>{stats.completed}</span>
          <div className={`${styles.cardTrend} ${styles.trendUp}`}>
            <CheckCircle size={14} /> <span>On target</span>
          </div>
        </div>
        <div className={styles.summaryCard}>
          <span className={styles.cardLabel}>Ongoing / Notified</span>
          <span className={styles.cardValue}>{stats.ongoing}</span>
          <div className={`${styles.cardTrend} ${styles.trendUp}`}>
            <Activity size={14} /> <span>Active cycles</span>
          </div>
        </div>
        <div className={styles.summaryCard}>
          <span className={styles.cardLabel}>Cancelled</span>
          <span className={styles.cardValue}>{stats.cancelled}</span>
          <div className={`${styles.cardTrend} ${styles.trendDown}`}>
            <AlertCircle size={14} /> <span>Requires review</span>
          </div>
        </div>
      </div>

      <div className={styles.filterBar}>
        <div className={styles.searchWrapper}>
          <Search size={16} className={styles.searchIcon} />
          <input 
            type="text" 
            placeholder="Search by training or team..." 
            className={styles.searchInput}
            value={search}
            onChange={e => setSearch(e.target.value)}
          />
        </div>
        
        <select 
          className={styles.select}
          value={filterType}
          onChange={e => setFilterType(e.target.value)}
        >
          <option value="ALL">All Types</option>
          <option value="IP">IP</option>
          <option value="AP">AP</option>
          <option value="MIP">MIP</option>
          <option value="Refresher">Refresher</option>
          <option value="Capsule">Capsule</option>
        </select>

        <select 
          className={styles.select}
          value={filterStatus}
          onChange={e => setFilterStatus(e.target.value)}
        >
          <option value="ALL">All Status</option>
          <option value="Draft">Draft</option>
          <option value="Approved">Approved</option>
          <option value="Notified">Notified</option>
          <option value="Ongoing">Ongoing</option>
          <option value="Completed">Completed</option>
          <option value="Cancelled">Cancelled</option>
        </select>
      </div>

      <div className={styles.trackerTableContainer}>
        <table className={styles.table}>
          <thead>
            <tr>
              <th className={styles.th}>Activity & Team</th>
              <th className={styles.th}>Schedule</th>
              <th className={styles.th}>Trainer</th>
              <th className={styles.th}>Status</th>
              <th className={styles.th}>Execution</th>
              <th className={styles.th}>Perf.</th>
              <th className={styles.th}></th>
            </tr>
          </thead>
          <tbody>
            {filteredActivities.map(activity => {
              const statusCfg = STATUS_CONFIG[activity.status] || STATUS_CONFIG['Draft'];
              const StatusIcon = statusCfg.icon;
              const attPct = activity.actualCount !== undefined ? Math.round((activity.actualCount / activity.plannedCount) * 100) : null;
              
              return (
                <tr key={activity.id} className={styles.tr}>
                  <td className={styles.td}>
                    <div className={styles.activityInfo}>
                      <span className={styles.activityType}>{activity.trainingType}</span>
                      <span className={styles.activityTeam}>{toProperCase(activity.team)}</span>
                    </div>
                  </td>
                  <td className={styles.td}>
                    <div className={styles.dateCell}>
                      <span className={styles.dateLabel}>Planned</span>
                      <span className={styles.dateValue}>{fmtDate(activity.scheduledDate)}</span>
                    </div>
                  </td>
                  <td className={styles.td}>
                    <div className={styles.trainerCell}>
                      <TrainerAvatar trainer={getTrainer(activity.trainer)} size={24} />
                      <span style={{ fontSize: '12px' }}>{getTrainer(activity.trainer).name}</span>
                    </div>
                  </td>
                  <td className={styles.td}>
                    <span className={`${styles.statusBadge} ${statusCfg.className}`}>
                      <StatusIcon size={12} />
                      {activity.status}
                    </span>
                  </td>
                  <td className={styles.td}>
                    <div className={styles.metricsContainer}>
                      <div className={styles.metric}>
                        <span className={styles.metricValue}>
                          {activity.actualCount !== undefined ? activity.actualCount : '—'} 
                          <span style={{ color: '#94a3b8', fontSize: '11px', fontWeight: 400 }}> / {activity.plannedCount}</span>
                        </span>
                        <div className={styles.progressTrack}>
                          <div 
                            className={styles.progressBar} 
                            style={{ 
                              width: `${attPct || 0}%`,
                              background: (attPct || 0) > 80 ? '#10b981' : (attPct || 0) > 50 ? '#f59e0b' : '#ef4444'
                            }}
                          />
                        </div>
                      </div>
                    </div>
                  </td>
                  <td className={styles.td}>
                    <div className={styles.metric}>
                      <span className={`${styles.metricValue} ${activity.avgScore && activity.avgScore >= 80 ? styles.trendUp : ''}`}>
                        {activity.avgScore !== undefined ? `${activity.avgScore}%` : '—'}
                      </span>
                      <span className={styles.metricLabel}>Avg Score</span>
                    </div>
                  </td>
                  <td className={styles.td}>
                    <button className="btn-icon" title="View Details">
                      <ChevronRight size={16} />
                    </button>
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </div>
  );
};
