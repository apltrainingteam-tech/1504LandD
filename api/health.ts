import type { VercelRequest, VercelResponse } from '@vercel/node';
import mongoose from 'mongoose';
import dbConnect from './lib/db';

export default async function handler(req: VercelRequest, res: VercelResponse) {
  try {
    await dbConnect();
    const isConnected = mongoose.connection.readyState === 1;
    
    res.status(isConnected ? 200 : 503).json({
      status: 'ok',
      database: isConnected ? 'connected' : 'disconnected',
      dbName: mongoose.connection.db.databaseName,
      timestamp: new Date().toISOString()
    });
  } catch (error: any) {
    res.status(500).json({
      status: 'error',
      error: error.message,
      timestamp: new Date().toISOString()
    });
  }
}
