/**
 * Frontend API Client
 * Communicates with backend server for all MongoDB operations
 */

import { API_BASE } from '../config/api';

// Runtime URL verification – confirms which backend is active
console.log("[API BASE]", API_BASE);

interface ApiResponse<T> {
  success: boolean;
  data?: T;
  error?: string;
  [key: string]: any;
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

    const response = await fetch(url);
    const data = await response.json();
    
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
    const response = await fetch(url);
    const data = await response.json();
    
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
    const response = await fetch(url, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ data })
    });
    const result = await response.json();

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
    const response = await fetch(url, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ batch: true, items })
    });
    const data = await response.json();

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
    const response = await fetch(url, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ upsert: true, id, data })
    });
    const result = await response.json();

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
    const response = await fetch(url, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ data })
    });
    const result = await response.json();

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
    const response = await fetch(url, {
      method: 'DELETE'
    });
    const result = await response.json();

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
 * DELETE /api/:collection
 * Delete multiple documents by field values
 */
export async function deleteRecordsByQuery(collectionName: string, field: string, values: string[]): Promise<number> {
  try {
    const url = `${API_BASE}/${collectionName}?field=${field}&values=${values.join(',')}`;
    const response = await fetch(url, {
      method: 'DELETE'
    });
    const result = await response.json();

    if (!response.ok) {
      console.error("API Error:", result);
      throw new Error(result.error || `API failed with status ${response.status}`);
    }

    console.log(`[API] ✅ DELETE ${collectionName} - ${result.deletedCount || 0} records`);
    return result.deletedCount || 0;
  } catch (error) {
    console.error("Network/API failure:", error);
    throw error;
  }
}

/**
 * DELETE /api/:collection?clearByField=true
 * Clear collection by field value
 */
export async function clearCollectionByField(collectionName: string, field: string, value: string): Promise<number> {
  try {
    const url = `${API_BASE}/${collectionName}?clearByField=true&field=${field}&value=${value}`;
    const response = await fetch(url, {
      method: 'DELETE'
    });
    const result = await response.json();

    if (!response.ok) {
      console.error("API Error:", result);
      throw new Error(result.error || `API failed with status ${response.status}`);
    }

    console.log(`[API] ✅ DELETE ${collectionName} (clearByField) - ${result.deletedCount || 0} records`);
    return result.deletedCount || 0;
  } catch (error) {
    console.error("Network/API failure:", error);
    throw error;
  }
}

/**
 * DELETE /api/:collection?clear=true
 * Clear entire collection
 */
export async function clearCollection(collectionName: string): Promise<void> {
  try {
    const url = `${API_BASE}/${collectionName}?clear=true`;
    const response = await fetch(url, {
      method: 'DELETE'
    });
    const result = await response.json();

    if (!response.ok) {
      console.error("API Error:", result);
      throw new Error(result.error || `API failed with status ${response.status}`);
    }

    console.log(`[API] ✅ DELETE ${collectionName} (clear all)`);
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
    const response = await fetch(url, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ query })
    });
    const result = await response.json();

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
    const response = await fetch(url, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ query, updateData })
    });
    const result = await response.json();

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
