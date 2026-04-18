# Frontend-Backend Setup & Connection Guide

## ✅ What's Been Fixed

1. **Enhanced CORS Configuration**
   - Explicit CORS middleware with allowed origins
   - Supports localhost:5173 (Vite), localhost:3000 (React Dev)
   - Allows credentials and all needed HTTP methods

2. **Improved Backend Logging**
   - Clear startup message showing all URLs
   - MongoDB connection verification on startup
   - Detailed request logging middleware
   - Better error messages with context

3. **Enhanced Frontend Error Handling**
   - Detailed error logs with URL, method, and error messages
   - Backend URL displayed in error messages
   - Success logs showing how many items fetched
   - Full diagnostic information for debugging

4. **Environment Configuration**
   - Frontend: `.env.local` with `REACT_APP_API_URL`
   - Backend: `backend/.env` with `MONGO_URI` and `PORT`
   - Both preconfigured with correct development URLs

---

## 🚀 Getting Started

### Prerequisites
- Node.js v24+ installed
- MongoDB Atlas account with connection string
- Two terminal windows

### Step 1: Install Dependencies
```bash
npm install
```

### Step 2: Verify Configuration Files

**Frontend (.env.local):**
```
REACT_APP_API_URL=http://localhost:5000/api
GEMINI_API_KEY=your_key_here
```

**Backend (backend/.env):**
```
MONGO_URI=mongodb+srv://user:password@cluster.mongodb.net/?appName=Cluster0
PORT=5000
NODE_ENV=development
```

### Step 3: Start Backend Server

**Terminal 1:**
```bash
npm run dev:backend
```

**Expected Output:**
```
✅ PharmaIntel Backend Server Started Successfully

Server: http://localhost:5000
API Base: http://localhost:5000/api
Health: http://localhost:5000/health

CORS Enabled for:
• http://localhost:5173 (Vite Frontend)
• http://localhost:3000 (React Dev Server)

Database: pharma_intelligence (MongoDB)
Environment: development
Timestamp: 2024-01-01T12:00:00.000Z

Ready to accept connections!

[STARTUP] Testing MongoDB connection...
[STARTUP] ✅ MongoDB connection verified
[STARTUP] ✅ Backend fully initialized and ready
```

### Step 4: Start Frontend Server

**Terminal 2:**
```bash
npm run dev
```

**Expected Output:**
```
VITE v5.x.x  ready in xxx ms

➜  Local:   http://localhost:5173/
➜  press h to show help
```

### Step 5: Verify Everything Works

Open browser to `http://localhost:5173` and check:
1. Page loads without errors
2. Data displays in tables
3. Browser console (F12) shows logs like:
   ```
   [API] GET employees {url: "http://localhost:5000/api/employees"}
   [API] ✅ GET employees - 150 items
   ```

---

## 📡 Architecture

### Backend (Port 5000)
```
/backend
├── server.ts          # Express server with REST API
├── mongodbService.ts  # MongoDB driver & connection pool
├── .env              # Configuration (MONGO_URI, PORT)
└── tsconfig.json
```

### Frontend (Port 5173)
```
/src
├── services/
│   ├── apiClient.ts  # HTTP client to backend API
│   └── [other services using apiClient]
├── components/
├── context/
└── features/
```

### Communication Flow
```
React Component
    ↓
apiClient (fetch)
    ↓
http://localhost:5000/api/:collection
    ↓
Express Routes
    ↓
MongoDB Service
    ↓
MongoDB Atlas
```

---

## 🔍 Monitoring Connection Health

### Check Backend Health
```bash
curl http://localhost:5000/health
```

Response:
```json
{"status":"ok","timestamp":"2024-01-01T12:00:00.000Z"}
```

### Check API Endpoint
```bash
curl http://localhost:5000/api/employees
```

Response:
```json
{"success":true,"data":[...employee records...]}
```

### Browser Console Monitoring
Open DevTools (F12) → Console tab to see:
- `[API] GET ...` - Request initiated
- `[API] ✅ GET ...` - Success with count
- `[API ERROR]` - Failure with details

---

## 🐛 Troubleshooting

### Issue: "Failed to fetch" in Browser Console

**Step 1: Verify Backend Running**
```bash
# Terminal 1 should show: "✅ PharmaIntel Backend Server Started Successfully"
# If not, backend is not running
```

**Step 2: Test Health Endpoint**
```bash
curl http://localhost:5000/health
```
If this fails, backend port is blocked or not running.

**Step 3: Check Environment Variables**
```bash
# Verify backend/.env has MONGO_URI set
cat backend/.env

# Verify frontend can access it
echo $REACT_APP_API_URL  # Should show: http://localhost:5000/api
```

**Step 4: Check Console for Errors**
Browser console (F12) should show detailed error:
```
[API ERROR] Failed to fetch collection "employees"
  URL: http://localhost:5000/api/employees
  Method: GET
  Error: [specific error message]
```

### Issue: MongoDB Connection Failed

**Symptoms:** Backend starts but shows:
```
[STARTUP] ❌ MongoDB connection failed
```

**Fixes:**
1. Verify `MONGO_URI` in `backend/.env` is correct
2. Check MongoDB Atlas network access:
   - Go to: Security → Network Access
   - Add your IP or 0.0.0.0 for development
3. Test connection directly:
   ```bash
   mongosh "mongodb+srv://..."
   ```

### Issue: CORS Error

**Error:** "Access to XMLHttpRequest blocked by CORS policy"

**Fix:** Already configured in backend/server.ts, but verify:
```typescript
const corsOptions = {
  origin: ['http://localhost:5173', 'http://localhost:3000'],
  credentials: true,
  methods: ['GET', 'POST', 'PUT', 'DELETE', 'PATCH', 'OPTIONS'],
};
app.use(cors(corsOptions));
```

### Issue: Port Already in Use

**Error:** "EADDRINUSE: address already in use :::5000"

**Fix:**
```bash
# Windows: Find and kill process
netstat -ano | findstr :5000
taskkill /PID <PID> /F

# Then restart
npm run dev:backend
```

---

## 📝 Available npm Scripts

```bash
# Start backend only
npm run dev:backend

# Start frontend only  
npm run dev

# Start both backend and frontend
npm run dev:all

# Build for production
npm build

# Build backend
npm run build:backend

# Preview production build
npm preview

# Start production backend
npm start
```

---

## 📚 File Reference

| File | Purpose | Key Config |
|------|---------|-----------|
| `backend/server.ts` | Express API server | PORT, CORS origins |
| `backend/mongodbService.ts` | MongoDB driver | MONGO_URI |
| `backend/.env` | Backend config | MONGO_URI, PORT |
| `src/services/apiClient.ts` | Frontend HTTP client | API_BASE_URL |
| `.env.local` | Frontend config | REACT_APP_API_URL |

---

## ✨ Features

- ✅ Separated frontend and backend architecture
- ✅ REST API communication with Express
- ✅ MongoDB Atlas connection with connection pooling
- ✅ CORS enabled for frontend development
- ✅ Detailed logging for debugging
- ✅ Graceful shutdown handlers
- ✅ Error handling at all layers
- ✅ Health check endpoint
- ✅ Support for all CRUD operations
- ✅ Batch operations support

---

## 🎯 Next Steps

1. **Verify Backend Running:** Check Terminal 1 for success message
2. **Verify Frontend Running:** Check Terminal 2 for Vite server
3. **Test Data Loading:** Check browser for tables with data
4. **Monitor Console:** Watch browser console for API logs
5. **Review Logs:** Check both terminal outputs for any errors

If you see any errors, refer to the troubleshooting section above.

---

**Last Updated:** 2024-01-01
**Backend URL:** http://localhost:5000
**Frontend URL:** http://localhost:5173
**Database:** pharma_intelligence (MongoDB Atlas)
