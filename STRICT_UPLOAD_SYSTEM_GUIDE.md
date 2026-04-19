# Strict Template-Driven Upload System - Implementation Guide

## Overview

A **deterministic, zero-ambiguity** Excel upload system for training data with:
- **No guessing**: Template type detected from unique columns (strict rules)
- **No silent failures**: Every error logged with row number and context
- **No fallback logic**: Exact column matching, reject on mismatch
- **Clean storage**: Flat records in single MongoDB collection `training_data`

---

## Architecture

### New Files Created

#### 1. **`src/services/uploadTemplatesStrict.ts`** (280 lines)
Core template definitions and validation logic.

**Key Exports:**
```typescript
- detectTemplateType(excelHeaders) → string
- validateCommonColumns(excelHeaders) → ValidationResult
- validateTemplateColumns(excelHeaders, templateType) → ValidationResult
- validateRow(rowData, rowNum) → ValidationResult
- mapRowToMongoDB(excelRow, excelHeaders, templateType) → { mapped, errors }
- getTemplateForDownload(templateType) → { headers, description, sample }
```

**Mandatory Common Columns (all 11 required in every template):**
```
✓ Aadhaar Number
✓ Employee ID
✓ Mobile Number
✓ Trainer
✓ Team
✓ Name
✓ Designation
✓ HQ
✓ State
✓ Attendance Date
✓ Attendance Status
```

**Template-Specific Columns:**

| Template | Unique Detector | Columns |
|----------|-----------------|---------|
| **IP** | "Trainability Score" | Detailing, Test Score, Trainability Score |
| **AP** | "BSE" | Knowledge, BSE, Grasping, Participation, Detailing & Presentation, Role Play, Punctuality, Grooming & Dress Code, Behaviour |
| **PreAP** | "AP Date" | AP Date, Notified, Test Score |
| **MIP** | "Science Score" | Science Score, Skill Score |
| **Refresher** | "Situation Handling" | Knowledge, Situation Handling, Presentation |
| **Capsule** | Only "Test Score" | Test Score |

**Detection Logic (Priority Order):**
```
1. IF "Trainability Score" → IP
2. IF "BSE" → AP
3. IF "AP Date" → PreAP
4. IF "Science Score" → MIP
5. IF "Situation Handling" → Refresher
6. IF "Test Score" (alone) → Capsule
7. ELSE → ERROR (template not determinable)
```

#### 2. **`src/services/parsingServiceStrict.ts`** (300 lines)
Excel parsing with strict validation and template detection.

**Main Function:**
```typescript
parseExcelFileStrict(file: File) → Promise<ParseResult>

// Returns:
{
  templateType: string;
  rows: ParsedRowStrict[];  // Each with status, data/errors, warnings
  debug: ParseDebugInfo;     // Template, total/valid/rejected counts, sample record
}
```

**Process:**
1. Load Excel file into JSON
2. Detect template type from headers
3. Validate common + template-specific columns
4. Parse each row with strict validation
5. Return detailed errors with row numbers

#### 3. **`src/services/uploadServiceStrict.ts`** (300 lines)
Upload orchestration with MongoDB storage.

**Main Function:**
```typescript
uploadTrainingDataStrict(
  file: File,
  options: { mode: 'append' | 'replace', chunkSize?: number, onProgress?: callback }
) → Promise<UploadResult>

// Returns:
{
  success: boolean;
  templateType: string;
  totalRows: number;
  uploadedRows: number;
  rejectedRows: number;
  errors: Array<{ rowNum, message }>;
  warnings: Array<{ rowNum, message }>;
  debugLog: string;
}
```

**Storage Location:** MongoDB collection `training_data`

**Document Structure (Flat):**
```javascript
{
  _id: "IP_EMP00001_2026-04-19",        // Deterministic ID
  trainingType: "IP",                   // System field
  
  // Common fields
  aadhaarNumber: "123456789012",
  employeeId: "EMP00001",
  mobileNumber: "9876543210",
  trainer: "Rajesh Kumar",
  team: "Sales",
  name: "John Doe",
  designation: "Executive",
  hq: "Mumbai",
  state: "Maharashtra",
  attendanceDate: "2026-04-19",
  attendanceStatus: "Present",
  
  // Template-specific fields (example: IP)
  detailingScore: 75,
  testScore: 85,
  trainabilityScore: 8.5,
  
  // Metadata
  uploadedAt: 2026-04-19T10:30:00Z,
  uploadedBy: "system"
}
```

#### 4. **`src/features/uploads/AttendanceUploadStrict.tsx`** (400 lines)
React component for UI with download templates and error display.

**Features:**
- Template type selector (for downloads)
- Download template button (generates Excel with headers + sample)
- Drag-drop or file picker upload
- Upload mode selector (Append or Replace)
- Real-time progress display
- Detailed error/warning display
- Debug log inspection

---

## Column Mapping (Excel → MongoDB)

### Common Columns
| Excel Header | MongoDB Field |
|--------------|--------------|
| Aadhaar Number | aadhaarNumber |
| Employee ID | employeeId |
| Mobile Number | mobileNumber |
| Trainer | trainer |
| Team | team |
| Name | name |
| Designation | designation |
| HQ | hq |
| State | state |
| Attendance Date | attendanceDate |
| Attendance Status | attendanceStatus |

### Template-Specific (Example: AP)
| Excel Header | MongoDB Field |
|--------------|--------------|
| Knowledge | knowledgeScore |
| BSE | bseScore |
| Grasping | graspingScore |
| Participation | participationScore |
| Detailing & Presentation | detailingPresentationScore |
| Role Play | rolePlayScore |
| Punctuality | punctualityScore |
| Grooming & Dress Code | groomingScore |
| Behaviour | behaviourScore |

---

## Validation Rules

### MANDATORY (Row Rejected If Missing)
- ✗ **Employee ID** empty/missing → Row rejected
- ✗ **Attendance Date** empty/invalid → Row rejected
- ✗ **Missing required common column** → File rejected at header validation

### OPTIONAL (Row Warned But Not Rejected)
- ⚠ Score fields missing
- ⚠ Trainer name missing/short
- ⚠ Attendance Status non-standard format

### ERROR HANDLING
**No fallback logic.** When validation fails:
```
Row 5: Employee ID is missing or empty
Row 5: Attendance Date "" is invalid. Use YYYY-MM-DD format
Row 5: Attendance Status "Maybe" not standard (use Present/Absent)
```

---

## Usage

### Import the Component
```typescript
import { AttendanceUploadStrict } from '@/features/uploads/AttendanceUploadStrict';

export function Dashboard() {
  return (
    <AttendanceUploadStrict 
      onUploadComplete={() => console.log('Upload done!')}
    />
  );
}
```

### Programmatic Usage
```typescript
import { uploadTrainingDataStrict } from '@/services/uploadServiceStrict';

const result = await uploadTrainingDataStrict(file, {
  mode: 'append',
  chunkSize: 50,
  onProgress: (progress) => {
    console.log(`${progress.stage}: ${progress.message}`);
  }
});

if (result.success) {
  console.log(`✅ Uploaded ${result.uploadedRows} rows`);
} else {
  console.log(`❌ Error: ${result.errors[0]?.message}`);
}
```

---

## Debug Logging

Every upload generates comprehensive logs:

```
[PARSER] Loaded 73 rows from Excel
[PARSER] Excel headers: [...11 common..., Trainability Score, Detailing, Test Score]
[PARSER] ✅ Template type detected: IP
[PARSER] ✅ All common columns present
[PARSER] Row 1: Valid
[PARSER] Row 2: Valid
[PARSER] Row 3: Employee ID is missing or empty → rejected
[PARSER] ✅ Parse complete
[PARSER] Total rows: 73
[PARSER] Valid rows: 71
[PARSER] Rejected rows: 2

[UPLOAD] Starting upload: mode=append, file=Training_Data.xlsx
[UPLOAD] ✅ Parse complete: template=IP
[UPLOAD] Validation summary: { totalRows: 73, validRows: 71, rejectedRows: 2, successRate: 97.3% }
[UPLOAD] Uploading 71 valid rows to MongoDB...
[UPLOAD] Chunk 1: 50/71 rows uploaded
[UPLOAD] Chunk 2: 71/71 rows uploaded
[UPLOAD] ✅ All 71 rows uploaded successfully
```

---

## Error Examples

### Template Detection Failed
```
❌ Template type cannot be determined. Unique columns not found.
Available headers: Aadhaar Number, Employee ID, ...
Expected one of:
  - "Trainability Score" for IP
  - "BSE" for AP
  - "AP Date" for PreAP
  - "Science Score" for MIP
  - "Situation Handling" for Refresher
  - "Test Score" (alone) for Capsule
```

### Missing Required Column
```
❌ Common column validation failed:
❌ Missing required column: "Trainer"
❌ Missing required column: "Team"
```

### Row Rejected
```
Row 5: Employee ID is missing or empty
Row 5: Attendance Date "04-19" is invalid. Use YYYY-MM-DD format
```

### No Valid Rows
```
❌ No valid rows to upload. All 73 rows were rejected.
Errors:
  Row 1: Employee ID is missing or empty
  Row 2: Attendance Date "" is invalid. Use YYYY-MM-DD format
  Row 3: Employee ID is missing or empty
  ... and 70 more
```

---

## MongoDB Collection Structure

**Collection:** `training_data`

**Index Recommendations:**
```javascript
db.training_data.createIndex({ employeeId: 1 })
db.training_data.createIndex({ trainingType: 1 })
db.training_data.createIndex({ attendanceDate: 1 })
db.training_data.createIndex({ trainingType: 1, employeeId: 1, attendanceDate: 1 }, { unique: true })
```

**Duplicate Handling:** Upsert by `_id = trainingType_employeeId_attendanceDate`
- Same row uploaded twice → updates existing record (no duplicates)
- Can safely re-upload with "Append" mode

---

## Features & Benefits

### ✅ Zero Ambiguity
- Deterministic template detection based on unique columns
- No fuzzy matching or guessing
- Exact column headers required

### ✅ No Silent Failures
- Every error logged with row number
- Missing fields clearly identified
- Validation error message shows raw value

### ✅ Deterministic Parsing
- Same file always produces same result
- No randomness or fallback logic
- Reproducible data cleaning

### ✅ Clean Storage
- Flat MongoDB documents (no nested objects)
- Consistent field names across all templates
- Analytics-ready data structure

### ✅ User-Friendly
- Download templates with sample data
- Real-time upload progress
- Clear error/warning display
- Debug log for troubleshooting

---

## Next Steps

1. **Replace old upload component** with `AttendanceUploadStrict`
2. **Update imports** in Dashboard/App
3. **Verify MongoDB collection** `training_data` exists
4. **Test with sample data** using downloaded templates
5. **Monitor debug logs** for any parsing issues
6. **Create indexes** on `training_data` collection for performance

---

## Technical Stack

- **Excel Parsing**: XLSX library
- **File I/O**: FileReader API
- **Validation**: Custom strict validators
- **Storage**: MongoDB (collection: training_data)
- **UI**: React 19 + TypeScript
- **Date Parsing**: YYYY-MM-DD, MM/DD/YYYY, DD-MM-YYYY support
- **Error Handling**: No fallback, comprehensive logging
