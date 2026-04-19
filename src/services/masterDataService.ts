/**
 * Master Data Service
 * Loads and manages employee master data for enrichment
 */

import { getCollection } from './apiService';

/**
 * Employee record from master data
 */
interface EmployeeRecord {
  id?: string;
  employeeId?: string;
  aadhaarNumber?: string;
  mobileNumber?: string;
  name?: string;
  team?: string;
  designation?: string;
  hq?: string;
  state?: string;
}

/**
 * Master data cache with lookup maps
 */
interface MasterDataCache {
  byEmployeeId: Map<string, EmployeeRecord>;
  byAadhaarNumber: Map<string, EmployeeRecord>;
  byMobileNumber: Map<string, EmployeeRecord>;
  allRecords: EmployeeRecord[];
  loadedAt: Date;
}

// Global cache (kept in memory during upload session)
let cache: MasterDataCache | null = null;

/**
 * Load employee master data into memory
 * Creates lookup maps for fast searching
 */
export async function loadMasterData(): Promise<MasterDataCache> {
  console.log('[MASTER] Loading employee master data from MongoDB...');
  
  try {
    const employees = await getCollection('employees');
    
    const cache: MasterDataCache = {
      byEmployeeId: new Map(),
      byAadhaarNumber: new Map(),
      byMobileNumber: new Map(),
      allRecords: employees,
      loadedAt: new Date()
    };

    // Build lookup maps
    for (const emp of employees) {
      // Map by Employee ID
      if (emp.employeeId) {
        cache.byEmployeeId.set(String(emp.employeeId).toUpperCase().trim(), emp);
      }

      // Map by Aadhaar Number
      if (emp.aadhaarNumber) {
        cache.byAadhaarNumber.set(String(emp.aadhaarNumber).trim(), emp);
      }

      // Map by Mobile Number
      if (emp.mobileNumber) {
        cache.byMobileNumber.set(String(emp.mobileNumber).trim(), emp);
      }
    }

    console.log(`[MASTER] Loaded ${employees.length} employees`);
    console.log(`[MASTER] Built lookup maps:`);
    console.log(`  - By Employee ID: ${cache.byEmployeeId.size} entries`);
    console.log(`  - By Aadhaar Number: ${cache.byAadhaarNumber.size} entries`);
    console.log(`  - By Mobile Number: ${cache.byMobileNumber.size} entries`);

    return cache;
  } catch (error) {
    console.error('[MASTER] Error loading master data:', error);
    throw error;
  }
}

/**
 * Get or create master data cache
 */
export async function getMasterDataCache(): Promise<MasterDataCache> {
  if (!cache) {
    cache = await loadMasterData();
  }
  return cache;
}

/**
 * Clear cache (call at end of upload session)
 */
export function clearCache(): void {
  cache = null;
  console.log('[MASTER] Master data cache cleared');
}

/**
 * Find employee by ANY identifier (Employee ID, Aadhaar, or Mobile)
 * 
 * Returns:
 * - { employee, source } if single match found
 * - { conflict: true } if multiple different employees matched
 * - { notFound: true } if no match found
 */
export async function findEmployeeByAnyId(
  employeeId?: string,
  aadhaarNumber?: string,
  mobileNumber?: string
): Promise<{ employee?: EmployeeRecord; conflict?: boolean; notFound?: boolean; source?: string }> {
  const cache = await getMasterDataCache();
  const matches: Set<EmployeeRecord> = new Set();
  const sources: string[] = [];

  // Search by Employee ID
  if (employeeId) {
    const emp = cache.byEmployeeId.get(String(employeeId).toUpperCase().trim());
    if (emp) {
      matches.add(emp);
      sources.push(`Employee ID: ${employeeId}`);
    }
  }

  // Search by Aadhaar Number
  if (aadhaarNumber) {
    const emp = cache.byAadhaarNumber.get(String(aadhaarNumber).trim());
    if (emp) {
      matches.add(emp);
      sources.push(`Aadhaar: ${aadhaarNumber}`);
    }
  }

  // Search by Mobile Number
  if (mobileNumber) {
    const emp = cache.byMobileNumber.get(String(mobileNumber).trim());
    if (emp) {
      matches.add(emp);
      sources.push(`Mobile: ${mobileNumber}`);
    }
  }

  // Analyze results
  if (matches.size === 0) {
    return { notFound: true };
  }

  if (matches.size === 1) {
    const employee = Array.from(matches)[0];
    return { employee, source: sources.join(', ') };
  }

  // Multiple matches found - check if they're the same person
  const uniqueEmps = Array.from(matches);
  const firstEmpId = uniqueEmps[0].employeeId;
  const allSame = uniqueEmps.every(emp => emp.employeeId === firstEmpId);

  if (allSame) {
    // All IDs point to same person
    return { employee: uniqueEmps[0], source: sources.join(', ') };
  }

  // Conflict: different employees
  return { conflict: true };
}

/**
 * Enrich row data with master employee information
 */
export async function enrichRowWithMasterData(
  row: any,
  employeeId?: string,
  aadhaarNumber?: string,
  mobileNumber?: string
): Promise<{ enriched: any; status: 'Active' | 'Inactive'; source?: string }> {
  const enriched = { ...row };

  // Find employee in master data
  const result = await findEmployeeByAnyId(employeeId, aadhaarNumber, mobileNumber);

  if (result.conflict) {
    throw new Error('Conflicting identifiers - different employees matched');
  }

  if (result.notFound) {
    // Employee not in master data
    enriched.employeeStatus = 'Inactive';
    return { enriched, status: 'Inactive', source: 'Not found in master' };
  }

  // Employee found - enrich with master data
  const emp = result.employee!;
  enriched.employeeStatus = 'Active';

  // Fill missing fields from master data
  if (!enriched.name && emp.name) enriched.name = emp.name;
  if (!enriched.team && emp.team) enriched.team = emp.team;
  if (!enriched.designation && emp.designation) enriched.designation = emp.designation;
  if (!enriched.hq && emp.hq) enriched.hq = emp.hq;
  if (!enriched.state && emp.state) enriched.state = emp.state;

  return { enriched, status: 'Active', source: result.source };
}

export default {
  loadMasterData,
  getMasterDataCache,
  clearCache,
  findEmployeeByAnyId,
  enrichRowWithMasterData
};
