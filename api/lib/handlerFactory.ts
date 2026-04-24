import type { VercelRequest, VercelResponse } from '@vercel/node';
import mongoose from 'mongoose';
import dbConnect from './db';

export function createHandler(Model: mongoose.Model<any>) {
  return async (req: VercelRequest, res: VercelResponse) => {
    try {
      await dbConnect();
      const dbName = mongoose.connection.db?.databaseName || 'unknown';
      const { id, action, field, value, values, clear, clearByField, batch, upsert, query: bodyQuery } = { ...req.query, ...req.body } as any;

      const collectionName = Model.collection.name;
      console.log(`[API] ${req.method} /api/${collectionName} (DB: ${dbName})`);
      console.log(`[API] Query Params:`, JSON.stringify(req.query));
      console.log(`[API] Body Action: ${action}`);

      switch (req.method) {
        case 'GET':
          if (id) {
            const doc = await Model.findById(id).lean();
            return res.status(200).json({ success: true, data: doc });
          }
          
          let query = {};
          if (field && value) {
            query = { [field]: value };
          }
          
          const data = await Model.find(query).limit(1000).lean();
          console.log(`[API] ${collectionName}: Found ${data.length} records`);
          return res.status(200).json({ 
            success: true, 
            count: data.length, 
            data: data.map(d => ({ ...d, id: d._id.toString() })) 
          });

        case 'POST':
          if (action === 'query') {
            const result = await Model.find(bodyQuery || {}).lean();
            return res.status(200).json({ success: true, data: result.map(d => ({ ...d, id: d._id.toString() })) });
          }

          if (batch && Array.isArray(req.body.items) && req.body.items.length > 0) {
            console.log(`[API] Performing bulk write of ${req.body.items.length} items`);
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
          res.setHeader('Allow', ['GET', 'POST', 'PUT', 'PATCH', 'DELETE']);
          return res.status(405).json({ success: false, error: `Method ${req.method} Not Allowed` });
      }
    } catch (error: any) {
      console.error(`[API ERROR] /api/${Model.collection.name}:`, error.message);
      return res.status(500).json({ success: false, error: error.message });
    }
  };
}
