export interface DataEdit {
  id: string;
  module: "trainingData" | "nomination" | "employee";
  recordId: string;
  type: "UPDATE" | "DELETE" | "ADD";
  changes?: Record<string, any>;
  createdAt: number;
}
