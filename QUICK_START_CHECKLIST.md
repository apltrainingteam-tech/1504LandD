# Quick Verification Checklist

## Before Starting

- [ ] Node.js v24+ installed
- [ ] MongoDB Atlas account with connection string
- [ ] Two terminal windows ready

---

## Step-by-Step Verification

### Terminal 1: Start Backend
```bash
npm run dev:backend
```

**Look for this output:**
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

[STARTUP] Testing MongoDB connection...
[STARTUP] ✅ MongoDB connection verified
[STARTUP] ✅ Backend fully initialized and ready
```

**If you don't see this:**
- ❌ Check if port 5000 is already in use: `netstat -ano | findstr :5000`
- ❌ Check backend/.env has MONGO_URI set
- ❌ Verify MongoDB Atlas network access settings

---

### Terminal 2: Start Frontend
```bash
npm run dev
```

**Look for this output:**
```
VITE v5.x.x  ready in xxx ms

➜  Local:   http://localhost:5173/
➜  press h to show help
```

---

### Browser: Verify Connection
1. Open `http://localhost:5173` in browser
2. Press `F12` to open Developer Tools
3. Go to **Console** tab
4. Look for logs like:
   ```
   [API] GET employees {url: "http://localhost:5000/api/employees"}
   [API] ✅ GET employees - 150 items
   ```

**Success:** Data displays in tables without errors  
**Failure:** See console errors below

---

## Console Errors & Solutions

### Error: "Failed to fetch"
```
[API ERROR] Failed to fetch collection "employees"
  URL: http://localhost:5000/api/employees
  Method: GET
  Error: Failed to fetch
```

**Causes:**
1. Backend not running (Terminal 1)
2. Backend crashed on startup
3. Port 5000 blocked by firewall

**Fix:**
```bash
# Check backend is running in Terminal 1
# Look for: "✅ Backend fully initialized and ready"

# If not running, restart:
npm run dev:backend
```

### Error: "HTTP 404"
```
[API ERROR] Failed to fetch collection "employees"
  Error: HTTP 404: Not Found
```

**Cause:** API route doesn't exist or collection name wrong

**Fix:**
```bash
# Verify collection exists
curl http://localhost:5000/api/employees

# Check backend/server.ts for route definitions
# Compare collection names in error
```

### Error: "CORS error"
```
Access to XMLHttpRequest blocked by CORS policy
No 'Access-Control-Allow-Origin' header
```

**Fix:**
- Check `backend/server.ts` has: `app.use(cors(corsOptions));`
- Verify CORS includes `http://localhost:5173`

### Error: "MongoDB connection failed"
```
[STARTUP] ❌ MongoDB connection failed
[STARTUP] Backend started but database operations will fail
```

**Fix:**
1. Check `backend/.env` has valid MONGO_URI
2. Go to MongoDB Atlas:
   - Security → Network Access
   - Add your IP or 0.0.0.0
3. Verify username/password in connection string

---

## Detailed Diagnostics

### Test Backend Health
```bash
curl http://localhost:5000/health
```

**Expected response:**
```json
{"status":"ok","timestamp":"2024-01-01T12:00:00.000Z"}
```

**If fails:** Backend not running or port blocked

### Test API Endpoint
```bash
curl http://localhost:5000/api/employees
```

**Expected response:**
```json
{"success":true,"data":[...]}
```

**If fails:** Check MongoDB connection

### Check Configuration Files

**Frontend (.env.local):**
```bash
cat .env.local
```

Should contain:
```
REACT_APP_API_URL=http://localhost:5000/api
```

**Backend (backend/.env):**
```bash
cat backend/.env
```

Should contain:
```
MONGO_URI=mongodb+srv://...
PORT=5000
NODE_ENV=development
```

---

## What Was Fixed

### 1. Backend (server.ts)
✅ Enhanced CORS configuration with explicit origins
✅ Detailed startup logging showing all URLs
✅ MongoDB connection verification on startup
✅ Improved error messages with full context
✅ Request logging middleware
✅ Graceful error handling

### 2. Frontend (apiClient.ts)
✅ Absolute URLs using http://localhost:5000/api
✅ Detailed error logging with URL and method
✅ Success logs showing item counts
✅ Backend URL displayed in error messages
✅ All functions enhanced with diagnostics
✅ Proper try-catch error handling

### 3. Configuration
✅ Frontend: .env.local with API_URL
✅ Backend: backend/.env with MONGO_URI
✅ CORS enabled for both localhost:5173 and localhost:3000

### 4. Documentation
✅ CONNECTION_TROUBLESHOOTING.md - Common issues & fixes
✅ FRONTEND_BACKEND_SETUP.md - Complete setup guide
✅ This checklist - Quick verification steps

---

## Success Indicators

- [x] Backend starts without errors
- [x] Frontend loads at localhost:5173
- [x] No "Failed to fetch" errors
- [x] Console shows [API] logs
- [x] Console shows ✅ success messages
- [x] Tables display data
- [x] Both terminals show no errors

---

## Files Modified

| File | Changes |
|------|---------|
| `backend/server.ts` | CORS, logging, MongoDB test |
| `backend/.env` | Created with MONGO_URI |
| `src/services/apiClient.ts` | Enhanced error logging, absolute URLs |
| `.env.local` | Added REACT_APP_API_URL |
| `CONNECTION_TROUBLESHOOTING.md` | Created - troubleshooting guide |
| `FRONTEND_BACKEND_SETUP.md` | Created - complete setup guide |

---

## Next Steps

1. **Start Backend:** `npm run dev:backend` in Terminal 1
2. **Start Frontend:** `npm run dev` in Terminal 2
3. **Open Browser:** http://localhost:5173
4. **Check Console:** F12 → Console tab
5. **Verify Data:** Tables should load with data
6. **Check Terminal Logs:** Both should show no errors

---

## Still Having Issues?

1. Check `CONNECTION_TROUBLESHOOTING.md` for common issues
2. Check `FRONTEND_BACKEND_SETUP.md` for architecture details
3. Verify both servers running with status messages
4. Use curl to test API endpoints directly
5. Check browser console for detailed error messages
6. Ensure MongoDB Atlas network access is configured

---

**Setup Time:** ~2 minutes  
**Debugging Time:** 5-10 minutes depending on issues  
**Status:** Ready to develop! 🚀
