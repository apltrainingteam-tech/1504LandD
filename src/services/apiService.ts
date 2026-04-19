/**
 * API Service Layer
 * 
 * Centralized client for all backend API calls
 * Replaces direct MongoDB access from the frontend
 * 
 * All database operations now flow through:
 * Frontend (React) → Backend API (Express) → MongoDB
 */

// Use environment variable if available, otherwise default to localhost
const BASE_URL = import.meta.env.VITE_API_URL || 'http://localhost:5000/api';

/**
 * Error response handler
 */
interface ApiResponse<T> {
  success: boolean;
  data?: T;
  error?: string;
  [key: string]: any;
}

/**
 * Helper to throw on API errors
 */
async function handleResponse<T>(response: Response): Promise<T> {
  if (!response.ok) {
    const error = await response.json().catch(() => ({ error: response.statusText }));
    throw new Error(error?.error || `API error: ${response.status}`);
  }
  return response.json();
}

/**
 * GET /api/:collection
 * Fetch entire collection
 */
export async function getCollection(collection: string): Promise<any[]> {
  const response = await fetch(`${BASE_URL}/${collection}`);
  const result = await handleResponse<ApiResponse<any[]>>(response);
  return result.data || [];
}

/**
 * GET /api/:collection?field=fieldName&value=fieldValue
 * Query collection by field value
 */
export async function queryByField(
  collection: string,
  field: string,
  value: any
): Promise<any[]> {
  const params = new URLSearchParams({
    field,
    value: String(value)
  });
  const response = await fetch(`${BASE_URL}/${collection}?${params}`);
  const result = await handleResponse<ApiResponse<any[]>>(response);
  return result.data || [];
}

/**
 * GET /api/:collection/:id
 * Fetch single document by ID
 */
export async function getById(collection: string, id: string): Promise<any> {
  const response = await fetch(`${BASE_URL}/${collection}/${id}`);
  const result = await handleResponse<ApiResponse<any>>(response);
  return result.data;
}

/**
 * POST /api/:collection
 * Insert single document
 */
export async function createDocument(
  collection: string,
  data: any
): Promise<{ insertedId: string }> {
  const response = await fetch(`${BASE_URL}/${collection}`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ data })
  });
  return handleResponse<any>(response);
}

/**
 * POST /api/:collection
 * Batch insert multiple documents
 */
export async function createBatch(
  collection: string,
  items: any[]
): Promise<{ insertedCount: number }> {
  console.log(`[API] createBatch() called for collection: ${collection}`);
  console.log(`[API] DEBUG: items.length = ${items.length}`);
  
  if (items.length > 0) {
    console.log('[API] DEBUG: First item:', JSON.stringify(items[0], null, 2));
    console.log(`[API] DEBUG: Item keys: ${Object.keys(items[0]).join(', ')}`);
  }
  
  const payload = { batch: true, items };
  console.log(`[API] DEBUG: Sending payload with batch=true, items=${items.length}`);
  console.log(`[API] DEBUG: Payload size: ${JSON.stringify(payload).length} bytes`);
  
  const response = await fetch(`${BASE_URL}/${collection}`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(payload)
  });
  
  const result = await handleResponse<any>(response);
  console.log(`[API] ✅ createBatch response:`, result);
  return result;
}

/**
 * POST /api/:collection
 * Upsert single document (insert or update)
 */
export async function upsertDocument(
  collection: string,
  id: string,
  data: any
): Promise<{ upsertedId: string }> {
  const response = await fetch(`${BASE_URL}/${collection}`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ upsert: true, id, data })
  });
  return handleResponse<any>(response);
}

/**
 * PUT /api/:collection/:id
 * Update single document
 */
export async function updateDocument(
  collection: string,
  id: string,
  data: any
): Promise<{ updatedId: string }> {
  const response = await fetch(`${BASE_URL}/${collection}/${id}`, {
    method: 'PUT',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ data })
  });
  return handleResponse<any>(response);
}

/**
 * DELETE /api/:collection/:id
 * Delete single document by ID
 */
export async function deleteDocument(
  collection: string,
  id: string
): Promise<{ deletedId: string }> {
  const response = await fetch(`${BASE_URL}/${collection}/${id}`, {
    method: 'DELETE'
  });
  return handleResponse<any>(response);
}

/**
 * DELETE /api/:collection?clear=true
 * Clear entire collection
 */
export async function clearCollection(collection: string): Promise<void> {
  const response = await fetch(`${BASE_URL}/${collection}?clear=true`, {
    method: 'DELETE'
  });
  await handleResponse<any>(response);
}

/**
 * DELETE /api/:collection?clearByField=true&field=fieldName&value=fieldValue
 * Clear collection by field value
 */
export async function clearCollectionByField(
  collection: string,
  field: string,
  value: any
): Promise<{ deletedCount: number }> {
  const params = new URLSearchParams({
    clearByField: 'true',
    field,
    value: String(value)
  });
  const response = await fetch(`${BASE_URL}/${collection}?${params}`, {
    method: 'DELETE'
  });
  return handleResponse<any>(response);
}

/**
 * DELETE /api/:collection?field=fieldName&values=val1,val2,val3
 * Delete documents by multiple field values
 */
export async function deleteRecordsByQuery(
  collection: string,
  field: string,
  values: any[]
): Promise<{ deletedCount: number }> {
  const params = new URLSearchParams({
    field,
    values: values.map(v => String(v)).join(',')
  });
  const response = await fetch(`${BASE_URL}/${collection}?${params}`, {
    method: 'DELETE'
  });
  return handleResponse<any>(response);
}

/**
 * POST /api/:collection/query
 * Find documents by MongoDB query
 */
export async function findByQuery(
  collection: string,
  query: any
): Promise<any[]> {
  const response = await fetch(`${BASE_URL}/${collection}/query`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ query })
  });
  const result = await handleResponse<ApiResponse<any[]>>(response);
  return result.data || [];
}

/**
 * PATCH /api/:collection
 * Update multiple documents by query
 */
export async function updateByQuery(
  collection: string,
  query: any,
  updateData: any
): Promise<{ modifiedCount: number }> {
  const response = await fetch(`${BASE_URL}/${collection}`, {
    method: 'PATCH',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ query, updateData })
  });
  return handleResponse<any>(response);
}

/**
 * Health check - verify backend connectivity
 */
export async function healthCheck(): Promise<boolean> {
  try {
    const response = await fetch(`${BASE_URL.replace('/api', '')}/health`);
    return response.ok;
  } catch (error) {
    console.error('[API] Health check failed:', error);
    return false;
  }
}
