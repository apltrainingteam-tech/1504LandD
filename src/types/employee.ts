export interface Employee {
  id: string; // Document ID (usually same as employeeId)
  employeeId: string;
  aadhaarNumber: string;
  mobileNumber: string;
  name: string;
  designation: string;
  team: string;
  hq: string;
  state: string;
  doj: string; 
  aplExperience: number;
  pastExperience: number;
  totalExperience: number; 
  age: number;
  dob: string; 
  email: string;
  basicQualification: string;
  status: 'Active' | 'Inactive';
  lastUpdatedAt?: number;
}
