// Standard Column Map (any Excel header → standard key)
export const ALIAS_MAP: Record<string, string> = {
  'aadhaar number': 'aadhaarNumber',
  'aadhaar': 'aadhaarNumber',
  'aadhar': 'aadhaarNumber',
  'aadhar number': 'aadhaarNumber',
  'aadhaar no': 'aadhaarNumber',
  'aadhar no': 'aadhaarNumber',
  'employee id': 'employeeId',
  'emp id': 'employeeId',
  'employeeid': 'employeeId',
  'empid': 'employeeId',
  'emp_id': 'employeeId',
  'employee code': 'employeeId',
  'mobile number': 'mobileNumber',
  'mobile': 'mobileNumber',
  'phone': 'mobileNumber',
  'mobile no': 'mobileNumber',
  'contact': 'mobileNumber',
  'employee name': 'employeeName',
  'name': 'employeeName',
  'emp name': 'employeeName',
  'empname': 'employeeName',
  'full name': 'employeeName',
  'trainer': 'trainerId',
  'trainer id': 'trainerId',
  'trainer name': 'trainerId',
  'team': 'team',
  'team name': 'team',
  'designation': 'designation',
  'desig': 'designation',
  'cluster': 'cluster',
  'cluster name': 'cluster',
  'hq': 'hq',
  'headquarter': 'hq',
  'headquarters': 'hq',
  'head quarter': 'hq',
  'state': 'state',
  'attendance date': 'attendanceDate',
  'date': 'attendanceDate',
  'training date': 'attendanceDate',
  'att date': 'attendanceDate',
  'attendance status': 'attendanceStatus',
  'status': 'attendanceStatus',
  'present/absent': 'attendanceStatus',
  'attendance': 'attendanceStatus',
  // Score columns
  'score': 'score',
  'test score': 'score',
  'detailing / percent': 'score',
  'detailing percent': 'score',
  'ip score': 'score',
  'knowledge': 'knowledge',
  'bse': 'bse',
  'grasping': 'grasping',
  'detailing': 'detailing',
  'situation handling': 'situationHandling',
  'english': 'english',
  'local language': 'localLanguage',
  'involvement': 'involvement',
  'effort': 'effort',
  'confidence': 'confidence',
  'science score': 'scienceScore',
  'skill score': 'skillScore',
};

export const getValue = (row: any, key: string) => {
  const lcKey = key.toLowerCase().trim();
  const directValue = row[key];
  if (directValue !== undefined) return directValue;

  // Try aliases
  for (const [alias, standard] of Object.entries(ALIAS_MAP)) {
    if (standard === key && row[alias] !== undefined) {
      return row[alias];
    }
  }

  return undefined;
};

export const toCamel = (str: any) => {
  if (!str) return '';
  return String(str)
    .trim()
    .toLowerCase()
    .split(' ')
    .map((w) => w.charAt(0).toUpperCase() + w.slice(1))
    .join(' ');
};

export const detectTrainingType = (cols: string[]) => {
  const lc = cols.map((c) => (ALIAS_MAP[c.toLowerCase().trim()] || c.toLowerCase()));
  if (lc.some((c) => c === 'scienceScore' || c === 'skillScore')) return 'MIP';
  if (lc.some((c) => c === 'knowledge' || c === 'bse' || c === 'grasping' || c === 'confidence')) return 'AP';
  return 'IP';
};
