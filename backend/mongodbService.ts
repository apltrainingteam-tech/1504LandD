import { MongoClient, Db, Collection, ObjectId } from 'mongodb';

// MongoDB connection details
const MONGO_URI = process.env.MONGO_URI || 'mongodb+srv://apltrainingteam_db_user:qbaHn8Ld0hZzdUEU@cluster0.qluikx6.mongodb.net/?appName=Cluster0';
const DB_NAME = 'Ajanta';

let mongoClient: MongoClient | null = null;
let mongoDb: Db | null = null;

/**
 * Initialize MongoDB connection
 */
async function initializeConnection(): Promise<Db> {
  try {
    if (mongoDb) {
      console.log('MongoDB connection already established');
      return mongoDb;
    }

    console.log('Initializing MongoDB connection...');
    mongoClient = new MongoClient(MONGO_URI);
    await mongoClient.connect();
    mongoDb = mongoClient.db(DB_NAME);
    
    // Verify connection
    await mongoDb.admin().ping();
    console.log('MongoDB connected successfully to database:', DB_NAME);
    return mongoDb;
  } catch (error) {
    console.error('Failed to connect to MongoDB:', error);
    throw error;
  }
}

/**
 * Get database instance
 */
export async function getDb(): Promise<Db> {
  if (!mongoDb) {
    await initializeConnection();
  }
  return mongoDb!;
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
    mongoDb = null;
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
          filter: { _id: doc._id || new ObjectId() },
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
      { _id },
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
    await collection.deleteOne({ _id: id });
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
    const doc = await collection.findOne({ _id: id });
    
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
    return insertedId;
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
  closeConnection
};
