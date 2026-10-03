// Automated Phase 2D.2 Servant Class Management & Assignment UX Test Suite
const http = require('http');
const fs = require('fs');
const path = require('path');

const PORT = 3000;
const BASE_URL = `http://localhost:${PORT}`;

function makePostRequest(path, payload, token) {
  return new Promise((resolve, reject) => {
    const data = JSON.stringify(payload);
    const headers = {
      'Content-Type': 'application/json',
      'Content-Length': Buffer.byteLength(data)
    };
    if (token) {
      headers['Authorization'] = `Bearer ${token}`;
    }

    const url = new URL(path, BASE_URL);
    const req = http.request({
      hostname: url.hostname,
      port: url.port,
      path: url.pathname,
      method: 'POST',
      headers
    }, (res) => {
      let body = '';
      res.on('data', chunk => { body += chunk; });
      res.on('end', () => {
        let json = null;
        try { json = JSON.parse(body); } catch (_) {}
        resolve({
          statusCode: res.statusCode,
          headers: res.headers,
          body,
          json
        });
      });
    });

    req.on('error', err => reject(err));
    req.write(data);
    req.end();
  });
}

function makeGetRequest(path, queryParams = {}, token) {
  return new Promise((resolve, reject) => {
    const query = new URLSearchParams(queryParams).toString();
    const fullPath = query ? `${path}?${query}` : path;
    const headers = {};
    if (token) {
      headers['Authorization'] = `Bearer ${token}`;
    }

    const url = new URL(fullPath, BASE_URL);
    const req = http.request({
      hostname: url.hostname,
      port: url.port,
      path: url.pathname + url.search,
      method: 'GET',
      headers
    }, (res) => {
      let body = '';
      res.on('data', chunk => { body += chunk; });
      res.on('end', () => {
        let json = null;
        try { json = JSON.parse(body); } catch (_) {}
        resolve({
          statusCode: res.statusCode,
          headers: res.headers,
          body,
          json
        });
      });
    });

    req.on('error', err => reject(err));
    req.end();
  });
}

async function runPhase2D2Tests() {
  console.log('====================================================');
  console.log('Phase 2D.2 Servant Class Management & Assignment UX Test Suite');
  console.log('====================================================\n');

  let passed = 0;
  let failed = 0;

  function assert(condition, message, detail = '') {
    if (condition) {
      console.log(`[PASS] ${message}`);
      passed++;
    } else {
      console.error(`[FAIL] ${message} - ${detail}`);
      failed++;
    }
  }

  const teacherMinaToken = 'test_jwt_teacher_mina';       // assigned to primary_2
  const teacherOtherToken = 'test_jwt_teacher_other';     // assigned to preparatory, angels
  const studentMarkToken = 'test_jwt_student_mark';       // student in primary_2
  const parentMaryToken = 'test_jwt_parent_mary';         // parent
  const adminPishoyToken = 'test_jwt_admin_pishoy';       // admin

  // Clean state reset
  await makePostRequest('/api/church/reset-review-test-state', {});

  // ----------------------------------------------------
  // TEST 1: Authorized servant can load own class via GET /api/church/my-class
  // ----------------------------------------------------
  console.log('--- Test 1: Authorized Servant Loads Own Class ---');
  const res1 = await makeGetRequest('/api/church/my-class', {}, teacherMinaToken);

  assert(
    res1.statusCode === 200 &&
    res1.json?.success === true &&
    res1.json?.classInfo?.classGroupId === 'primary_2' &&
    res1.json?.classInfo?.role === 'teacher' &&
    Array.isArray(res1.json?.roster) &&
    res1.json?.roster?.length > 0,
    'Test 1: Servant Mina loads own class (primary_2) and authoritative roster via GET /my-class',
    JSON.stringify(res1.json)
  );

  // ----------------------------------------------------
  // TEST 2: Authorized servant can assign eligible student
  // ----------------------------------------------------
  console.log('--- Test 2: Servant Assigns Eligible Student ---');
  const res2 = await makePostRequest('/api/church/student/class', {
    studentId: 'student-david',
    classGroupId: 'primary_2',
    grade: 'Grade 5'
  }, teacherMinaToken);

  assert(
    res2.statusCode === 200 &&
    res2.json?.success === true &&
    res2.json?.student?.studentId === 'student-david' &&
    res2.json?.student?.grade === 'Grade 5' &&
    res2.json?.student?.classGroupId === 'primary_2',
    'Test 2: Servant Mina assigns student-david to Grade 5 in primary_2',
    JSON.stringify(res2.json)
  );

  // ----------------------------------------------------
  // TEST 3: Assignment persists
  // ----------------------------------------------------
  console.log('--- Test 3: Assignment Persistence Verification ---');
  const classFile = path.join(__dirname, '..', 'uploads', 'class_roster_persistence.json');
  const fileExists = fs.existsSync(classFile);
  let fileData = null;
  if (fileExists) {
    try { fileData = JSON.parse(fs.readFileSync(classFile, 'utf-8')); } catch (_) {}
  }

  assert(
    fileExists &&
    fileData?.studentClasses?.['student-david']?.grade === 'Grade 5' &&
    fileData?.studentClasses?.['student-david']?.classGroupId === 'primary_2',
    'Test 3: Assignment is physically verified in persistent storage',
    JSON.stringify(fileData?.studentClasses?.['student-david'])
  );

  // ----------------------------------------------------
  // TEST 4: Roster reflects assignment after refresh
  // ----------------------------------------------------
  console.log('--- Test 4: Roster Refresh Reflects New Assignment ---');
  const res4 = await makeGetRequest('/api/church/my-class', {}, teacherMinaToken);
  const refreshedDavid = res4.json?.roster?.find(s => s.id === 'student-david');

  assert(
    res4.statusCode === 200 &&
    Boolean(refreshedDavid) &&
    refreshedDavid.grade === 'Grade 5' &&
    refreshedDavid.classGroupId === 'primary_2',
    'Test 4: Roster refreshed via GET /my-class accurately reflects updated Grade 5 for student-david',
    JSON.stringify(refreshedDavid)
  );

  // ----------------------------------------------------
  // TEST 5: Unrelated servant gets 403 FORBIDDEN
  // ----------------------------------------------------
  console.log('--- Test 5: Unrelated Servant Gets 403 ---');
  // Servant Other is assigned to preparatory/angels, NOT primary_2
  const res5a = await makePostRequest('/api/church/student/class', {
    studentId: 'student-david',
    classGroupId: 'primary_2',
    grade: 'Grade 5'
  }, teacherOtherToken);

  assert(
    res5a.statusCode === 403 &&
    res5a.json?.error === 'FORBIDDEN',
    'Test 5a: Unrelated servant receives 403 FORBIDDEN when attempting assignment to unassigned class',
    JSON.stringify(res5a.json)
  );

  const res5b = await makeGetRequest('/api/church/class-roster', {
    classGroupId: 'primary_2'
  }, teacherOtherToken);

  assert(
    res5b.statusCode === 403 &&
    res5b.json?.error === 'FORBIDDEN',
    'Test 5b: Unrelated servant receives 403 FORBIDDEN when attempting to read another class roster',
    JSON.stringify(res5b.json)
  );

  // ----------------------------------------------------
  // TEST 6: Student cannot assign
  // ----------------------------------------------------
  console.log('--- Test 6: Student Cannot Assign ---');
  const res6 = await makePostRequest('/api/church/student/class', {
    studentId: 'student-david',
    classGroupId: 'primary_2',
    grade: 'Grade 5'
  }, studentMarkToken);

  assert(
    res6.statusCode === 403 &&
    res6.json?.error === 'FORBIDDEN',
    'Test 6: Student receives 403 FORBIDDEN when attempting class assignment',
    JSON.stringify(res6.json)
  );

  // ----------------------------------------------------
  // TEST 7: Parent cannot assign
  // ----------------------------------------------------
  console.log('--- Test 7: Parent Cannot Assign ---');
  const res7 = await makePostRequest('/api/church/student/class', {
    studentId: 'student-david',
    classGroupId: 'primary_2',
    grade: 'Grade 5'
  }, parentMaryToken);

  assert(
    res7.statusCode === 403 &&
    res7.json?.error === 'FORBIDDEN',
    'Test 7: Parent receives 403 FORBIDDEN when attempting class assignment',
    JSON.stringify(res7.json)
  );

  // ----------------------------------------------------
  // TEST 8: Invalid grade rejected
  // ----------------------------------------------------
  console.log('--- Test 8: Invalid Grade Rejected ---');
  const res8 = await makePostRequest('/api/church/student/class', {
    studentId: 'student-david',
    classGroupId: 'primary_2',
    grade: 'KG1' // KG1 belongs to angels, NOT primary_2
  }, teacherMinaToken);

  assert(
    res8.statusCode === 400 &&
    res8.json?.error === 'INVALID_GRADE',
    'Test 8: Incompatible grade (KG1 for primary_2) rejected with 400 INVALID_GRADE',
    JSON.stringify(res8.json)
  );

  // ----------------------------------------------------
  // TEST 9: Nonexistent student rejected
  // ----------------------------------------------------
  console.log('--- Test 9: Nonexistent Student Rejected ---');
  const res9 = await makePostRequest('/api/church/student/class', {
    studentId: 'nonexistent_student_9999',
    classGroupId: 'primary_2',
    grade: 'Grade 4'
  }, teacherMinaToken);

  assert(
    res9.statusCode === 404 &&
    res9.json?.error === 'STUDENT_NOT_FOUND',
    'Test 9: Nonexistent student rejected with 404 STUDENT_NOT_FOUND',
    JSON.stringify(res9.json)
  );

  // ----------------------------------------------------
  // TEST 10: Persistence failure does not report success
  // ----------------------------------------------------
  console.log('--- Test 10: Persistence Failure Safety ---');
  // Missing required parameter (classGroupId)
  const res10a = await makePostRequest('/api/church/student/class', {
    studentId: 'student-david'
  }, teacherMinaToken);

  assert(
    res10a.statusCode === 400 &&
    res10a.json?.error === 'MISSING_PARAMS' &&
    res10a.json?.success === false,
    'Test 10a: Missing classGroupId rejected with 400 and success=false',
    JSON.stringify(res10a.json)
  );

  // Non-existent class group
  const res10b = await makePostRequest('/api/church/student/class', {
    studentId: 'student-david',
    classGroupId: 'fake_class_xyz'
  }, adminPishoyToken);

  assert(
    res10b.statusCode === 404 &&
    res10b.json?.error === 'CLASS_NOT_FOUND' &&
    res10b.json?.success === false,
    'Test 10b: Invalid class rejected with 404 and success=false',
    JSON.stringify(res10b.json)
  );

  // ----------------------------------------------------
  // TEST 11: Demo / Guest / Offline remain safe
  // ----------------------------------------------------
  console.log('--- Test 11: Demo / Guest / Offline Remain Safe ---');
  const res11a = await makeGetRequest('/api/church/my-class'); // Unauthenticated
  assert(
    res11a.statusCode === 200 &&
    res11a.json?.success === true &&
    Boolean(res11a.json?.classInfo?.classGroupId),
    'Test 11a: Unauthenticated GET /my-class returns demo student class info safely',
    JSON.stringify(res11a.json)
  );

  const res11b = await makeGetRequest('/api/church/class-roster', {
    classGroupId: 'primary_2'
  }); // Unauthenticated
  assert(
    res11b.statusCode === 200 &&
    res11b.json?.success === true &&
    Array.isArray(res11b.json?.roster) &&
    res11b.json?.roster?.length > 0,
    'Test 11b: Unauthenticated GET /class-roster returns demo roster safely',
    JSON.stringify(res11b.json)
  );

  console.log('\n====================================================');
  console.log(`Results: ${passed} Passed, ${failed} Failed`);
  console.log('====================================================\n');

  if (failed > 0) {
    process.exit(1);
  }
}

runPhase2D2Tests().catch(err => {
  console.error('Fatal error running tests:', err);
  process.exit(1);
});
