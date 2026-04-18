# Backend Architecture - MongoDB to REST API Migration

## Overview

The PharmaIntel backend has been restructured to use a REST API pattern. All MongoDB operations now run on a Node.js/Express server, while the frontend communicates via HTTP requests.

### Architecture Diagram
```
┌─────────────────────────────────────────────┐
│        React Frontend (Vite)                │
│  ├── src/services/apiClient.ts              │
│  └── Fetch calls to http://localhost:5000   │
└──────────────────┬──────────────────────────┘
                   │ HTTP Requests
                   ↓
┌──────────────────────────────────────────────┐
│    Express Backend Server (Port 5000)        │
│  ├── backend/server.ts                       │
│  ├── backend/mongodbService.ts               │
│  └── REST API endpoints                      │
└──────────────────┬───────────────────────────┘
                   │ MongoDB Driver
                   ↓
         ┌─────────────────────┐
         │   MongoDB Atlas     │
         │   Cluster           │
         └─────────────────────┘
```

## Backend Setup

### 1. Install Dependencies
```bash
npm install
```

This installs all dependencies including backend packages:
- `express`: Web framework
- `cors`: Cross-origin request handling
- `dotenv`: Environment variable management
- `mongodb`: MongoDB driver
- `tsx`: TypeScript executor for development

### 2. Configure Environment

Create `.env` file in the backend directory:
```bash
cp backend/.env.example backend/.env
```

Edit `backend/.env`:
```env
MONGO_URI=mongodb+srv://apltrainingteam_db_user:qbaHn8Ld0hZzdUEU@cluster0.qluikx6.mongodb.net/?appName=Cluster0
PORT=5000
NODE_ENV=development
```

### 3. Run Backend Server

**Development mode (with auto-reload):**
```bash
npm run dev:backend
```

**Production mode:**
```bash
npm run build:backend
npm start
```

## Running Frontend and Backend Together

### Option 1: Two Terminal Windows (Recommended for Development)
**Terminal 1 - Backend:**
```bash
npm run dev:backend
```

**Terminal 2 - Frontend:**
```bash
npm run dev
```

### Option 2: Single Command (Linux/Mac only)
```bash
npm run dev:all
```

### Expected Output
- **Backend**: `PharmaIntel Backend Server running on port 5000`
- **Frontend**: `VITE v6.2.0 ready in 500 ms`

## API Endpoints

The backend provides RESTful endpoints at `http://localhost:5000/api/:collection`

### GET Endpoints

**Fetch entire collection:**
```bash
GET /api/:collection
```
Returns all documents in the collection.

**Fetch with field filter:**
```bash
GET /api/:collection?field=trainingType&value=IP
```
Returns documents where field matches value (client-side filtered).

**Fetch single document:**
```bash
GET /api/:collection/:id
```
Returns document by ID.

### POST Endpoints

**Insert single document:**
```bash
POST /api/:collection
Body: { "data": { /* document */ } }
```

**Batch insert multiple documents:**
```bash
POST /api/:collection
Body: { "batch": true, "items": [ /* documents */ ] }
```

**Upsert (insert or update):**
```bash
POST /api/:collection
Body: { "upsert": true, "id": "doc-id", "data": { /* document */ } }
```

**Query by filter:**
```bash
POST /api/:collection/query
Body: { "query": { "field": "value" } }
```

### PUT Endpoints

**Update single document:**
```bash
PUT /api/:collection/:id
Body: { "data": { /* updated data */ } }
```

### PATCH Endpoints

**Update multiple documents:**
```bash
PATCH /api/:collection
Body: { "query": { /* filter */ }, "updateData": { /* updates */ } }
```

### DELETE Endpoints

**Delete single document:**
```bash
DELETE /api/:collection/:id
```

**Delete multiple by field values:**
```bash
DELETE /api/:collection?field=trainingType&values=IP,AP,MIP
```

**Clear collection by field:**
```bash
DELETE /api/:collection?clearByField=true&field=trainingType&value=IP
```

**Clear entire collection:**
```bash
DELETE /api/:collection?clear=true
```

## Frontend API Client

Located in `src/services/apiClient.ts`, this provides a convenient wrapper for backend calls:

```typescript
import { getCollection, insertDocument, upsertDoc } from './services/apiClient';

// Fetch collection
const employees = await getCollection('employees');

// Insert document
const id = await insertDocument('employees', { name: 'John' });

// Upsert document
await upsertDoc('employees', 'emp-001', { name: 'John', status: 'active' });
```

## Collection Names

All collection names remain unchanged from the original setup:
- `employees`
- `attendance`
- `training_scores`
- `training_nominations`
- `demographics`
- And others...

## Error Handling

The backend includes:
- **Try-catch** in all endpoints
- **Exponential backoff retry logic** for transient failures
- **Comprehensive error logging**
- **Proper HTTP status codes** in responses

Example error response:
```json
{
  "success": false,
  "error": "Failed to fetch collection: Connection timeout"
}
```

## Monitoring

### Backend Logs
When running the backend, you'll see logs like:
```
[2024-04-18] GET /api/attendance
[2024-04-18] POST /api/training_scores (batch)
[2024-04-18] DELETE /api/attendance (clearByField)
```

### Health Check
Check if backend is running:
```bash
curl http://localhost:5000/health
# Returns: { "status": "ok", "timestamp": "..." }
```

## Building for Production

### Backend Build
```bash
npm run build:backend
```
Creates `dist/backend/` with compiled JavaScript.

### Frontend Build
```bash
npm run build
```
Creates `dist/` with optimized React bundle.

### Deploy
1. Build both parts: `npm run build && npm run build:backend`
2. Deploy `dist/` to static hosting (Vercel, Netlify, etc.)
3. Deploy `dist/backend/server.js` to Node.js server (Heroku, Railway, etc.)
4. Update frontend API endpoint to production backend URL

## Troubleshooting

### Backend won't start
**Error:** `EADDRINUSE: address already in use :::5000`
- Kill process on port 5000: `lsof -ti:5000 | xargs kill -9` (macOS/Linux)
- Or change PORT in `.env`

**Error:** `MONGO_URI environment variable not found`
- Ensure `backend/.env` exists with `MONGO_URI` set

### Frontend can't reach backend
**Error:** `Failed to fetch from http://localhost:5000`
- Confirm backend is running on port 5000
- Check CORS is enabled (it is by default)
- Verify MongoDB connection works

### Data not persisting
- Check MongoDB Atlas credentials in `.env`
- Ensure network access is allowed in MongoDB Atlas
- Check browser console for API errors

## Performance Notes

- **Connection Pooling**: Backend maintains single MongoDB connection
- **Batch Operations**: Bulk writes reduce round trips
- **Retry Logic**: Automatic retry with exponential backoff
- **CORS Headers**: Enabled for frontend development

## Security Notes

For production:
- Move `MONGO_URI` to secure environment (don't commit `.env`)
- Use MongoDB IP whitelisting
- Add authentication middleware to backend endpoints
- Use HTTPS for frontend-backend communication
- Implement rate limiting
- Add API key validation

## Next Steps

1. Test all endpoints with Postman/cURL
2. Set up monitoring (APM tools)
3. Configure logging aggregation
4. Set up CI/CD pipeline
5. Plan database indexing strategy
6. Implement caching layer if needed
