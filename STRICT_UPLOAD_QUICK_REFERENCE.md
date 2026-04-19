# Strict Upload System - Quick Reference

## File Structure

```
src/services/
  ├── uploadTemplatesStrict.ts      ← Template definitions, column mapping, validation rules
  ├── parsingServiceStrict.ts        ← Excel parser with strict template detection
  └── uploadServiceStrict.ts         ← MongoDB upload orchestration

src/features/uploads/
  └── AttendanceUploadStrict.tsx     ← React UI component
```

## Files Size Summary

| File | Lines | Purpose |
|------|-------|---------|
| uploadTemplatesStrict.ts | 280 | Column mapping, detection rules, validators |
| parsingServiceStrict.ts | 300 | Parse Excel → detect template → validate rows |
| uploadServiceStrict.ts | 300 | Upload to MongoDB, progress tracking, error handling |
| AttendanceUploadStrict.tsx | 400 | UI component with template download & error display |

---

## Template Detection (Strict Rules)

### Decision Tree
```
Read Excel headers ↓
Check for unique identifier columns:

1. Has "Trainability Score"? → IP
2. Has "BSE"? → AP
3. Has "AP Date"? → PreAP
4. Has "Science Score"? → MIP
5. Has "Situation Handling"? → Refresher
6. Has "Test Score" (and NOT any above)? → Capsule
7. None of above? → ❌ ERROR: Template cannot be determined
```

---

## Data Flow

```
1. User selects file
   ↓
2. parseExcelFileStrict()
   - Detect template type (strict)
   - Validate common columns (11 required)
   - Validate template-specific columns
   - Parse each row (validate Employee ID + Date)
   ↓
3. uploadTrainingDataStrict()
   - Collect valid rows
   - Skip/report invalid rows
   - Upload to training_data collection (MongoDB)
   ↓
4. Display result
   - Show uploaded count
   - Show rejected count with reasons
   - Display warnings (optional fields)
```

---

## Common Columns (All 11 Required)

| # | Column Name | Maps To | Required |
|---|---|---|---|
| 1 | Aadhaar Number | aadhaarNumber | Yes |
| 2 | Employee ID | employeeId | ✓ MANDATORY |
| 3 | Mobile Number | mobileNumber | Yes |
| 4 | Trainer | trainer | Yes |
| 5 | Team | team | Yes |
| 6 | Name | name | Yes |
| 7 | Designation | designation | Yes |
| 8 | HQ | hq | Yes |
| 9 | State | state | Yes |
| 10 | Attendance Date | attendanceDate | ✓ MANDATORY |
| 11 | Attendance Status | attendanceStatus | Yes |

> **Note:** Mandatory fields (Employee ID, Attendance Date) cause row rejection if missing or invalid

---

## Template-Specific Columns

### IP (Detected by: "Trainability Score")
```
Excel Header              MongoDB Field
Detailing         →       detailingScore
Test Score        →       testScore
Trainability Score →      trainabilityScore
```

### AP (Detected by: "BSE")
```
Excel Header                     MongoDB Field
Knowledge                    →   knowledgeScore
BSE                          →   bseScore
Grasping                     →   graspingScore
Participation                →   participationScore
Detailing & Presentation     →   detailingPresentationScore
Role Play                    →   rolePlayScore
Punctuality                  →   punctualityScore
Grooming & Dress Code        →   groomingScore
Behaviour                    →   behaviourScore
```

### PreAP (Detected by: "AP Date")
```
Excel Header    MongoDB Field
AP Date     →   apDate
Notified    →   notified
Test Score  →   testScore
```

### MIP (Detected by: "Science Score")
```
Excel Header    MongoDB Field
Science Score → scienceScore
Skill Score   → skillScore
```

### Refresher (Detected by: "Situation Handling")
```
Excel Header        MongoDB Field
Knowledge          →  knowledgeScore
Situation Handling →  situationHandlingScore
Presentation       →  presentationScore
```

### Capsule (Detected by: "Test Score" alone)
```
Excel Header    MongoDB Field
Test Score  →   testScore
```

---

## Row Validation Rules

### Hard Rejects (❌ Row is skipped)
- Employee ID empty or missing
- Attendance Date empty or invalid format

### Soft Warnings (⚠️ Row uploaded but flagged)
- Score field missing (optional fields)
- Trainer name missing
- Attendance Status non-standard (not "Present" or "Absent")

---

## Error Response Format

### Header Validation Error
```json
{
  "success": false,
  "templateType": "UNKNOWN",
  "totalRows": 0,
  "uploadedRows": 0,
  "rejectedRows": 0,
  "errors": [
    { "rowNum": 0, "message": "❌ Missing required column: \"Trainer\"" }
  ],
  "debugLog": "[PARSER] Parse error: Column validation failed..."
}
```

### Parse Success with Rejections
```json
{
  "success": true,
  "templateType": "IP",
  "totalRows": 73,
  "uploadedRows": 71,
  "rejectedRows": 2,
  "errors": [
    { "rowNum": 15, "message": "Employee ID is missing or empty" },
    { "rowNum": 42, "message": "Attendance Date \"\" is invalid. Use YYYY-MM-DD format" }
  ],
  "warnings": [
    { "rowNum": 5, "message": "Trainer name missing" },
    { "rowNum": 23, "message": "Attendance Status \"Maybe\" not standard (use Present/Absent)" }
  ]
}
```

---

## MongoDB Storage

### Collection Name
```
training_data
```

### Document _id Format
```
{trainingType}_{employeeId}_{attendanceDate}

Example: IP_EMP00001_2026-04-19
```

### Fields Added by System
```javascript
{
  _id: "IP_EMP00001_2026-04-19",
  trainingType: "IP",                    // System field
  uploadedAt: 2026-04-19T10:30:00Z,      // System field
  uploadedBy: "system",                  // System field
  ...all mapped fields...
}
```

### Duplicate Handling
- Upsert by unique _id
- Re-uploading same row updates existing record
- Safe to use "Append" mode multiple times

---

## API Reference

### parseExcelFileStrict()
```typescript
import { parseExcelFileStrict } from '@/services/parsingServiceStrict';

const result = await parseExcelFileStrict(file);
// result.templateType: 'IP' | 'AP' | 'PreAP' | 'MIP' | 'Refresher' | 'Capsule'
// result.rows: Array of { rowNum, data?, status, errors, warnings }
// result.debug: { templateType, totalRows, validRows, rejectedRows, errors, sampleRecord }
```

### uploadTrainingDataStrict()
```typescript
import { uploadTrainingDataStrict } from '@/services/uploadServiceStrict';

const result = await uploadTrainingDataStrict(file, {
  mode: 'append',  // or 'replace'
  chunkSize: 50,
  onProgress: (progress) => {
    console.log(progress.stage, progress.processed, progress.message);
  }
});
// result: { success, templateType, totalRows, uploadedRows, rejectedRows, errors, warnings, debugLog }
```

### getTemplateForDownload()
```typescript
import { getTemplateForDownload } from '@/services/uploadTemplatesStrict';

const { headers, description, sample } = getTemplateForDownload('IP');
// Create Excel file from these arrays for download
```

### detectTemplateType()
```typescript
import { detectTemplateType } from '@/services/uploadTemplatesStrict';

const type = detectTemplateType(excelHeaders);  // 'IP' | 'AP' | ...
// Throws error if template cannot be determined
```

---

## Component Usage

### Basic Import
```typescript
import { AttendanceUploadStrict } from '@/features/uploads/AttendanceUploadStrict';

export function Dashboard() {
  return (
    <AttendanceUploadStrict 
      onUploadComplete={() => {
        console.log('Upload finished');
        // Refresh dashboard, etc.
      }}
    />
  );
}
```

### Component Props
```typescript
interface AttendanceUploadStrictProps {
  onUploadComplete?: () => void;  // Called when upload succeeds
}
```

---

## Test Checklist

- [ ] Template detection works for all 6 types
- [ ] Missing common column → header validation error
- [ ] Empty Employee ID → row rejected
- [ ] Invalid date → row rejected
- [ ] Valid row → uploaded to training_data
- [ ] Download template → generates Excel with headers + sample
- [ ] Append mode → adds to existing data
- [ ] Replace mode → clears collection first
- [ ] Error display → shows row number + message
- [ ] Debug log → contains detailed trace

---

## Common Mistakes to Avoid

❌ **Don't use old parsingService.ts**
Use `parsingServiceStrict.ts` instead

❌ **Don't mix templates**
Upload file must have consistent unique columns for ONE template type

❌ **Don't leave Employee ID or Attendance Date empty**
These fields cause automatic row rejection

❌ **Don't forget common columns**
All 11 common columns must be present in Excel file

❌ **Don't ignore error responses**
Check `result.success` and handle errors appropriately

✅ **Do download templates first**
Use the download button to get proper column headers

✅ **Do use YYYY-MM-DD for dates**
Other formats may fail validation

✅ **Do check debug logs**
Detailed trace helps troubleshoot issues

✅ **Do test with small files first**
Validate with 5-10 row test file before bulk uploads

---

## Performance Notes

- **Chunk size**: 50 rows per MongoDB batch (configurable)
- **File size limit**: Check validateFileSize() in fileValidation.ts
- **Memory**: Entire file loaded into memory (OK for <50MB files)
- **MongoDB**: Upsert operations (faster than insert + dedup)
- **Validation**: O(n) single pass through rows

---

## Troubleshooting

### "Template type cannot be determined"
**Cause:** Excel file doesn't have unique identifier columns
**Fix:** Download correct template for your training type, use exact column names

### "Missing required column: X"
**Cause:** One of 11 common columns is missing
**Fix:** Add missing column to Excel file, use correct header spelling

### "Employee ID is missing or empty"
**Cause:** This row has no Employee ID value
**Fix:** Fill in Employee ID for all rows, or delete rows without IDs

### "Attendance Date is invalid"
**Cause:** Date format not recognized
**Fix:** Use YYYY-MM-DD format (e.g., 2026-04-19)

### "No valid rows to upload"
**Cause:** All rows were rejected during validation
**Fix:** Check error list, fix mandatory fields (Employee ID, Date), retry

### Upload to MongoDB fails
**Cause:** Database connection issue
**Fix:** Check MongoDB URI in .env, verify cluster is running, check network access

---

## Version History

- **v1.0** (2026-04-19): Initial release
  - 6 template types (IP, AP, PreAP, MIP, Refresher, Capsule)
  - Strict template detection
  - Comprehensive validation
  - MongoDB storage in training_data collection
