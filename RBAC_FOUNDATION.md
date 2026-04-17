# RBAC Foundation Layer Documentation

## 🎯 Overview

This document describes the lightweight **Role-Based Access Control (RBAC)** foundation layer added to the Ajanta Pharma Intelligence application. This is an **architectural enhancement** that prepares the codebase for future multi-user support without changing any existing functionality.

---

## 📁 File Structure

```
src/
├── context/
│   └── userContext.ts          # Current user object & type definitions
├── utils/
│   ├── permissions.ts          # Permission checking & action constants
│   ├── scopeFilter.ts          # Scope-based data filtering stubs
│   └── rbac.ts                 # Centralized exports (index)
```

---

## 🔑 Key Components

### 1. User Context (`userContext.ts`)

**Purpose:** Centralized user object representing the current logged-in user.

```typescript
import { currentUser, getCurrentUser, setUserScope } from './context/userContext';

// Access current user
const user = getCurrentUser();
console.log(user.role);  // 'super_admin'
console.log(user.scope); // { cluster: [], team: [] }

// Update scope (for future auth)
setUserScope({ cluster: ['Cardiac', 'Neuro'] });
```

**Current State:**
- Hardcoded as `super_admin` with full scope access
- Ready to be replaced with JWT/auth provider later

**Types:**
```typescript
type UserRole = 'super_admin' | 'admin' | 'trainer';

interface CurrentUser {
  id?: string;
  name?: string;
  role: UserRole;
  scope: { cluster: string[]; team: string[] };
  email?: string;
}
```

---

### 2. Permissions (`permissions.ts`)

**Purpose:** Permission checking and action constants.

**Features:**
- Action constants for consistency across codebase
- Permission matrix by role (for future enforcement)
- Helper functions: `can()`, `canAll()`, `canAny()`

**Usage:**

```typescript
import { can, canAll, ACTIONS, getCurrentUser } from '@/utils/rbac';

const user = getCurrentUser();

// Check single permission
if (can(user, ACTIONS.UPLOAD_DATA)) {
  // Show upload button
}

// Check multiple permissions (AND)
if (canAll(user, [ACTIONS.UPLOAD_DATA, ACTIONS.EDIT_EMPLOYEE])) {
  // User has all permissions
}

// Check at least one permission (OR)
if (canAny(user, [ACTIONS.EDIT_EMPLOYEE, ACTIONS.DELETE_EMPLOYEE])) {
  // User can edit OR delete
}
```

**Available Actions:**
```javascript
ACTIONS = {
  VIEW_DASHBOARD,
  VIEW_REPORTS,
  UPLOAD_DATA,
  UPLOAD_ATTENDANCE,
  UPLOAD_NOMINATIONS,
  VIEW_EMPLOYEES,
  EDIT_EMPLOYEE,
  DELETE_EMPLOYEE,
  VIEW_TRAININGS,
  VIEW_TRAININGVIEWER,
  VIEW_ELIGIBILITY,
  EDIT_ELIGIBILITY,
  EDIT_ELIGIBILITY_RULES,
  VIEW_NOTIFICATIONS,
  MANAGE_NOTIFICATIONS,
  VIEW_GAP_ANALYSIS,
  SEED_DATABASE,
  CLEAN_DATA,
  VIEW_SYSTEM_ADMIN
}
```

**Current Behavior:**
- All `can()` checks return `true` (non-breaking)
- Permission matrix defined but disabled

**Future Enhancement:**
Uncomment the enforcement logic in `can()` function to activate role-based restrictions:
```typescript
export function can(user: CurrentUser, action: Action): boolean {
  const permissions = rolePermissions[user.role];
  return permissions?.has(action) ?? false;
}
```

---

### 3. Scope Filtering (`scopeFilter.ts`)

**Purpose:** Centralized data filtering based on user scope (cluster/team).

**Functions:**
- `applyScope(data, user)` - Generic scope filtering
- `filterEmployeesByScope(employees, user)` - Employee-specific
- `filterRecordsByScope(records, employees, user)` - Attendance/Training-specific
- `getScopeInfo(user)` - Debug info

**Usage:**

```typescript
import { applyScope, getCurrentUser } from '@/utils/rbac';

const user = getCurrentUser();
const allEmployees = await getCollection('employees');

// Apply scope filter (currently returns all data)
const scopedEmployees = applyScope(allEmployees, user);

// Later: will filter by user.scope.cluster and user.scope.team
```

**Current Behavior:**
- Returns data unchanged (non-breaking)
- Filters are stubbed with TODO comments

**Future Enhancement:**
Uncomment the filter logic in `applyScope()` to activate scope-based filtering.

---

## 🚀 Implementation Strategy

### Phase 1: Foundation (CURRENT)
✅ Create user context
✅ Create permission stubs  
✅ Create scope filter stubs
✅ No behavior changes

### Phase 2: Auth Integration (FUTURE)
- Replace hardcoded `currentUser` with JWT/auth provider
- Populate `user.role` and `user.scope` from auth system

### Phase 3: Permission Enforcement (FUTURE)
- Uncomment `can()` permission check logic
- Hide/disable UI elements based on permissions
- Return 403 on unauthorized API calls

### Phase 4: Scope Enforcement (FUTURE)
- Uncomment `applyScope()` filtering logic
- Filter all data queries by user scope
- Apply scoped aggregation in dashboards

---

## 💡 Integration Points

### Where to Use Permissions

1. **Component-level UI hiding:**
```typescript
import { can, ACTIONS, getCurrentUser } from '@/utils/rbac';

function EmployeeForm() {
  const user = getCurrentUser();
  
  return (
    <>
      {can(user, ACTIONS.EDIT_EMPLOYEE) && (
        <button>Edit Employee</button>
      )}
    </>
  );
}
```

2. **Feature protection:**
```typescript
async function handleUpload() {
  if (!can(currentUser, ACTIONS.UPLOAD_DATA)) {
    alert('You do not have upload permission');
    return;
  }
  // Existing upload logic
}
```

### Where to Use Scope Filters

1. **Data loading:**
```typescript
const allAttendance = await getCollection('attendance');
const scopedAttendance = applyScope(allAttendance, currentUser);
setAtt(scopedAttendance);
```

2. **Before aggregation:**
```typescript
const filteredEmployees = filterEmployeesByScope(employees, currentUser);
const stats = calculateStats(filteredEmployees);
```

---

## 🎭 Role Definitions

### Super Admin
- Full access to all features
- Can access all data across all clusters and teams
- Scope: `{ cluster: [], team: [] }` (empty = all)

### Admin
- Full feature access
- Scoped access to specific clusters/teams
- Can manage eligibility rules
- Cannot seed/clean database

### Trainer
- Limited features (view, upload, notifications)
- Scoped access to assigned cluster/team
- Cannot manage employees or eligibility

---

## ✋ Non-Breaking Guarantees

This RBAC foundation **maintains 100% backward compatibility:**

1. ✅ All `can()` calls return `true`
2. ✅ All `applyScope()` calls return original data
3. ✅ No UI changes
4. ✅ No data output changes
5. ✅ All features work exactly as before

---

## 🧪 Testing

### Verify No Breaking Changes
```typescript
import { can, canAll, applyScope, getCurrentUser, ACTIONS } from '@/utils/rbac';

const user = getCurrentUser();
const testData = [{ id: 1 }, { id: 2 }];

// These should all pass (non-breaking)
console.assert(can(user, ACTIONS.VIEW_DASHBOARD) === true);
console.assert(canAll(user, [ACTIONS.VIEW_DASHBOARD, ACTIONS.UPLOAD_DATA]) === true);
console.assert(applyScope(testData, user).length === testData.length);
```

---

## 📋 Migration Checklist

When enabling full RBAC enforcement:

- [ ] Uncomment `can()` permission check in `permissions.ts`
- [ ] Uncomment `applyScope()` filters in `scopeFilter.ts`
- [ ] Update `App.tsx` to apply filters in `loadAll()`
- [ ] Add permission checks in upload handlers
- [ ] Update Dashboard to show scoped data only
- [ ] Test all roles with different scopes
- [ ] Update component UI with permission guards

---

## 📞 Support

For questions or to extend RBAC:

1. **Add new action:** Add to `ACTIONS` constant in `permissions.ts`
2. **Add new role:** Update `rolePermissions` matrix in `permissions.ts`
3. **Change default user:** Modify `currentUser` in `userContext.ts`
4. **Enable permissions:** Uncomment enforcement logic in `can()`
5. **Enable filtering:** Uncomment filtering logic in `applyScope()`

---

**Status:** ✅ Foundation ready for role-based scaling  
**Next Step:** Integrate authentication provider and enable enforcement
