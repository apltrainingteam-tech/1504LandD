/**
 * Scope Filter Utility - Lightweight data filtering foundation
 * 
 * This is a stub implementation that currently returns all data unchanged.
 * Future: Apply cluster/team filters to datasets based on user scope.
 */

import { CurrentUser } from '../context/userContext';
import { Employee } from '../../types/employee';
import { Attendance } from '../../types/attendance';

/**
 * Apply scope-based filtering to data
 * 
 * Currently: Returns data unchanged (non-breaking)
 * Future: Filter based on user.scope.cluster and user.scope.team
 * 
 * Usage:
 *   const scopedEmployees = applyScope(employees, currentUser);
 *   const scopedAttendance = applyScope(attendance, currentUser);
 * 
 * @param data The dataset to filter (supports Employee, Attendance, or generic array)
 * @param user Current user with scope constraints
 * @returns Filtered data (currently returns original data)
 */
export function applyScope<T>(data: T[], user: CurrentUser): T[] {
  // If user is super_admin with empty scope, return all data
  if (user.role === 'super_admin' && user.scope.cluster.length === 0 && user.scope.team.length === 0) {
    return data;
  }

  // TODO: Enable this when scope enforcement is needed
  // const { cluster, team } = user.scope;
  // 
  // return data.filter(item => {
  //   // For Employee data
  //   if (hasProperty(item, 'cluster') && hasProperty(item, 'team')) {
  //     const itemCluster = (item as any).cluster;
  //     const itemTeam = (item as any).team;
  //     
  //     const matchesCluster = cluster.length === 0 || cluster.includes(itemCluster);
  //     const matchesTeam = team.length === 0 || team.includes(itemTeam);
  //     
  //     return matchesCluster && matchesTeam;
  //   }
  //   
  //   // For Attendance/Training data (has Employee reference)
  //   if (hasProperty(item, 'employeeId')) {
  //     // Would need employee lookup here
  //     return true; // placeholder
  //   }
  //   
  //   return true;
  // });

  // Currently: Return all data unchanged (non-breaking change)
  return data;
}

/**
 * Filter employees by scope
 * 
 * @param employees Array of employees
 * @param user Current user with scope constraints
 * @returns Filtered employee list
 */
export function filterEmployeesByScope(employees: Employee[], user: CurrentUser): Employee[] {
  return applyScope(employees, user);
  
  // Future enhanced version:
  // if (user.role === 'super_admin' && user.scope.cluster.length === 0) return employees;
  // const { cluster, team } = user.scope;
  // return employees.filter(emp => {
  //   const matchesCluster = cluster.length === 0 || cluster.includes(emp.cluster);
  //   const matchesTeam = team.length === 0 || team.includes(emp.team);
  //   return matchesCluster && matchesTeam;
  // });
}

/**
 * Filter attendance/training records by scope
 * 
 * Filters based on employee's cluster/team assignment
 * 
 * @param records Array of attendance/training records
 * @param employees Master employee list for lookup
 * @param user Current user with scope constraints
 * @returns Filtered records
 */
export function filterRecordsByScope<T extends Record<string, any>>(
  records: T[],
  employees: Employee[],
  user: CurrentUser
): T[] {
  return applyScope(records, user);
  
  // Future enhanced version:
  // if (user.role === 'super_admin' && user.scope.cluster.length === 0) return records;
  // const employeeMap = new Map(employees.map(e => [e.employeeId, e]));
  // const { cluster, team } = user.scope;
  // 
  // return records.filter(record => {
  //   const employee = employeeMap.get((record as any).employeeId);
  //   if (!employee) return false; // Unknown employee
  //   
  //   const matchesCluster = cluster.length === 0 || cluster.includes(employee.cluster);
  //   const matchesTeam = team.length === 0 || team.includes(employee.team);
  //   return matchesCluster && matchesTeam;
  // });
}

/**
 * Helper: Check if object has a property
 */
function hasProperty(obj: any, prop: string): boolean {
  return obj && typeof obj === 'object' && prop in obj;
}

/**
 * Get scoped access info for UI display/debugging
 * 
 * @param user Current user
 * @returns Object with scope info
 */
export function getScopeInfo(user: CurrentUser) {
  return {
    role: user.role,
    clusterFilter: user.scope.cluster.length > 0 ? user.scope.cluster : 'All',
    teamFilter: user.scope.team.length > 0 ? user.scope.team : 'All',
    isFullAccess: user.scope.cluster.length === 0 && user.scope.team.length === 0
  };
}






