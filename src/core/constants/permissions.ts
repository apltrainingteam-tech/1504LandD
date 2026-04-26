/**
 * Permission Utility - Lightweight RBAC permission checks
 * 
 * This is a stub implementation that currently allows all actions.
 * Future: Replace logic to enforce role-based restrictions.
 */

import { CurrentUser } from '../context/userContext';

/**
 * Action constants for permission checks
 * Use these throughout the app to maintain consistency
 */
export const ACTIONS = {
  // Dashboard
  VIEW_DASHBOARD: 'view_dashboard',
  VIEW_REPORTS: 'view_reports',
  
  // Data upload
  UPLOAD_DATA: 'upload_data',
  UPLOAD_ATTENDANCE: 'upload_attendance',
  UPLOAD_NOMINATIONS: 'upload_nominations',
  
  // Employee management
  VIEW_EMPLOYEES: 'view_employees',
  EDIT_EMPLOYEE: 'edit_employee',
  DELETE_EMPLOYEE: 'delete_employee',
  
  // Training management
  VIEW_TRAININGS: 'view_trainings',
  VIEW_TRAININGVIEWER: 'view_trainings_viewer',
  
  // Eligibility
  VIEW_ELIGIBILITY: 'view_eligibility',
  EDIT_ELIGIBILITY: 'edit_eligibility',
  EDIT_ELIGIBILITY_RULES: 'edit_eligibility_rules',
  
  // Notifications
  VIEW_NOTIFICATIONS: 'view_notifications',
  MANAGE_NOTIFICATIONS: 'manage_notifications',
  
  // Gap analysis
  VIEW_GAP_ANALYSIS: 'view_gap_analysis',
  
  // System
  SEED_DATABASE: 'seed_database',
  CLEAN_DATA: 'clean_data',
  VIEW_SYSTEM_ADMIN: 'view_system_admin'
} as const;

export type Action = typeof ACTIONS[keyof typeof ACTIONS];

/**
 * Permission matrix by role
 * Future: Move to database/config for easier management
 */
const rolePermissions: Record<string, Set<Action>> = {
  super_admin: new Set(Object.values(ACTIONS)),
  
  admin: new Set([
    ACTIONS.VIEW_DASHBOARD,
    ACTIONS.VIEW_REPORTS,
    ACTIONS.UPLOAD_DATA,
    ACTIONS.UPLOAD_ATTENDANCE,
    ACTIONS.UPLOAD_NOMINATIONS,
    ACTIONS.VIEW_EMPLOYEES,
    ACTIONS.EDIT_EMPLOYEE,
    ACTIONS.VIEW_TRAININGS,
    ACTIONS.VIEW_TRAININGVIEWER,
    ACTIONS.VIEW_ELIGIBILITY,
    ACTIONS.EDIT_ELIGIBILITY,
    ACTIONS.VIEW_NOTIFICATIONS,
    ACTIONS.MANAGE_NOTIFICATIONS,
    ACTIONS.VIEW_GAP_ANALYSIS
  ]),
  
  trainer: new Set([
    ACTIONS.VIEW_DASHBOARD,
    ACTIONS.VIEW_REPORTS,
    ACTIONS.UPLOAD_DATA,
    ACTIONS.UPLOAD_ATTENDANCE,
    ACTIONS.VIEW_EMPLOYEES,
    ACTIONS.VIEW_TRAININGS,
    ACTIONS.VIEW_TRAININGVIEWER,
    ACTIONS.VIEW_NOTIFICATIONS,
    ACTIONS.VIEW_GAP_ANALYSIS
  ])
};

/**
 * Check if user has permission for an action
 * 
 * Currently: Always returns true (non-breaking)
 * Future: Check user.role against rolePermissions matrix
 * 
 * Usage:
 *   if (can(currentUser, ACTIONS.EDIT_EMPLOYEE)) {
 *     // show edit button
 *   }
 * 
 * @param user Current user
 * @param action Action to check
 * @returns true if user can perform action, false otherwise
 */
export function can(user: CurrentUser, action: Action): boolean {
  // TODO: Enable this when role enforcement is needed
  // const permissions = rolePermissions[user.role];
  // return permissions?.has(action) ?? false;
  
  // Currently: Allow all actions (non-breaking change)
  return true;
}

/**
 * Check if user has multiple permissions (AND logic)
 * 
 * @param user Current user
 * @param actions Actions to check
 * @returns true if user can perform ALL actions
 */
export function canAll(user: CurrentUser, actions: Action[]): boolean {
  return actions.every(action => can(user, action));
}

/**
 * Check if user has at least one permission (OR logic)
 * 
 * @param user Current user
 * @param actions Actions to check
 * @returns true if user can perform at least ONE action
 */
export function canAny(user: CurrentUser, actions: Action[]): boolean {
  return actions.some(action => can(user, action));
}

/**
 * Get all permissions for a user role
 * Useful for debugging and testing
 * 
 * @param role User role
 * @returns Array of permitted actions
 */
export function getPermissions(role: string): Action[] {
  return Array.from(rolePermissions[role] || []);
}






