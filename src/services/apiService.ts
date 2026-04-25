/**
 * API Service Layer (Restful Bridge)
 * 
 * Centralized client for all backend API calls.
 * Consolidated to use the Restful URL format required by the Render production backend.
 * This file acts as a bridge to ensure all existing services (MasterData, Uploads)
 * communicate correctly with the production API.
 */

import API_BASE from '../config/api';

const BASE_URL = API_BASE;

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
 */
export async function getCollection(collection: string, field?: string, value?: any): Promise<any[]> {
  let url = `${BASE_URL}/${collection}`;
  if (field && value !== undefined) {
    url += `?field=${field}&value=${value}`;
  }
  const response = await fetchWithRetry(url);
  const result = await handleResponse<ApiResponse<any[]>>(response);
  return result.data || [];
}

/**
 * GET /api/:collection/query (Alias for queryByField)
 */
export async function queryByField(collection: string, field: string, value: any): Promise<any[]> {
  return getCollection(collection, field, value);
}

/**
 * GET /api/:collection/:id
 */
export async function getById(collection: string, id: string): Promise<any> {
  const response = await fetchWithRetry(`${BASE_URL}/${collection}/${id}`);
  const result = await handleResponse<ApiResponse<any>>(response);
  return result.data;
}

/**
 * POST /api/:collection
 */
export async function createDocument(collection: string, data: any): Promise<{ insertedId: string }> {
  const response = await fetchWithRetry(`${BASE_URL}/${collection}`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ data })
  });
  return handleResponse<any>(response);
}

/**
 * POST /api/:collection (Batch)
 */
export async function createBatch(collection: string, items: any[]): Promise<{ insertedCount: number }> {
  const response = await fetchWithRetry(`${BASE_URL}/${collection}`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ batch: true, items })
  });
  return handleResponse<any>(response);
}

/**
 * POST /api/:collection (Upsert)
 */
export async function upsertDocument(collection: string, id: string, data: any): Promise<{ upsertedId: string }> {
  const response = await fetchWithRetry(`${BASE_URL}/${collection}`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ upsert: true, id, data })
  });
  return handleResponse<any>(response);
}

/**
 * PUT /api/:collection/:id
 */
export async function updateDocument(collection: string, id: string, data: any): Promise<{ updatedId: string }> {
  const response = await fetchWithRetry(`${BASE_URL}/${collection}/${id}`, {
    method: 'PUT',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ data })
  });
  return handleResponse<any>(response);
}

/**
 * DELETE /api/:collection/:id
 */
export async function deleteDocument(collection: string, id: string): Promise<{ deletedId: string }> {
  const response = await fetchWithRetry(`${BASE_URL}/${collection}/${id}`, {
    method: 'DELETE'
  });
  return handleResponse<any>(response);
}

/**
 * DELETE /api/:collection?clear=true
 */
export async function clearCollection(collection: string): Promise<void> {
  const response = await fetchWithRetry(`${BASE_URL}/${collection}?clear=true`, {
    method: 'DELETE'
  });
  await handleResponse<any>(response);
}

/**
 * DELETE /api/:collection?clearByField=true
 */
export async function clearCollectionByField(collection: string, field: string, value: any): Promise<{ deletedCount: number }> {
  const response = await fetchWithRetry(`${BASE_URL}/${collection}?clearByField=true&field=${field}&value=${value}`, {
    method: 'DELETE'
  });
  return handleResponse<any>(response);
}

/**
 * DELETE /api/:collection?field=field&values=v1,v2
 */
export async function deleteRecordsByQuery(collection: string, field: string, values: any[]): Promise<{ deletedCount: number }> {
  const response = await fetchWithRetry(`${BASE_URL}/${collection}?field=${field}&values=${values.join(',')}`, {
    method: 'DELETE'
  });
  return handleResponse<any>(response);
}

/**
 * POST /api/:collection/query
 */
export async function findByQuery(collection: string, query: any): Promise<any[]> {
  const response = await fetchWithRetry(`${BASE_URL}/${collection}/query`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ query })
  });
  const result = await handleResponse<ApiResponse<any[]>>(response);
  return result.data || [];
}

/**
 * PATCH /api/:collection
 */
export async function updateByQuery(collection: string, query: any, updateData: any): Promise<{ modifiedCount: number }> {
  const response = await fetchWithRetry(`${BASE_URL}/${collection}`, {
    method: 'PATCH',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ query, updateData })
  });
  return handleResponse<any>(response);
}

/**
 * Health Check
 */
export async function healthCheck(): Promise<boolean> {
  try {
    const response = await fetchWithRetry(`${BASE_URL}/health`);
    return response.ok;
  } catch (error) {
    return false;
  }
}
