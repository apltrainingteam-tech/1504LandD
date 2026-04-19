
import { MongoClient } from 'mongodb';
import dotenv from 'dotenv';
import path from 'path';

dotenv.config({ path: 'd:/Personal/visual-L-D-Database/backend/.env' });

async function checkData() {
  const client = new MongoClient(process.env.MONGO_URI);
  try {
    await client.connect();
    const db = client.db('Ajanta');
    const collection = db.collection('training_data');
    const sample = await collection.findOne({ trainingType: 'IP' });
    console.log('Sample IP Record:', JSON.stringify(sample, null, 2));
    
    const count = await collection.countDocuments({ trainingType: 'IP' });
    console.log('Total IP Records:', count);

    const distinctDates = await collection.distinct('attendanceDate', { trainingType: 'IP' });
    console.log('Distinct Dates (first 10):', distinctDates.slice(0, 10));

  } finally {
    await client.close();
  }
}

checkData();
