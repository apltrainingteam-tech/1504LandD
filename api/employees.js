const { MongoClient } = require("mongodb");

let cachedClient = null;

async function getClient() {
  if (cachedClient) return cachedClient;

  const client = new MongoClient(process.env.MONGO_URI);
  await client.connect();

  cachedClient = client;
  return client;
}

module.exports = async (req, res) => {
  try {
    const client = await getClient();
    const db = client.db("Ajanta");

    const data = await db
      .collection("employees")
      .find()
      .limit(100)
      .toArray();

    res.status(200).json({ success: true, data });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
}
