/**
 * User Context - Centralized user object for RBAC foundation
 * 
 * This is a lightweight foundation for future multi-user support.
 * Currently hardcoded as super_admin, but ready for role-based scaling.
 */

export type UserRole = 'super_admin' | 'admin' | 'trainer';

export interface UserScope {
  cluster: string[];  // e.g., ["Cardiac", "Neuro"]
  team: string[];     // e.g., ["Revance", "Sales"]
}

export interface CurrentUser {
  id?: string;
  name?: string;
  role: UserRole;
  scope: UserScope;
  email?: string;
}

/**
 * Current user object - hardcoded for now, will be replaced with auth system
 * 
 * Roles:
 * - super_admin: Full access to all features and data
 * - admin: Full feature access, scoped data by cluster/team
 * - trainer: Limited feature access, scoped data by assigned cluster/team
 */
export const currentUser: CurrentUser = {
  id: 'user-001',
  name: 'System Admin',
  role: 'super_admin',
  scope: {
    cluster: [], // Empty means access to all clusters
    team: []     // Empty means access to all teams
  },
  email: 'admin@ajantapharma.local'
};

/**
 * Get current user (can be replaced with auth provider later)
 */
export function getCurrentUser(): CurrentUser {
  return currentUser;
}

/**
 * Update user scope (for future auth implementation)
 */
export function setUserScope(scope: Partial<UserScope>): void {
  Object.assign(currentUser.scope, scope);
}
