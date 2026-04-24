import React, { useState, useMemo } from 'react';
import { ClipboardList, Bell, Activity } from 'lucide-react';
import { usePlanningFlow } from '../../context/PlanningFlowContext';
import { useMasterData } from '../../context/MasterDataContext';
import { Employee } from '../../types/employee';
import { Attendance, TrainingNomination } from '../../types/attendance';
import { NominationsPage }  from './NominationsPage';
import { NotificationPage } from './NotificationPage';
import { ExecutionPage }    from './ExecutionPage';

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

  // Per-tab counts for badge
  const counts = useMemo(() => {
    const allDrafts = getDrafts({ teamIds: sessionTeamIds.length > 0 ? sessionTeamIds : undefined });
    return {
      nominations:  allDrafts.filter(d => d.status === 'DRAFT').length,
      notification: allDrafts.filter(d => d.status === 'APPROVED').length,
      execution:    allDrafts.filter(d => d.status === 'SENT' || d.status === 'COMPLETED').length,
    };
  }, [getDrafts, sessionTeamIds]);

  // Session summary for header
  const sessionLabel = selectionSession
    ? `${selectionSession.trainingType} · ${selectionSession.teams.join(', ')}`
    : 'No active session';

  return (
    <div className="animate-fade-in">

      {/* ── PAGE HEADER ── */}
      <div style={{ marginBottom: '20px' }}>
        <h1 style={{ margin: 0, fontSize: '26px', fontWeight: 700 }}>Training Module</h1>
        <div style={{ marginTop: '6px', display: 'flex', alignItems: 'center', gap: '10px', flexWrap: 'wrap' }}>
          <p style={{ margin: 0, fontSize: '13px', color: 'var(--text-secondary)' }}>
            End-to-end pipeline: Nominations → Notification → Execution
          </p>
          {selectionSession && (
            <span style={{
              display: 'inline-flex', alignItems: 'center', gap: '5px',
              padding: '3px 10px', borderRadius: '20px', fontSize: '12px', fontWeight: 600,
              background: 'rgba(16,185,129,.1)', color: '#059669',
              border: '1px solid rgba(16,185,129,.3)'
            }}>
              ● {sessionLabel}
            </span>
          )}
        </div>
      </div>

      {/* ── TAB BAR ── */}
      <div style={{
        display: 'flex', gap: '4px', marginBottom: '20px',
        background: 'var(--bg-card)', borderRadius: '10px',
        padding: '4px', border: '1px solid var(--border-color)',
        width: 'fit-content'
      }}>
        {TABS.map(({ key, label, Icon }) => {
          const active  = tab === key;
          const count   = counts[key];
          return (
            <button
              key={key}
              onClick={() => setTab(key)}
              style={{
                display: 'flex', alignItems: 'center', gap: '7px',
                padding: '8px 18px', borderRadius: '7px', border: 'none', cursor: 'pointer',
                background: active ? 'var(--accent-primary)' : 'transparent',
                color: active ? '#ffffff' : 'var(--text-secondary)',
                fontWeight: active ? 700 : 500, fontSize: '13px',
                transition: 'all .15s', whiteSpace: 'nowrap'
              }}
            >
              <Icon size={15} />
              {label}
              {count > 0 && (
                <span style={{
                  display: 'inline-flex', alignItems: 'center', justifyContent: 'center',
                  minWidth: '18px', height: '18px', borderRadius: '9px', padding: '0 5px',
                  background: active ? 'rgba(255,255,255,.25)' : 'rgba(99,102,241,.12)',
                  color: active ? '#fff' : 'var(--accent-primary)',
                  fontSize: '10px', fontWeight: 700
                }}>
                  {count}
                </span>
              )}
            </button>
          );
        })}
      </div>

      {/* ── TAB DESCRIPTION ── */}
      <div style={{ marginBottom: '16px', fontSize: '12px', color: 'var(--text-secondary)', fontWeight: 500, letterSpacing: '.01em' }}>
        {TABS.find(t => t.key === tab)?.desc}
      </div>

      {/* ── PAGE CONTENT ── */}
      {tab === 'nominations'  && <NominationsPage  employees={employees} nominations={nominations} attendance={attendance} />}
      {tab === 'notification' && <NotificationPage employees={employees} />}
      {tab === 'execution'    && <ExecutionPage    employees={employees} attendance={attendance} />}
    </div>
  );
};
