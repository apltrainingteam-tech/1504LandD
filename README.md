# Pharma Intelligence Training System (PharmaIntel)

PharmaIntel is a Decision Intelligence Engine designed to streamline field training ingestion, processing, and analytical reporting for pharmaceutical field teams.

## Architecture Overview
- **Core**: React 19 (Vite)
- **Database**: Firebase Firestore
- **Styling**: Vanilla CSS (Premium Dark Mode)
- **Data Engine**: Modular services and utilities for Excel parsing, score normalization, and weighted analytics.
- **Reporting**: Intelligence modules for Rank Performance, Time-Series trends, and Gap Analysis.

## Setup Instructions

### Prerequisites
- Node.js (v24+)
- npm

### Installation
1. Clone the repository:
   ```bash
   git clone https://github.com/apltrainingteam-tech/pharma-train-intelligence.git
   cd pharma-train-intelligence
   ```
2. Install dependencies:
   ```bash
   npm install
   ```
3. Configure environment variables:
   - Create a `.env` file in the root directory.
   - Add your Firebase configuration keys (see `.env.example` or your Firebase console).
   - Add your `GEMINI_API_KEY` for intelligence features.

### Local Development
Run the development server:
```bash
npm run dev
```

## Features
- **Attendance Portal**: Drag-and-drop Excel upload with automated mapping and validation.
- **Trainings Viewer**: Detailed search and historical records for IP, AP, and MIP training types.
- **Intelligence Engine**: 
    - **Grouped Analytics**: Real-time performance ranking by Team, Cluster, or Month.
    - **Trend Analysis**: Heatmapped time-series metrics.
    - **Gap Analysis**: Automated identification of untrained eligible employees.

## Version Control Workflow
- `main`: Stable production-ready code.
- `dev`: Active development and integration.
- `feature/*`: Specific feature development (e.g., `feature/upload-engine`).

---
Designed for maximum efficiency and decision intelligence.
