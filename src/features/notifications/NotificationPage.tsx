import React, { useState, useMemo } from 'react';
import { Mail, Users, Lock, Check, Copy, ExternalLink, X, ChevronDown, ChevronRight } from 'lucide-react';
import { usePlanningFlow, NominationDraft } from '../../context/PlanningFlowContext';
import { useMasterData } from '../../context/MasterDataContext';
import { Employee } from '../../types/employee';

interface Props {
  employees: Employee[];
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
    <div style={{ position:'fixed',inset:0,zIndex:3000,display:'flex',alignItems:'center',justifyContent:'center',background:'rgba(0,0,0,.55)',backdropFilter:'blur(4px)' }}>
      <div style={{ background:'var(--bg-card)',borderRadius:'12px',width:'92vw',maxWidth:'1020px',maxHeight:'92vh',display:'flex',flexDirection:'column',boxShadow:'0 24px 80px rgba(0,0,0,.3)' }}>

        {/* Header */}
        <div style={{ padding:'14px 22px',borderBottom:'1px solid var(--border-color)',display:'flex',justifyContent:'space-between',alignItems:'center',background:'var(--bg)' }}>
          <div style={{ fontSize:'15px',fontWeight:700,display:'flex',alignItems:'center',gap:'8px' }}><Mail size={16} color="var(--accent-primary)"/>Email Preview</div>
          <button onClick={onClose} style={{ background:'none',border:'none',cursor:'pointer' }}><X size={19} color="var(--text-secondary)"/></button>
        </div>

        {/* Subject row */}
        <div style={{ padding:'10px 22px',borderBottom:'1px solid var(--border-color)',background:'rgba(99,102,241,.04)',display:'flex',alignItems:'center',gap:'10px' }}>
          <span style={{ fontSize:'11px',fontWeight:700,color:'var(--text-secondary)',textTransform:'uppercase',letterSpacing:'.05em',whiteSpace:'nowrap' }}>Subject:</span>
          <span style={{ fontSize:'13px',fontWeight:600,flex:1 }}>{subject}</span>
          <button onClick={()=>copy(subject,setCSubj)} style={{ display:'inline-flex',alignItems:'center',gap:'4px',padding:'3px 9px',borderRadius:'6px',background:'var(--bg)',border:'1px solid var(--border-color)',cursor:'pointer',fontSize:'11px',fontWeight:600,color:cSubj?'var(--success)':'var(--text-secondary)',whiteSpace:'nowrap' }}>
            {cSubj?<><Check size={10}/>Copied</>:<><Copy size={10}/>Copy</>}
          </button>
        </div>

        {/* Instruction banner */}
        <div style={{ padding:'8px 22px',background:'rgba(245,158,11,.07)',borderBottom:'1px solid rgba(245,158,11,.2)',fontSize:'12px',color:'#92400e',display:'flex',alignItems:'center',gap:'8px' }}>
          <span style={{ fontWeight:700 }}>💡 Workflow:</span>
          <span>1&nbsp;&nbsp;Click <strong>Open in Outlook</strong> to create a draft with subject &amp; summary.&nbsp;&nbsp;2&nbsp;&nbsp;Then click <strong>Copy Table</strong> and paste into the email body for the full candidate table.</span>
        </div>

        {/* iframe preview */}
        <div style={{ flex:1,overflow:'hidden' }}>
          <iframe srcDoc={html} title="Email Preview" style={{ width:'100%',height:'100%',border:'none',display:'block' }}/>
        </div>

        {/* Footer actions */}
        <div style={{ padding:'12px 22px',borderTop:'1px solid var(--border-color)',display:'flex',gap:'8px',justifyContent:'flex-end',flexWrap:'wrap',background:'var(--bg)' }}>
          <button onClick={onClose} className="btn btn-secondary">Cancel</button>

          {/* Copy full HTML */}
          <button onClick={()=>copy(html,setCHtml)} style={{ display:'inline-flex',alignItems:'center',gap:'6px',padding:'7px 14px',borderRadius:'8px',cursor:'pointer',background:cHtml?'rgba(34,197,94,.1)':'var(--bg)',border:`1px solid ${cHtml?'var(--success)':'var(--border-color)'}`,color:cHtml?'var(--success)':'var(--text-primary)',fontSize:'12px',fontWeight:600 }}>
            {cHtml?<><Check size={13}/>Copied!</>:<><Copy size={13}/>Copy Full HTML</>}
          </button>

          {/* Copy Table only */}
          <button
            onClick={()=>copy(tableHtml,setCTable)}
            title="Copies just the candidate table HTML — paste directly into Outlook body"
            style={{ display:'inline-flex',alignItems:'center',gap:'6px',padding:'7px 14px',borderRadius:'8px',cursor:'pointer',background:cTable?'rgba(99,102,241,.12)':'var(--bg)',border:`1px solid ${cTable?'var(--accent-primary)':'var(--border-color)'}`,color:cTable?'var(--accent-primary)':'var(--text-primary)',fontSize:'12px',fontWeight:700 }}
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
            style={{ display:'inline-flex',alignItems:'center',gap:'6px',padding:'7px 18px',borderRadius:'8px',cursor:'pointer',background:'var(--accent-primary)',border:'none',color:'white',fontSize:'12px',fontWeight:700 }}
          >
            <ExternalLink size={13}/>Open in Outlook
          </button>
        </div>
      </div>
    </div>
  );
};

// ─── Main Component ───────────────────────────────────────────────────────────

export const NotificationPage: React.FC<Props> = ({ employees }) => {
  const { getDrafts, updateDraft, selectionSession } = usePlanningFlow();
  const { teams: masterTeams, trainers: masterTrainers } = useMasterData();

  const sessionTeamIds = selectionSession?.teamIds ?? [];
  const [emailModal, setEmailModal] = useState<{ html:string; subject:string; mailto:string; tableHtml:string; draftId:string }|null>(null);
  const [expanded, setExpanded]     = useState<Set<string>>(new Set());

  const resolveTeam    = (id?:string, fb?:string) => masterTeams.find(t=>t.id===id)?.teamName||(fb||id||'—');
  const resolveTrainer = (id?:string) => masterTrainers.find(t=>t.id===id)?.trainerName||(id||'—');

  // Only APPROVED drafts
  const approvedDrafts = useMemo(
    () => getDrafts({ teamIds: sessionTeamIds.length>0?sessionTeamIds:undefined }).filter(d=>d.status==='APPROVED'),
    [getDrafts, sessionTeamIds]
  );

  // Group by team
  const teamGroups = useMemo(() => {
    const map = new Map<string, NominationDraft[]>();
    approvedDrafts.forEach(d => {
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
    const cEmps  = employees.filter(e => draft.candidates.includes(String(e.employeeId)));
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

    const dataRows = cEmps.map((e, i) => {
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

  const handleSent = (draftId: string) => {
    updateDraft(draftId, { status: 'SENT', sentBy: 'Trainer', sentAt: new Date().toISOString() });
    setEmailModal(null);
  };

  if (approvedDrafts.length === 0) {
    return (
      <div className="animate-fade-in" style={{ padding: '24px' }}>
        <h1 style={{ margin: '0 0 20px', fontSize: '26px', fontWeight: 700 }}>Notification</h1>
        <div style={{ padding: '48px', textAlign: 'center', color: 'var(--text-secondary)' }}>
          <Lock size={36} style={{ margin: '0 auto 12px', color: 'var(--border-color)' }}/>
          <div style={{ fontSize: '16px', fontWeight: 600, marginBottom: '6px' }}>No approved nominations yet</div>
          <div style={{ fontSize: '13px' }}>Sales Head must approve from the <strong>Nominations</strong> page first.</div>
        </div>
      </div>
    );
  }

  return (
    <div className="animate-fade-in" style={{ padding: '24px' }}>
      <div style={{ marginBottom: '20px' }}>
        <h1 style={{ margin: 0, fontSize: '26px', fontWeight: 700 }}>Notification</h1>
        <p style={{ margin: '5px 0 0', fontSize: '13px', color: 'var(--text-secondary)' }}>
          Send training communication to approved candidates, grouped by team.
        </p>
      </div>
      <div style={{ marginBottom:'16px',display:'flex',alignItems:'center',gap:'10px' }}>
        <span style={{ fontSize:'13px',color:'var(--text-secondary)' }}>
          <strong style={{ color:'var(--accent-primary)' }}>{approvedDrafts.length}</strong> approved nomination{approvedDrafts.length!==1?'s':''} ready to send — grouped by team
        </span>
      </div>

      <div style={{ display:'flex',flexDirection:'column',gap:'12px' }}>
        {teamGroups.map(([teamId, drafts]) => {
          const tName    = resolveTeam(teamId, drafts[0]?.team);
          const isOpen   = expanded.has(teamId);
          const allEmps  = employees.filter(e => drafts.some(d => d.candidates.includes(String(e.employeeId))));

          return (
            <div key={teamId} style={{ border:'1px solid var(--border-color)',borderRadius:'10px',overflow:'hidden' }}>

              {/* Group header */}
              <div
                onClick={()=>toggleGroup(teamId)}
                style={{ padding:'12px 18px',display:'flex',alignItems:'center',gap:'12px',background:'var(--bg)',cursor:'pointer',borderBottom:isOpen?'1px solid var(--border-color)':'none' }}
              >
                {isOpen?<ChevronDown size={16}/>:<ChevronRight size={16}/>}
                <span style={{ fontSize:'15px',fontWeight:700 }}>{tName}</span>
                <span style={{ padding:'2px 8px',borderRadius:'12px',background:'rgba(99,102,241,.1)',color:'var(--accent-primary)',fontSize:'12px',fontWeight:700 }}>
                  {drafts.length} plan{drafts.length!==1?'s':''}
                </span>
                <span style={{ fontSize:'12px',color:'var(--text-secondary)',display:'flex',alignItems:'center',gap:'4px' }}>
                  <Users size={12}/>{allEmps.length} candidates across all plans
                </span>
                <div style={{ marginLeft:'auto',display:'flex',gap:'8px' }} onClick={e=>e.stopPropagation()}>
                  {/* Send per team = send for all plans in this team */}
                  {drafts.map(draft=>(
                    <button key={draft.id} onClick={()=>handleEmail(draft)} style={{ display:'inline-flex',alignItems:'center',gap:'5px',padding:'6px 14px',borderRadius:'7px',background:'rgba(59,130,246,.1)',border:'1px solid rgba(59,130,246,.3)',cursor:'pointer',fontSize:'12px',fontWeight:700,color:'#2563eb' }}>
                      <Mail size={12}/>{draft.trainingType} — Send Email
                    </button>
                  ))}
                </div>
              </div>

              {/* Expanded candidate table */}
              {isOpen && (
                <div style={{ overflowX:'auto' }}>
                  <table style={{ width:'100%',borderCollapse:'collapse',fontSize:'13px' }}>
                    <thead>
                      <tr style={{ background:'rgba(0,0,0,.02)',borderBottom:'1px solid var(--border-color)' }}>
                        {['Emp ID','Name','Designation','HQ','State','Plan'].map(h=>(
                          <th key={h} style={{ padding:'8px 12px',textAlign:'left',fontSize:'11px',fontWeight:700,textTransform:'uppercase',letterSpacing:'.05em',color:'var(--text-secondary)',whiteSpace:'nowrap' }}>{h}</th>
                        ))}
                      </tr>
                    </thead>
                    <tbody>
                      {drafts.flatMap(draft => {
                        const cEmps = employees.filter(e=>draft.candidates.includes(String(e.employeeId)));
                        return cEmps.map((emp,i)=>(
                          <tr key={`${draft.id}-${emp.employeeId}`} style={{ borderBottom:'1px solid var(--border-color)',background:i%2===0?'transparent':'rgba(0,0,0,.01)' }}>
                            <td style={{ padding:'9px 12px',fontFamily:'monospace',fontSize:'12px',color:'var(--text-secondary)',fontWeight:600 }}>{emp.employeeId}</td>
                            <td style={{ padding:'9px 12px',fontWeight:500 }}>{emp.name}</td>
                            <td style={{ padding:'9px 12px',fontSize:'12px',color:'var(--text-secondary)' }}>{emp.designation||'—'}</td>
                            <td style={{ padding:'9px 12px',fontSize:'12px' }}>{emp.hq||'—'}</td>
                            <td style={{ padding:'9px 12px',fontSize:'12px' }}>{emp.state||'—'}</td>
                            <td style={{ padding:'9px 12px' }}>
                              <span style={{ padding:'2px 8px',borderRadius:'10px',background:'rgba(99,102,241,.1)',color:'var(--accent-primary)',fontSize:'11px',fontWeight:700 }}>{draft.trainingType}</span>
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
