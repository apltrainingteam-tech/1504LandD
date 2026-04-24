import mongoose from 'mongoose';

const MONGODB_URI = process.env.MONGODB_URI || process.env.MONGO_URI || "";

if (!MONGODB_URI) {
  throw new Error('Please define the MONGODB_URI environment variable inside .env');
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
    const opts = {
      dbName: 'Ajanta',
      bufferCommands: false,
    };

    console.log('[DB] Connecting to MongoDB...');
    cached.promise = mongoose.connect(MONGODB_URI, opts).then((mongoose) => {
      console.log('[DB] Connected successfully to Ajanta DB');
      return mongoose;
    });
  }

  try {
    cached.conn = await cached.promise;
  } catch (e) {
    cached.promise = null;
    console.error('[DB] Connection error:', e);
    throw e;
  }

  return cached.conn;
}

// Define Models
const employeeSchema = new mongoose.Schema({}, { strict: false, collection: 'employees' });
const teamSchema = new mongoose.Schema({}, { strict: false, collection: 'teams' });
const trainingDataSchema = new mongoose.Schema({}, { strict: false, collection: 'training_data' });
const eligibilityRuleSchema = new mongoose.Schema({}, { strict: false, collection: 'eligibility_rules' });
const clusterSchema = new mongoose.Schema({}, { strict: false, collection: 'clusters' });
const trainerSchema = new mongoose.Schema({}, { strict: false, collection: 'trainers' });
const attendanceSchema = new mongoose.Schema({}, { strict: false, collection: 'attendance' });
const trainingScoreSchema = new mongoose.Schema({}, { strict: false, collection: 'training_scores' });
const trainingNominationSchema = new mongoose.Schema({}, { strict: false, collection: 'training_nominations' });
const demographicSchema = new mongoose.Schema({}, { strict: false, collection: 'demographics' });

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
