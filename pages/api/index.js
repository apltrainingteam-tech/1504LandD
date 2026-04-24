import mongoose from "mongoose";

let cached = global.mongoose || { conn: null, promise: null };

async function connectDB() {
  if (cached.conn) return cached.conn;

  if (!cached.promise) {
    cached.promise = mongoose.connect(process.env.MONGODB_URI, {
      dbName: "Ajanta",
    });
  }

  cached.conn = await cached.promise;
  return cached.conn;
}

export default async function handler(req, res) {
  const { path } = req.query;

  try {
    await connectDB();
    const db = mongoose.connection.db;

    switch (path) {
      case "employees":
        return res.json(await db.collection("employees").find().toArray());

      case "teams":
        return res.json(await db.collection("teams").find().toArray());

      case "training_data":
        return res.json(await db.collection("training_data").find().toArray());

      case "eligibility_rules":
        return res.json(await db.collection("eligibility_rules").find().toArray());

      case "clusters":
        return res.json(await db.collection("clusters").find().toArray());

      case "trainers":
        return res.json(await db.collection("trainers").find().toArray());

      default:
        return res.status(404).json({ error: "Invalid path" });
    }
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: err.message });
  }
}
