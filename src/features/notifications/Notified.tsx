import React, { useState, useMemo } from 'react';
import { ClipboardList, Bell, Activity } from 'lucide-react';
import { usePlanningFlow } from '../../core/context/PlanningFlowContext';
import { useMasterData } from '../../core/context/MasterDataContext';
import { Employee } from '../../types/employee';
import { Attendance, TrainingNomination } from '../../types/attendance';
import { NominationsPage }  from './NominationsPage';
import { NotificationPage } from './NotificationPage';
import { ExecutionPage }    from './ExecutionPage';
import { FlowStepper } from '../../shared/components/ui/FlowStepper';
import styles from './Notified.module.css';

interface NotifiedProps {
  employees:        Employee[];
  attendance:       Attendance[];
  nominations:      TrainingNomination[];
  onUploadComplete?: () => void;
}

type Tab = 'nominations' | 'notification' | 'execution';

const TABS: { key: Tab; label: string; Icon: React.ElementType; desc: string }[] = [
  { key: 'nominations',  label: 'Nominations',  Icon: ClipboardList, desc: 'Sales Head review & approval' },
  { key: 'notification', label: 'Notification',  Icon: Bell,          desc: 'Trainer sends communication' },
  { key: 'execution',    label: 'Execution',     Icon: Activity,      desc: 'Attendance & performance tracking' },
];

export const Notified: React.FC<NotifiedProps> = ({ employees, attendance, nominations }) => {
  const [tab, setTab] = useState<Tab>('nominations');
  const { getDrafts, selectionSession } = usePlanningFlow();
  const { teams: masterTeams } = useMasterData();

  const sessionTeamIds = selectionSession?.teamIds ?? [];

  const counts = useMemo(() => {
    const allDrafts = getDrafts({ teamIds: sessionTeamIds.length > 0 ? sessionTeamIds : undefined });
    return {
      nominations:  allDrafts.filter(d => d.status === 'DRAFT').length,
      notification: allDrafts.filter(d => d.status === 'APPROVED').length,
      execution:    allDrafts.filter(d => d.status === 'NOTIFIED' || d.status === 'SENT' || d.status === 'COMPLETED').length,
    };
  }, [getDrafts, sessionTeamIds]);

  const sessionLabel = selectionSession
    ? `${selectionSession.trainingType} · ${selectionSession.teams.join(', ')}`
    : 'No active session';

  const activeStep = tab === 'nominations' ? 1 : tab === 'notification' ? 1 : 2;

  return (
    <div className="animate-fade-in">

      {/* PAGE HEADER */}
      <div className={styles.pageHeader}>
        <h1 className={styles.pageTitle}>Training Module</h1>
        <div className={styles.headerMeta}>
          <p className={styles.headerSubtitle}>
            End-to-end pipeline: Nominations → Notification → Execution
          </p>
          {selectionSession && (
            <span className={styles.sessionBadge}>
              ● {sessionLabel}
            </span>
          )}
        </div>
      </div>
      <FlowStepper currentStep={activeStep} />

      <div className={styles.summaryStrip}>
        <div className={styles.summaryCard}>
          <div className={`status-badge status-planned ${styles.summaryBadge}`}>Planned</div>
          <div className={styles.summaryValue}>{counts.nominations}</div>
          <div className={styles.summaryLabel}>Awaiting Approval</div>
        </div>
        <div className={styles.summaryCard}>
          <div className={`status-badge status-notified ${styles.summaryBadge}`}>Notified</div>
          <div className={styles.summaryValue}>{counts.notification}</div>
          <div className={styles.summaryLabel}>Ready To Email</div>
        </div>
        <div className={styles.summaryCard}>
          <div className={`status-badge status-completed ${styles.summaryBadge}`}>Execution</div>
          <div className={styles.summaryValue}>{counts.execution}</div>
          <div className={styles.summaryLabel}>In/After Training</div>
        </div>
      </div>

      {/* TAB BAR */}
      <div className={styles.tabBar}>
        {TABS.map(({ key, label, Icon }) => {
          const active  = tab === key;
          const count   = counts[key];
          return (
            <button
              key={key}
              onClick={() => setTab(key)}
              className={`${styles.tabBtn} ${active ? styles.tabBtnActive : styles.tabBtnInactive}`}
            >
              <Icon size={15} />
              {label}
              {count > 0 && (
                <span className={`${styles.tabBadge} ${active ? styles.tabBadgeActive : styles.tabBadgeInactive}`}>
                  {count}
                </span>
              )}
            </button>
          );
        })}
      </div>

      {/* TAB DESCRIPTION */}
      <div className={styles.tabDesc}>
        {TABS.find(t => t.key === tab)?.desc}
      </div>

      {/* PAGE CONTENT */}
      {tab === 'nominations'  && <NominationsPage  employees={employees} nominations={nominations} attendance={attendance} />}
      {tab === 'notification' && <NotificationPage employees={employees} />}
      {tab === 'execution'    && <ExecutionPage    employees={employees} attendance={attendance} />}
    </div>
  );
};




