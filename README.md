# Pharma Intelligence Training System (PharmaIntel)

PharmaIntel is a Decision Intelligence Engine designed to streamline field training ingestion, processing, and analytical reporting for pharmaceutical field teams.

## Architecture Overview
- **Frontend**: React 19 (Vite) + TypeScript
- **Backend**: Express.js (Node.js) with REST API
- **Database**: MongoDB Atlas
- **Communication**: HTTP/REST API (CORS enabled)
- **Styling**: Vanilla CSS (Premium Dark Mode)
- **Data Engine**: Modular services and utilities for Excel parsing, score normalization, and weighted analytics.
- **Reporting**: Intelligence modules for Rank Performance, Time-Series trends, and Gap Analysis.

## Quick Start

### Prerequisites
- Node.js (v24+)
- npm
- MongoDB Atlas account

### Setup & Run

1. **Install dependencies:**
   ```bash
   npm install
   ```

2. **Configure environment:**
   ```bash
   cp backend/.env.example backend/.env
   # Edit backend/.env with your MongoDB URI
   ```

3. **Run both backend and frontend (two terminals):**
   
   **Terminal 1 - Backend:**
   ```bash
   npm run dev:backend
   ```
   
   **Terminal 2 - Frontend:**
   ```bash
   npm run dev
   ```

4. **Open browser:**
   Navigate to `http://localhost:5173` (frontend)
   Backend runs on `http://localhost:5000`

## Features
- **Attendance Portal**: Drag-and-drop Excel upload with automated mapping and validation.
- **Trainings Viewer**: Detailed search and historical records for IP, AP, and MIP training types.
- **Intelligence Engine**: 
    - **Grouped Analytics**: Real-time performance ranking by Team, Cluster, or Month.
    - **Trend Analysis**: Heatmapped time-series metrics.
    - **Gap Analysis**: Automated identification of untrained eligible employees.

## Architecture Documentation

- **Backend Architecture**: See [BACKEND_ARCHITECTURE.md](BACKEND_ARCHITECTURE.md) for detailed backend setup and API endpoints
- **MongoDB Migration**: See [MONGODB_MIGRATION.md](MONGODB_MIGRATION.md) for migration details from Firebase to MongoDB
- **Performance**: See [PERFORMANCE_OPTIMIZATION.md](PERFORMANCE_OPTIMIZATION.md) for frontend optimizations

## Available Scripts

**Frontend:**
- `npm run dev` - Start Vite dev server (port 5173)
- `npm run build` - Build frontend for production
- `npm run preview` - Preview production build

**Backend:**
- `npm run dev:backend` - Start backend with auto-reload (port 5000)
- `npm run build:backend` - Build backend for production
- `npm start` - Run production backend

**Combined:**
- `npm run dev:all` - Run both frontend and backend (Linux/Mac only)

## Project Structure

```
.
├── backend/                    # Express.js backend server
│   ├── mongodbService.ts      # MongoDB operations
│   ├── server.ts              # Express app & routes
│   ├── .env.example           # Environment template
│   └── tsconfig.json          # Backend TypeScript config
├── src/                        # React frontend
│   ├── services/
│   │   ├── apiClient.ts       # API client for backend calls
│   │   ├── attendanceService.ts
│   │   ├── attendanceUploadService.ts
│   │   └── ...
│   ├── components/            # React components
│   ├── features/              # Feature modules
│   ├── App.tsx
│   └── main.tsx
├── package.json               # Dependencies
├── tsconfig.json              # Frontend TypeScript config
├── vite.config.ts             # Vite configuration
└── README.md
```

## Version Control Workflow
- `main`: Stable production-ready code.
- `dev`: Active development and integration.
- `feature/*`: Specific feature development (e.g., `feature/upload-engine`).

## Deployment

### Frontend Deployment
Deploy the `dist/` folder to Vercel, Netlify, or your static hosting:
```bash
npm run build
```

### Backend Deployment
Deploy to Node.js hosting (Railway, Heroku, AWS, etc.):
```bash
npm run build:backend
# Deploy dist/backend/server.js
```

Update `VITE_API_URL` environment variable in frontend to point to production backend.

## Support

For issues, questions, or contributions, please refer to the detailed documentation files:
- Backend: [BACKEND_ARCHITECTURE.md](BACKEND_ARCHITECTURE.md)
- Database: [MONGODB_MIGRATION.md](MONGODB_MIGRATION.md)
- Performance: [PERFORMANCE_OPTIMIZATION.md](PERFORMANCE_OPTIMIZATION.md)

---
Designed for maximum efficiency and decision intelligence.
