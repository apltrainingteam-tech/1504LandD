export interface Employee {
  id: string; // Document ID
  aadhaarNumber: string;
  employeeId: string;
  mobileNumber: string;
  employeeName: string;
  cluster: string;
  team: string;
  hq: string;
  state: string;
  status: 'Active' | 'Inactive';
}
