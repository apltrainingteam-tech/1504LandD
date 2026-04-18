# Firebase to MongoDB Migration Guide

## Overview
This codebase has been successfully refactored from Firebase Firestore to MongoDB using the official MongoDB Node.js driver.

## Key Changes

### 1. Dependencies Updated
- **Removed**: `firebase` (v12.6.0)
- **Added**: `mongodb` (v6.5.0) and `dotenv` (v16.3.1)

Update dependencies:
```bash
npm install
```

### 2. Database Service Layer
- **Old**: `src/services/firestoreService.ts` (Firebase Firestore)
- **New**: `src/services/mongodbService.ts` (MongoDB)

All imports have been updated to use the new MongoDB service.

### 3. Connection Handling
The MongoDB service (`mongodbService.ts`) includes:
- **Connection Management**: Lazy initialization on first use, reusable connection
- **Connection Pooling**: Automatic connection reuse across the application
- **Graceful Shutdown**: `closeConnection()` function for cleanup

### 4. Operation Mappings

| Firestore | MongoDB |
|-----------|---------|
| `collection().add()` | `insertOne()` |
| `collection().doc(id).get()` | `findOne({ _id: id })` |
| `collection().get()` | `find().toArray()` |
| `doc(id).update()` | `updateOne({ _id: id }, { $set: ... })` |
| `doc(id).delete()` | `deleteOne({ _id: id })` |
| `writeBatch()` | `bulkWrite()` |

### 5. Updated Services
The following services have been updated to use MongoDB:
- ✅ `src/services/mongodbService.ts` - Core MongoDB operations
- ✅ `src/services/attendanceService.ts` - Attendance data handling
- ✅ `src/services/attendanceUploadService.ts` - Bulk upload operations

### 6. Collection Operations
All existing collection names remain the same:
- `employees`
- `attendance`
- `training_scores`
- `training_nominations`
- `demographics`
- And all others...

### 7. ID Handling
- MongoDB uses `_id` as the primary key
- The mongodbService converts `_id` to `id` for compatibility with existing code
- Documents with a provided `id` field will be stored with that as `_id`

### 8. Async/Await Pattern
All database operations use `async/await` for consistency:
```typescript
// Example: Get all documents
const docs = await getCollection('attendance');

// Example: Insert document
const docId = await insertDocument('attendance', { /* data */ });

// Example: Update document
await upsertDoc('attendance', 'doc-id', { /* updated data */ });
```

### 9. Error Handling
- All operations include try-catch error handling
- Exponential backoff retry logic for transient failures
- Detailed logging for debugging

### 10. Batch Operations
Batch writes use MongoDB's `bulkWrite()` instead of Firestore's `writeBatch()`:
```typescript
// Multiple operations in a single batch
await addBatch('attendance', arrayOfDocuments);
```

## Environment Setup

### Step 1: Create `.env` file
Copy `.env.example` to `.env` and update with your MongoDB URI:

```bash
cp .env.example .env
```

### Step 2: Configure MongoDB URI
Edit `.env` and add your MongoDB connection string:

```env
MONGO_URI=mongodb+srv://username:password@cluster.mongodb.net/?appName=YourAppName
```

Or for local development:
```env
MONGO_URI=mongodb://localhost:27017/pharma_intelligence
```

### Step 3: Install Dependencies
```bash
npm install
```

### Step 4: Start Development Server
```bash
npm run dev
```

## Connection Details

The MongoDB connection string provided is:
```
mongodb+srv://apltrainingteam_db_user:qbaHn8Ld0hZzdUEU@cluster0.qluikx6.mongodb.net/?appName=Cluster0
```

Database name: `pharma_intelligence`

## API Reference

### Core Functions

```typescript
// Get all documents
const docs = await getCollection(collectionName: string): Promise<any[]>

// Get single document
const doc = await getDocumentById(collectionName: string, id: string): Promise<any>

// Insert document
const docId = await insertDocument(collectionName: string, data: any): Promise<string>

// Upsert document (update or insert)
await upsertDoc(collectionName: string, id: string, data: any): Promise<void>

// Delete document
await deleteDocument(collectionName: string, id: string): Promise<void>

// Batch operations
await addBatch(collectionName: string, items: any[]): Promise<void>

// Clear collection
await clearCollection(collectionName: string): Promise<void>

// Clear by field value
await clearCollectionByField(collectionName: string, field: string, value: any): Promise<number>

// Find by query
await findByQuery(collectionName: string, query: Record<string, any>): Promise<any[]>

// Update by query
await updateByQuery(collectionName: string, query: Record<string, any>, updateData: Record<string, any>): Promise<number>

// Delete by field values
await deleteRecordsByQuery(collectionName: string, field: string, values: string[]): Promise<number>

// Get database instance
const db = await getDb(): Promise<Db>

// Close connection
await closeConnection(): Promise<void>
```

## Migration Checklist

- [x] Update package.json with MongoDB driver
- [x] Remove Firebase dependencies
- [x] Create mongodbService.ts with all operations
- [x] Update attendanceService.ts to use MongoDB
- [x] Update attendanceUploadService.ts to use MongoDB
- [x] Update all component imports
- [x] Remove/backup Firebase-specific files
- [x] Create .env.example
- [x] Update documentation

## Testing

### 1. Verify Connection
Test that the MongoDB connection is working:
```bash
npm run dev
# Check console for "MongoDB connected successfully" message
```

### 2. Test Basic Operations
- Upload attendance data
- View analytics dashboards
- Create and edit demographics
- Run employee management features

### 3. Verify Data Persistence
- Restart the application
- Verify data is still available

## Troubleshooting

### Connection Errors
If you see `MongoClient not connected` errors:
1. Check `.env` file has valid MONGO_URI
2. Verify MongoDB cluster is accessible
3. Check firewall/network settings

### "Cannot find module 'mongodb'"
Run `npm install` to ensure dependencies are installed.

### Collection Not Found
MongoDB creates collections on first write. If a collection appears empty:
1. Verify you're using the correct collection name (case-sensitive)
2. Check MongoDB Atlas GUI to confirm collections exist
3. Review error logs for permission issues

## Performance Notes

- Connection pooling is handled automatically
- Bulk writes are used for batch operations to minimize round trips
- Indexes should be created in MongoDB for frequently queried fields
- Consider TTL (time-to-live) indexes for temporary data

## Security Notes

- Store MongoDB URI in `.env` file (never in source code)
- Use strong passwords for MongoDB user accounts
- Enable network access restrictions in MongoDB Atlas
- Consider IP whitelisting for production environments
- Regularly rotate credentials

## Next Steps

1. **Index Optimization**: Create MongoDB indexes for frequently queried fields
2. **Monitoring**: Set up MongoDB monitoring in Atlas console
3. **Backups**: Enable automated backups in MongoDB Atlas
4. **Schema Validation**: Consider adding MongoDB schema validation rules
5. **Performance**: Monitor slow queries and optimize indexes

## Support

For issues or questions about the MongoDB migration:
1. Review mongodbService.ts for available operations
2. Check error messages in browser console
3. Refer to MongoDB documentation: https://docs.mongodb.com/drivers/node/
