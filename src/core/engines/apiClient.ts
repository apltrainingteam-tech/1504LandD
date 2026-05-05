/**
 * Frontend API Client
 * Communicates with backend server for all MongoDB operations
 *
 * Debug Layer Integration:
 *   Every fetch call is instrumented via the Debug Registry.
 *   Use DebugAPI.getApiDiagnostics(traceId) to inspect any call.
 */

import API_BASE from '../../config/api';
// Runtime URL verification – confirms which backend is active
console.log("[API BASE]", API_BASE);

interface ApiResponse<T> {
  success: boolean;
  data?: T;
  error?: string;
  [key: string]: any;
}

/**
 * Helper to handle fetch with retries (for cold starts and network glitches)
 */
async function fetchWithRetry(
  url: string,
  options: RequestInit = {},
  retries = 5,
  delay = 1000
): Promise<Response> {
  try {
    const response = await fetch(url, options);

    // If backend is cold starting, it might return 502/503/504
    if (!response.ok && [502, 503, 504].includes(response.status) && retries > 0) {
      console.warn(`[API] Backend busy (cold start?), retrying in ${delay}ms... (${retries} left)`);
      await new Promise(resolve => setTimeout(resolve, delay));
      return fetchWithRetry(url, options, retries - 1, delay * 1.2);
    }

    return response;
  } catch (error: any) {
    if (retries > 0) {
      console.warn(`[API] Network error (possibly QUIC or connection reset), retrying in ${delay}ms... (${retries} left)`, error);
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
 * GET /api/:collection
 * Fetch entire collection or query by field
 */
export async function getCollection(collectionName: string, field?: string, value?: any): Promise<any[]> {
  try {
    let url = `${API_BASE}/${collectionName}`;
    if (field && value !== undefined) {
      url += `?field=${field}&value=${value}`;
    }

    const response = await fetchWithRetry(url);
    const data = await safeParseJson(response);

    if (!response.ok) {
      console.error("API Error:", data);
      throw new Error(data.error || `API failed with status ${response.status}`);
    }

    console.log(`[API] ✅ GET ${collectionName} - ${data.data?.length || 0} items`);
    return data.data || [];
  } catch (error) {
    console.error("Network/API failure:", error);
    throw error;
  }
}

/**
 * GET /api/:collection/:id
 * Fetch single document by ID
 */
export async function getDocumentById(collectionName: string, id: string): Promise<any> {
  try {
    const url = `${API_BASE}/${collectionName}/${id}`;
    const response = await fetchWithRetry(url);
    const data = await safeParseJson(response);

    if (!response.ok) {
      console.error("API Error:", data);
      throw new Error(data.error || `API failed with status ${response.status}`);
    }

    return data.data || null;
  } catch (error) {
    console.error("Network/API failure:", error);
    throw error;
  }
}

/**
 * POST /api/:collection
 * Insert single document
 */
export async function insertDocument(collectionName: string, data: any): Promise<string> {
  try {
    const url = `${API_BASE}/${collectionName}`;
    const response = await fetchWithRetry(url, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ data })
    });
    const result = await safeParseJson(response);

    if (!response.ok) {
      console.error("API Error:", result);
      throw new Error(result.error || `API failed with status ${response.status}`);
    }

    console.log(`[API] ✅ POST ${collectionName} - ID: ${result.insertedId}`);
    return result.insertedId || '';
  } catch (error) {
    console.error("Network/API failure:", error);
    throw error;
  }
}

/**
 * POST /api/:collection (Batch)
 * Insert multiple documents
 */
export async function addBatch(collectionName: string, items: any[]): Promise<void> {
  try {
    const url = `${API_BASE}/${collectionName}`;
    const response = await fetchWithRetry(url, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ batch: true, items })
    });
    const data = await safeParseJson(response);

    if (!response.ok) {
      console.error("API Error:", data);
      throw new Error(data.error || `API failed with status ${response.status}`);
    }

    console.log(`[API] ✅ POST ${collectionName} (batch) - ${items.length} items`);
  } catch (error) {
    console.error("Network/API failure:", error);
    throw error;
  }
}

/**
 * POST /api/:collection (Upsert)
 * Insert or update document
 */
export async function upsertDoc(collectionName: string, id: string, data: any): Promise<void> {
  try {
    const url = `${API_BASE}/${collectionName}`;
    const response = await fetchWithRetry(url, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ upsert: true, id, data })
    });
    const result = await safeParseJson(response);

    if (!response.ok) {
      console.error("API Error:", result);
      throw new Error(result.error || `API failed with status ${response.status}`);
    }

    console.log(`[API] ✅ POST ${collectionName} (upsert) - ID: ${id}`);
  } catch (error) {
    console.error("Network/API failure:", error);
    throw error;
  }
}

/**
 * PUT /api/:collection/:id
 * Update single document
 */
export async function updateDocument(collectionName: string, id: string, data: any): Promise<void> {
  try {
    const url = `${API_BASE}/${collectionName}/${id}`;
    const response = await fetchWithRetry(url, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ data })
    });
    const result = await safeParseJson(response);

    if (!response.ok) {
      console.error("API Error:", result);
      throw new Error(result.error || `API failed with status ${response.status}`);
    }

    console.log(`[API] ✅ PUT ${collectionName}/${id}`);
  } catch (error) {
    console.error("Network/API failure:", error);
    throw error;
  }
}

/**
 * DELETE /api/:collection/:id
 * Delete single document
 */
export async function deleteDocument(collectionName: string, id: string): Promise<void> {
  try {
    const url = `${API_BASE}/${collectionName}/${id}`;
    const response = await fetchWithRetry(url, {
      method: 'DELETE'
    });
    const result = await safeParseJson(response);

    if (!response.ok) {
      console.error("API Error:", result);
      throw new Error(result.error || `API failed with status ${response.status}`);
    }

    console.log(`[API] ✅ DELETE ${collectionName}/${id}`);
  } catch (error) {
    console.error("Network/API failure:", error);
    throw error;
  }
}



/**
 * POST /api/:collection/query
 * Find documents by query
 */
export async function findByQuery(collectionName: string, query: Record<string, any>): Promise<any[]> {
  try {
    const url = `${API_BASE}/${collectionName}/query`;
    const response = await fetchWithRetry(url, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ query })
    });
    const result = await safeParseJson(response);

    if (!response.ok) {
      console.error("API Error:", result);
      throw new Error(result.error || `API failed with status ${response.status}`);
    }

    console.log(`[API] ✅ POST ${collectionName}/query - ${result.data?.length || 0} items`);
    return result.data || [];
  } catch (error) {
    console.error("Network/API failure:", error);
    throw error;
  }
}

/**
 * PATCH /api/:collection
 * Update multiple documents by filter
 */
export async function updateByQuery(collectionName: string, query: Record<string, any>, updateData: Record<string, any>): Promise<number> {
  try {
    const url = `${API_BASE}/${collectionName}`;
    const response = await fetchWithRetry(url, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ query, updateData })
    });
    const result = await safeParseJson(response);

    if (!response.ok) {
      console.error("API Error:", result);
      throw new Error(result.error || `API failed with status ${response.status}`);
    }

    console.log(`[API] ✅ PATCH ${collectionName} - ${result.modifiedCount || 0} documents updated`);
    return result.modifiedCount || 0;
  } catch (error) {
    console.error("Network/API failure:", error);
    throw error;
  }
}

/**
 * Query by field (client-side filter)
 */
export async function queryByField(collectionName: string, field: string, value: any): Promise<any[]> {
  return getCollection(collectionName, field, value);
}

/**
 * POST /api/upload-avatar
 * Upload a trainer avatar image
 */
export async function uploadAvatar(file: File): Promise<string> {
  try {
    const url = `${API_BASE}/upload-avatar`;
    const formData = new FormData();
    formData.append('avatar', file);

    const response = await fetchWithRetry(url, {
      method: 'POST',
      body: formData
    });
    const result = await safeParseJson(response);

    if (!response.ok) {
      throw new Error(result.error || `Upload failed with status ${response.status}`);
    }

    // Return relative URL as per architectural rules
    return result.avatarUrl;
  } catch (error) {
    console.error("Upload failure:", error);
    throw error;
  }
}



export default {
  getCollection,
  getDocumentById,
  insertDocument,
  addBatch,
  upsertDoc,
  updateDocument,
  deleteDocument,
  findByQuery,
  updateByQuery,
  queryByField,
  uploadAvatar
};


