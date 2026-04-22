import React, { useState } from 'react';
import {
  Mail, CheckCircle, Users, X, Edit2, Lock, Send,
  ChevronRight, Eye, Calendar, Layers, UserCheck, Clock,
  Copy, Check, ExternalLink
} from 'lucide-react';
import { usePlanningFlow, NominationDraft } from '../../context/PlanningFlowContext';
import { useMasterData } from '../../context/MasterDataContext';
import { Employee } from '../../types/employee';
import { Attendance, TrainingNomination } from '../../types/attendance';

interface NotifiedProps {
  employees: Employee[];
  attendance: Attendance[];
  nominations: TrainingNomination[];
  onUploadComplete?: () => void;
}

type DraftStatus = 'DRAFT' | 'FINALIZED' | 'SENT' | 'COMPLETED';

// ─── STATUS UI ──────────────────────────────────────────────────────────────

const STATUS_META: Record<DraftStatus, { label: string; color: string; bg: string }> = {
  DRAFT:     { label: 'Draft',     color: 'var(--warning)',        bg: 'rgba(245,158,11,0.12)' },
  FINALIZED: { label: 'Finalized', color: 'var(--accent-primary)', bg: 'rgba(99,102,241,0.12)' },
  SENT:      { label: 'Sent',      color: 'var(--success)',        bg: 'rgba(34,197,94,0.12)'  },
  COMPLETED: { label: 'Completed', color: 'var(--text-secondary)', bg: 'rgba(0,0,0,0.06)'      },
};

const StatusBadge: React.FC<{ status: DraftStatus }> = ({ status }) => {
  const m = STATUS_META[status] || STATUS_META.DRAFT;
  return (
    <span style={{
      display: 'inline-flex', alignItems: 'center', gap: '5px',
      padding: '3px 10px', borderRadius: '20px',
      background: m.bg, color: m.color,
      fontSize: '12px', fontWeight: 700, whiteSpace: 'nowrap'
    }}>
      {status === 'DRAFT'     && <Clock size={11} />}
      {status === 'FINALIZED' && <Lock size={11} />}
      {status === 'SENT'      && <Send size={11} />}
      {status === 'COMPLETED' && <CheckCircle size={11} />}
      {m.label}
    </span>
  );
};

// ─── DATE HELPERS ────────────────────────────────────────────────────────────

const addDays = (dateStr: string, n: number): string => {
  if (!dateStr) return '';
  const d = new Date(dateStr);
  d.setDate(d.getDate() + n);
  return d.toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' });
};

const formatDate = (dateStr?: string): string => {
  if (!dateStr) return '—';
  const d = new Date(dateStr);
  return d.toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' });
};

const getMonthYear = (dateStr?: string): string => {
  if (!dateStr) return '';
  const d = new Date(dateStr);
  return d.toLocaleDateString('en-IN', { month: 'long', year: 'numeric' });
};

// ─── HTML EMAIL BUILDER ──────────────────────────────────────────────────────

interface EmailData {
  trainingType: string;
  teamName: string;
  trainerName: string;
  startDate: string;
  endDate: string;
  candidates: Employee[];
}

function buildEmailSubject(data: EmailData): string {
  return `${data.trainingType} Training Notice: ${data.teamName} ${getMonthYear(data.startDate)}`;
}

function buildEmailHtml(data: EmailData): string {
  const checkInDate = addDays(data.startDate, -1);
  const returnDate  = formatDate(data.endDate);
  const fmtStart    = formatDate(data.startDate);
  const fmtEnd      = formatDate(data.endDate);

  const candidateRows = data.candidates.map((emp, idx) => `
    <tr style="background:${idx % 2 === 0 ? '#ffffff' : '#f9f9fb'}">
      <td style="padding:8px 10px;border:1px solid #e5e7eb;text-align:center;font-weight:600">${idx + 1}</td>
      <td style="padding:8px 10px;border:1px solid #e5e7eb;font-weight:600">${emp.employeeId}</td>
      <td style="padding:8px 10px;border:1px solid #e5e7eb">${emp.team || '—'}</td>
      <td style="padding:8px 10px;border:1px solid #e5e7eb;font-weight:500">${emp.name}</td>
      <td style="padding:8px 10px;border:1px solid #e5e7eb">${emp.designation || '—'}</td>
      <td style="padding:8px 10px;border:1px solid #e5e7eb">${emp.hq || '—'}</td>
      <td style="padding:8px 10px;border:1px solid #e5e7eb">${emp.state || '—'}</td>
      <td style="padding:8px 10px;border:1px solid #e5e7eb">${emp.email || '—'}</td>
      <td style="padding:8px 10px;border:1px solid #e5e7eb">${emp.mobileNumber || '—'}</td>
    </tr>`).join('');

  return `<!DOCTYPE html>
<html>
<head><meta charset="UTF-8" /><title>${buildEmailSubject(data)}</title></head>
<body style="font-family:Calibri,Arial,sans-serif;font-size:14px;color:#1f2937;background:#f3f4f6;margin:0;padding:24px">
<div style="max-width:900px;margin:0 auto;background:#ffffff;border-radius:8px;overflow:hidden;box-shadow:0 2px 12px rgba(0,0,0,0.08)">

  <!-- HEADER -->
  <div style="background:linear-gradient(135deg,#1e40af,#3b82f6);padding:28px 32px">
    <div style="font-size:22px;font-weight:700;color:#ffffff;margin-bottom:4px">
      ${data.trainingType} Training — Nomination Notice
    </div>
    <div style="font-size:14px;color:rgba(255,255,255,0.82)">${data.teamName} | ${getMonthYear(data.startDate)}</div>
  </div>

  <!-- BODY -->
  <div style="padding:28px 32px">

    <p style="margin:0 0 20px 0">Dear Sir / Ma'am,</p>
    <p style="margin:0 0 24px 0">
      Please refer to the below details &amp; shortlisted candidates for the upcoming
      <strong>${data.trainingType} Training</strong>.
    </p>

    <!-- TRAINING DETAILS TABLE -->
    <table style="width:100%;border-collapse:collapse;margin-bottom:20px;font-size:14px">
      <thead>
        <tr style="background:#1e40af">
          <th colspan="2" style="padding:10px 14px;color:#ffffff;text-align:left;font-size:13px;text-transform:uppercase;letter-spacing:0.05em">
            Training Details
          </th>
        </tr>
      </thead>
      <tbody>
        <tr style="background:#f9fafb">
          <td style="padding:9px 14px;border:1px solid #e5e7eb;font-weight:600;width:35%">Training Type</td>
          <td style="padding:9px 14px;border:1px solid #e5e7eb">${data.trainingType}</td>
        </tr>
        <tr>
          <td style="padding:9px 14px;border:1px solid #e5e7eb;font-weight:600">Team</td>
          <td style="padding:9px 14px;border:1px solid #e5e7eb">${data.teamName}</td>
        </tr>
        <tr style="background:#f9fafb">
          <td style="padding:9px 14px;border:1px solid #e5e7eb;font-weight:600">Trainer</td>
          <td style="padding:9px 14px;border:1px solid #e5e7eb">${data.trainerName}</td>
        </tr>
        <tr>
          <td style="padding:9px 14px;border:1px solid #e5e7eb;font-weight:600">Training Date</td>
          <td style="padding:9px 14px;border:1px solid #e5e7eb">${fmtStart}${fmtStart !== fmtEnd ? ` to ${fmtEnd}` : ''}</td>
        </tr>
        <tr style="background:#f9fafb">
          <td style="padding:9px 14px;border:1px solid #e5e7eb;font-weight:600">Check-In Date</td>
          <td style="padding:9px 14px;border:1px solid #e5e7eb">${checkInDate}</td>
        </tr>
        <tr>
          <td style="padding:9px 14px;border:1px solid #e5e7eb;font-weight:600">Return Date</td>
          <td style="padding:9px 14px;border:1px solid #e5e7eb">${returnDate}</td>
        </tr>
        <tr style="background:#f9fafb">
          <td style="padding:9px 14px;border:1px solid #e5e7eb;font-weight:600">No. of Candidates</td>
          <td style="padding:9px 14px;border:1px solid #e5e7eb;font-weight:700;color:#1e40af">${data.candidates.length}</td>
        </tr>
      </tbody>
    </table>

    <!-- HIGHLIGHT NOTE -->
    <div style="background:#fef9c3;border-left:4px solid #f59e0b;padding:12px 16px;border-radius:4px;margin-bottom:24px;font-size:13px;color:#78350f">
      <strong>📌 Note:</strong> Kindly ensure all nominated candidates are informed and confirm their attendance by
      <strong>${checkInDate}</strong>. Any changes after finalization must be escalated to L&amp;D Team immediately.
    </div>

    <!-- CANDIDATE TABLE -->
    <p style="font-weight:700;font-size:15px;margin:0 0 10px 0;color:#1e40af">Shortlisted Candidates (${data.candidates.length})</p>
    <div style="overflow-x:auto">
      <table style="width:100%;border-collapse:collapse;font-size:13px;min-width:700px">
        <thead>
          <tr style="background:#1e40af;color:#ffffff">
            <th style="padding:9px 10px;border:1px solid #2563eb;text-align:center;white-space:nowrap">Sr No</th>
            <th style="padding:9px 10px;border:1px solid #2563eb;text-align:left;white-space:nowrap">Emp No</th>
            <th style="padding:9px 10px;border:1px solid #2563eb;text-align:left;white-space:nowrap">Team</th>
            <th style="padding:9px 10px;border:1px solid #2563eb;text-align:left;white-space:nowrap">Name</th>
            <th style="padding:9px 10px;border:1px solid #2563eb;text-align:left;white-space:nowrap">Designation</th>
            <th style="padding:9px 10px;border:1px solid #2563eb;text-align:left;white-space:nowrap">HQ</th>
            <th style="padding:9px 10px;border:1px solid #2563eb;text-align:left;white-space:nowrap">State</th>
            <th style="padding:9px 10px;border:1px solid #2563eb;text-align:left;white-space:nowrap">Email</th>
            <th style="padding:9px 10px;border:1px solid #2563eb;text-align:left;white-space:nowrap">Mobile</th>
          </tr>
        </thead>
        <tbody>
          ${candidateRows || '<tr><td colspan="9" style="padding:16px;text-align:center;color:#9ca3af">No candidates selected.</td></tr>'}
        </tbody>
      </table>
    </div>

    <!-- FOOTER -->
    <div style="margin-top:32px;padding-top:20px;border-top:1px solid #e5e7eb;font-size:13px;color:#6b7280">
      <p style="margin:0 0 4px 0">Warm regards,</p>
      <p style="margin:0;font-weight:700;color:#1f2937">L&amp;D Team — APL</p>
    </div>

  </div>
</div>
</body>
</html>`;
}

// ─── EMAIL PREVIEW MODAL ─────────────────────────────────────────────────────

interface EmailPreviewModalProps {
  html: string;
  subject: string;
  mailto: string;
  onClose: () => void;
  onConfirmSent: () => void;
}

const EmailPreviewModal: React.FC<EmailPreviewModalProps> = ({ html, subject, mailto, onClose, onConfirmSent }) => {
  const [copied, setCopied] = useState(false);
  const [subjectCopied, setSubjectCopied] = useState(false);

  const copyHtml = async () => {
    try {
      await navigator.clipboard.writeText(html);
      setCopied(true);
      setTimeout(() => setCopied(false), 2500);
    } catch {
      // Fallback
      const ta = document.createElement('textarea');
      ta.value = html;
      document.body.appendChild(ta);
      ta.select();
      document.execCommand('copy');
      document.body.removeChild(ta);
      setCopied(true);
      setTimeout(() => setCopied(false), 2500);
    }
  };

  const copySubject = async () => {
    try {
      await navigator.clipboard.writeText(subject);
      setSubjectCopied(true);
      setTimeout(() => setSubjectCopied(false), 2000);
    } catch { /* noop */ }
  };

  const openOutlook = () => {
    window.location.href = mailto;
    setTimeout(() => { onConfirmSent(); onClose(); }, 800);
  };

  return (
    <div style={{
      position: 'fixed', inset: 0, zIndex: 2000,
      display: 'flex', alignItems: 'center', justifyContent: 'center',
      background: 'rgba(0,0,0,0.6)', backdropFilter: 'blur(4px)'
    }}>
      <div style={{
        background: 'var(--bg-card)', borderRadius: '12px',
        width: '90vw', maxWidth: '1020px', maxHeight: '92vh',
        display: 'flex', flexDirection: 'column',
        boxShadow: '0 24px 80px rgba(0,0,0,0.3)'
      }}>

        {/* Modal Header */}
        <div style={{
          padding: '18px 24px', borderBottom: '1px solid var(--border-color)',
          display: 'flex', justifyContent: 'space-between', alignItems: 'center',
          background: 'var(--bg)', borderRadius: '12px 12px 0 0'
        }}>
          <div>
            <div style={{ fontSize: '17px', fontWeight: 700, display: 'flex', alignItems: 'center', gap: '8px' }}>
              <Mail size={18} color="var(--accent-primary)" /> Email Preview
            </div>
            <div style={{ fontSize: '12px', color: 'var(--text-secondary)', marginTop: '3px' }}>
              Review before sending. HTML is ready to paste into Outlook.
            </div>
          </div>
          <button onClick={onClose} style={{ background: 'none', border: 'none', cursor: 'pointer', padding: '4px' }}>
            <X size={22} color="var(--text-secondary)" />
          </button>
        </div>

        {/* Subject line */}
        <div style={{
          padding: '12px 24px', borderBottom: '1px solid var(--border-color)',
          background: 'rgba(99,102,241,0.04)',
          display: 'flex', alignItems: 'center', gap: '10px'
        }}>
          <span style={{ fontSize: '12px', fontWeight: 700, color: 'var(--text-secondary)', textTransform: 'uppercase', letterSpacing: '0.05em', whiteSpace: 'nowrap' }}>
            Subject:
          </span>
          <span style={{ fontSize: '14px', fontWeight: 600, flex: 1, color: 'var(--text-primary)' }}>{subject}</span>
          <button
            onClick={copySubject}
            style={{
              display: 'inline-flex', alignItems: 'center', gap: '5px',
              padding: '4px 10px', borderRadius: '6px',
              background: 'var(--bg)', border: '1px solid var(--border-color)',
              cursor: 'pointer', fontSize: '12px', fontWeight: 600,
              color: subjectCopied ? 'var(--success)' : 'var(--text-secondary)', whiteSpace: 'nowrap'
            }}
          >
            {subjectCopied ? <><Check size={12} /> Copied</> : <><Copy size={12} /> Copy Subject</>}
          </button>
        </div>

        {/* iframe preview */}
        <div style={{ flex: 1, overflow: 'hidden', position: 'relative' }}>
          <iframe
            srcDoc={html}
            title="Email Preview"
            style={{ width: '100%', height: '100%', border: 'none', display: 'block' }}
            sandbox="allow-same-origin"
          />
        </div>

        {/* Actions Footer */}
        <div style={{
          padding: '16px 24px', borderTop: '1px solid var(--border-color)',
          display: 'flex', gap: '10px', justifyContent: 'flex-end',
          background: 'var(--bg)', borderRadius: '0 0 12px 12px'
        }}>
          <button
            onClick={onClose}
            className="btn btn-secondary"
            style={{ minWidth: '90px' }}
          >
            Cancel
          </button>

          <button
            onClick={copyHtml}
            style={{
              display: 'inline-flex', alignItems: 'center', gap: '6px',
              padding: '8px 16px', borderRadius: '8px', cursor: 'pointer',
              background: copied ? 'rgba(34,197,94,0.1)' : 'var(--bg)',
              border: `1px solid ${copied ? 'var(--success)' : 'var(--border-color)'}`,
              color: copied ? 'var(--success)' : 'var(--text-primary)',
              fontSize: '13px', fontWeight: 600, transition: 'all 0.2s'
            }}
          >
            {copied ? <><Check size={14} /> Copied!</> : <><Copy size={14} /> Copy HTML</>}
          </button>

          <button
            onClick={openOutlook}
            style={{
              display: 'inline-flex', alignItems: 'center', gap: '6px',
              padding: '8px 20px', borderRadius: '8px', cursor: 'pointer',
              background: 'var(--accent-primary)', border: 'none',
              color: 'white', fontSize: '13px', fontWeight: 700,
              boxShadow: '0 2px 8px rgba(99,102,241,0.35)'
            }}
          >
            <ExternalLink size={14} /> Open in Outlook
          </button>
        </div>
      </div>
    </div>
  );
};

// ─── MAIN COMPONENT ──────────────────────────────────────────────────────────

export const Notified: React.FC<NotifiedProps> = ({ employees }) => {
  const { teams: masterTeams, trainers: masterTrainers } = useMasterData();
  const { getDrafts, updateDraft, selectionSession: activePlanningSession, resetConsumed } = usePlanningFlow();

  const hasPlanningContext = Boolean(
    activePlanningSession &&
    Array.isArray(activePlanningSession.teams) &&
    activePlanningSession.teams.length > 0
  );

  // Drawer state
  const [candidateDrawerDraftId, setCandidateDrawerDraftId] = useState<string | null>(null);
  const [editDrawerDraftId, setEditDrawerDraftId]           = useState<string | null>(null);
  const [emailPreview, setEmailPreview]                     = useState<{ html: string; subject: string; mailto: string; draftId: string } | null>(null);

  const allDrafts = getDrafts({});

  // ── Resolvers ──
  const resolveTrainerName = (trainerId?: string) => {
    if (!trainerId) return '—';
    const t = masterTrainers.find(mt => mt.id === trainerId);
    return t ? t.trainerName : trainerId;
  };

  const resolveTeamName = (teamId?: string, fallback?: string) => {
    if (!teamId) return fallback || '—';
    const t = masterTeams.find(mt => mt.id === teamId);
    return t ? t.teamName : (fallback || teamId);
  };

  // ── Email generation ──
  const handleEmailPreview = (draft: NominationDraft) => {
    if (draft.candidates.length === 0) {
      alert('Cannot send email: no candidates in this nomination.');
      return;
    }

    const tName  = resolveTeamName(draft.teamId, draft.team);
    const trName = resolveTrainerName(draft.trainer);
    const candidateEmps = employees.filter(e => draft.candidates.includes(String(e.employeeId)));

    const emailData: EmailData = {
      trainingType: draft.trainingType,
      teamName: tName,
      trainerName: trName,
      startDate: draft.startDate || '',
      endDate: draft.endDate || draft.startDate || '',
      candidates: candidateEmps,
    };

    const subject = buildEmailSubject(emailData);
    const html    = buildEmailHtml(emailData);

    // Mailto fallback (plain text — Outlook will use the HTML copy)
    const plainBody = encodeURIComponent(
      `Dear Team,\n\nPlease find the nomination list for ${draft.trainingType} training — ${tName} (${getMonthYear(draft.startDate)}).\n\n` +
      `Training : ${draft.trainingType}\nTeam : ${tName}\nTrainer : ${trName}\n` +
      `Dates : ${formatDate(draft.startDate)} to ${formatDate(draft.endDate)}\nCandidates : ${candidateEmps.length}\n\n` +
      candidateEmps.map((e, i) => `${i + 1}. ${e.name} (${e.employeeId})`).join('\n') +
      '\n\nRegards,\nL&D Team'
    );
    const mailto = `mailto:?subject=${encodeURIComponent(subject)}&body=${plainBody}`;

    setEmailPreview({ html, subject, mailto, draftId: draft.id });
  };

  const handleConfirmSent = (draftId: string) => {
    updateDraft(draftId, { status: 'SENT' });
    setEmailPreview(null);
  };

  // ─── CANDIDATE VIEW DRAWER ──────────────────────────────────────────────

  const CandidateViewDrawer: React.FC<{ draftId: string }> = ({ draftId }) => {
    const draft = allDrafts.find(d => d.id === draftId);
    if (!draft) return null;
    const candidateEmps = employees.filter(e => draft.candidates.includes(String(e.employeeId)));

    return (
      <div style={{ position: 'fixed', top: 0, right: 0, bottom: 0, width: '420px', background: 'var(--bg-card)', boxShadow: '-4px 0 32px rgba(0,0,0,0.15)', zIndex: 1100, display: 'flex', flexDirection: 'column' }}>
        <div style={{ padding: '20px 24px', borderBottom: '1px solid var(--border-color)', display: 'flex', justifyContent: 'space-between', alignItems: 'center', background: 'var(--bg)' }}>
          <div>
            <div style={{ fontSize: '16px', fontWeight: 700 }}>Candidate List</div>
            <div style={{ fontSize: '12px', color: 'var(--text-secondary)', marginTop: '2px' }}>
              {draft.trainingType} • {resolveTeamName(draft.teamId, draft.team)} •{' '}
              <strong style={{ color: 'var(--accent-primary)' }}>{candidateEmps.length}</strong> candidates
            </div>
          </div>
          <button onClick={() => setCandidateDrawerDraftId(null)} style={{ background: 'none', border: 'none', cursor: 'pointer' }}>
            <X size={20} color="var(--text-secondary)" />
          </button>
        </div>

        <div style={{ flex: 1, overflowY: 'auto', padding: '16px' }}>
          {candidateEmps.length === 0 ? (
            <div style={{ textAlign: 'center', padding: '48px 0', color: 'var(--text-secondary)' }}>No candidates in this draft.</div>
          ) : (
            <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
              {candidateEmps.map((emp, idx) => (
                <div key={emp.employeeId} style={{
                  display: 'flex', alignItems: 'center', gap: '12px',
                  padding: '10px 14px', borderRadius: '8px',
                  background: 'var(--bg)', border: '1px solid var(--border-color)'
                }}>
                  <div style={{
                    width: '28px', height: '28px', borderRadius: '50%',
                    background: 'var(--accent-primary)', color: 'white',
                    display: 'flex', alignItems: 'center', justifyContent: 'center',
                    fontSize: '12px', fontWeight: 700, flexShrink: 0
                  }}>{idx + 1}</div>
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div style={{ fontSize: '14px', fontWeight: 600, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{emp.name}</div>
                    <div style={{ fontSize: '11px', color: 'var(--text-secondary)' }}>{emp.designation} • {emp.employeeId}</div>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    );
  };

  // ─── CANDIDATE EDIT DRAWER ──────────────────────────────────────────────

  const CandidateEditDrawer: React.FC<{ draftId: string }> = ({ draftId }) => {
    const draft = allDrafts.find(d => d.id === draftId);
    if (!draft) return null;
    const teamEmps = employees.filter(e => e.teamId === draft.teamId);
    const isLocked = draft.status === 'FINALIZED' || draft.status === 'SENT' || draft.status === 'COMPLETED';

    const toggleEmp = (empId: string) => {
      if (isLocked) return;
      let next = [...draft.candidates];
      if (next.includes(empId)) {
        next = next.filter(id => id !== empId);
      } else {
        if (next.length >= 40) { alert('Max 40 trainees per plan.'); return; }
        next.push(empId);
      }
      updateDraft(draft.id, { candidates: next });
    };

    return (
      <div style={{ position: 'fixed', top: 0, right: 0, bottom: 0, width: '460px', background: 'var(--bg-card)', boxShadow: '-4px 0 32px rgba(0,0,0,0.15)', zIndex: 1100, display: 'flex', flexDirection: 'column' }}>
        <div style={{ padding: '20px 24px', borderBottom: '1px solid var(--border-color)', background: 'var(--bg)', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <div>
            <div style={{ fontSize: '16px', fontWeight: 700 }}>Edit Candidates</div>
            <div style={{ fontSize: '12px', color: 'var(--text-secondary)', marginTop: '2px' }}>
              <strong style={{ color: draft.candidates.length >= 40 ? 'var(--danger)' : 'var(--accent-primary)' }}>
                {draft.candidates.length}/40
              </strong> selected
              {isLocked && <span style={{ marginLeft: '8px', color: 'var(--warning)' }}> • Locked</span>}
            </div>
          </div>
          <button onClick={() => setEditDrawerDraftId(null)} style={{ background: 'none', border: 'none', cursor: 'pointer' }}>
            <X size={20} color="var(--text-secondary)" />
          </button>
        </div>
        <div style={{ flex: 1, overflowY: 'auto', padding: '16px' }}>
          {teamEmps.length === 0 ? (
            <div style={{ textAlign: 'center', padding: '48px 0', color: 'var(--text-secondary)' }}>No employees found for this team.</div>
          ) : (
            <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
              {teamEmps.map(emp => {
                const isSelected = draft.candidates.includes(String(emp.employeeId));
                return (
                  <div
                    key={emp.employeeId}
                    onClick={() => toggleEmp(String(emp.employeeId))}
                    style={{
                      display: 'flex', alignItems: 'center', gap: '12px',
                      padding: '10px 14px', borderRadius: '8px',
                      background: isSelected ? 'rgba(99,102,241,0.08)' : 'var(--bg)',
                      border: `1px solid ${isSelected ? 'var(--accent-primary)' : 'var(--border-color)'}`,
                      cursor: isLocked ? 'not-allowed' : 'pointer', transition: 'all 0.15s',
                      opacity: isLocked ? 0.75 : 1
                    }}
                  >
                    <input type="checkbox" checked={isSelected} readOnly style={{ pointerEvents: 'none', accentColor: 'var(--accent-primary)' }} />
                    <div style={{ flex: 1 }}>
                      <div style={{ fontSize: '14px', fontWeight: 600 }}>{emp.name}</div>
                      <div style={{ fontSize: '11px', color: 'var(--text-secondary)' }}>{emp.designation} • {emp.employeeId}</div>
                    </div>
                    {isSelected && <UserCheck size={15} color="var(--accent-primary)" />}
                  </div>
                );
              })}
            </div>
          )}
        </div>
        <div style={{ padding: '16px 24px', borderTop: '1px solid var(--border-color)', display: 'flex', gap: '10px' }}>
          <button className="btn btn-secondary" style={{ flex: 1 }} onClick={() => setEditDrawerDraftId(null)}>Done</button>
          {!isLocked && (
            <button
              className="btn btn-primary"
              style={{ flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '6px' }}
              onClick={() => { updateDraft(draft.id, { status: 'FINALIZED' }); setEditDrawerDraftId(null); }}
            >
              <Lock size={14} /> Finalize & Lock
            </button>
          )}
        </div>
      </div>
    );
  };

  // ─── RENDER ─────────────────────────────────────────────────────────────

  return (
    <div className="animate-fade-in" style={{ padding: '24px' }}>

      {/* PAGE HEADER */}
      <div style={{ marginBottom: '24px', display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', flexWrap: 'wrap', gap: '16px' }}>
        <div>
          <h1 style={{ margin: 0, fontSize: '28px', fontWeight: 700 }}>Nominations</h1>
          <p style={{ color: 'var(--text-secondary)', margin: '6px 0 0 0', fontSize: '13px' }}>
            Manage training nominations — review candidates, finalize lists, and send invitations.
          </p>
        </div>
        {/* KPI strip */}
        <div style={{ display: 'flex', gap: '12px', flexWrap: 'wrap' }}>
          {([
            { label: 'Total',     value: allDrafts.length,                                             color: 'var(--accent-primary)', Icon: Layers },
            { label: 'Draft',     value: allDrafts.filter(d => d.status === 'DRAFT').length,     color: 'var(--warning)',        Icon: Clock  },
            { label: 'Finalized', value: allDrafts.filter(d => d.status === 'FINALIZED').length, color: 'var(--accent-secondary)', Icon: Lock  },
            { label: 'Sent',      value: allDrafts.filter(d => d.status === 'SENT').length,      color: 'var(--success)',        Icon: Send   },
          ] as const).map(k => (
            <div key={k.label} style={{
              background: 'var(--bg-card)', border: '1px solid var(--border-color)',
              borderRadius: '12px', padding: '10px 18px', minWidth: '80px', textAlign: 'center'
            }}>
              <div style={{ fontSize: '22px', fontWeight: 700, color: k.color }}>{k.value}</div>
              <div style={{ fontSize: '11px', color: 'var(--text-secondary)', fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.05em' }}>{k.label}</div>
            </div>
          ))}
        </div>
      </div>

      {/* ACTIVE PLANNING SESSION BANNER */}
      {hasPlanningContext && (
        <div style={{
          background: 'rgba(34,197,94,0.08)', border: '1px solid var(--success)',
          color: 'var(--success)', padding: '10px 16px', borderRadius: '8px',
          marginBottom: '20px', display: 'flex', justifyContent: 'space-between', alignItems: 'center'
        }}>
          <div style={{ fontSize: '13px', fontWeight: 600, display: 'flex', alignItems: 'center', gap: '8px' }}>
            <CheckCircle size={15} />
            Active Session — Planning for: <strong>{activePlanningSession!.teams.join(', ')}</strong>
            <span style={{ fontWeight: 400, opacity: 0.75 }}>({activePlanningSession!.trainingType})</span>
          </div>
          <button
            onClick={() => { if (window.confirm('Reset planning session?')) resetConsumed(); }}
            style={{ fontSize: '12px', padding: '4px 12px', background: 'white', color: 'var(--success)', border: '1px solid var(--success)', borderRadius: '6px', cursor: 'pointer' }}
          >
            Reset Session
          </button>
        </div>
      )}

      {/* STATUS FLOW LEGEND */}
      <div style={{ marginBottom: '20px', display: 'flex', gap: '8px', alignItems: 'center', flexWrap: 'wrap' }}>
        <span style={{ fontSize: '12px', color: 'var(--text-secondary)', fontWeight: 600, marginRight: '4px' }}>Workflow:</span>
        {(['DRAFT', 'FINALIZED', 'SENT', 'COMPLETED'] as DraftStatus[]).map((s, i, arr) => (
          <React.Fragment key={s}>
            <StatusBadge status={s} />
            {i < arr.length - 1 && <ChevronRight size={14} color="var(--text-secondary)" />}
          </React.Fragment>
        ))}
      </div>

      {/* MAIN TABLE */}
      <div className="glass-panel" style={{ overflow: 'hidden' }}>
        {allDrafts.length === 0 ? (
          <div style={{ padding: '72px', textAlign: 'center' }}>
            <Calendar size={48} style={{ margin: '0 auto 16px', color: 'var(--border-color)' }} />
            <div style={{ fontSize: '18px', fontWeight: 600, marginBottom: '8px' }}>No training plans yet</div>
            <p style={{ color: 'var(--text-secondary)', fontSize: '14px', maxWidth: '300px', margin: '0 auto' }}>
              Select teams from <strong>Training Requirement</strong>, then create plans in the <strong>Calendar</strong>.
            </p>
          </div>
        ) : (
          <table style={{ width: '100%', borderCollapse: 'collapse' }}>
            <thead>
              <tr style={{ background: 'var(--bg)', borderBottom: '1px solid var(--border-color)' }}>
                {['Date', 'Training', 'Team', 'Trainer', 'Candidates', 'Status', 'Actions'].map(h => (
                  <th key={h} style={{
                    padding: '12px 16px', textAlign: 'left',
                    fontSize: '11px', fontWeight: 700,
                    textTransform: 'uppercase', letterSpacing: '0.06em',
                    color: 'var(--text-secondary)', whiteSpace: 'nowrap'
                  }}>{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {allDrafts.map((draft, idx) => {
                const status = (draft.status || 'DRAFT') as DraftStatus;
                const isLocked = status === 'FINALIZED' || status === 'SENT' || status === 'COMPLETED';
                const tName  = resolveTeamName(draft.teamId, draft.team);
                const trName = resolveTrainerName(draft.trainer);
                const dateDisplay = draft.startDate
                  ? (draft.endDate && draft.endDate !== draft.startDate
                      ? `${formatDate(draft.startDate)} → ${formatDate(draft.endDate)}`
                      : formatDate(draft.startDate))
                  : '—';
                const canEmail = draft.candidates.length > 0 && !!draft.startDate;

                return (
                  <tr
                    key={draft.id}
                    style={{
                      borderBottom: '1px solid var(--border-color)',
                      background: idx % 2 === 0 ? 'transparent' : 'rgba(0,0,0,0.015)',
                      transition: 'background 0.1s'
                    }}
                    onMouseEnter={e => (e.currentTarget.style.background = 'rgba(99,102,241,0.04)')}
                    onMouseLeave={e => (e.currentTarget.style.background = idx % 2 === 0 ? 'transparent' : 'rgba(0,0,0,0.015)')}
                  >
                    {/* Date */}
                    <td style={{ padding: '14px 16px', whiteSpace: 'nowrap' }}>
                      <div style={{ fontSize: '13px', fontWeight: 600 }}>{dateDisplay}</div>
                    </td>

                    {/* Training Type */}
                    <td style={{ padding: '14px 16px' }}>
                      <span style={{
                        display: 'inline-block', padding: '3px 10px', borderRadius: '20px',
                        background: 'rgba(99,102,241,0.12)', color: 'var(--accent-primary)',
                        fontSize: '12px', fontWeight: 700
                      }}>{draft.trainingType}</span>
                    </td>

                    {/* Team */}
                    <td style={{ padding: '14px 16px', fontSize: '14px', fontWeight: 500 }}>{tName}</td>

                    {/* Trainer */}
                    <td style={{ padding: '14px 16px', fontSize: '14px', color: 'var(--text-secondary)' }}>{trName}</td>

                    {/* Candidates */}
                    <td style={{ padding: '14px 16px' }}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                        <span style={{
                          display: 'inline-flex', alignItems: 'center', gap: '4px',
                          fontSize: '13px', fontWeight: 700,
                          color: draft.candidates.length >= 40 ? 'var(--danger)' : 'var(--text-primary)'
                        }}>
                          <Users size={13} />
                          {draft.candidates.length}
                          <span style={{ fontWeight: 400, color: 'var(--text-secondary)', fontSize: '12px' }}>/40</span>
                        </span>
                        <button
                          onClick={() => setCandidateDrawerDraftId(draft.id)}
                          style={{
                            display: 'inline-flex', alignItems: 'center', gap: '4px',
                            padding: '3px 8px', borderRadius: '6px',
                            background: 'var(--bg)', border: '1px solid var(--border-color)',
                            cursor: 'pointer', fontSize: '11px', fontWeight: 600,
                            color: 'var(--text-secondary)'
                          }}
                        >
                          <Eye size={11} /> View
                        </button>
                      </div>
                    </td>

                    {/* Status */}
                    <td style={{ padding: '14px 16px' }}><StatusBadge status={status} /></td>

                    {/* Actions */}
                    <td style={{ padding: '14px 16px' }}>
                      <div style={{ display: 'flex', gap: '6px', alignItems: 'center', flexWrap: 'wrap' }}>

                        {/* Edit */}
                        {!isLocked && (
                          <button
                            onClick={() => setEditDrawerDraftId(draft.id)}
                            title="Edit candidates"
                            style={{
                              display: 'inline-flex', alignItems: 'center', gap: '5px',
                              padding: '5px 10px', borderRadius: '6px',
                              background: 'rgba(99,102,241,0.08)', border: '1px solid rgba(99,102,241,0.25)',
                              cursor: 'pointer', fontSize: '12px', fontWeight: 600,
                              color: 'var(--accent-primary)'
                            }}
                          >
                            <Edit2 size={12} /> Edit
                          </button>
                        )}

                        {/* Finalize */}
                        {status === 'DRAFT' && (
                          <button
                            onClick={() => {
                              if (window.confirm(`Finalize and lock this ${draft.trainingType} plan for ${tName}?`)) {
                                updateDraft(draft.id, { status: 'FINALIZED' });
                              }
                            }}
                            style={{
                              display: 'inline-flex', alignItems: 'center', gap: '5px',
                              padding: '5px 10px', borderRadius: '6px',
                              background: 'rgba(245,158,11,0.08)', border: '1px solid rgba(245,158,11,0.3)',
                              cursor: 'pointer', fontSize: '12px', fontWeight: 600, color: 'var(--warning)'
                            }}
                          >
                            <Lock size={12} /> Finalize
                          </button>
                        )}

                        {/* Send Email */}
                        {(status === 'FINALIZED' || status === 'DRAFT') && (
                          <button
                            onClick={() => handleEmailPreview(draft)}
                            disabled={!canEmail}
                            title={canEmail ? 'Preview & send email' : 'Add candidates and dates first'}
                            style={{
                              display: 'inline-flex', alignItems: 'center', gap: '5px',
                              padding: '5px 10px', borderRadius: '6px',
                              background: canEmail ? 'rgba(34,197,94,0.08)' : 'rgba(0,0,0,0.03)',
                              border: `1px solid ${canEmail ? 'rgba(34,197,94,0.3)' : 'var(--border-color)'}`,
                              cursor: canEmail ? 'pointer' : 'not-allowed',
                              fontSize: '12px', fontWeight: 600,
                              color: canEmail ? 'var(--success)' : 'var(--text-secondary)',
                              opacity: canEmail ? 1 : 0.6
                            }}
                          >
                            <Mail size={12} /> Send Email
                          </button>
                        )}

                        {/* Mark Completed */}
                        {status === 'SENT' && (
                          <button
                            onClick={() => updateDraft(draft.id, { status: 'COMPLETED' })}
                            style={{
                              display: 'inline-flex', alignItems: 'center', gap: '5px',
                              padding: '5px 10px', borderRadius: '6px',
                              background: 'rgba(0,0,0,0.05)', border: '1px solid var(--border-color)',
                              cursor: 'pointer', fontSize: '12px', fontWeight: 600, color: 'var(--text-secondary)'
                            }}
                          >
                            <CheckCircle size={12} /> Complete
                          </button>
                        )}
                      </div>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        )}
      </div>

      {/* CANDIDATE VIEW DRAWER */}
      {candidateDrawerDraftId && (
        <>
          <div onClick={() => setCandidateDrawerDraftId(null)} style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.35)', zIndex: 1050 }} />
          <CandidateViewDrawer draftId={candidateDrawerDraftId} />
        </>
      )}

      {/* CANDIDATE EDIT DRAWER */}
      {editDrawerDraftId && (
        <>
          <div onClick={() => setEditDrawerDraftId(null)} style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.35)', zIndex: 1050 }} />
          <CandidateEditDrawer draftId={editDrawerDraftId} />
        </>
      )}

      {/* EMAIL PREVIEW MODAL */}
      {emailPreview && (
        <EmailPreviewModal
          html={emailPreview.html}
          subject={emailPreview.subject}
          mailto={emailPreview.mailto}
          onClose={() => setEmailPreview(null)}
          onConfirmSent={() => handleConfirmSent(emailPreview.draftId)}
        />
      )}
    </div>
  );
};
