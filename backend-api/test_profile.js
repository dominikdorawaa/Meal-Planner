async function run() {
  const loginRes = await fetch('http://localhost:8080/api/auth/register', {
    method: 'POST', headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ email: 'test_' + Date.now() + '@test.com', password: 'password123', name: 'Test' })
  });
  const loginData = await loginRes.json();
  console.log('Login:', loginData);

  const putRes = await fetch('http://localhost:8080/api/profile', {
    method: 'PUT', headers: { 'Content-Type': 'application/json', 'Authorization': 'Bearer ' + loginData.token },
    body: JSON.stringify({
      target_kcal: 2000,
      gender: 'male',
      age: 25,
      weight: 70.0,
      goal: 'maintain',
      activity: '1.2'
    })
  });
  console.log('PUT status:', putRes.status);
  const responseData = await putRes.text();
  console.log('PUT response:', responseData);
}
run();
