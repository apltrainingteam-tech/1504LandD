/**
 * API Service Layer
 * 
 * Centralized client for all backend API calls
 * Replaces direct MongoDB access from the frontend
 * 
 * All database operations now flow through:
 * Frontend (React) → Backend API (Express) → MongoDB
 */

import API_BASE from '../config/api';

// Use environment variable if available, otherwise default to localhost
const BASE_URL = API_BASE;

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
 * Helper to handle fetch with retries (for cold starts)
 */
async function fetchWithRetry(url: string, options: RequestInit = {}, retries = 2, delay = 2000): Promise<Response> {
  try {
    const response = await fetch(url, options);
    
    // If backend is cold starting, it might return 502/503/504
    if (!response.ok && [502, 503, 504].includes(response.status) && retries > 0) {
      console.warn(`[API] Backend busy (cold start?), retrying in ${delay}ms... (${retries} left)`);
      await new Promise(resolve => setTimeout(resolve, delay));
      return fetchWithRetry(url, options, retries - 1, delay * 1.5);
    }
    
    return response;
  } catch (error) {
    if (retries > 0) {
      console.warn(`[API] Network error, retrying in ${delay}ms... (${retries} left)`, error);
      await new Promise(resolve => setTimeout(resolve, delay));
      return fetchWithRetry(url, options, retries - 1, delay * 1.5);
    }
    throw error;
  }
}

/**
 * Helper to parse JSON safely and handle HTML error pages
 */
async function safeParseJson(response: Response): Promise<any> {
  const text = await response.text();
  try {
    return JSON.parse(text);
  } catch (e) {
    console.error(`[API] Non-JSON response from ${response.url}:`, text.substring(0, 200));
    throw new Error(`API did not return JSON (Status ${response.status}). The server might be down or misconfigured.`);
  }
}

/**
 * Helper to throw on API errors
 */
async function handleResponse<T>(response: Response): Promise<T> {
  const data = await safeParseJson(response);
  if (!response.ok) {
    throw new Error(data?.error || `API error: ${response.status}`);
  }
  return data;
}

/**
 * GET /api/:collection
 * Fetch entire collection
 */
export async function getCollection(collection: string): Promise<any[]> {
  const response = await fetchWithRetry(`${BASE_URL}?path=${collection}`);
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
    path: collection,
    field,
    value: String(value)
  });
  const response = await fetchWithRetry(`${BASE_URL}?${params}`);
  const result = await handleResponse<ApiResponse<any[]>>(response);
  return result.data || [];
}

/**
 * GET /api/:collection/:id
 * Fetch single document by ID
 */
export async function getById(collection: string, id: string): Promise<any> {
  const response = await fetchWithRetry(`${BASE_URL}?path=${collection}&id=${id}`);
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
  const response = await fetchWithRetry(`${BASE_URL}?path=${collection}`, {
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

  const response = await fetchWithRetry(`${BASE_URL}?path=${collection}`, {
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
  const response = await fetchWithRetry(`${BASE_URL}?path=${collection}`, {
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
  const response = await fetchWithRetry(`${BASE_URL}?path=${collection}&id=${id}`, {
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
  const response = await fetchWithRetry(`${BASE_URL}?path=${collection}&id=${id}`, {
    method: 'DELETE'
  });
  return handleResponse<any>(response);
}

/**
 * DELETE /api/:collection?clear=true
 * Clear entire collection
 */
export async function clearCollection(collection: string): Promise<void> {
  const response = await fetchWithRetry(`${BASE_URL}?path=${collection}&clear=true`, {
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
    path: collection,
    clearByField: 'true',
    field,
    value: String(value)
  });
  const response = await fetchWithRetry(`${BASE_URL}?${params}`, {
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
    path: collection,
    field,
    values: values.map(v => String(v)).join(',')
  });
  const response = await fetchWithRetry(`${BASE_URL}?${params}`, {
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
  const response = await fetchWithRetry(`${BASE_URL}?path=${collection}&action=query`, {
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
  const response = await fetchWithRetry(`${BASE_URL}?path=${collection}`, {
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
    const response = await fetchWithRetry(`${BASE_URL}?path=health`);
    return response.ok;
  } catch (error) {
    console.error('[API] Health check failed:', error);
    return false;
  }
}
