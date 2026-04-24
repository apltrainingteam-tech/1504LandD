import type { VercelRequest, VercelResponse } from '@vercel/node';
import mongoose from 'mongoose';

/**
 * Unified Backend Handler
 * Consolidates all API routes into a single serverless function.
 */

const MONGODB_URI = process.env.MONGODB_URI || process.env.MONGO_URI || "";

// Connection Singleton
let cached = (global as any).mongoose;
if (!cached) {
  cached = (global as any).mongoose = { conn: null, promise: null };
}

async function dbConnect() {
  if (!MONGODB_URI) throw new Error('MONGODB_URI is not defined');
  if (cached.conn) return cached.conn;
  if (!cached.promise) {
    cached.promise = mongoose.connect(MONGODB_URI, { 
      dbName: 'Ajanta',
      bufferCommands: false,
    }).then((m) => m);
  }
  cached.conn = await cached.promise;
  return cached.conn;
}

// Simple Model Factory
function getModel(collectionName: string) {
  const modelName = collectionName.charAt(0).toUpperCase() + collectionName.slice(1);
  const schema = new mongoose.Schema({}, { strict: false, versionKey: false, collection: collectionName });
  return mongoose.models[modelName] || mongoose.model(modelName, schema);
}

export default async function handler(req: VercelRequest, res: VercelResponse) {
  const { path } = req.query;

  try {
    // 1. Connect to MongoDB (Ajanta DB)
    await dbConnect();
    console.log(`[DB] Connection successful to Ajanta`);

    // 2. Validate Path & Collection
    let collectionName = "";
    switch(path) {
      case "employees":
        collectionName = "employees";
        break;
      case "teams":
        collectionName = "teams";
        break;
      case "training_data":
        collectionName = "training_data";
        break;
      case "eligibility_rules":
        collectionName = "eligibility_rules";
        break;
      case "clusters":
        collectionName = "clusters";
        break;
      case "trainers":
        collectionName = "trainers";
        break;
      case "attendance":
        collectionName = "attendance";
        break;
      case "demographics":
        collectionName = "demographics";
        break;
      case "training_nominations":
        collectionName = "training_nominations";
        break;
      case "training_scores":
        collectionName = "training_scores";
        break;
      case "health":
        return res.status(200).json({ success: true, status: 'ok', db: 'Ajanta' });
      default:
        console.log(`[API] Path not found: ${path}`);
        return res.status(404).json({ success: false, error: "Endpoint not found" });
    }

    console.log(`[API] Targeting collection: ${collectionName}`);

    // 3. Get Model
    const Model = getModel(collectionName) as any;
    
    // Debug log record count
    const count = await Model.countDocuments();
    console.log(`[DB] Collection: ${collectionName} | Record count: ${count}`);

    // 4. CRUD Logic
    const { id, action, field, value, values, clear, clearByField, batch, upsert, query: bodyQuery } = { ...req.query, ...req.body } as any;

    switch (req.method) {
      case 'GET':
        if (id) {
          const doc = await Model.findById(id).lean();
          return res.status(200).json({ success: true, data: doc });
        }
        
        let findQuery = {};
        if (field && value) {
          findQuery = { [field]: value };
        }
        
        const data = await Model.find(findQuery).limit(1000).lean();
        return res.status(200).json({ 
          success: true, 
          count: data.length, 
          data: data.map((d: any) => ({ ...d, id: d._id.toString() })) 
        });

      case 'POST':
        if (action === 'query') {
          const result = await Model.find(bodyQuery || {}).lean();
          return res.status(200).json({ success: true, data: result.map((d: any) => ({ ...d, id: d._id.toString() })) });
        }

        if (batch && Array.isArray(req.body.items)) {
          const operations = req.body.items.map((item: any) => ({
            updateOne: {
              filter: { _id: item.id || item._id || new mongoose.Types.ObjectId() },
              update: { $set: item },
              upsert: true
            }
          }));
          const result = await Model.bulkWrite(operations);
          return res.status(200).json({ success: true, insertedCount: result.upsertedCount + result.modifiedCount });
        }

        if (upsert && id) {
          const result = await Model.findByIdAndUpdate(id, req.body.data, { upsert: true, new: true }).lean();
          return res.status(200).json({ success: true, upsertedId: id, data: result });
        }

        const newDoc = await Model.create(req.body.data);
        return res.status(201).json({ success: true, insertedId: newDoc._id });

      case 'PUT':
        if (id) {
          await Model.findByIdAndUpdate(id, req.body.data);
          return res.status(200).json({ success: true, updatedId: id });
        }
        return res.status(400).json({ success: false, error: 'Missing ID' });

      case 'PATCH':
        const patchResult = await Model.updateMany(req.body.query, { $set: req.body.updateData });
        return res.status(200).json({ success: true, modifiedCount: patchResult.modifiedCount });

      case 'DELETE':
        if (id) {
          await Model.findByIdAndDelete(id);
          return res.status(200).json({ success: true, deletedId: id });
        }
        
        if (clear === 'true') {
          await Model.deleteMany({});
          return res.status(200).json({ success: true, clearedCollection: true });
        }
        
        if (clearByField === 'true' && field && value) {
          const delResult = await Model.deleteMany({ [field]: value });
          return res.status(200).json({ success: true, deletedCount: delResult.deletedCount });
        }
        
        if (field && values) {
          const valArray = String(values).split(',');
          const delResult = await Model.deleteMany({ [field]: { $in: valArray } });
          return res.status(200).json({ success: true, deletedCount: delResult.deletedCount });
        }
        
        return res.status(400).json({ success: false, error: 'Invalid delete parameters' });

      default:
        return res.status(405).json({ success: false, error: `Method ${req.method} Not Allowed` });
    }

  } catch (error: any) {
    console.error(`[API ERROR] path=${path}:`, error.message);
    return res.status(500).json({ success: false, error: error.message });
  }
}
