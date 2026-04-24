import mongoose from 'mongoose';

const MONGODB_URI = process.env.MONGODB_URI || process.env.MONGO_URI || "";

/**
 * Global is used here to maintain a cached connection across hot reloads
 * in development. This prevents connections growing exponentially
 * during API Route usage.
 */
let cached = (global as any).mongoose;

if (!cached) {
  cached = (global as any).mongoose = { conn: null, promise: null };
}

export async function dbConnect() {
  if (!MONGODB_URI) {
    throw new Error('Please define the MONGODB_URI environment variable');
  }

  if (cached.conn) {
    return cached.conn;
  }

  if (!cached.promise) {
    const opts = {
      dbName: 'Ajanta',
      bufferCommands: false,
      serverSelectionTimeoutMS: 10000,
      family: 4,
    };

    cached.promise = mongoose.connect(MONGODB_URI, opts).then((mongoose) => {
      return mongoose;
    });
  }

  try {
    cached.conn = await cached.promise;
    return cached.conn;
  } catch (e: any) {
    cached.promise = null;
    throw e;
  }
}

// Model registry to avoid top-level initialization
const schemaOptions: mongoose.SchemaOptions = { strict: false, versionKey: false };

export function getModel(modelName: string, collectionName: string) {
  const schema = new mongoose.Schema({}, { ...schemaOptions, collection: collectionName });
  return (mongoose.models[modelName] || mongoose.model(modelName, schema)) as any;
}
