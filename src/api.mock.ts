export const mockEmployees = [
  { id: 'EMP002', employeeId: 'EMP002', name: 'Jane Smith', team: 'Revance', hq: 'Pune', state: 'Maharashtra', designation: 'FE', mobileNumber: '9876543211', aadhaarNumber: '1234-5678-9013' }
];

export const mockAttendance = [
  { id: 'EMP002_IP_2024-03-01', employeeId: 'EMP002', name: 'Jane Smith', trainingType: 'IP', attendanceDate: '2024-03-01', attendanceStatus: 'Present', trainerId: 'T001', team: 'Revance', hq: 'Pune', state: 'Maharashtra' }
];

export const mockScores = [
  { id: 'EMP002_IP_2024-03-01', employeeId: 'EMP002', trainingType: 'IP', dateStr: '2024-03-01', scores: { 'Science': 75, 'Skill': 80 } }
];

export const mockNominations = [
  { id: 'NOM002', employeeId: 'EMP002', trainingType: 'AP', nominationDate: '2024-03-01' }
];

export const mockDemographics = [
  { id: 'DEM002', employeeId: 'EMP002', tenure: '12 Months', eligibilityStatus: 'Eligible' }
];
