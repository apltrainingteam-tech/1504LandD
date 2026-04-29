import { MongoClient, Db, Collection, ObjectId } from 'mongodb';

const delay = (ms: number) => new Promise(resolve => setTimeout(resolve, ms));

// Connection state
let mongoClient: MongoClient | null = null;
let db: Db | null = null;
let connectionPromise: Promise<Db> | null = null;
let dbStatus: 'disconnected' | 'connected' | 'failed' = 'disconnected';

/**
 * Get current database connection status
 */
export function getDbStatus() {
  return dbStatus;
}

/**
 * Get database instance with robust connection logic
 * Implements a singleton promise pattern that resets on failure
 */
export async function getDb(): Promise<Db> {
  try {
    // 1. If already connected, return the DB
    if (db) return db;

    // 2. If connection is in progress, wait for it
    if (connectionPromise) {
      console.log('[DB] Waiting for existing connection promise...');
      return await connectionPromise;
    }

    // 3. Start a new connection attempt
    console.log('[DB] Connecting...');
    connectionPromise = (async () => {
      let uri = process.env.MONGO_URI || 'mongodb+srv://apltrainingteam_db_user:qbaHn8Ld0hZzdUEU@cluster0.qluikx6.mongodb.net/Ajanta?appName=Cluster0';
      // dbName local variable is removed

      // Password Encoding
      const pwdMatch = uri.match(/mongodb(?:\+srv)?:\/\/[^:]+:([^@]+)@/);
      if (pwdMatch && pwdMatch[1]) {
        const originalPassword = pwdMatch[1];
        if (!originalPassword.includes('%')) {
          const encodedPassword = originalPassword
            .replace(/@/g, '%40')
            .replace(/#/g, '%23')
            .replace(/\//g, '%2F');
          uri = uri.replace(`:${originalPassword}@`, `:${encodedPassword}@`);
        }
      }

      // Check DB missing and append /ajanta
      const parts = uri.split('?');
      const pathPart = parts[0];
      if (pathPart.endsWith('.net') || pathPart.endsWith('.net/')) {
        const cleanPath = pathPart.endsWith('/') ? pathPart.slice(0, -1) : pathPart;
        parts[0] = cleanPath + '/Ajanta';
        uri = parts.join('?');
      }

      // Ensure write concern / retryable in query
      if (!uri.includes('retryWrites=')) {
        uri += uri.includes('?') ? '&retryWrites=true&w=majority' : '?retryWrites=true&w=majority';
      }

      // Support debug mode (directConnection)
      if (process.env.DEBUG === 'true' && !uri.includes('directConnection=')) {
        uri += '&directConnection=true';
      }

      const safeUri = uri.replace(/:([^@]+)@/, ':****@');
      console.log(`[DB] Sanitized URI: ${safeUri}`);
      
      const clusterHost = uri.split('@')[1]?.split('/')[0] || 'unknown-cluster';
      console.log(`[DB] Connecting to ${clusterHost}...`);

      const mongoOptions = {
        serverSelectionTimeoutMS: 10000,
        socketTimeoutMS: 45000,
        family: 4, // FORCE IPv4 (CRITICAL FIX)
      } as any;

      for (let i = 1; i <= 3; i++) {
        try {
          mongoClient = new MongoClient(uri, mongoOptions);
          await mongoClient.connect();
          
          db = mongoClient.db("Ajanta");
          await db.admin().ping();
          console.log('[DB] Connected successfully');
          
          dbStatus = 'connected';
          return db;
        } catch (err: any) {
          console.error(`❌ Attempt ${i} failed`, err.message);
          
          if (i === 3) {
            throw new Error(`MongoDB connection failed after retries: ${err.message}`);
          }
          await delay(2000); // Delay between retries
        }
      }
      throw new Error("MongoDB connection failed after retries");
    })();

    return await connectionPromise;
  } catch (error: any) {
    const errorMsg = error.message || 'Unknown connection error';
    console.error('[DB] Connection failed:', errorMsg);
    
    // 🔥 CRITICAL: Reset state on failure to allow future retries
    mongoClient = null;
    db = null;
    connectionPromise = null;
    dbStatus = 'failed';

    throw error;
  }
}

/**
 * Initialize connection directly (called at server startup)
 */
export async function initializeConnection(): Promise<Db | null> {
  try {
    return await getDb();
  } catch (error: any) {
    // Error is already logged in getDb
    return null;
  }
}

/**
 * Get collection instance
 */
async function getCollection_internal(collectionName: string): Promise<Collection> {
  const db = await getDb();
  return db.collection(collectionName);
}

/**
 * Close MongoDB connection (call on app shutdown)
 */
export async function closeConnection(): Promise<void> {
  if (mongoClient) {
    await mongoClient.close();
    db = null;
    mongoClient = null;
    console.log('MongoDB connection closed');
  }
}

/**
 * GET ENTIRE COLLECTION (MongoDB)
 */
export async function getCollection(path: string): Promise<any[]> {
  console.log(`Fetching collection from path: ${path}`);
  try {
    const collection = await getCollection_internal(path);
    const documents = await collection.find({}).toArray();
    console.log(`QuerySnapshot size: ${documents.length}`);
    
    if (documents.length === 0) {
      console.log(`No documents found in collection: ${path}`);
      return [];
    }

    // Convert MongoDB _id to id for compatibility
    const result = documents.map(doc => ({
      id: doc._id?.toString?.() || doc.id || '',
      ...doc
    }));
    
    console.log(`Converted ${path} to array with length ${result.length}`);
    if (result[0]) console.log(`Sample ${path}[0] keys:`, Object.keys(result[0]));
    return result;
  } catch (error) {
    console.error(`Error fetching collection from ${path}:`, error);
    throw error;
  }
}

/**
 * QUERY (CLIENT-SIDE FILTER)
 */
export async function queryByField(
  path: string,
  field: string,
  value: any
): Promise<any[]> {
  const all = await getCollection(path);
  return all.filter(item => item[field] === value);
}

/**
 * BATCH WRITE (MongoDB)
 */
export async function addBatch(path: string, items: any[]): Promise<void> {
  console.log(`Batch writing ${items.length} items to ${path}`);
  try {
    const collection = await getCollection_internal(path);
    const operations = items.map(item => {
      // Prepare document - convert id to _id if present
      const doc = { ...item };
      if (doc.id && !doc._id) {
        doc._id = doc.id;
      }
      return {
        updateOne: {
          filter: { _id: (doc._id || new ObjectId()) as any },
          update: { $set: doc },
          upsert: true
        }
      };
    });

    await collection.bulkWrite(operations);
    console.log(`Successfully batch wrote ${items.length} items to ${path}`);
  } catch (error) {
    console.error(`Error batch writing to ${path}:`, error);
    throw error;
  }
}

/**
 * CLEAR ENTIRE COLLECTION (MongoDB)
 */
export async function clearCollection(path: string): Promise<void> {
  console.log(`Clearing collection: ${path}`);
  try {
    const collection = await getCollection_internal(path);
    const result = await collection.deleteMany({});
    console.log(`Successfully cleared ${result.deletedCount} documents from ${path}`);
  } catch (error) {
    console.error(`Error clearing collection ${path}:`, error);
    throw error;
  }
}

/**
 * CLEAR COLLECTION BY FIELD VALUE (MongoDB)
 */
export async function clearCollectionByField(
  path: string,
  field: string,
  value: any
): Promise<number> {
  console.log(`Clearing documents in ${path} where ${field} == ${value}`);
  try {
    const collection = await getCollection_internal(path);
    const result = await collection.deleteMany({ [field]: value });
    
    if (result.deletedCount === 0) {
      console.log(`No matching documents found in ${path} for ${field} == ${value}`);
      return 0;
    }
    
    console.log(`Successfully cleared ${result.deletedCount} documents from ${path} where ${field} == ${value}`);
    return result.deletedCount;
  } catch (error) {
    console.error(`Error clearing documents in ${path} where ${field} == ${value}:`, error);
    throw error;
  }
}

/**
 * UPSERT (CORE FUNCTION) (MongoDB)
 */
export async function upsertDoc(
  path: string,
  id: string,
  data: any
): Promise<void> {
  console.log(`Upserting document ${id} in ${path}`);
  try {
    const collection = await getCollection_internal(path);
    const doc = { ...data };
    
    // Use provided id or generate new ObjectId
    const _id = id || new ObjectId().toString();
    
    await collection.updateOne(
      { _id: _id as any },
      { $set: doc },
      { upsert: true }
    );
    
    console.log(`Successfully upserted document ${id} in ${path}`);
  } catch (error) {
    console.error(`Error upserting document ${id} in ${path}:`, error);
    throw error;
  }
}

/**
 * SINGLE DOCUMENT DELETE (MongoDB)
 */
export async function deleteDocument(path: string, id: string): Promise<void> {
  if (!id) throw new Error("Missing document ID");
  console.log(`Deleting document ${id} from ${path}`);
  try {
    const collection = await getCollection_internal(path);
    await collection.deleteOne({ _id: id as any });
    console.log(`Successfully deleted document ${id} from ${path}`);
  } catch (error) {
    console.error(`Error deleting document ${id} from ${path}:`, error);
    throw error;
  }
}

/**
 * DELETE RECORDS (BY FIELD VALUES) (MongoDB)
 */
export async function deleteRecordsByQuery(
  path: string,
  field: string,
  values: string[]
): Promise<number> {
  console.log(`Deleting records from ${path} where ${field} in [${values.join(', ')}]`);
  try {
    const collection = await getCollection_internal(path);
    const result = await collection.deleteMany({ [field]: { $in: values } });
    
    console.log(`Successfully deleted ${result.deletedCount} records from ${path}`);
    return result.deletedCount;
  } catch (error) {
    console.error(`Error deleting records from ${path}:`, error);
    throw error;
  }
}

/**
 * GET SINGLE DOCUMENT BY ID
 */
export async function getDocumentById(path: string, id: string): Promise<any> {
  console.log(`Fetching document ${id} from ${path}`);
  try {
    const collection = await getCollection_internal(path);
    const doc = await collection.findOne({ _id: id as any });
    
    if (!doc) {
      console.log(`Document ${id} not found in ${path}`);
      return null;
    }
    
    return {
      id: doc._id?.toString?.() || doc.id || '',
      ...doc
    };
  } catch (error) {
    console.error(`Error fetching document ${id} from ${path}:`, error);
    throw error;
  }
}

/**
 * INSERT SINGLE DOCUMENT
 */
export async function insertDocument(path: string, data: any): Promise<string> {
  console.log(`Inserting document into ${path}`);
  try {
    const collection = await getCollection_internal(path);
    const doc = { ...data };
    
    // If no _id provided, MongoDB will generate one
    const result = await collection.insertOne(doc);
    const insertedId = result.insertedId?.toString?.() || result.insertedId;
    
    console.log(`Successfully inserted document ${insertedId} into ${path}`);
    return String(insertedId);
  } catch (error) {
    console.error(`Error inserting document into ${path}:`, error);
    throw error;
  }
}

/**
 * FIND BY QUERY (MongoDB)
 */
export async function findByQuery(
  path: string,
  query: Record<string, any>
): Promise<any[]> {
  console.log(`Finding documents in ${path} with query:`, query);
  try {
    const collection = await getCollection_internal(path);
    const documents = await collection.find(query).toArray();
    
    return documents.map(doc => ({
      id: doc._id?.toString?.() || doc.id || '',
      ...doc
    }));
  } catch (error) {
    console.error(`Error finding documents in ${path}:`, error);
    throw error;
  }
}

/**
 * UPDATE MULTIPLE DOCUMENTS BY FILTER
 */
export async function updateByQuery(
  path: string,
  query: Record<string, any>,
  updateData: Record<string, any>
): Promise<number> {
  console.log(`Updating documents in ${path} with query:`, query);
  try {
    const collection = await getCollection_internal(path);
    const result = await collection.updateMany(query, { $set: updateData });
    
    console.log(`Successfully updated ${result.modifiedCount} documents in ${path}`);
    return result.modifiedCount;
  } catch (error) {
    console.error(`Error updating documents in ${path}:`, error);
    throw error;
  }
}

export default {
  getCollection,
  queryByField,
  addBatch,
  clearCollection,
  clearCollectionByField,
  upsertDoc,
  deleteDocument,
  deleteRecordsByQuery,
  getDocumentById,
  insertDocument,
  findByQuery,
  updateByQuery,
  getDb,
  getDbStatus,
  initializeConnection,
  closeConnection,
  deleteManyByQuery
};


/**
 * DELETE MANY BY COMPLEX QUERY (MongoDB)
 */
export async function deleteManyByQuery(
  path: string,
  query: Record<string, any>
): Promise<number> {
  console.log(`Deleting records from ${path} with query:`, query);
  try {
    const collection = await getCollection_internal(path);
    const result = await collection.deleteMany(query);
    console.log(`Successfully deleted ${result.deletedCount} records from ${path}`);
    return result.deletedCount;
  } catch (error) {
    console.error(`Error deleting records from ${path}:`, error);
    throw error;
  }
}
