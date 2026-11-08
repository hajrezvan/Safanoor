import assert from 'node:assert/strict';

assert.notEqual(process.env.NODE_ENV, 'production', 'Run this check only against the demo seed.');
const base = process.env.TEST_API_URL || 'http://localhost:3001/api/v1';
const login = await fetch(`${base}/auth/login`, {
  method: 'POST',
  headers: { 'Content-Type': 'application/json', 'X-Client-Type': 'native' },
  body: JSON.stringify({ login: '+989100000040', password: '12345678' }),
});
assert(login.ok, 'Demo login failed.');
const { accessToken } = await login.json();
const headers = { Authorization: `Bearer ${accessToken}` };
const form = new FormData();
form.set('groupId', '20000000-0000-4000-8000-000000000003');
form.set('file', new Blob([
  'firstName,lastName,fatherName,birthDate,nationalId,phone,group\n' +
  'آزمون,پردازش پس‌زمینه,نمونه,1380/01/01,9000099986,+989100009998,20000000-0000-4000-8000-000000000003',
], { type: 'text/csv' }), 'worker-smoke.csv');
const upload = await fetch(`${base}/imports`, { method: 'POST', headers, body: form });
assert(upload.ok, 'Demo import upload failed.');
let job = await upload.json();
const deadline = Date.now() + 45000;
async function waitFor(statuses) {
  while (statuses.includes(job.status) && Date.now() < deadline) {
    await new Promise((resolve) => setTimeout(resolve, 500));
    const response = await fetch(`${base}/imports/${job.id}`, { headers });
    assert(response.ok, 'Import status could not be read.');
    job = await response.json();
  }
}
await waitFor(['queued', 'validating']);
assert(['ready', 'completed'].includes(job.status), 'Worker did not validate the import.');
assert.equal(job.errorCount, 0);
const confirm = () => fetch(`${base}/imports/${job.id}/confirm`, { method: 'POST', headers });
let response = await confirm();
assert(response.ok, 'Import confirmation failed.');
job = await response.json();
await waitFor(['committing']);
assert.equal(job.status, 'completed', 'Worker did not commit the confirmed import.');
response = await confirm();
assert.equal((await response.json()).status, 'completed');
console.log('✅ Real worker passed: queued validation, explicit confirmation, commit and idempotent retry.');
