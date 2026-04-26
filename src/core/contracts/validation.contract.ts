export interface ValidationError {
  id: string;
  module: "trainingData" | "nomination" | "employee";
  rowIndex: number;
  recordId: string;
  field: string;
  value: any;
  errorType:
    | "UNKNOWN_VALUE"
    | "INVALID_FORMAT"
    | "MISSING_FIELD"
    | "MAPPING_ERROR";
  message: string;
}
