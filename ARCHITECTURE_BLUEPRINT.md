# L&D Database Application - Architecture Blueprint

## 1. System Overview

### 1.1 Purpose
A comprehensive Learning & Development (L&D) management system for tracking training attendance, trainer performance, and employee certification status across multiple teams and fiscal years.

### 1.2 Tech Stack
- **Frontend**: React 18, TypeScript, Vite
- **State Management**: React Context API + Hooks
- **Styling**: CSS Modules
- **Data Processing**: SheetJS (XLSX) for Excel parsing
- **Backend**: REST API (Node.js/Express on Render)
- **Database**: MongoDB Atlas
- **Icons**: Lucide React

---

## 2. Frontend Architecture

### 2.1 Directory Structure
`
src/
+-- core/
¦   +-- constants/          # App constants, templates
¦   +-- context/            # React Context providers
¦   +-- debug/              # Debug utilities
¦   +-- engines/            # Business logic engines
¦   +-- utils/              # Utility functions
+-- features/
¦   +-- uploads/            # File upload components
¦   +-- performance/        # TOA, analytics pages
¦   +-- notifications/      # Training data views
¦   +-- employees/          # Employee management
¦   +-- eligibility/        # Demographics, rules
¦   +-- settings/           # Master data settings
¦   +-- dashboard/          # Dashboard components
+-- shared/
¦   +-- hooks/              # Shared custom hooks
+-- types/                  # TypeScript type definitions
`

### 2.2 Context Providers

#### MasterDataContext
- **Purpose**: Central data repository for all master entities
- **Cached Collections**: training_data, training_sessions, training_batches, employees, teams, clusters, trainers
- **Key Methods**: refreshData(), invalidateCache()

#### GlobalFilterContext
- **Purpose**: Manage global filtering state
- **Filter Dimensions**: fiscalYear, trainingType, trainer, cluster, team
- **Default**: Current fiscal year (April-March)

---

## 3. Core Engines

### 3.1 Upload Engine (uploadEngine.ts)
**Responsibilities**:
- Parse Excel files using SheetJS
- Validate row data against templates
- Extract trainer from multiple column aliases
- Parse dates (DD-MM-YYYY, DD-MMM-YYYY, Excel serial)
- Group rows by trainer + date for month-wise batches
- Generate deterministic trainingId
- Upsert TrainingSession documents
- Insert TrainingData attendance records

**Key Functions**:
- uploadAttendanceData(): Main upload orchestrator
- parseDate(): Date parsing with multiple format support
- extractTrainer(): Trainer extraction from various column names
- buildTrainingId(): Deterministic ID generation

**Grouping Algorithm**:
OLD (Problematic): Group by trainer only = 1 batch per trainer per fiscal year
NEW (Fixed): Group by trainer_date = Multiple month-wise batches per trainer

---

## 4. Backend Architecture

### 4.1 API Structure
`
https://one504landd.onrender.com/api
+-- /training_data          # Attendance records
+-- /training_sessions      # Session metadata
+-- /training_batches       # Upload batch tracking
+-- /employees              # Employee master
+-- /teams                  # Team master
+-- /clusters               # Cluster master
+-- /trainers               # Trainer master
+-- /eligibility_rules      # Business rules
`

### 4.2 Database Schema

#### training_data Collection
Fields:
- _id: Unique attendance record ID
- trainingId: Links to session
- trainingType: IP, AP, F2F
- trainingDate, attendanceDate, sessionDate: Date fields
- sessionTrainer, sessionTrainerId: Trainer info
- sessionTeam, team: Team info
- employeeId, name: Employee info
- attended, attendanceStatus: Attendance status
- isVoided: Cancellation flag
- uploadBatchId, uploadedAt, uploadedBy: Audit fields

#### training_sessions Collection
Fields:
- _id, trainingId: Session identifier
- trainingType, trainingDate: Session metadata
- trainerName, trainerId: Trainer info
- team: Team name
- sessionCreatedAt: Creation timestamp
- recordCount: Number of attendance records
- status: Session status
- uploadBatchId: Batch tracking

---

## 5. Key Algorithms

### 5.1 Fiscal Year Calculation
- Fiscal Year: April (Month 4) to March (Month 3)
- getFiscalYearFromDate(): Returns year based on month
- Format: "2026-27"

### 5.2 Date Parsing (Multi-Format)
Supports:
1. Excel Serial Number (e.g., 45112)
2. ISO Format: YYYY-MM-DD
3. DD-MM-YYYY (Indian format: 14-04-2025)
4. DD-MMM-YYYY (e.g., 14-Apr-2025)

### 5.3 Month-Wise Grouping
Code pattern:
const groupedByTrainerDate = new Map();
rows.forEach(row => {
  const trainer = extractTrainer(row);
  const date = parseDate(row['Training Date']) || sheetDate;
  const key = trainer + '_' + date;
  groupedByTrainerDate.get(key).push(row);
});

---

## 6. Data Processing Hooks

### 6.1 useAppData.ts
**Purpose**: Process and join training data for UI consumption
**Pipeline**:
1. Fetch raw training_data from MasterDataContext
2. Join with training_sessions to get trainer info
3. Normalize training types (handle aliases)
4. Filter by global filters (fiscal year, team exclusions)
5. Aggregate metrics (attendance %, batch counts)

### 6.2 usePerformanceData.ts
**Purpose**: Prepare data for TOA reports
**Pipeline**:
1. Filter by trainingType (IP, AP, F2F)
2. Group by team and month
3. Calculate metrics: total, present, dropOff, attendance%
4. Sort teams by attendance % (ranking)

---

## 7. Component Reference

### 7.1 Upload Components
- AttendanceUploadStrict.tsx: Main upload interface with validation
- UploadPreview.tsx: Display parsed Excel data before confirmation

### 7.2 Performance Components
- TrainerOperationalExcellence.tsx: TOA dashboard main page
- ReportsAnalytics.tsx: Detailed analytics view

### 7.3 Data Display Components
- TrainingDataPage.tsx: Raw training data browser

---

## 8. Configuration

### 8.1 Environment Variables
- VITE_API_BASE_URL: https://one504landd.onrender.com/api

### 8.2 Template Configurations
- IP (Induction Program): employeeId, name, team, trainer, date, status
- AP (Advanced Program): employeeId, name, team, trainer, date, modules
- F2F (Face to Face): employeeId, name, team, trainer, date, topic

### 8.3 Team Exclusions
Teams excluded from reporting: Digital Support, HO Support, Vendors

---

## 9. Known Issues & Solutions

### Issue 1: Date Parsing (RESOLVED)
Problem: DD-MM-YYYY dates not parsing correctly, all defaulting to April
Solution: Added DD-MM-YYYY format support in parseDate() function

### Issue 2: Batch Grouping (RESOLVED)
Problem: All rows grouped by trainer only, creating giant fiscal-year batches
Solution: Changed grouping key to trainer_date for month-wise separation

---

## 10. Recent Changes

### Upload Engine (uploadEngine.ts)
- Changed from groupedByTrainer to groupedByTrainerDate
- Added parseDate import from uploadTemplates
- Each row's date extracted individually
- Groups keyed as trainer_date for month-wise separation
- Training sessions created per trainer per date

### Date Parser (uploadTemplates.ts)
- Added DD-MM-YYYY date format support
- Handles Excel serial numbers
- Supports DD-MMM-YYYY format
