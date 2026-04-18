# Connection Troubleshooting Guide

## Quick Start

### Terminal 1: Start Backend Server
```bash
npm run dev:backend
```

You should see:
```
✅ PharmaIntel Backend Server Started Successfully

Server: http://localhost:5000
API Base: http://localhost:5000/api
Health: http://localhost:5000/health
```

### Terminal 2: Start Frontend Development Server
```bash
npm run dev
```

You should see Vite starting on `http://localhost:5173`

---

## Verification Steps

### Step 1: Verify Backend is Running
Run this in a new terminal:
```bash
curl http://localhost:5000/health
```

Expected response:
```json
{"status":"ok","timestamp":"2024-01-01T12:00:00.000Z"}
```

### Step 2: Test API Connection
```bash
curl http://localhost:5000/api/employees
```

Expected response (with data):
```json
{"success":true,"data":[...]}
```

### Step 3: Check Frontend Console
1. Open browser DevTools (F12)
2. Go to Console tab
3. Should see logs like:
   ```
   [API] GET employees {url: "http://localhost:5000/api/employees"}
   [API] ✅ GET employees - 150 items
   ```

---

## Common Issues & Fixes

### Issue 1: "Failed to fetch"
**Possible causes:**
1. Backend not running on port 5000
2. CORS configuration issue
3. MongoDB connection string invalid

**Fix:**
```bash
# Terminal 1: Ensure backend starts without errors
npm run dev:backend

# Check for errors in terminal output
# Look for: "Connected to MongoDB" and "✅ Running on port 5000"
```

### Issue 2: HTTP 404 Error
**Possible causes:**
- API route not matching
- Wrong collection name

**Fix:**
- Verify collection names match: employees, attendance, training_scores, etc.
- Check backend route definitions in `backend/server.ts`

### Issue 3: CORS Error (No 'Access-Control-Allow-Origin')
**Fix:**
- Check `backend/server.ts` has `app.use(cors());` before routes
- Verify CORS origins include `http://localhost:5173`

### Issue 4: MongoDB Connection Error
**Possible causes:**
- MONGO_URI not set in `backend/.env`
- Invalid connection string
- Network access not allowed in MongoDB Atlas

**Fix:**
```bash
# 1. Verify backend/.env exists and has MONGO_URI
cat backend/.env

# 2. Check MongoDB Atlas:
#    - Go to Database Access → Users
#    - Go to Network Access → IP Whitelist
#    - Add your IP or 0.0.0.0 (less secure)
```

### Issue 5: Port 5000 Already in Use
**Error:** "Error: listen EADDRINUSE: address already in use :::5000"

**Fix:**
```bash
# Windows: Find process using port 5000
netstat -ano | findstr :5000

# Kill the process (replace PID)
taskkill /PID <PID> /F

# Then restart backend:
npm run dev:backend
```

---

## Console Logs Reference

### Successful API Call Logs
```
[API] GET employees {url: "http://localhost:5000/api/employees"}
[API] ✅ GET employees - 150 items
```

### Error Logs
```
[API ERROR] Failed to fetch collection "employees"
  URL: http://localhost:5000/api/employees
  Method: GET
  Error: Failed to fetch
  Backend URL: http://localhost:5000/api
```

---

## Environment Configuration

### Frontend (.env.local)
```
REACT_APP_API_URL=http://localhost:5000/api
GEMINI_API_KEY=your_api_key
```

### Backend (backend/.env)
```
MONGO_URI=mongodb+srv://user:password@cluster.mongodb.net/?appName=Cluster0
PORT=5000
NODE_ENV=development
```

---

## Testing with curl

### Get all employees
```bash
curl http://localhost:5000/api/employees
```

### Get single employee
```bash
curl http://localhost:5000/api/employees/<ID>
```

### Get attendance data
```bash
curl http://localhost:5000/api/attendance
```

### Check backend health
```bash
curl http://localhost:5000/health
```

---

## Debug Checklist

- [ ] Backend server running on port 5000
- [ ] Frontend server running on port 5173
- [ ] Console shows API logs (not errors)
- [ ] MongoDB connection successful
- [ ] CORS enabled in backend
- [ ] `.env` files created with correct URLs
- [ ] No "Failed to fetch" errors
- [ ] Data loading in UI

---

## Need More Help?

1. Check backend console for MongoDB connection errors
2. Check browser console (F12) for fetch errors
3. Use curl to test API endpoints directly
4. Verify both servers are running in separate terminals
5. Ensure ports 5000 and 5173 are not blocked by firewall
