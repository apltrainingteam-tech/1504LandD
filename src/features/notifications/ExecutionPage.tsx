import React, { useMemo } from 'react';
import { CheckCircle, AlertCircle, TrendingDown, RotateCcw } from 'lucide-react';
import { usePlanningFlow } from '../../context/PlanningFlowContext';
import { Employee } from '../../types/employee';
import { Attendance } from '../../types/attendance';

interface Props {
  employees: Employee[];
  attendance: Attendance[];
}

const fmtDate = (s?: string) => !s ? '—' : new Date(s).toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' });

const ATTENDANCE_STATUS: Record<string, { label: string; color: string; bg: string }> = {
  present:    { label: 'Present',    color: '#059669', bg: 'rgba(16,185,129,.12)' },
  absent:     { label: 'Absent',     color: 'var(--danger)', bg: 'rgba(239,68,68,.12)' },
  pending:    { label: 'Pending',    color: '#d97706', bg: 'rgba(245,158,11,.12)' },
};

export const ExecutionPage: React.FC<Props> = ({ employees, attendance }) => {
  const { getDrafts, selectionSession } = usePlanningFlow();

  const sessionTeamIds = selectionSession?.teamIds ?? [];

  // Drafts that are SENT or COMPLETED = execution-phase plans
  const executionDrafts = useMemo(
    () => getDrafts({ teamIds: sessionTeamIds.length>0?sessionTeamIds:undefined })
            .filter(d => d.status === 'SENT' || d.status === 'COMPLETED'),
    [getDrafts, sessionTeamIds]
  );

  // Build execution rows
  const rows = useMemo(() => {
    return executionDrafts.flatMap(draft => {
      return draft.candidates.map(empId => {
        const emp = employees.find(e => String(e.employeeId) === empId);
        // Look for actual attendance record for this employee + training type + plan date window
        const attRecord = attendance.find(a =>
          a.employeeId === empId &&
          a.trainingType?.toUpperCase() === draft.trainingType?.toUpperCase() &&
          (draft.startDate ? a.attendanceDate >= (draft.startDate.substring(0,10)) : true)
        );

        const rawStatus = attRecord?.attendanceStatus?.toLowerCase() || 'pending';
        const statusKey = rawStatus.includes('present') ? 'present' : rawStatus.includes('absent') ? 'absent' : 'pending';

        return {
          draftId:       draft.id,
          trainingType:  draft.trainingType,
          planDate:      draft.startDate,
          empId,
          name:          emp?.name || '—',
          team:          emp?.team || draft.team || '—',
          designation:   emp?.designation || '—',
          attendanceStatus: statusKey,
        };
      });
    });
  }, [executionDrafts, employees, attendance]);

  // Metrics
  const total    = rows.length;
  const present  = rows.filter(r=>r.attendanceStatus==='present').length;
  const absent   = rows.filter(r=>r.attendanceStatus==='absent').length;
  const pending  = rows.filter(r=>r.attendanceStatus==='pending').length;
  const attPct   = total>0 ? Math.round((present/total)*100) : 0;
  const dropPct  = total>0 ? Math.round((absent/total)*100) : 0;

  // Repeat-needed = candidates who were present but were already repeat nominees
  // (simplified: absent candidates who need re-nomination)
  const repeatNeeded = absent;

  if (executionDrafts.length === 0) {
    return (
      <div style={{ padding:'48px',textAlign:'center',color:'var(--text-secondary)' }}>
        <TrendingDown size={36} style={{ margin:'0 auto 12px',color:'var(--border-color)' }}/>
        <div style={{ fontSize:'16px',fontWeight:600,marginBottom:'6px' }}>No plans in execution phase</div>
        <div style={{ fontSize:'13px' }}>Plans move here after the Notification email is sent (status → SENT).</div>
      </div>
    );
  }

  return (
    <div>
      {/* Metrics strip */}
      <div style={{ display:'flex',gap:'12px',marginBottom:'20px',flexWrap:'wrap' }}>
        {[
          { label:'Total Planned', value:total,       color:'var(--accent-primary)', Icon:CheckCircle    },
          { label:'Attendance %',  value:`${attPct}%`,color:'var(--success)',         Icon:TrendingDown   },
          { label:'Drop-off %',    value:`${dropPct}%`,color:'var(--danger)',         Icon:AlertCircle    },
          { label:'Repeat Needed', value:repeatNeeded, color:'#d97706',              Icon:RotateCcw      },
          { label:'Pending',       value:pending,      color:'var(--text-secondary)', Icon:AlertCircle    },
        ].map(k=>(
          <div key={k.label} style={{ background:'var(--bg-card)',border:'1px solid var(--border-color)',borderRadius:'10px',padding:'12px 18px',minWidth:'110px',textAlign:'center',flex:'0 0 auto' }}>
            <div style={{ fontSize:'22px',fontWeight:700,color:k.color }}>{k.value}</div>
            <div style={{ fontSize:'10px',color:'var(--text-secondary)',fontWeight:600,textTransform:'uppercase',letterSpacing:'.05em',marginTop:'3px' }}>{k.label}</div>
          </div>
        ))}
      </div>

      {/* Table */}
      <div style={{ overflowX:'auto',borderRadius:'10px',border:'1px solid var(--border-color)' }}>
        <table style={{ width:'100%',borderCollapse:'collapse',fontSize:'13px' }}>
          <thead>
            <tr style={{ background:'var(--bg)',borderBottom:'2px solid var(--border-color)' }}>
              {['Emp ID','Name','Team','Training','Planned Date','Attendance','Status'].map(h=>(
                <th key={h} style={{ padding:'10px 12px',textAlign:'left',fontSize:'11px',fontWeight:700,textTransform:'uppercase',letterSpacing:'.05em',color:'var(--text-secondary)',whiteSpace:'nowrap' }}>{h}</th>
              ))}
            </tr>
          </thead>
          <tbody>
            {rows.map((row,i)=>{
              const s = ATTENDANCE_STATUS[row.attendanceStatus] ?? ATTENDANCE_STATUS.pending;
              return (
                <tr key={`${row.draftId}-${row.empId}`} style={{ borderBottom:'1px solid var(--border-color)',background:i%2===0?'transparent':'rgba(0,0,0,.015)' }}>
                  <td style={{ padding:'10px 12px',fontFamily:'monospace',fontSize:'12px',color:'var(--text-secondary)',fontWeight:600 }}>{row.empId}</td>
                  <td style={{ padding:'10px 12px',fontWeight:500 }}>{row.name}</td>
                  <td style={{ padding:'10px 12px',fontSize:'12px' }}>{row.team}</td>
                  <td style={{ padding:'10px 12px' }}>
                    <span style={{ padding:'2px 8px',borderRadius:'10px',background:'rgba(99,102,241,.1)',color:'var(--accent-primary)',fontSize:'11px',fontWeight:700 }}>{row.trainingType}</span>
                  </td>
                  <td style={{ padding:'10px 12px',fontSize:'12px' }}>{fmtDate(row.planDate)}</td>
                  <td style={{ padding:'10px 12px' }}>
                    <span style={{ display:'inline-flex',alignItems:'center',gap:'4px',padding:'3px 9px',borderRadius:'12px',background:s.bg,color:s.color,fontSize:'12px',fontWeight:700 }}>
                      {s.label}
                    </span>
                  </td>
                  <td style={{ padding:'10px 12px',fontSize:'12px' }}>
                    {row.attendanceStatus==='absent'&&(
                      <span style={{ display:'inline-flex',alignItems:'center',gap:'4px',fontSize:'11px',color:'#d97706',fontWeight:600 }}>
                        <RotateCcw size={11}/>Re-nominate
                      </span>
                    )}
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
