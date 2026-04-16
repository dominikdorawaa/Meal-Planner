async function run() {
  try {
    const loginRes = await fetch('http://localhost:8080/api/auth/register', {
      method: 'POST', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email: 'test_' + Date.now() + '@test.com', password: 'password123', name: 'Test' })
    });
    const loginData = await loginRes.json();
    const putRes = await fetch('http://localhost:8080/api/profile', {
      method: 'PUT', headers: { 'Content-Type': 'application/json', 'Authorization': 'Bearer ' + loginData.token },
      body: JSON.stringify({ target_kcal: 2000, gender: 'male', age: 25, weight: 70.0, goal: 'maintain', activity: '1.2' })
    });
    const responseData = await putRes.json();
    require('fs').writeFileSync('response.json', JSON.stringify(responseData, null, 2));
  } catch (err) {
    require('fs').writeFileSync('response.json', JSON.stringify({ err: err.message }));
  }
}
run();
