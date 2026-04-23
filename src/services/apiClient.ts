/**
 * Frontend API Client
 * Communicates with backend server for all MongoDB operations
 */

import { API_BASE } from '../config/api';

// Runtime URL verification – confirms which backend is active
console.log("[API BASE]", API_BASE);

const API_BASE_URL = API_BASE;

interface ApiResponse<T> {
  success: boolean;
  data?: T;
  error?: string;
  [key: string]: any;
}

/**
 * Log API errors with full context
 */
function logApiError(context: string, url: string, method: string, error: any): void {
  const errorMessage = error instanceof Error ? error.message : String(error);
  console.error(`
[API ERROR] ${context}
  URL: ${url}
  Method: ${method}
  Error: ${errorMessage}
  Timestamp: ${new Date().toISOString()}
  Backend URL: ${API_BASE_URL}
`);
}

/**
 * Handle API errors
 */
function handleError(error: any): Error {
  if (error instanceof Error) {
    return error;
  }
  if (typeof error === 'string') {
    return new Error(error);
  }
  return new Error('Unknown error occurred');
}

/**
 * GET /api/:collection
 * Fetch entire collection or query by field
 */
export async function getCollection(collectionName: string, field?: string, value?: any): Promise<any[]> {
  try {
    let url = `${API_BASE_URL}/${collectionName}`;
    if (field && value !== undefined) {
      url += `?field=${field}&value=${value}`;
    }

    console.log(`[API] GET ${collectionName}`, { url, field, value });
    const response = await fetch(url);
    
    if (!response.ok) {
      const errorText = await response.text();
      const error = new Error(`HTTP ${response.status}: ${response.statusText} - ${errorText}`);
      logApiError(`Failed to fetch collection "${collectionName}"`, url, 'GET', error);
      throw error;
    }

    const result: ApiResponse<any[]> = await response.json();
    if (!result.success) {
      const error = new Error(result.error || 'Failed to fetch collection');
      logApiError(`Collection fetch failed for "${collectionName}"`, url, 'GET', error);
      throw error;
    }

    console.log(`[API] ✅ GET ${collectionName} - ${result.data?.length || 0} items`);
    return result.data || [];
  } catch (error) {
    console.error(`❌ Error fetching collection ${collectionName}:`, error);
    throw handleError(error);
  }
}

/**
 * GET /api/:collection/:id
 * Fetch single document by ID
 */
export async function getDocumentById(collectionName: string, id: string): Promise<any> {
  try {
    const url = `${API_BASE_URL}/${collectionName}/${id}`;
    console.log(`[API] GET ${collectionName}/${id}`, { url });
    
    const response = await fetch(url);
    
    if (!response.ok) {
      const errorText = await response.text();
      const error = new Error(`HTTP ${response.status}: ${response.statusText} - ${errorText}`);
      logApiError(`Failed to fetch document from "${collectionName}"`, url, 'GET', error);
      throw error;
    }

    const result: ApiResponse<any> = await response.json();
    if (!result.success) {
      const error = new Error(result.error || 'Failed to fetch document');
      logApiError(`Document fetch failed for "${collectionName}/${id}"`, url, 'GET', error);
      throw error;
    }

    return result.data || null;
  } catch (error) {
    console.error(`❌ Error fetching document ${collectionName}/${id}:`, error);
    throw handleError(error);
  }
}

/**
 * POST /api/:collection
 * Insert single document
 */
export async function insertDocument(collectionName: string, data: any): Promise<string> {
  try {
    const url = `${API_BASE_URL}/${collectionName}`;
    console.log(`[API] POST ${collectionName}`, { url, data });
    
    const response = await fetch(url, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ data })
    });

    if (!response.ok) {
      const errorText = await response.text();
      const error = new Error(`HTTP ${response.status}: ${response.statusText} - ${errorText}`);
      logApiError(`Failed to insert document into "${collectionName}"`, url, 'POST', error);
      throw error;
    }

    const result: ApiResponse<any> = await response.json();
    if (!result.success) {
      const error = new Error(result.error || 'Failed to insert document');
      logApiError(`Insert failed for "${collectionName}"`, url, 'POST', error);
      throw error;
    }

    console.log(`[API] ✅ POST ${collectionName} - ID: ${result.insertedId}`);
    return result.insertedId || '';
  } catch (error) {
    console.error(`❌ Error inserting document into ${collectionName}:`, error);
    throw handleError(error);
  }
}

/**
 * POST /api/:collection (Batch)
 * Insert multiple documents
 */
export async function addBatch(collectionName: string, items: any[]): Promise<void> {
  try {
    const url = `${API_BASE_URL}/${collectionName}`;
    console.log(`[API] POST ${collectionName} (batch)`, { url, itemCount: items.length });
    
    const response = await fetch(url, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ batch: true, items })
    });

    if (!response.ok) {
      const errorText = await response.text();
      const error = new Error(`HTTP ${response.status}: ${response.statusText} - ${errorText}`);
      logApiError(`Failed to batch insert into "${collectionName}"`, url, 'POST', error);
      throw error;
    }

    const result: ApiResponse<any> = await response.json();
    if (!result.success) {
      const error = new Error(result.error || 'Failed to insert batch');
      logApiError(`Batch insert failed for "${collectionName}"`, url, 'POST', error);
      throw error;
    }

    console.log(`[API] ✅ POST ${collectionName} (batch) - ${items.length} items`);
  } catch (error) {
    console.error(`❌ Error batch inserting into ${collectionName}:`, error);
    throw handleError(error);
  }
}

/**
 * POST /api/:collection (Upsert)
 * Insert or update document
 */
export async function upsertDoc(collectionName: string, id: string, data: any): Promise<void> {
  try {
    const url = `${API_BASE_URL}/${collectionName}`;
    console.log(`[API] POST ${collectionName} (upsert)`, { url, id });
    
    const response = await fetch(url, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ upsert: true, id, data })
    });

    if (!response.ok) {
      const errorText = await response.text();
      const error = new Error(`HTTP ${response.status}: ${response.statusText} - ${errorText}`);
      logApiError(`Failed to upsert document in "${collectionName}"`, url, 'POST', error);
      throw error;
    }

    const result: ApiResponse<any> = await response.json();
    if (!result.success) {
      const error = new Error(result.error || 'Failed to upsert document');
      logApiError(`Upsert failed for "${collectionName}/${id}"`, url, 'POST', error);
      throw error;
    }

    console.log(`[API] ✅ POST ${collectionName} (upsert) - ID: ${id}`);
  } catch (error) {
    console.error(`❌ Error upserting document in ${collectionName}:`, error);
    throw handleError(error);
  }
}

/**
 * PUT /api/:collection/:id
 * Update single document
 */
export async function updateDocument(collectionName: string, id: string, data: any): Promise<void> {
  try {
    const url = `${API_BASE_URL}/${collectionName}/${id}`;
    console.log(`[API] PUT ${collectionName}/${id}`, { url, data });
    
    const response = await fetch(url, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ data })
    });

    if (!response.ok) {
      const errorText = await response.text();
      const error = new Error(`HTTP ${response.status}: ${response.statusText} - ${errorText}`);
      logApiError(`Failed to update document in "${collectionName}"`, url, 'PUT', error);
      throw error;
    }

    const result: ApiResponse<any> = await response.json();
    if (!result.success) {
      const error = new Error(result.error || 'Failed to update document');
      logApiError(`Update failed for "${collectionName}/${id}"`, url, 'PUT', error);
      throw error;
    }

    console.log(`[API] ✅ PUT ${collectionName}/${id}`);
  } catch (error) {
    console.error(`❌ Error updating document in ${collectionName}:`, error);
    throw handleError(error);
  }
}

/**
 * DELETE /api/:collection/:id
 * Delete single document
 */
export async function deleteDocument(collectionName: string, id: string): Promise<void> {
  try {
    const url = `${API_BASE_URL}/${collectionName}/${id}`;
    console.log(`[API] DELETE ${collectionName}/${id}`, { url });
    
    const response = await fetch(url, {
      method: 'DELETE'
    });

    if (!response.ok) {
      const errorText = await response.text();
      const error = new Error(`HTTP ${response.status}: ${response.statusText} - ${errorText}`);
      logApiError(`Failed to delete document from "${collectionName}"`, url, 'DELETE', error);
      throw error;
    }

    const result: ApiResponse<any> = await response.json();
    if (!result.success) {
      const error = new Error(result.error || 'Failed to delete document');
      logApiError(`Delete failed for "${collectionName}/${id}"`, url, 'DELETE', error);
      throw error;
    }

    console.log(`[API] ✅ DELETE ${collectionName}/${id}`);
  } catch (error) {
    console.error(`❌ Error deleting document from ${collectionName}:`, error);
    throw handleError(error);
  }
}

/**
 * DELETE /api/:collection
 * Delete multiple documents by field values
 */
export async function deleteRecordsByQuery(collectionName: string, field: string, values: string[]): Promise<number> {
  try {
    const url = `${API_BASE_URL}/${collectionName}?field=${field}&values=${values.join(',')}`;
    console.log(`[API] DELETE ${collectionName}`, { url, field, values });
    
    const response = await fetch(url, {
      method: 'DELETE'
    });

    if (!response.ok) {
      const errorText = await response.text();
      const error = new Error(`HTTP ${response.status}: ${response.statusText} - ${errorText}`);
      logApiError(`Failed to delete records from "${collectionName}"`, url, 'DELETE', error);
      throw error;
    }

    const result: ApiResponse<any> = await response.json();
    if (!result.success) {
      const error = new Error(result.error || 'Failed to delete records');
      logApiError(`Delete query failed for "${collectionName}"`, url, 'DELETE', error);
      throw error;
    }

    console.log(`[API] ✅ DELETE ${collectionName} - ${result.deletedCount || 0} records`);
    return result.deletedCount || 0;
  } catch (error) {
    console.error(`❌ Error deleting records from ${collectionName}:`, error);
    throw handleError(error);
  }
}

/**
 * DELETE /api/:collection?clearByField=true
 * Clear collection by field value
 */
export async function clearCollectionByField(collectionName: string, field: string, value: any): Promise<number> {
  try {
    const url = `${API_BASE_URL}/${collectionName}?clearByField=true&field=${field}&value=${value}`;
    console.log(`[API] DELETE ${collectionName} (clearByField)`, { url, field, value });
    
    const response = await fetch(url, {
      method: 'DELETE'
    });

    if (!response.ok) {
      const errorText = await response.text();
      const error = new Error(`HTTP ${response.status}: ${response.statusText} - ${errorText}`);
      logApiError(`Failed to clear collection by field in "${collectionName}"`, url, 'DELETE', error);
      throw error;
    }

    const result: ApiResponse<any> = await response.json();
    if (!result.success) {
      const error = new Error(result.error || 'Failed to clear collection');
      logApiError(`Clear by field failed for "${collectionName}"`, url, 'DELETE', error);
      throw error;
    }

    console.log(`[API] ✅ DELETE ${collectionName} (clearByField) - ${result.deletedCount || 0} records`);
    return result.deletedCount || 0;
  } catch (error) {
    console.error(`❌ Error clearing collection ${collectionName}:`, error);
    throw handleError(error);
  }
}

/**
 * DELETE /api/:collection?clear=true
 * Clear entire collection
 */
export async function clearCollection(collectionName: string): Promise<void> {
  try {
    const url = `${API_BASE_URL}/${collectionName}?clear=true`;
    console.log(`[API] DELETE ${collectionName} (clear all)`, { url });
    
    const response = await fetch(url, {
      method: 'DELETE'
    });

    if (!response.ok) {
      const errorText = await response.text();
      const error = new Error(`HTTP ${response.status}: ${response.statusText} - ${errorText}`);
      logApiError(`Failed to clear entire collection "${collectionName}"`, url, 'DELETE', error);
      throw error;
    }

    const result: ApiResponse<any> = await response.json();
    if (!result.success) {
      const error = new Error(result.error || 'Failed to clear entire collection');
      logApiError(`Clear all failed for "${collectionName}"`, url, 'DELETE', error);
      throw error;
    }

    console.log(`[API] ✅ DELETE ${collectionName} (clear all)`);
  } catch (error) {
    console.error(`❌ Error clearing entire collection ${collectionName}:`, error);
    throw handleError(error);
  }
}

/**
 * POST /api/:collection/query
 * Find documents by query
 */
export async function findByQuery(collectionName: string, query: Record<string, any>): Promise<any[]> {
  try {
    const url = `${API_BASE_URL}/${collectionName}/query`;
    console.log(`[API] POST ${collectionName}/query`, { url, query });
    
    const response = await fetch(url, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ query })
    });

    if (!response.ok) {
      const errorText = await response.text();
      const error = new Error(`HTTP ${response.status}: ${response.statusText} - ${errorText}`);
      logApiError(`Failed to query collection "${collectionName}"`, url, 'POST', error);
      throw error;
    }

    const result: ApiResponse<any[]> = await response.json();
    if (!result.success) {
      const error = new Error(result.error || 'Failed to query collection');
      logApiError(`Query failed for "${collectionName}"`, url, 'POST', error);
      throw error;
    }

    console.log(`[API] ✅ POST ${collectionName}/query - ${result.data?.length || 0} items`);
    return result.data || [];
  } catch (error) {
    console.error(`❌ Error querying ${collectionName}:`, error);
    throw handleError(error);
  }
}

/**
 * PATCH /api/:collection
 * Update multiple documents by filter
 */
export async function updateByQuery(collectionName: string, query: Record<string, any>, updateData: Record<string, any>): Promise<number> {
  try {
    const url = `${API_BASE_URL}/${collectionName}`;
    console.log(`[API] PATCH ${collectionName}`, { url, query, updateData });
    
    const response = await fetch(url, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ query, updateData })
    });

    if (!response.ok) {
      const errorText = await response.text();
      const error = new Error(`HTTP ${response.status}: ${response.statusText} - ${errorText}`);
      logApiError(`Failed to update documents in "${collectionName}"`, url, 'PATCH', error);
      throw error;
    }

    const result: ApiResponse<any> = await response.json();
    if (!result.success) {
      const error = new Error(result.error || 'Failed to update documents');
      logApiError(`Update query failed for "${collectionName}"`, url, 'PATCH', error);
      throw error;
    }

    console.log(`[API] ✅ PATCH ${collectionName} - ${result.modifiedCount || 0} documents updated`);
    return result.modifiedCount || 0;
  } catch (error) {
    console.error(`❌ Error updating documents in ${collectionName}:`, error);
    throw handleError(error);
  }
}

/**
 * Query by field (client-side filter)
 */
export async function queryByField(collectionName: string, field: string, value: any): Promise<any[]> {
  return getCollection(collectionName, field, value);
}

export default {
  getCollection,
  getDocumentById,
  insertDocument,
  addBatch,
  upsertDoc,
  updateDocument,
  deleteDocument,
  deleteRecordsByQuery,
  clearCollectionByField,
  clearCollection,
  findByQuery,
  updateByQuery,
  queryByField
};
