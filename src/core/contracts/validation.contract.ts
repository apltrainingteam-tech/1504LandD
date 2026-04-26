export interface ValidationError {
  id: string;
  module: "trainingData" | "nomination" | "employee";
  rowIndex: number;
  recordId: string;
  field: string;
  column?: string;
  value: any;
  expectedValue?: any;
  errorType:
    | "UNKNOWN_VALUE"
    | "INVALID_FORMAT"
    | "MISSING_FIELD"
    | "MAPPING_ERROR"
    | "SCHEMA_MISMATCH";
  message: string;
  sourceFile?: string;
  uploadBatchId?: string;
  suggestions?: string[];
}

