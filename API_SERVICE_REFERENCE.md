# API Service Layer - Quick Reference

## Overview
The frontend no longer uses the MongoDB driver directly. All database operations now flow through a centralized API layer (`/src/services/apiService.ts`).

### Architecture
```
Frontend Components/Services
    ↓
apiService.ts (HTTP fetch calls)
    ↓
Backend Express API (/backend/server.ts)
    ↓
mongodbService.ts (Backend only)
    ↓
MongoDB Atlas
```

## API Service Functions

### Read Operations

```typescript
// Get entire collection
const employees = await getCollection('employees');

// Query by field value
const active = await queryByField('employees', 'status', 'active');

// Get single document by ID
const emp = await getById('employees', 'emp-123');

// Complex query
const results = await findByQuery('employees', { 
  status: 'active', 
  team: 'Sales' 
});
```

### Write Operations

```typescript
// Single insert
await createDocument('employees', {
  name: 'John',
  email: 'john@example.com'
});

// Batch insert (upserts if _id exists)
await createBatch('employees', [
  { _id: 'emp-1', name: 'John' },
  { _id: 'emp-2', name: 'Jane' }
]);

// Upsert single document
await upsertDocument('employees', 'emp-123', {
  name: 'Updated Name',
  status: 'inactive'
});

// Update by query
await updateByQuery('employees', 
  { status: 'pending' },
  { status: 'active', updatedAt: new Date() }
);
```

### Delete Operations

```typescript
// Delete single document
await deleteDocument('employees', 'emp-123');

// Delete by field value(s)
await deleteRecordsByQuery('employees', 'status', ['pending', 'inactive']);

// Clear by field value
await clearCollectionByField('employees', 'department', 'sales');

// Clear entire collection
await clearCollection('employees');
```

### Health Check

```typescript
const isOnline = await healthCheck();
```

## Environment Configuration

### Development (Default)
```
VITE_API_URL = http://localhost:5000/api
```

### Production
Create `.env`:
```
VITE_API_URL=https://api.yourserver.com/api
```

## Backend Server Setup

Make sure backend is running:
```bash
npm run dev:backend
# or
node dist/backend/server.js
```

Backend listens on: `http://localhost:5000`

## Error Handling

All functions throw on errors:
```typescript
try {
  const data = await getCollection('employees');
} catch (error) {
  console.error('API Error:', error.message);
  // Handle error appropriately
}
```

## Common Patterns

### Upload with Progress
```typescript
import { createBatch, clearCollection } from './apiService';

// Clear if replacing
if (options.mode === 'replace') {
  await clearCollection('training_data');
}

// Upload in chunks
for (const chunk of chunks) {
  await createBatch('training_data', chunk);
  updateProgress(currentCount / total);
}
```

### Master Data Loading
```typescript
// Load and cache employee data
const employees = await getCollection('employees');
const empMap = new Map(employees.map(e => [e.employeeId, e]));

// Lookup by ID
const emp = empMap.get(employeeId);
```

## Important Notes

⚠️ **DO NOT:**
- Import MongoDB driver in frontend code
- Use Node.js-only modules in React components
- Make direct database connections from browser

✅ **DO:**
- Use apiService functions for all data access
- Handle errors gracefully
- Cache data when appropriate (e.g., master data)
- Use environment variables for API URL

## Files Affected by Refactor

### Updated (Now use apiService)
- `masterDataService.ts`
- `uploadServiceStrict.ts`
- `uploadServiceEnriched.ts`

### Removed
- `src/services/mongodbService.ts` ❌ (was Frontend - Deleted)

### Unchanged
- `backend/mongodbService.ts` ✅ (Backend - Still operational)
- `backend/server.ts` ✅ (Backend API - No changes)

## Testing

### Backend Health
```bash
curl http://localhost:5000/health
```

### Get Collection
```bash
curl http://localhost:5000/api/employees
```

### Create Document
```bash
curl -X POST http://localhost:5000/api/employees \
  -H "Content-Type: application/json" \
  -d '{"data":{"name":"John"}}'
```

## Troubleshooting

### "API Error: fetch failed"
- Ensure backend is running on port 5000
- Check VITE_API_URL environment variable
- Verify CORS is configured in backend

### "Module 'util' has been externalized"
- This error is gone! ✅ No more MongoDB in frontend

### "crypto.randomBytes not available"
- This error is gone! ✅ No more Node.js modules in browser

---

**Last Updated:** April 19, 2026  
**Status:** ✅ Production Ready
