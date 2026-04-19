import { normalizeText } from '../utils/textNormalizer';

/**
 * Robust Training Type Normalizer (STRICT)
 * Handles "Pre-AP", "Pre AP", "preap", "IP ", etc.
 */
export function normalizeTrainingType(type: string): string {
  if (!type) return '';
  const t = String(type).toLowerCase().replace(/[\s\-_]/g, '');

  if (t.includes('ip')) return 'IP';
  if (t.includes('ap') && !t.includes('pre')) return 'AP';
  if (t.includes('pre')) return 'PRE_AP';
  if (t.includes('mip')) return 'MIP';
  if (t.includes('ref')) return 'REFRESHER';
  if (t.includes('cap')) return 'CAPSULE';

  return type.toUpperCase().trim();
}
import { Attendance, TrainingScore, TrainingNomination } from '../types/attendance';
import { UnifiedRecord, GroupedData, ViewByOption, TimeSeriesRow, TrainerStat, DrilldownNode, ReportFilter, SCORE_SCHEMAS } from '../types/reports';
import { EligibilityResult } from './eligibilityService';
import { groupByKey, groupByTwoLevels, groupByField } from '../utils/mapGrouping';

const safe = (v: any): number => (typeof v === 'number' && !isNaN(v)) ? v : 0;

const avgScores = (scores: Record<string, number | null> | undefined): number => {
  if (!scores) return 0;
  const vals = Object.values(scores).filter((v): v is number => v !== null && !isNaN(v as number));
  return vals.length > 0 ? vals.reduce((a, b) => a + b, 0) / vals.length : 0;
};

// ─── UNIFIED DATASET BUILDER ───────────────────────────────────────────────
export function buildUnifiedDataset(
  emps: Employee[],
  att: Attendance[],
  scs: TrainingScore[],
  noms: TrainingNomination[],
  eligibilityResults: EligibilityResult[] = []
): UnifiedRecord[] {
  const empMap = new Map<string, Employee>();
  for (const e of emps) {
    empMap.set(e.employeeId || e.id, e);
  }

  const scoreMap = new Map<string, TrainingScore>();
  for (const s of scs) {
    const tid = String(s.employeeId).trim();
    const type = String(s.trainingType).toUpperCase();
    const key = `${tid}::${type}::${s.dateStr}`;
    scoreMap.set(key, s);
  }

  const nominationMap = new Map<string, TrainingNomination>();
  for (const n of noms) {
    const tid = String(n.employeeId).trim();
    const type = String(n.trainingType).toUpperCase();
    const key = `${tid}::${type}`;
    nominationMap.set(key, n);
  }

  const eligibilityMap = new Map<string, EligibilityResult>();
  for (const el of eligibilityResults) {
    const tid = String(el.employeeId).trim();
    eligibilityMap.set(tid, el);
  }

  return att.map(a => {
    const tid = String(a.employeeId).trim();
    const type = normalizeTrainingType(a.trainingType);
    
    const emp = empMap.get(tid) || {
      id: tid,
      employeeId: tid,
      name: a.name || '—',
      team: a.team || '—',
      state: a.state || '-',
      hq: a.hq || '-',
      designation: a.designation || '-',
      aadhaarNumber: a.aadhaarNumber || '-',
      mobileNumber: a.mobileNumber || '-',
      doj: '', dob: '', email: '', basicQualification: '',
      aplExperience: 0, pastExperience: 0, totalExperience: 0, age: 0,
      status: 'Active' as const,
    };

    const sc = scoreMap.get(`${tid}::${type}::${a.attendanceDate}`) || null;
    const nm = nominationMap.get(`${tid}::${type}`) || null;
    const el = eligibilityMap.get(tid);

    return {
      employee: emp as Employee,
      attendance: { ...a, trainingType: type },
      score: sc,
      nomination: nm,
      eligibilityStatus: el?.eligibilityStatus,
      eligibilityReason: el?.reasonIfNotEligible
    };
  }).filter(r => r.employee);
}

// ─── FILTER ENGINE ─────────────────────────────────────────────────────────
export function applyFilters(ds: UnifiedRecord[], filter: ReportFilter): UnifiedRecord[] {
  return ds.filter(r => {
    const month = r.attendance.month || (r.attendance.attendanceDate || '').substring(0, 7);
    if (filter.monthFrom && month < filter.monthFrom) return false;
    if (filter.monthTo && month > filter.monthTo) return false;
    if (filter.teams.length > 0 && !filter.teams.includes(r.employee.team)) return false;
    if (filter.clusters.length > 0 && !filter.clusters.includes(r.employee.state)) return false;
    if (filter.trainer && r.attendance.trainerId !== filter.trainer) return false;
    return true;
  });
}

// ─── GROUPING ENGINE ───────────────────────────────────────────────────────
/**
 * Optimized grouping: Uses Map-based pattern to avoid repeated lookups.
 * Single pass through data + nominations with O(n+m) complexity.
 */
export function groupData(
  ds: UnifiedRecord[],
  by: ViewByOption,
  noms: TrainingNomination[],
  emps: Employee[]
): GroupedData[] {
  const m = new Map<string, GroupedData>();

  // Single pass through records
  for (const r of ds) {
    let k = '—';
    if (by === 'Month') k = r.attendance.month || (r.attendance.attendanceDate || '').substring(0, 7) || '—';
    else if (by === 'Team') k = r.employee.team || '—';
    else k = r.employee.state || '—';

    if (!m.has(k)) m.set(k, { key: k, records: [], nominations: [], metric: 0 });
    m.get(k)!.records.push(r);
  }

  // Build lookup map for employees (O(n) instead of O(m*n) with repeated finds)
  const empMap = new Map<string, Employee>();
  for (const e of emps) {
    empMap.set(e.employeeId || e.id, e);
  }

  // Single pass through nominations
  for (const n of noms) {
    const e = empMap.get(n.employeeId);
    let k = '—';
    if (by === 'Month') k = (n.notificationDate || '').substring(0, 7) || '—';
    else if (by === 'Team') k = e?.team || '—';
    else k = e?.state || '—';

    if (!m.has(k)) m.set(k, { key: k, records: [], nominations: [], metric: 0 });
    m.get(k)!.nominations.push(n);
  }

  return Array.from(m.values());
}

// ─── IP ENGINE ─────────────────────────────────────────────────────────────
export function calcIP(recs: UnifiedRecord[]) {
  const p = recs.filter(r => r.attendance.attendanceStatus === 'Present');
  let h = 0, med = 0, l = 0;
  p.forEach(r => {
    const s = r.score?.scores?.['score'] ?? 
              r.score?.scores?.['percent'] ?? 
              r.score?.scores?.['tScore'] ?? 
              r.score?.scores?.['Score'] ?? 
              r.score?.scores?.['Percent'] ?? 
              r.score?.scores?.['T Score'];
    if (s != null) {
      if (s >= 75) h++;
      else if (s >= 50) med++;
      else l++;
    } else l++;
  });
  const t = h + med + l;
  return {
    total: t,
    high: h,
    medium: med,
    low: l,
    weighted: t > 0 ? ((h * 95) + (med * 82.5) + (l * 62.5)) / t : 0,
    highPct: t > 0 ? (h / t) * 100 : 0
  };
}

// ─── AP ENGINE ─────────────────────────────────────────────────────────────
export function calcAP(recs: UnifiedRecord[], noms: TrainingNomination[]) {
  const present = recs.filter(r => r.attendance.attendanceStatus === 'Present');
  const attendedIds = new Set(present.map(r => r.attendance.employeeId));
  const notifiedIds = new Set((noms || []).map(n => n.employeeId));
  let scoreSum = 0, scoredCount = 0;
  present.forEach(r => {
    const avg = avgScores(r.score?.scores);
    if (avg > 0) { scoreSum += avg; scoredCount++; }
  });

  // Defaulters: >= 3 nominations, 0 attendance
  const nomCountMap = new Map<string, number>();
  (noms || []).forEach(n => nomCountMap.set(n.employeeId, (nomCountMap.get(n.employeeId) || 0) + 1));
  let defaulterCount = 0;
  nomCountMap.forEach((count, empId) => { if (count >= 3 && !attendedIds.has(empId)) defaulterCount++; });

  return {
    notified: notifiedIds.size,
    attended: present.length,
    attendance: notifiedIds.size > 0 ? (present.length / notifiedIds.size) * 100 : 0,
    composite: scoredCount > 0 ? scoreSum / scoredCount : 0,
    defaulterCount
  };
}

// ─── MIP ENGINE ────────────────────────────────────────────────────────────
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
  return { count: p.length, avgSci: cS > 0 ? sS / cS : 0, avgSkl: cK > 0 ? sK / cK : 0 };
}

// ─── REFRESHER ENGINE ──────────────────────────────────────────────────────
export function calcRefresher(recs: UnifiedRecord[]) {
  const p = recs.filter(r => r.attendance.attendanceStatus === 'Present');
  const schema = ['Knowledge', 'Situation Handling', 'Presentation'];
  const totals: Record<string, { sum: number; count: number }> = {};
  schema.forEach(k => { totals[k] = { sum: 0, count: 0 }; });
  p.forEach(r => {
    schema.forEach(k => {
      const v = r.score?.scores?.[k];
      if (v != null && !isNaN(v as number)) { totals[k].sum += v as number; totals[k].count++; }
    });
  });
  const avgs: Record<string, number> = {};
  schema.forEach(k => { avgs[k] = totals[k].count > 0 ? totals[k].sum / totals[k].count : 0; });
  const overallAvg = schema.reduce((a, k) => a + avgs[k], 0) / schema.length;
  return { count: p.length, avgs, overallAvg };
}

// ─── CAPSULE ENGINE ────────────────────────────────────────────────────────
export function calcCapsule(recs: UnifiedRecord[]) {
  const p = recs.filter(r => r.attendance.attendanceStatus === 'Present');
  let scoreSum = 0, scoredCount = 0;
  p.forEach(r => {
    const v = r.score?.scores?.['Score'];
    if (v != null) { scoreSum += safe(v); scoredCount++; }
  });
  return { count: p.length, avgScore: scoredCount > 0 ? scoreSum / scoredCount : 0 };
}

// ─── PRE-AP ENGINE ─────────────────────────────────────────────────────────
export function calcPreAP(recs: UnifiedRecord[], noms: TrainingNomination[]) {
  const nominatedIds = new Set((noms || []).map(n => n.employeeId));
  // Only include records for nominated employees
  const nominatedRecs = recs.filter(r => nominatedIds.has(r.employee.employeeId));
  const present = nominatedRecs.filter(r => r.attendance.attendanceStatus === 'Present');
  let scoreSum = 0, scoredCount = 0;
  present.forEach(r => {
    const avg = avgScores(r.score?.scores);
    if (avg > 0) { scoreSum += avg; scoredCount++; }
  });
  return {
    notified: nominatedIds.size,
    attended: present.length,
    attendance: nominatedIds.size > 0 ? (present.length / nominatedIds.size) * 100 : 0,
    avgScore: scoredCount > 0 ? scoreSum / scoredCount : 0
  };
}

// ─── GENERIC SCORE ENGINE (for GTG, HO, RTM) ──────────────────────────────
export function calcGeneric(recs: UnifiedRecord[]) {
  const p = recs.filter(r => r.attendance.attendanceStatus === 'Present');
  let scoreSum = 0, scoredCount = 0;
  p.forEach(r => {
    const v = r.score?.scores?.['Score'];
    if (v != null) { scoreSum += safe(v); scoredCount++; }
  });
  return { count: p.length, avgScore: scoredCount > 0 ? scoreSum / scoredCount : 0 };
}

// ─── TIME SERIES BUILDER ───────────────────────────────────────────────────
/**
 * Optimized time series: Pre-groups records by month to avoid repeated filtering.
 * Uses Map to store month-grouped records for O(n*m) instead of O(n*m*k) complexity.
 */
export function buildTimeSeries(
  groups: GroupedData[],
  months: string[],
  tab: string,
  mode: 'count' | 'score' = 'score'
): TimeSeriesRow[] {
  return groups.map(g => {
    // Pre-group records by month (single pass)
    const monthMap = new Map<string, UnifiedRecord[]>();
    for (const r of g.records) {
      const m = r.attendance.month || (r.attendance.attendanceDate || '').substring(0, 7);
      if (!monthMap.has(m)) monthMap.set(m, []);
      monthMap.get(m)!.push(r);
    }

    const cells: Record<string, number | null> = {};
    
    for (const mo of months) {
      const monthRecs = monthMap.get(mo);
      if (!monthRecs || monthRecs.length === 0) { 
        cells[mo] = null; 
        continue; 
      }

      if (mode === 'count') {
        // Single filter pass to count present
        let presentCount = 0;
        for (const r of monthRecs) {
          if (r.attendance.attendanceStatus === 'Present') presentCount++;
        }
        cells[mo] = presentCount;
      } else {
        // Calculate metrics based on tab type
        if (tab === 'IP') cells[mo] = calcIP(monthRecs).weighted;
        else if (tab === 'AP') cells[mo] = calcAP(monthRecs, g.nominations).composite;
        else if (tab === 'MIP') { const m = calcMIP(monthRecs); cells[mo] = (m.avgSci + m.avgSkl) / 2; }
        else if (tab === 'Refresher') cells[mo] = calcRefresher(monthRecs).overallAvg;
        else cells[mo] = calcCapsule(monthRecs).avgScore;
      }
    }
    
    return { label: g.key, cells };
  });
}

// ─── TRAINER STATS ENGINE ──────────────────────────────────────────────────
/**
 * Optimized trainer stats: Single pass with Set-based tracking.
 * Avoids repeated filtering and lookups.
 */
export function calcTrainerStats(ds: UnifiedRecord[]): TrainerStat[] {
  const m = new Map<string, { sessions: Set<string>; trainees: Set<string>; total: number; totalAtt: number; scoreSum: number; scoreCount: number }>();
  
  // Single pass through all records
  for (const r of ds) {
    const tid = r.attendance.trainerId || '—';
    
    if (!m.has(tid)) {
      m.set(tid, { sessions: new Set(), trainees: new Set(), total: 0, totalAtt: 0, scoreSum: 0, scoreCount: 0 });
    }
    
    const entry = m.get(tid)!;
    const sessionKey = r.attendance.attendanceDate || '—';
    
    entry.sessions.add(sessionKey);
    entry.trainees.add(r.attendance.employeeId);
    entry.total++;
    
    if (r.attendance.attendanceStatus === 'Present') {
      entry.totalAtt++;
      const avg = avgScores(r.score?.scores);
      if (avg > 0) { 
        entry.scoreSum += avg; 
        entry.scoreCount++; 
      }
    }
  }
  
  // Convert to array and sort in one pass
  return Array.from(m.entries())
    .map(([tid, e]) => ({
      trainerId: tid,
      trainingsConducted: e.sessions.size,
      totalTrainees: e.trainees.size,
      avgScore: e.scoreCount > 0 ? e.scoreSum / e.scoreCount : 0,
      attendancePct: e.total > 0 ? (e.totalAtt / e.total) * 100 : 0
    }))
    .sort((a, b) => b.avgScore - a.avgScore);
}

// ─── DRILL-DOWN BUILDER ────────────────────────────────────────────────────
/**
 * Optimized drilldown: Uses two-level Map grouping for O(n) single pass.
 * Avoids nested forEach and repeated .filter() calls.
 */
export function buildDrilldown(ds: UnifiedRecord[], tab: string): DrilldownNode[] {
  // Use optimized two-level Map grouping
  const clusterMap = groupByTwoLevels(
    ds,
    r => r.employee.state || '—',
    r => r.employee.team || '—'
  );

  // Build nodes with single-pass metric calculation
  const nodes: DrilldownNode[] = [];
  
  for (const [cluster, teamMap] of clusterMap) {
    const children: DrilldownNode[] = [];
    const clusterRecs: UnifiedRecord[] = [];

    for (const [team, recs] of teamMap) {
      // Pre-filter present records once
      const presentRecs = recs.filter(r => r.attendance.attendanceStatus === 'Present');
      
      children.push({
        key: `${cluster}_${team}`,
        label: team,
        metric: getPrimaryMetricRaw(recs, tab),
        count: presentRecs.length,
        records: recs
      });

      clusterRecs.push(...recs);
    }

    // Calculate cluster-level metric once from all records
    const presentClusterRecs = clusterRecs.filter(r => r.attendance.attendanceStatus === 'Present');
    
    nodes.push({
      key: cluster,
      label: cluster,
      metric: getPrimaryMetricRaw(clusterRecs, tab),
      count: presentClusterRecs.length,
      children
    });
  }

  return nodes.sort((a, b) => b.metric - a.metric);
}

// ─── GAP ANALYSIS ─────────────────────────────────────────────────────────
export function getGapData(
  type: string,
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

// ─── EXPORT TO CSV ─────────────────────────────────────────────────────────
export function exportToCSV(rows: Record<string, any>[], filename: string = 'report.csv') {
  if (rows.length === 0) return;
  const headers = Object.keys(rows[0]);
  const csvContent = [
    headers.join(','),
    ...rows.map(r => headers.map(h => {
      const val = r[h] ?? '';
      const str = String(val).replace(/"/g, '""');
      return str.includes(',') || str.includes('"') || str.includes('\n') ? `"${str}"` : str;
    }).join(','))
  ].join('\n');
  const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.setAttribute('href', url);
  link.setAttribute('download', filename);
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
  URL.revokeObjectURL(url);
}

// ─── HELPERS ───────────────────────────────────────────────────────────────
export function getPrimaryMetricRaw(recs: UnifiedRecord[], tab: string): number {
  if (tab === 'IP') return calcIP(recs).weighted;
  if (tab === 'AP') return calcAP(recs, []).composite;
  if (tab === 'MIP') { const m = calcMIP(recs); return (m.avgSci + m.avgSkl) / 2; }
  if (tab === 'Refresher') return calcRefresher(recs).overallAvg;
  return calcCapsule(recs).avgScore;
}

export function getPrimaryMetric(recs: UnifiedRecord[], tab: string, noms: TrainingNomination[]): number {
  if (tab === 'AP') return calcAP(recs, noms).composite;
  return getPrimaryMetricRaw(recs, tab);
}

export function rankGroups(groups: GroupedData[], tab: string): GroupedData[] {
  const scored = groups.map(g => ({
    ...g,
    metric: getPrimaryMetric(g.records, tab, g.nominations)
  }));
  scored.sort((a, b) => b.metric - a.metric);
  return scored.map((g, i) => ({ ...g, rank: i + 1 }));
}
