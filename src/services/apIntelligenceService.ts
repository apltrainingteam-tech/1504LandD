import { Attendance, TrainingNomination, TrainingScore } from '../types/attendance';
import { normalizeText } from '../utils/textNormalizer';
import { Team } from '../context/MasterDataContext';
import { getTeamId } from '../utils/teamIdMapper';

// --- EVENT LAYER ---
export type EmployeeEventTimeline = {
  employeeId: string;
  name: string;
  team: string; 
  cluster: string;
  notifications: Array<{ date: string; month: string }>;
  attendances: Array<{ date: string; month: string; status: 'Present' | 'Absent'; trainerId?: string; scores: Record<string, number | null> }>;
};

export function buildEmployeeTimelines(
  attendances: Attendance[],
  nominations: TrainingNomination[],
  masterTeams: Team[],
  targetType: string = 'AP',
  scores: TrainingScore[] = []
): Map<string, EmployeeEventTimeline> {
  const map = new Map<string, EmployeeEventTimeline>();
  const teamMap = Object.fromEntries(masterTeams.map(t => [t.id, t]));

  const getTimeline = (empId: string, empName: string, teamRaw: string | undefined): EmployeeEventTimeline => {
    if (!map.has(empId)) {
      const team = normalizeText(teamRaw || 'Unknown');
      const teamId = getTeamId(team, masterTeams);
      const cluster = teamId ? (teamMap[teamId]?.cluster || 'Unmapped') : 'Unmapped';
      map.set(empId, { employeeId: empId, name: empName || 'Unknown', team, cluster, notifications: [], attendances: [] });
    }
    return map.get(empId)!;
  };

  nominations.forEach(n => {
    if (n.trainingType !== targetType) return;
    const t = getTimeline(n.employeeId, n.name, n.team);
    t.notifications.push({
      date: n.notificationDate || '',
      month: n.month || (n.notificationDate ? n.notificationDate.substring(0, 7) : '')
    });
  });

  attendances.forEach(a => {
    if (a.trainingType !== targetType) return;
    // We expect attendance records with joined master data to have the employee name, 
    // but the pure Attendance interface might not directly guarantee it without joining.
    // However, in ReportsAnalytics, attendance array is often just raw records.
    // Wait, the Attendance interface actually has `name`? Let me assume `a.name` exists or fallback.
    const t = getTimeline(a.employeeId, (a as any).name || 'Unknown', a.team);
    // Join scores: match by employeeId + trainingType + date
    const sc = scores.find(s =>
      s.employeeId === a.employeeId &&
      s.trainingType === a.trainingType &&
      s.dateStr === a.attendanceDate
    );
    t.attendances.push({
      date: a.attendanceDate || '',
      month: a.month || (a.attendanceDate ? a.attendanceDate.substring(0, 7) : ''),
      status: a.attendanceStatus,
      trainerId: a.trainerId,
      scores: sc?.scores || {}
    });
  });

  // Sort them chronologically for future processing
  for (const t of map.values()) {
    t.notifications.sort((a, b) => a.date.localeCompare(b.date));
    t.attendances.sort((a, b) => a.date.localeCompare(b.date));
  }

  return map;
}

export function filterTimelines(
  rawTimelines: Map<string, EmployeeEventTimeline>,
  filters: { trainer?: string; validMonths?: string[] }
): Map<string, EmployeeEventTimeline> {
  const filtered = new Map<string, EmployeeEventTimeline>();

  for (const [empId, timeline] of rawTimelines.entries()) {
    let keep = true;

    // Filter by Trainer (if provided, employee MUST have at least one attendance with this trainer)
    if (filters.trainer) {
      const hasTrainer = timeline.attendances.some(a => a.trainerId === filters.trainer);
      if (!hasTrainer) keep = false;
    }

    // Filter by FY Months (if provided, employee MUST have at least one event in these months)
    if (keep && filters.validMonths && filters.validMonths.length > 0) {
      const hasValidNom = timeline.notifications.some(n => filters.validMonths!.includes(n.month));
      const hasValidAtt = timeline.attendances.some(a => filters.validMonths!.includes(a.month));
      if (!hasValidNom && !hasValidAtt) keep = false;
    }

    // If kept, we clone the timeline but ONLY KEEP the events that fall within the valid months
    // Note: The user said "use filteredEvents for ... matrix generation". 
    // Matrix generation uses `month of fyMonths` check, but wait... if we filter the events themselves, 
    // then KPI calc (which we might base on these timelines) will also be accurate!
    if (keep) {
      const tClone = { ...timeline };
      if (filters.validMonths && filters.validMonths.length > 0) {
        tClone.notifications = tClone.notifications.filter(n => filters.validMonths!.includes(n.month));
        tClone.attendances = tClone.attendances.filter(a => filters.validMonths!.includes(a.month));
      }
      filtered.set(empId, tClone);
    }
  }

  return filtered;
}

// --- SUMMARY LAYER ---
export interface APCellSummary {
  notified: number;
  attended: number;
}

export interface APMonthMapNode {
  totalNotified: number;
  totalAttended: number;
  months: Record<string, APCellSummary>;
}

export interface APAggregates {
  clusterMonthMap: Record<string, APMonthMapNode>;
  teamMonthMap: Record<string, Record<string, APMonthMapNode>>;
  globalKPIs: {
    totalEmployeesNotified: number;
    totalEmployeesAttended: number;
    attendancePercent: number;
    defaulters: number;
    compositeScore: number;
  };
}

export function buildAPMonthlyMatrix(
  timelines: Map<string, EmployeeEventTimeline>,
  fyMonths: string[]
): APAggregates {
  const clusterMonthMap: Record<string, APMonthMapNode> = {};
  const teamMonthMap: Record<string, Record<string, APMonthMapNode>> = {};

  const DUMMY_TEAMS = new Set(['Team A', 'Unknown', '—', 'Unknown Team', 'Unmapped']);

  const globalNotifiedSet = new Set<string>();
  const globalAttendedSet = new Set<string>();

  let defaulters = 0;
  let totalScoreSum = 0;
  let scoredSessions = 0;

  for (const timeline of timelines.values()) {
    if (DUMMY_TEAMS.has(timeline.team) || DUMMY_TEAMS.has(timeline.cluster)) continue;

    // KPI Calc
    let presentCount = 0;
    timeline.attendances.forEach(a => {
      if (a.status === 'Present') {
        presentCount++;
        const vals = Object.values(a.scores).filter(v => v !== null) as number[];
        if (vals.length > 0) {
          totalScoreSum += (vals.reduce((s, v) => s + v, 0) / vals.length);
          scoredSessions++;
        }
      }
    });
    if (timeline.notifications.length >= 3 && presentCount === 0) defaulters++;

    const cluster = timeline.cluster;
    const team = timeline.team;

    if (!clusterMonthMap[cluster]) {
      clusterMonthMap[cluster] = { totalNotified: 0, totalAttended: 0, months: {} };
    }
    if (!teamMonthMap[cluster]) {
      teamMonthMap[cluster] = {};
    }
    if (!teamMonthMap[cluster][team]) {
      teamMonthMap[cluster][team] = { totalNotified: 0, totalAttended: 0, months: {} };
    }

    for (const month of fyMonths) {
      if (!clusterMonthMap[cluster].months[month]) {
        clusterMonthMap[cluster].months[month] = { notified: 0, attended: 0 };
      }
      if (!teamMonthMap[cluster][team].months[month]) {
        teamMonthMap[cluster][team].months[month] = { notified: 0, attended: 0 };
      }

      const isNotifiedMonth = timeline.notifications.some(n => n.month === month);
      const isAttendedMonth = timeline.attendances.some(a => a.month === month && a.status === 'Present');

      if (isNotifiedMonth) {
        clusterMonthMap[cluster].months[month].notified++;
        teamMonthMap[cluster][team].months[month].notified++;
        globalNotifiedSet.add(timeline.employeeId);
      }

      if (isAttendedMonth) {
        clusterMonthMap[cluster].months[month].attended++;
        teamMonthMap[cluster][team].months[month].attended++;
        globalAttendedSet.add(timeline.employeeId);
      }
    }
  }

  // Calculate totals across selected months
  for (const cluster of Object.values(clusterMonthMap)) {
    for (const data of Object.values(cluster.months)) {
      cluster.totalNotified += data.notified;
      cluster.totalAttended += data.attended;
    }
  }

  for (const clusterObj of Object.values(teamMonthMap)) {
    for (const teamObj of Object.values(clusterObj)) {
      for (const data of Object.values(teamObj.months)) {
        teamObj.totalNotified += data.notified;
        teamObj.totalAttended += data.attended;
      }
    }
  }

  return {
    clusterMonthMap,
    teamMonthMap,
    globalKPIs: {
      totalEmployeesNotified: globalNotifiedSet.size,
      totalEmployeesAttended: globalAttendedSet.size,
      attendancePercent: globalNotifiedSet.size > 0 ? (globalAttendedSet.size / globalNotifiedSet.size) * 100 : 0,
      defaulters,
      compositeScore: scoredSessions > 0 ? totalScoreSum / scoredSessions : 0
    }
  };
}
