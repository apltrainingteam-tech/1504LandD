export interface DataEdit {
  id: string;
  module: "trainingData" | "nomination" | "employee";
  recordId: string;
  field: string;
  newValue: any;
  timestamp: number;
  status: 'applied' | 'pending';
}

