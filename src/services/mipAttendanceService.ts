import { EmployeeEventTimeline } from './apIntelligenceService';

export interface MIPMonthMapNode {
  notified: number;
  attended: number;
}

export interface MIPCandidateAttendance {
  employeeId: string;
  name: string;
  team: string;
  cluster: string;
  trainer: string;
  date: string;
}

export interface MIPAttendanceAggregates {
  clusterMonthMap: Record<string, { totalNotified: number; totalAttended: number; months: Record<string, MIPMonthMapNode>; teams: Record<string, { totalNotified: number; totalAttended: number; months: Record<string, MIPMonthMapNode> }> }>;
  globalKPIs: {
    totalNotified: number;
    totalAttended: number;
    attendancePercent: number;
  };
}

export function buildMIPAttendanceMatrix(
  timelines: Map<string, EmployeeEventTimeline>,
  fyMonths: string[]
): MIPAttendanceAggregates {
  const clusterMonthMap: MIPAttendanceAggregates['clusterMonthMap'] = {};
  const DUMMY_TEAMS = new Set(['Team A', '—', 'Unknown Team']);

  const globalNotifiedSet = new Set<string>();
  const globalAttendedSet = new Set<string>();

  for (const timeline of timelines.values()) {
    if (DUMMY_TEAMS.has(timeline.team) || DUMMY_TEAMS.has(timeline.cluster)) continue;

    const cluster = timeline.cluster;
    const team = timeline.team;

    if (!clusterMonthMap[cluster]) {
      clusterMonthMap[cluster] = { totalNotified: 0, totalAttended: 0, months: {}, teams: {} };
    }
    if (!clusterMonthMap[cluster].teams[team]) {
      clusterMonthMap[cluster].teams[team] = { totalNotified: 0, totalAttended: 0, months: {} };
    }

    const clusterNode = clusterMonthMap[cluster];
    const teamNode = clusterNode.teams[team];

    const notifiedMonths = new Set<string>();
    const attendedMonths = new Set<string>();

    timeline.notifications.forEach(n => {
      if (fyMonths.includes(n.month)) notifiedMonths.add(n.month);
    });
    timeline.attendances.forEach(a => {
      if (a.status === 'Present' && fyMonths.includes(a.month)) attendedMonths.add(a.month);
    });

    if (notifiedMonths.size > 0 || attendedMonths.size > 0) {
      if (notifiedMonths.size > 0) globalNotifiedSet.add(timeline.employeeId);
      if (attendedMonths.size > 0) globalAttendedSet.add(timeline.employeeId);
    }

    fyMonths.forEach(mo => {
      if (!clusterNode.months[mo]) clusterNode.months[mo] = { notified: 0, attended: 0 };
      if (!teamNode.months[mo]) teamNode.months[mo] = { notified: 0, attended: 0 };

      const isNotified = notifiedMonths.has(mo);
      const isAttended = attendedMonths.has(mo);

      if (isNotified) {
        clusterNode.months[mo].notified++;
        teamNode.months[mo].notified++;
        clusterNode.totalNotified++;
        teamNode.totalNotified++;
      }
      if (isAttended) {
        clusterNode.months[mo].attended++;
        teamNode.months[mo].attended++;
        clusterNode.totalAttended++;
        teamNode.totalAttended++;
      }
    });
  }

  return {
    clusterMonthMap,
    globalKPIs: {
      totalNotified: globalNotifiedSet.size,
      totalAttended: globalAttendedSet.size,
      attendancePercent: globalNotifiedSet.size > 0 ? (globalAttendedSet.size / globalNotifiedSet.size) * 100 : (globalAttendedSet.size > 0 ? 100 : 0)
    }
  };
}

export function getMIPAttendanceDrilldown(
  timelines: Map<string, EmployeeEventTimeline>,
  filters: { cluster: string; team: string; month: string }
): MIPCandidateAttendance[] {
  const results: MIPCandidateAttendance[] = [];

  for (const timeline of timelines.values()) {
    if (timeline.cluster !== filters.cluster || timeline.team !== filters.team) continue;

    // Both noticed and attended can exist for a month, let's grab attendance records first.
    // Wait, the drilldown table typically shows candidates who were either notified OR attended.
    const isAttended = timeline.attendances.some(a => a.status === 'Present' && a.month === filters.month);
    const isNotified = timeline.notifications.some(n => n.month === filters.month);

    if (isAttended || isNotified) {
      // Find exact date/trainer if attended
      const attRecord = timeline.attendances.find(a => a.status === 'Present' && a.month === filters.month);
      const notRecord = timeline.notifications.find(n => n.month === filters.month);
      
      results.push({
        employeeId: timeline.employeeId,
        name: timeline.name,
        team: timeline.team,
        cluster: timeline.cluster,
        trainer: attRecord?.trainerId || '—',
        date: attRecord?.date || notRecord?.date || '—'
      });
    }
  }

  return results;
}
