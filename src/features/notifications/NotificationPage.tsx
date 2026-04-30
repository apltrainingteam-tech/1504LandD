import React, { useState, useMemo } from 'react';
import { Mail, Users, Lock, Check, Copy, ExternalLink, X, ChevronDown, ChevronRight } from 'lucide-react';
import { usePlanningFlow } from '../../core/context/PlanningFlowContext';
import { useMasterData } from '../../core/context/MasterDataContext';
import { Employee } from '../../types/employee';
import { NominationDraft } from '../../types/attendance';
import { updateByQuery } from '../../core/engines/apiClient';
import styles from './NotificationPage.module.css';

interface Props {
  allEmployees: Employee[];
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

const fmtDate  = (s?: string) => !s ? '—' : new Date(s).toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' });
const addDays  = (s: string, n: number) => { const d = new Date(s); d.setDate(d.getDate() + n); return d.toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' }); };
const monthYear = (s?: string) => !s ? '' : new Date(s).toLocaleDateString('en-IN', { month: 'long', year: 'numeric' });

// ─── Email Builder ────────────────────────────────────────────────────────────

const buildSubject = (type: string, team: string, start?: string) =>
  `${type} Training Notice: ${team} ${monthYear(start)}`;

const buildHtml = (draft: NominationDraft, teamName: string, trainerName: string, cEmps: Employee[]) => {
  const checkIn = draft.startDate ? addDays(draft.startDate, -1) : '—';
  const fS = fmtDate(draft.startDate), fE = fmtDate(draft.endDate);

  const rows = cEmps.map((e, i) => `
    <tr style="background:${i%2===0?'#fff':'#f9f9fb'}">
      <td style="padding:8px 10px;border:1px solid #e5e7eb;text-align:center;font-weight:600">${i+1}</td>
      <td style="padding:8px 10px;border:1px solid #e5e7eb;font-weight:600">${e.employeeId}</td>
      <td style="padding:8px 10px;border:1px solid #e5e7eb">${e.team||'—'}</td>
      <td style="padding:8px 10px;border:1px solid #e5e7eb;font-weight:500">${e.name}</td>
      <td style="padding:8px 10px;border:1px solid #e5e7eb">${e.designation||'—'}</td>
      <td style="padding:8px 10px;border:1px solid #e5e7eb">${e.hq||'—'}</td>
      <td style="padding:8px 10px;border:1px solid #e5e7eb">${e.state||'—'}</td>
      <td style="padding:8px 10px;border:1px solid #e5e7eb">${e.email||'—'}</td>
      <td style="padding:8px 10px;border:1px solid #e5e7eb">${e.mobileNumber||'—'}</td>
    </tr>`).join('');

  return `<!DOCTYPE html><html><head><meta charset="UTF-8"/></head>
<body style="font-family:Calibri,Arial,sans-serif;font-size:14px;color:#1f2937;background:#f3f4f6;margin:0;padding:24px">
<div style="max-width:900px;margin:0 auto;background:#fff;border-radius:8px;overflow:hidden;box-shadow:0 2px 12px rgba(0,0,0,.08)">
  <div style="background:linear-gradient(135deg,#1e40af,#3b82f6);padding:28px 32px">
    <div style="font-size:22px;font-weight:700;color:#fff;margin-bottom:4px">${draft.trainingType} Training — Nomination Notice</div>
    <div style="font-size:14px;color:rgba(255,255,255,.82)">${teamName} | ${monthYear(draft.startDate)}</div>
  </div>
  <div style="padding:28px 32px">
    <p style="margin:0 0 20px 0">Dear Sir / Ma'am,</p>
    <p style="margin:0 0 24px 0">Please refer to the below details for the upcoming <strong>${draft.trainingType} Training</strong>.</p>
    <table style="width:100%;border-collapse:collapse;margin-bottom:20px;font-size:14px">
      <thead><tr style="background:#1e40af"><th colspan="2" style="padding:10px 14px;color:#fff;text-align:left;font-size:13px;text-transform:uppercase;letter-spacing:.05em">Training Details</th></tr></thead>
      <tbody>
        <tr style="background:#f9fafb"><td style="padding:9px 14px;border:1px solid #e5e7eb;font-weight:600;width:35%">Training Type</td><td style="padding:9px 14px;border:1px solid #e5e7eb">${draft.trainingType}</td></tr>
        <tr><td style="padding:9px 14px;border:1px solid #e5e7eb;font-weight:600">Team</td><td style="padding:9px 14px;border:1px solid #e5e7eb">${teamName}</td></tr>
        <tr style="background:#f9fafb"><td style="padding:9px 14px;border:1px solid #e5e7eb;font-weight:600">Trainer</td><td style="padding:9px 14px;border:1px solid #e5e7eb">${trainerName}</td></tr>
        <tr><td style="padding:9px 14px;border:1px solid #e5e7eb;font-weight:600">Training Date</td><td style="padding:9px 14px;border:1px solid #e5e7eb">${fS}${fS!==fE?` to ${fE}`:''}</td></tr>
        <tr style="background:#f9fafb"><td style="padding:9px 14px;border:1px solid #e5e7eb;font-weight:600">Check-In Date</td><td style="padding:9px 14px;border:1px solid #e5e7eb">${checkIn}</td></tr>
        <tr><td style="padding:9px 14px;border:1px solid #e5e7eb;font-weight:600">Return Date</td><td style="padding:9px 14px;border:1px solid #e5e7eb">${fE}</td></tr>
        <tr style="background:#f9fafb"><td style="padding:9px 14px;border:1px solid #e5e7eb;font-weight:600">Candidates</td><td style="padding:9px 14px;border:1px solid #e5e7eb;font-weight:700;color:#1e40af">${cEmps.length}</td></tr>
      </tbody>
    </table>
    <div style="background:#fef9c3;border-left:4px solid #f59e0b;padding:12px 16px;border-radius:4px;margin-bottom:24px;font-size:13px;color:#78350f">
      <strong>📌 Note:</strong> Ensure all candidates confirm attendance by <strong>${checkIn}</strong>. Post-approval changes must be escalated to L&amp;D.
    </div>
    <p style="font-weight:700;font-size:15px;margin:0 0 10px 0;color:#1e40af">Shortlisted Candidates (${cEmps.length})</p>
    <div style="overflow-x:auto">
      <table style="width:100%;border-collapse:collapse;font-size:13px;min-width:700px">
        <thead><tr style="background:#1e40af;color:#fff">
          <th style="padding:9px 10px;border:1px solid #2563eb;text-align:center">Sr</th>
          <th style="padding:9px 10px;border:1px solid #2563eb;text-align:left">Emp No</th>
          <th style="padding:9px 10px;border:1px solid #2563eb;text-align:left">Team</th>
          <th style="padding:9px 10px;border:1px solid #2563eb;text-align:left">Name</th>
          <th style="padding:9px 10px;border:1px solid #2563eb;text-align:left">Designation</th>
          <th style="padding:9px 10px;border:1px solid #2563eb;text-align:left">HQ</th>
          <th style="padding:9px 10px;border:1px solid #2563eb;text-align:left">State</th>
          <th style="padding:9px 10px;border:1px solid #2563eb;text-align:left">Email</th>
          <th style="padding:9px 10px;border:1px solid #2563eb;text-align:left">Mobile</th>
        </tr></thead>
        <tbody>${rows||'<tr><td colspan="9" style="padding:16px;text-align:center;color:#9ca3af">No candidates.</td></tr>'}</tbody>
      </table>
    </div>
    <div style="margin-top:32px;padding-top:20px;border-top:1px solid #e5e7eb;font-size:13px;color:#6b7280">
      <p style="margin:0 0 4px 0">Warm regards,</p>
      <p style="margin:0;font-weight:700;color:#1f2937">L&amp;D Team — APL</p>
    </div>
  </div>
</div></body></html>`;
};

// ─── Email Preview Modal ──────────────────────────────────────────────────────

const EmailModal: React.FC<{
  html: string; subject: string; mailto: string; tableHtml: string;
  onClose: () => void; onSent: () => void;
}> = ({ html, subject, mailto, tableHtml, onClose, onSent }) => {
  const [cHtml,  setCHtml]  = useState(false);
  const [cSubj,  setCSubj]  = useState(false);
  const [cTable, setCTable] = useState(false);

  const copy = async (text: string, set: (v:boolean)=>void) => {
    try { await navigator.clipboard.writeText(text); } catch { /* noop */ }
    set(true); setTimeout(()=>set(false), 2200);
  };

  return (
    <div className={styles.modalBackdrop}>
      <div className={styles.modalContent}>

        {/* Header */}
        <div className={styles.modalHeader}>
          <div className={styles.modalTitle}><Mail size={16} color="var(--accent-primary)"/>Email Preview</div>
          <button onClick={onClose} className={styles.closeBtn} title="Close Modal" aria-label="Close Modal"><X size={19} color="var(--text-secondary)"/></button>
        </div>

        {/* Subject row */}
        <div className={styles.subjectRow}>
          <span className={styles.subjectLabel}>Subject:</span>
          <span className={styles.subjectVal}>{subject}</span>
          <button onClick={()=>copy(subject,setCSubj)} className={`${styles.copyBtn} ${cSubj ? styles.copyBtnSuccess : styles.copyBtnNormal}`}>
            {cSubj?<><Check size={10}/>Copied</>:<><Copy size={10}/>Copy</>}
          </button>
        </div>

        {/* Instruction banner */}
        <div className={styles.instructionBanner}>
          <span className={styles.instructionTitle}>💡 Workflow:</span>
          <span>1&nbsp;&nbsp;Click <strong>Open in Outlook</strong> to create a draft with subject &amp; summary.&nbsp;&nbsp;2&nbsp;&nbsp;Then click <strong>Copy Table</strong> and paste into the email body for the full candidate table.</span>
        </div>

        {/* iframe preview */}
        <div className={styles.previewArea}>
          <iframe srcDoc={html} title="Email Preview" className={styles.previewIframe}/>
        </div>

        {/* Footer actions */}
        <div className={styles.modalFooter}>
          <button onClick={onClose} className="btn btn-secondary">Cancel</button>

          {/* Copy full HTML */}
          <button onClick={()=>copy(html,setCHtml)} className={`${styles.footerBtn} ${cHtml ? styles.footerBtnHtml : styles.footerBtnNormal}`}>
            {cHtml?<><Check size={13}/>Copied!</>:<><Copy size={13}/>Copy Full HTML</>}
          </button>

          {/* Copy Table only */}
          <button
            onClick={()=>copy(tableHtml,setCTable)}
            title="Copies just the candidate table HTML — paste directly into Outlook body"
            className={`${styles.footerBtn} ${cTable ? styles.footerBtnTable : styles.footerBtnNormal}`}
          >
            {cTable?<><Check size={13}/>Table Copied!</>:<><Copy size={13}/>Copy Table</>}
          </button>

          {/* Open in Outlook */}
          <button
            onClick={() => {
              const a = document.createElement('a');
              a.href = mailto;
              a.style.display = 'none';
              document.body.appendChild(a);
              a.click();
              document.body.removeChild(a);
              onSent();
              onClose();
            }}
            className={`${styles.footerBtn} ${styles.primaryAction}`}
          >
            <ExternalLink size={13}/>Open in Outlook
          </button>
        </div>
      </div>
    </div>
  );
};

// ─── Main Component ───────────────────────────────────────────────────────────

export const NotificationPage: React.FC<Props> = ({ allEmployees }) => {
  const { getDrafts, updateDraft, commitBatch, selectionSession, cancelDraft } = usePlanningFlow();
  const { teams: masterTeams, trainers: masterTrainers } = useMasterData();

  const sessionTeamIds = selectionSession?.teamIds ?? [];
  const [emailModal, setEmailModal] = useState<{ html:string; subject:string; mailto:string; tableHtml:string; draftId:string }|null>(null);
  const [expanded, setExpanded]     = useState<Set<string>>(new Set());
  const [actionInFlight, setActionInFlight] = useState<Set<string>>(new Set());

  const resolveTeam    = (id?:string, fb?:string) => masterTeams.find(t=>t.id===id)?.teamName||(fb||id||'—');
  const resolveTrainer = (id?:string) => masterTrainers.find(t=>t.id===id)?.trainerName||(id||'—');

  // Keep ready-to-send and post-send drafts visible in Notification
  const approvedDrafts = useMemo(
    () => getDrafts({ teamIds: sessionTeamIds.length>0?sessionTeamIds:undefined }).filter((d: NominationDraft)=>d.status==='DRAFT' || d.status==='APPROVED' || d.status === 'NOTIFIED' || d.status === 'SENT' || d.status === 'COMPLETED'),
    [getDrafts, sessionTeamIds]
  );

  // Group by team
  const teamGroups = useMemo(() => {
    const map = new Map<string, NominationDraft[]>();
    approvedDrafts.forEach((d: NominationDraft) => {
      if (!map.has(d.teamId)) map.set(d.teamId, []);
      map.get(d.teamId)!.push(d);
    });
    return Array.from(map.entries());
  }, [approvedDrafts]);

  const toggleGroup = (teamId: string) => {
    const next = new Set(expanded);
    next.has(teamId) ? next.delete(teamId) : next.add(teamId);
    setExpanded(next);
  };

  const handleEmail = (draft: NominationDraft) => {
    const tName  = resolveTeam(draft.teamId, draft.team);
    const trName = resolveTrainer(draft.trainer);
    const cEmps  = allEmployees.filter((e: Employee) => draft.candidates.includes(String(e.employeeId)));
    const subject = buildSubject(draft.trainingType, tName, draft.startDate);
    const html    = buildHtml(draft, tName, trName, cEmps);

    // ── Build inline-styled HTML candidate table ──────────────────────────────
    // This is used for both the mailto body and the dedicated "Copy Table" button.
    const thStyle = 'padding:7px 10px;border:1px solid #c5c5c5;background:#1e40af;color:#ffffff;font-size:12px;text-align:left;white-space:nowrap';
    const tdStyle = (alt: boolean) =>
      `padding:7px 10px;border:1px solid #c5c5c5;font-size:12px;background:${alt ? '#f0f4ff' : '#ffffff'}`;

    const headerRow = `<tr>
      <th style="${thStyle};text-align:center">#</th>
      <th style="${thStyle}">Emp ID</th>
      <th style="${thStyle}">Trainer</th>
      <th style="${thStyle}">Team</th>
      <th style="${thStyle}">Name</th>
      <th style="${thStyle}">Designation</th>
      <th style="${thStyle}">HQ</th>
      <th style="${thStyle}">State</th>
    </tr>`;

    const dataRows = cEmps.map((e: Employee, i: number) => {
      const td = tdStyle(i % 2 !== 0);
      return `<tr>
        <td style="${td};text-align:center;font-weight:600">${i + 1}</td>
        <td style="${td};font-family:monospace;font-weight:600">${e.employeeId}</td>
        <td style="${td}">${trName}</td>
        <td style="${td}">${e.team || tName}</td>
        <td style="${td};font-weight:500">${e.name}</td>
        <td style="${td}">${e.designation || '—'}</td>
        <td style="${td}">${e.hq || '—'}</td>
        <td style="${td}">${e.state || '—'}</td>
      </tr>`;
    }).join('');

    const tableHtml =
      `<table border="1" cellpadding="5" cellspacing="0" style="border-collapse:collapse;font-family:Calibri,Arial,sans-serif;font-size:12px;width:100%">
        <thead>${headerRow}</thead>
        <tbody>${dataRows || '<tr><td colspan="8" style="padding:12px;text-align:center">No candidates.</td></tr>'}</tbody>
      </table>`;

    // ── mailto body: PLAIN TEXT ONLY ─────────────────────────────────────────
    // The mailto: protocol only supports plain text — HTML tags cause Outlook
    // to fail to open the compose window entirely. Keep this short and simple.
    // The formatted HTML table is available via the "Copy Table" button instead.
    const dateRange = draft.startDate
      ? fmtDate(draft.startDate) + (draft.endDate && draft.endDate !== draft.startDate ? ` to ${fmtDate(draft.endDate)}` : '')
      : '—';

    const mailtoBody =
      `Dear Sir / Ma'am,\n\n` +
      `Please find the shortlisted candidates for the upcoming ${draft.trainingType} Training.\n\n` +
      `Team: ${tName}\n` +
      `Trainer: ${trName}\n` +
      `Date: ${dateRange}\n` +
      `Candidates: ${cEmps.length}\n\n` +
      `[Paste the formatted candidate table here — use "Copy Table" from the email preview]\n\n` +
      `Warm regards,\n` +
      `L&D Team — APL`;

    const mailto = `mailto:?subject=${encodeURIComponent(subject)}&body=${encodeURIComponent(mailtoBody)}`;
    setEmailModal({ html, subject, mailto, tableHtml, draftId: draft.id });
  };

  const handleSent = async (draftId: string) => {
    if (actionInFlight.has(`send:${draftId}`)) return;
    setActionInFlight(prev => new Set(prev).add(`send:${draftId}`));
    // Find the draft before status changes, then commit an immutable batch
    const draft = approvedDrafts.find((d: NominationDraft) => d.id === draftId);
    if (!draft || draft.status === 'COMPLETED' || draft.isCancelled) {
      setActionInFlight(prev => {
        const next = new Set(prev);
        next.delete(`send:${draftId}`);
        return next;
      });
      return;
    }
    try {
      // First send only: commit notification batch once.
      if (draft.status === 'APPROVED') {
        await commitBatch(draft, allEmployees);
        updateDraft(draftId, { status: 'NOTIFIED', sentBy: 'Trainer', sentAt: new Date().toISOString() });
      } else {
        console.log('[Notification] Resent email without creating new batch', { draftId, status: draft.status });
      }
      setEmailModal(null);
    } finally {
      setActionInFlight(prev => {
        const next = new Set(prev);
        next.delete(`send:${draftId}`);
        return next;
      });
    }
  };

  const handleComplete = async (draft: NominationDraft) => {
    if (actionInFlight.has(`complete:${draft.id}`)) return;
    if (draft.status !== 'NOTIFIED' || draft.isCancelled) return;
    if (!window.confirm('Confirm training completed?')) return;
    setActionInFlight(prev => new Set(prev).add(`complete:${draft.id}`));
    try {
      console.log('[Notification] Complete clicked', { draftId: draft.id, status: draft.status });
      await updateByQuery(
        'notification_history',
        { trainingId: draft.trainingId || draft.id },
        { finalStatus: 'Completed' }
      );
      if (draft.status === 'NOTIFIED') {
        updateDraft(draft.id, { status: 'COMPLETED', completedAt: draft.completedAt || new Date().toISOString() });
      }
    } catch (error) {
      console.error('Failed to complete notification batch', error);
    } finally {
      setActionInFlight(prev => {
        const next = new Set(prev);
        next.delete(`complete:${draft.id}`);
        return next;
      });
    }
  };

  const handleCancel = async (draft: NominationDraft) => {
    if (actionInFlight.has(`cancel:${draft.id}`)) return;
    if (draft.status === 'COMPLETED') return;
    if (!window.confirm('This will cancel training and return employees to untrained pool')) return;
    setActionInFlight(prev => new Set(prev).add(`cancel:${draft.id}`));
    try {
      const result = await cancelDraft(draft.id);
      if (!result.success) {
        alert(result.reason || 'Cancel failed.');
      }
    } catch (error) {
      console.error('Failed to cancel notification batch', error);
    } finally {
      setActionInFlight(prev => {
        const next = new Set(prev);
        next.delete(`cancel:${draft.id}`);
        return next;
      });
    }
  };

  if (approvedDrafts.length === 0) {
    return (
      <div className={`animate-fade-in ${styles.page}`}>
        <h1 className={styles.pageTitle}>Notification</h1>
        <div className={styles.emptyState}>
          <Lock size={36} className={styles.emptyIcon}/>
          <div className={styles.emptyTitle}>No approved nominations yet</div>
          <div className={styles.fz13}>Sales Head must approve from the <strong>Nominations</strong> page first.</div>
        </div>
      </div>
    );
  }

  return (
    <div className={`animate-fade-in ${styles.page}`}>
      <div className={styles.mb20}>
        <h1 className={styles.pageTitle}>Notification</h1>
        <p className={styles.pageSubtitle}>
          Send training communication to approved candidates, grouped by team.
        </p>
      </div>
      <div className={styles.statsBar}>
        <span className={styles.statsText}>
          <strong className={styles.textAccent}>{approvedDrafts.length}</strong> approved nomination{approvedDrafts.length!==1?'s':''} ready to send — grouped by team
        </span>
      </div>

      <div className={styles.groupsContainer}>
        {teamGroups.map(([teamId, drafts]) => {
          const tName    = resolveTeam(teamId, drafts[0]?.team);
          const isOpen   = expanded.has(teamId);
          const allEmps  = allEmployees.filter((e: Employee) => drafts.some((d: NominationDraft) => d.candidates.includes(String(e.employeeId))));

          return (
            <div key={teamId} className={styles.groupCard}>

              {/* Group header */}
              <div
                onClick={()=>toggleGroup(teamId)}
                className={`${styles.groupHeader} ${isOpen ? styles.groupHeaderOpen : styles.groupHeaderClosed}`}
              >
                {isOpen?<ChevronDown size={16}/>:<ChevronRight size={16}/>}
                <span className={styles.teamName}>{tName}</span>
                <span className={styles.planCountBadge}>
                  {drafts.length} plan{drafts.length!==1?'s':''}
                </span>
                <span className={styles.userCountInfo}>
                  <Users size={12}/>{allEmps.length} candidates across all plans
                </span>
                <div className={styles.groupActions} onClick={e=>e.stopPropagation()}>
                  {/* Send per team = send for all plans in this team */}
                  {drafts.map(draft=>(
                    <React.Fragment key={draft.id}>
                      <button
                        onClick={()=>handleEmail(draft)}
                        className={styles.sendBtn}
                        disabled={draft.status === 'COMPLETED' || !!draft.isCancelled || actionInFlight.has(`send:${draft.id}`)}
                      >
                        <Mail size={12}/>{draft.trainingType} — {draft.status === 'NOTIFIED' ? 'Resend Email' : 'Send Email'}
                      </button>
                      {draft.status !== 'COMPLETED' && (
                        <>
                          <button
                            onClick={() => handleComplete(draft)}
                            className={styles.sendBtn}
                            disabled={actionInFlight.has(`complete:${draft.id}`) || draft.status !== 'NOTIFIED' || !!draft.isCancelled}
                          >
                            Complete
                          </button>
                          <button
                            onClick={() => handleCancel(draft)}
                            className={styles.sendBtn}
                            disabled={actionInFlight.has(`cancel:${draft.id}`) || !!draft.isCancelled}
                          >
                            Cancel
                          </button>
                        </>
                      )}
                    </React.Fragment>
                  ))}
                </div>
              </div>

              {/* Expanded candidate table */}
              {isOpen && (
                <div className={styles.tableContainer}>
                  <table className={styles.table}>
                    <thead>
                      <tr className={styles.trHeader}>
                        {['Emp ID','Name','Designation','HQ','State','Plan'].map(h=>(
                          <th key={h} className={styles.th}>{h}</th>
                        ))}
                      </tr>
                    </thead>
                    <tbody>
                      {drafts.flatMap((draft: NominationDraft) => {
                        const cEmps = allEmployees.filter((e: Employee)=>draft.candidates.includes(String(e.employeeId)));
                        return cEmps.map((emp: Employee, i: number)=>(
                          <tr key={`${draft.id}-${emp.employeeId}`} className={`${styles.trRow} ${i%2===0?styles.trRowEven:styles.trRowOdd}`}>
                            <td className={`${styles.td} ${styles.tdEmpId}`}>{emp.employeeId}</td>
                            <td className={`${styles.td} ${styles.tdName}`}>{emp.name}</td>
                            <td className={`${styles.td} ${styles.fz12} ${styles.textSecondary}`}>{emp.designation||'—'}</td>
                            <td className={`${styles.td} ${styles.fz12}`}>{emp.hq||'—'}</td>
                            <td className={`${styles.td} ${styles.fz12}`}>{emp.state||'—'}</td>
                            <td className={styles.td}>
                              <span className={styles.planTypeBadge}>{draft.trainingType}</span>
                            </td>
                          </tr>
                        ));
                      })}
                    </tbody>
                  </table>
                </div>
              )}
            </div>
          );
        })}
      </div>

      {emailModal && (
        <EmailModal
          html={emailModal.html}
          subject={emailModal.subject}
          mailto={emailModal.mailto}
          tableHtml={emailModal.tableHtml}
          onClose={()=>setEmailModal(null)}
          onSent={()=>handleSent(emailModal.draftId)}
        />
      )}
    </div>
  );
};




