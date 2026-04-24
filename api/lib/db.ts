import mongoose from 'mongoose';

const MONGODB_URI = process.env.MONGODB_URI || process.env.MONGO_URI || "";

if (!MONGODB_URI) {
  throw new Error('Please define the MONGODB_URI environment variable');
}

/**
 * Global is used here to maintain a cached connection across hot reloads
 * in development. This prevents connections growing exponentially
 * during API Route usage.
 */
let cached = (global as any).mongoose;

if (!cached) {
  cached = (global as any).mongoose = { conn: null, promise: null };
}

async function dbConnect() {
  if (cached.conn) {
    console.log('[DB] Using cached connection');
    return cached.conn;
  }

  if (!cached.promise) {
    // Robust connection options matching previous working setup
    const opts = {
      dbName: 'Ajanta',
      bufferCommands: false,
      serverSelectionTimeoutMS: 10000,
      socketTimeoutMS: 45000,
      family: 4, // Force IPv4 to prevent connection timeouts on Vercel
    };

    console.log('[DB] Connecting to MongoDB Atlas...');
    // We don't use retry logic here because Vercel functions have short timeouts
    // and caching the promise is enough.
    cached.promise = mongoose.connect(MONGODB_URI, opts).then((mongoose) => {
      console.log('[DB] Connected successfully to Ajanta DB');
      return mongoose;
    });
  }

  try {
    cached.conn = await cached.promise;
    return cached.conn;
  } catch (e: any) {
    cached.promise = null;
    console.error('[DB] Connection error:', e.message);
    throw new Error(`Database connection failed: ${e.message}`);
  }
}

// Define Models with strict: false to handle flexible MongoDB documents
const schemaOptions = { strict: false, versionKey: false };

const employeeSchema = new mongoose.Schema({}, { ...schemaOptions, collection: 'employees' });
const teamSchema = new mongoose.Schema({}, { ...schemaOptions, collection: 'teams' });
const trainingDataSchema = new mongoose.Schema({}, { ...schemaOptions, collection: 'training_data' });
const eligibilityRuleSchema = new mongoose.Schema({}, { ...schemaOptions, collection: 'eligibility_rules' });
const clusterSchema = new mongoose.Schema({}, { ...schemaOptions, collection: 'clusters' });
const trainerSchema = new mongoose.Schema({}, { ...schemaOptions, collection: 'trainers' });
const attendanceSchema = new mongoose.Schema({}, { ...schemaOptions, collection: 'attendance' });
const trainingScoreSchema = new mongoose.Schema({}, { ...schemaOptions, collection: 'training_scores' });
const trainingNominationSchema = new mongoose.Schema({}, { ...schemaOptions, collection: 'training_nominations' });
const demographicSchema = new mongoose.Schema({}, { ...schemaOptions, collection: 'demographics' });

// Export models with singleton pattern
export const Employee = mongoose.models.Employee || mongoose.model('Employee', employeeSchema);
export const Team = mongoose.models.Team || mongoose.model('Team', teamSchema);
export const TrainingData = mongoose.models.TrainingData || mongoose.model('TrainingData', trainingDataSchema);
export const EligibilityRule = mongoose.models.EligibilityRule || mongoose.model('EligibilityRule', eligibilityRuleSchema);
export const Cluster = mongoose.models.Cluster || mongoose.model('Cluster', clusterSchema);
export const Trainer = mongoose.models.Trainer || mongoose.model('Trainer', trainerSchema);
export const Attendance = mongoose.models.Attendance || mongoose.model('Attendance', attendanceSchema);
export const TrainingScore = mongoose.models.TrainingScore || mongoose.model('TrainingScore', trainingScoreSchema);
export const TrainingNomination = mongoose.models.TrainingNomination || mongoose.model('TrainingNomination', trainingNominationSchema);
export const Demographic = mongoose.models.Demographic || mongoose.model('Demographic', demographicSchema);

export default dbConnect;
