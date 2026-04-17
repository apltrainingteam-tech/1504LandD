/**
 * RBAC (Role-Based Access Control) Foundation Index
 * 
 * Centralized exports for permission and scope utilities
 */

// User context
export { getCurrentUser, setUserScope, currentUser, type CurrentUser, type UserRole, type UserScope } from '../context/userContext';

// Permissions
export { can, canAll, canAny, getPermissions, ACTIONS, type Action } from './permissions';

// Scope filtering
export { applyScope, filterEmployeesByScope, filterRecordsByScope, getScopeInfo } from './scopeFilter';
