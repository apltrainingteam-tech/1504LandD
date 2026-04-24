import dotenv from 'dotenv';
dotenv.config();

import express, { Express, Request, Response, NextFunction } from 'express';
import cors from 'cors';
import {
  getCollection,
  getDocumentById,
  insertDocument,
  upsertDoc,
  deleteDocument,
  deleteRecordsByQuery,
  addBatch,
  clearCollection,
  clearCollectionByField,
  queryByField,
  findByQuery,
  updateByQuery,
  closeConnection,
  getDb,
  getDbStatus,
  initializeConnection
} from './mongodbService';

const app: Express = express();
const PORT = process.env.PORT || 5000;

// Global CORS Configuration
app.use(cors());

// Preflight support
app.options('*', cors());

app.use(express.json({ limit: '50mb' }));
app.use(express.urlencoded({ limit: '50mb', extended: true }));

// Root health check
app.get("/", (req, res) => {
  res.send("Backend is running");
});

// Request logging middleware with Origin
app.use((req: Request, res: Response, next: NextFunction) => {
  console.log(`[${new Date().toISOString()}] ${req.method} ${req.path} - Origin: ${req.headers.origin || 'No Origin'}`);
  next();
});

// Error handling middleware
app.use((err: Error, req: Request, res: Response, next: NextFunction) => {
  console.error('[ERROR]', err.message);
  res.status(500).json({ success: false, error: err.message });
});

/**
 * Health check endpoint
 */
app.get('/api/health', (req: Request, res: Response) => {
  const isConnected = getDbStatus() === 'connected';
  const status = isConnected ? 200 : 503;
  
  res.status(status).json({
    server: "running",
    database: isConnected ? "connected" : "disconnected",
    timestamp: new Date().toISOString()
  });
});

/**
 * FAIL-SAFE FOR API ROUTES
 * Ensure DB is connected before any DB operations
 */
app.use('/api', async (req: Request, res: Response, next: NextFunction) => {
  // Allow health endpoints to bypass strict db check
  if (req.path === '/health' || req.path === '/test-db') {
    return next();
  }

  try {
    const db = await getDb();
    if (!db || getDbStatus() !== 'connected') {
      return res.status(503).json({
        success: false,
        error: "Database not connected"
      });
    }
    next();
  } catch (error) {
    return res.status(503).json({
      success: false,
      error: "Database not connected"
    });
  }
});

/**
 * GET /api/:collection
 * Fetch entire collection or query by field
 * Query params:
 *   - field: field name to filter by
 *   - value: value to match
 */
app.get('/api/:collection', async (req: Request, res: Response) => {
  try {
    const { collection } = req.params;
    const { field, value } = req.query;

    console.log(`[GET /api/${collection}] field=${field}, value=${value}`);

    let result;
    if (field && value) {
      result = await queryByField(collection, String(field), value);
    } else {
      result = await getCollection(collection);
    }

    res.json({ success: true, data: result });
  } catch (error: any) {
    console.error('Error fetching collection:', error);
    res.status(500).json({ success: false, error: error.message });
  }
});

/**
 * GET /api/:collection/:id
 * Fetch single document by ID
 */
app.get('/api/:collection/:id', async (req: Request, res: Response) => {
  try {
    const { collection, id } = req.params;

    console.log(`[GET /api/${collection}/${id}]`);

    const result = await getDocumentById(collection, id);
    res.json({ success: true, data: result });
  } catch (error: any) {
    console.error('Error fetching document:', error);
    res.status(500).json({ success: false, error: error.message });
  }
});

/**
 * POST /api/:collection
 * Insert or batch insert documents
 * Body:
 *   - Single document: { data: {...} }
 *   - Batch: { batch: true, items: [{...}, {...}] }
 *   - Upsert: { upsert: true, id: "doc-id", data: {...} }
 */
app.post('/api/:collection', async (req: Request, res: Response) => {
  try {
    const { collection } = req.params;
    const { batch, items, upsert, id, data } = req.body;

    console.log(`[POST /api/${collection}] batch=${batch}, upsert=${upsert}`);
    console.log('Incoming payload:', JSON.stringify(req.body, null, 2));

    let result;

    if (batch && items) {
      if (!Array.isArray(items) || items.length === 0) {
        throw new Error('Batch items are empty or invalid');
      }

      // Check DB Status before proceeding with upload
      if (getDbStatus() !== 'connected') {
        return res.status(503).json({
          success: false,
          error: 'Database is not connected. Upload aborted.',
          dbStatus: getDbStatus()
        });
      }

      await addBatch(collection, items);

      console.log(`[BATCH INSERT] Attempted: ${items.length}`);

      return res.json({
        success: true,
        insertedCount: items.length
      });
    } else if (upsert && id) {
      // Upsert document
      await upsertDoc(collection, id, data);
      result = { upsertedId: id };
    } else if (data) {
      // Single insert
      const insertedId = await insertDocument(collection, data);
      result = { insertedId };
    } else {
      throw new Error('Invalid request body');
    }

    res.json({ success: true, ...result });
  } catch (error: any) {
    console.error('Error inserting document:', error);
    res.status(500).json({ success: false, error: error.message });
  }
});

/**
 * PUT /api/:collection/:id
 * Update single document
 * Body: { data: {...} }
 */
app.put('/api/:collection/:id', async (req: Request, res: Response) => {
  try {
    const { collection, id } = req.params;
    const { data } = req.body;

    console.log(`[PUT /api/${collection}/${id}]`);

    await upsertDoc(collection, id, data);
    res.json({ success: true, updatedId: id });
  } catch (error: any) {
    console.error('Error updating document:', error);
    res.status(500).json({ success: false, error: error.message });
  }
});

/**
 * DELETE /api/:collection/:id
 * Delete single document by ID
 */
app.delete('/api/:collection/:id', async (req: Request, res: Response) => {
  try {
    const { collection, id } = req.params;

    console.log(`[DELETE /api/${collection}/${id}]`);

    await deleteDocument(collection, id);
    res.json({ success: true, deletedId: id });
  } catch (error: any) {
    console.error('Error deleting document:', error);
    res.status(500).json({ success: false, error: error.message });
  }
});

/**
 * DELETE /api/:collection
 * Delete multiple documents by field value or clear collection
 * Query params or body:
 *   - field: field name to filter by
 *   - values: comma-separated values or array
 *   - clear: true to clear entire collection
 *   - clearByField: true with field and value to clear by field
 */
app.delete('/api/:collection', async (req: Request, res: Response) => {
  try {
    const { collection } = req.params;
    const { field, values, clear, clearByField, value } = req.query;

    console.log(`[DELETE /api/${collection}] field=${field}, values=${values}, clear=${clear}`);

    let deletedCount = 0;

    if (clear === 'true') {
      // Clear entire collection
      await clearCollection(collection);
      res.json({ success: true, clearedCollection: true });
    } else if (clearByField === 'true' && field && value) {
      // Clear by field value
      deletedCount = await clearCollectionByField(collection, String(field), value);
      res.json({ success: true, deletedCount });
    } else if (field && values) {
      // Delete by field values
      const valueArray = String(values).split(',').map(v => v.trim());
      deletedCount = await deleteRecordsByQuery(collection, String(field), valueArray);
      res.json({ success: true, deletedCount });
    } else {
      throw new Error('Missing required parameters for delete operation');
    }
  } catch (error: any) {
    console.error('Error deleting documents:', error);
    res.status(500).json({ success: false, error: error.message });
  }
});

/**
 * POST /api/:collection/query
 * Find documents by query
 * Body: { query: {...} }
 */
app.post('/api/:collection/query', async (req: Request, res: Response) => {
  try {
    const { collection } = req.params;
    const { query } = req.body;

    if (!query) {
      throw new Error('Query parameter is required');
    }

    console.log(`[POST /api/${collection}/query]`, query);

    const result = await findByQuery(collection, query);
    res.json({ success: true, data: result });
  } catch (error: any) {
    console.error('Error querying collection:', error);
    res.status(500).json({ success: false, error: error.message });
  }
});

/**
 * PATCH /api/:collection
 * Update multiple documents by filter
 * Body: { query: {...}, updateData: {...} }
 */
app.patch('/api/:collection', async (req: Request, res: Response) => {
  try {
    const { collection } = req.params;
    const { query, updateData } = req.body;

    if (!query || !updateData) {
      throw new Error('Query and updateData parameters are required');
    }

    console.log(`[PATCH /api/${collection}]`, query);

    const modifiedCount = await updateByQuery(collection, query, updateData);
    res.json({ success: true, modifiedCount });
  } catch (error: any) {
    console.error('Error updating documents:', error);
    res.status(500).json({ success: false, error: error.message });
  }
});

/**
 * GET /api/test-db
 * Ping the database to verify connectivity
 */
app.get('/api/test-db', async (req: Request, res: Response) => {
  try {
    const db = await getDb();
    await db.command({ ping: 1 });
    res.json({
      success: true,
      message: 'Database ping successful',
      status: getDbStatus(),
      timestamp: new Date().toISOString()
    });
  } catch (error: any) {
    res.status(500).json({
      success: false,
      error: error.message,
      status: getDbStatus()
    });
  }
});

/**
 * Health check endpoint
 */
app.get('/health', (req: Request, res: Response) => {
  res.json({
    status: 'ok',
    database: getDbStatus(),
    timestamp: new Date().toISOString()
  });
});

/**
 * Start server
 */
const startServer = async () => {
  await initializeConnection();

  const server = app.listen(PORT, () => {
    const timestamp = new Date().toISOString();
    console.log(`
╔════════════════════════════════════════════════════════════╗
║                                                            ║
║   ✅ PharmaIntel Backend Server Started Successfully       ║
║                                                            ║
║   Server: http://localhost:${PORT}                             ║
║   API Base: http://localhost:${PORT}/api                     ║
║   Health: http://localhost:${PORT}/health                    ║
║                                                            ║
║   CORS: Dynamic Localhost (Ports 5173, 5174, etc.)         ║
║   Mode: ${process.env.NODE_ENV || 'development'}                                    ║
║                                                            ║
║   Database: pharma_intelligence (MongoDB)                 ║
║   Timestamp: ${timestamp}                ║
║                                                            ║
╚════════════════════════════════════════════════════════════╝

Ready to accept connections!
  `);

    if (getDbStatus() === 'connected') {
      console.log('[STARTUP] ✅ MongoDB connection verified');
      console.log('[STARTUP] ✅ Backend fully initialized and ready');
    } else {
      console.error('[STARTUP] ❌ MongoDB connection failed');
      console.error('[STARTUP] Backend started but database operations will fail');
      console.error('[STARTUP] Check backend/.env for MONGO_URI and verify MongoDB Atlas network access');
    }
  });

  /**
   * Graceful shutdown
   */
  process.on('SIGINT', async () => {
    console.log('Shutting down gracefully...');
    server.close(async () => {
      await closeConnection();
      console.log('Server closed');
      process.exit(0);
    });
  });

  process.on('SIGTERM', async () => {
    console.log('Shutting down gracefully...');
    server.close(async () => {
      await closeConnection();
      console.log('Server closed');
      process.exit(0);
    });
  });
};

startServer();

