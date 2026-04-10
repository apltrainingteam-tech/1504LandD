import { Employee } from '../types/employee';
import { Attendance, TrainingScore, TrainingNomination, Demographics, TrainingType } from '../types/attendance';
import { UnifiedRecord, GroupedData, ViewByOption } from '../types/reports';
import { EligibilityResult } from './eligibilityService';

const safe = (v: any): number => (typeof v === 'number' && !isNaN(v)) ? v : 0;

export function buildUnifiedDataset(
  emps: Employee[],
  att: Attendance[],
  scs: TrainingScore[],
  noms: TrainingNomination[],
  eligibilityResults: EligibilityResult[] = []
): UnifiedRecord[] {
  return att.map(a => {
    const emp = emps.find(e => e.id === a.employeeId) || {
      id: a.employeeId,
      employeeId: a.employeeId,
      employeeName: 'Unknown',
      team: 'Unknown',
      cluster: 'Unknown',
      hq: '-',
      state: '-',
      status: 'Inactive' as const,
      aadhaarNumber: '-',
      mobileNumber: '-',
      designation: '-',
      joiningDate: ''
    };
    const sc = scs.find(s => s.employeeId === a.employeeId && s.trainingType === a.trainingType && s.dateStr === a.attendanceDate) || null;
    const nm = noms.find(n => n.employeeId === a.employeeId && n.trainingType === a.trainingType) || null;
    const el = eligibilityResults.find(e => e.employeeId === a.employeeId);
    
    return { 
      employee: emp as Employee, 
      attendance: a, 
      score: sc, 
      nomination: nm,
      eligibilityStatus: el?.eligibilityStatus,
      eligibilityReason: el?.reasonIfNotEligible
    };
  });
}

export function groupData(
  ds: UnifiedRecord[],
  by: ViewByOption,
  noms: TrainingNomination[],
  emps: Employee[]
): GroupedData[] {
  const m = new Map<string, GroupedData>();

  ds.forEach(r => {
    let k = 'Unknown';
    if (by === 'Month') k = r.attendance.month || (r.attendance.attendanceDate || '').substring(0, 7) || 'Unknown';
    else if (by === 'Team') k = r.employee.team || 'Unknown';
    else k = r.employee.cluster || 'Unknown';

    if (!m.has(k)) m.set(k, { key: k, records: [], nominations: [], metric: 0 });
    m.get(k)!.records.push(r);
  });

  (noms || []).forEach(n => {
    const e = emps.find(x => x.employeeId === n.employeeId || x.id === n.employeeId);
    let k = 'Unknown';
    if (by === 'Month') k = (n.nominationDate || '').substring(0, 7) || 'Unknown';
    else if (by === 'Team') k = e?.team || 'Unknown';
    else k = e?.cluster || 'Unknown';

    if (!m.has(k)) m.set(k, { key: k, records: [], nominations: [], metric: 0 });
    m.get(k)!.nominations.push(n);
  });

  return Array.from(m.values());
}

// IP Metrics
export function calcIP(recs: UnifiedRecord[]) {
  const p = recs.filter(r => r.attendance.attendanceStatus === 'Present');
  let h = 0, m = 0, l = 0;
  p.forEach(r => {
    const s = r.score?.scores?.['Score'];
    if (s != null) {
      if (s >= 75) h++;
      else if (s >= 50) m++;
      else l++;
    } else l++;
  });
  const t = h + m + l;
  return {
    total: t,
    high: h,
    medium: m,
    low: l,
    weighted: t > 0 ? ((h * 95) + (m * 82.5) + (l * 62.5)) / t : 0,
    highPct: t > 0 ? (h / t) * 100 : 0
  };
}

// AP Metrics
export function calcAP(recs: UnifiedRecord[], noms: TrainingNomination[]) {
  const att = recs.filter(r => r.attendance.attendanceStatus === 'Present').length;
  const not = new Set((noms || []).map(n => n.employeeId)).size;
  let s = 0, c = 0;
  recs.filter(r => r.attendance.attendanceStatus === 'Present').forEach(r => {
    if (r.score?.scores) {
      const ks = Object.keys(r.score.scores);
      if (ks.length) {
        s += ks.reduce((a, k) => a + safe(r.score.scores[k]), 0) / ks.length;
        c++;
      }
    }
  });
  return {
    notified: not,
    attended: att,
    conversion: not > 0 ? (att / not) * 100 : 0,
    composite: c > 0 ? s / c : 0
  };
}

// MIP Metrics
export function calcMIP(recs: UnifiedRecord[]) {
  const p = recs.filter(r => r.attendance.attendanceStatus === 'Present');
  let sS = 0, cS = 0, sK = 0, cK = 0;
  p.forEach(r => {
    if (r.score?.scores) {
      const sc = r.score.scores['Science Score'];
      const sk = r.score.scores['Skill Score'];
      if (sc != null) { sS += safe(sc); cS++; }
      if (sk != null) { sK += safe(sk); cK++; }
    }
  });
  return {
    count: p.length,
    avgSci: cS > 0 ? sS / cS : 0,
    avgSkl: cK > 0 ? sK / cK : 0
  };
}

/**
 * GAP ANALYSIS LOGIC
 * Identifies employees who are eligible but have NO attendance record for the type.
 */
export function getGapData(
  type: TrainingType,
  eligibilityResults: EligibilityResult[],
  attendance: Attendance[]
) {
  const trainedIds = new Set(
    attendance
      .filter(a => a.trainingType === type && a.attendanceStatus === 'Present')
      .map(a => a.employeeId)
  );

  const eligibleButNotTrained = eligibilityResults.filter(
    er => er.eligibilityStatus && !trainedIds.has(er.employeeId)
  );

  return {
    eligibleCount: eligibilityResults.filter(er => er.eligibilityStatus).length,
    trainedCount: trainedIds.size,
    gapCount: eligibleButNotTrained.length,
    gapList: eligibleButNotTrained
  };
}

export function getPrimaryMetric(recs: UnifiedRecord[], tab: string, noms: TrainingNomination[]): number {
  if (tab === 'IP') return calcIP(recs).weighted;
  if (tab === 'AP') return calcAP(recs, noms).composite;
  const m = calcMIP(recs);
  return (m.avgSci + m.avgSkl) / 2;
}

export function rankGroups(groups: GroupedData[], tab: string): GroupedData[] {
  const scored = groups.map(g => ({
    ...g,
    metric: getPrimaryMetric(g.records, tab, g.nominations)
  }));
  scored.sort((a, b) => b.metric - a.metric);
  return scored.map((g, i) => ({ ...g, rank: i + 1 }));
}
