async function check() {
  try {
    console.log('Checking health...');
    const res = await fetch('http://localhost:5000/health');
    const data = await res.json();
    console.log('Health:', JSON.stringify(data));
    
    console.log('Checking database status via /api/employees...');
    const res2 = await fetch('http://localhost:5000/api/employees');
    const data2 = await res2.json();
    console.log('API Response Success:', data2.success);
    if (!data2.success) {
      console.log('API Error:', data2.error);
    } else {
      console.log('API Data Count:', data2.data?.length);
    }
  } catch (err) {
    console.error('Check failed:', err.message);
  }
}

check();
