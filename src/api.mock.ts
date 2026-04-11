export const mockEmployees = [
  { id: 'EMP001', employeeId: 'EMP001', name: 'John Doe', team: 'Team A', hq: 'Mumbai', state: 'Maharashtra', designation: 'FE', mobileNumber: '9876543210', aadhaarNumber: '1234-5678-9012' },
  { id: 'EMP002', employeeId: 'EMP002', name: 'Jane Smith', team: 'Team B', hq: 'Pune', state: 'Maharashtra', designation: 'FE', mobileNumber: '9876543211', aadhaarNumber: '1234-5678-9013' },
  { id: 'EMP003', employeeId: 'EMP003', name: 'Bob Wilson', team: 'Team A', hq: 'Delhi', state: 'Delhi', designation: 'FE', mobileNumber: '9876543212', aadhaarNumber: '1234-5678-9014' }
];

export const mockAttendance = [
  { id: 'EMP001_IP_2024-03-01', employeeId: 'EMP001', name: 'John Doe', trainingType: 'IP', attendanceDate: '2024-03-01', attendanceStatus: 'Present', trainerId: 'T001', team: 'Team A', hq: 'Mumbai', state: 'Maharashtra' },
  { id: 'EMP002_IP_2024-03-01', employeeId: 'EMP002', name: 'Jane Smith', trainingType: 'IP', attendanceDate: '2024-03-01', attendanceStatus: 'Present', trainerId: 'T001', team: 'Team B', hq: 'Pune', state: 'Maharashtra' },
  { id: 'EMP003_AP_2024-03-05', employeeId: 'EMP003', name: 'Bob Wilson', trainingType: 'AP', attendanceDate: '2024-03-05', attendanceStatus: 'Present', trainerId: 'T002', team: 'Team A', hq: 'Delhi', state: 'Delhi' }
];

export const mockScores = [
  { id: 'EMP001_IP_2024-03-01', employeeId: 'EMP001', trainingType: 'IP', dateStr: '2024-03-01', scores: { 'Science': 85, 'Skill': 90 } },
  { id: 'EMP002_IP_2024-03-01', employeeId: 'EMP002', trainingType: 'IP', dateStr: '2024-03-01', scores: { 'Science': 75, 'Skill': 80 } },
  { id: 'EMP003_AP_2024-03-05', employeeId: 'EMP003', trainingType: 'AP', dateStr: '2024-03-05', scores: { 'Quiz': 92, 'Viva': 88 } }
];

export const mockNominations = [
  { id: 'NOM001', employeeId: 'EMP001', trainingType: 'AP', nominationDate: '2024-03-01' },
  { id: 'NOM002', employeeId: 'EMP002', trainingType: 'AP', nominationDate: '2024-03-01' }
];

export const mockDemographics = [
  { id: 'DEM001', employeeId: 'EMP001', tenure: '24 Months', eligibilityStatus: 'Eligible' },
  { id: 'DEM002', employeeId: 'EMP002', tenure: '12 Months', eligibilityStatus: 'Eligible' }
];
