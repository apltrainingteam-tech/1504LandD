const { MongoClient } = require('mongodb');

async function checkDb() {
  const uri = 'mongodb+srv://apltrainingteam_db_user:qbaHn8Ld0hZzdUEU@cluster0.qluikx6.mongodb.net/Ajanta?retryWrites=true&w=majority';
  const client = new MongoClient(uri);
  try {
    await client.connect();
    const db = client.db('Ajanta');
    const records = await db.collection('training_data').find({}).limit(5).toArray();
    console.log("Records found:", records.length);
    records.forEach(r => console.log(JSON.stringify(r, null, 2)));
  } catch (err) {
    console.error(err);
  } finally {
    await client.close();
  }
}

checkDb();
