const { MongoClient } = require('mongodb');

async function checkDb() {
  const uri = 'mongodb+srv://apltrainingteam_db_user:qbaHn8Ld0hZzdUEU@cluster0.qluikx6.mongodb.net/Ajanta?retryWrites=true&w=majority';
  const client = new MongoClient(uri);
  try {
    await client.connect();
    const db = client.db('Ajanta');

    // Check all distinct attendanceDates for IP training
    const ipDates = await db.collection('training_data').distinct('attendanceDate', { _templateType: 'IP' });
    console.log("All IP attendance dates:", ipDates.sort());

    // Check Mar 2026 IP records
    const mar2026 = await db.collection('training_data').find({ 
      _templateType: 'IP', 
      attendanceDate: { $regex: '^2026-03' }
    }).limit(5).toArray();
    console.log("\nMar 2026 IP Records found:", mar2026.length);
    mar2026.forEach(r => {
      console.log(`  emp:${r.employeeId} date:${r.attendanceDate} percent:${r.percent} scores:`, r.scores);
    });

    // Check records where percent is NOT null
    const withScores = await db.collection('training_data').find({ 
      _templateType: 'IP', 
      percent: { $ne: null, $exists: true }
    }).limit(5).toArray();
    console.log("\nIP Records with non-null percent:", withScores.length);
    withScores.forEach(r => {
      console.log(`  emp:${r.employeeId} date:${r.attendanceDate} percent:${r.percent}`);
    });

  } catch (err) {
    console.error(err);
  } finally {
    await client.close();
  }
}

checkDb();
