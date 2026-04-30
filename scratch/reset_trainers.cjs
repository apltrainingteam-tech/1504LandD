const { MongoClient } = require('mongodb');

async function run() {
  const uri = 'mongodb+srv://apltrainingteam_db_user:qbaHn8Ld0hZzdUEU@cluster0.qluikx6.mongodb.net/Ajanta?appName=Cluster0';
  const client = new MongoClient(uri);
  try {
    console.log('Connecting to MongoDB...');
    await client.connect();
    const db = client.db('Ajanta');
    const trainers = db.collection('trainers');
    
    console.log('Resetting avatarUrl for all trainers...');
    const result = await trainers.updateMany({}, { $set: { avatarUrl: null } });
    
    console.log(`Successfully reset ${result.modifiedCount} avatars.`);
  } catch (err) {
    console.error('Error:', err);
  } finally {
    await client.close();
  }
}

run();
