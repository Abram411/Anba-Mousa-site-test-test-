// Automated Phase 2D.1 Church Classes & Roster Foundation Test Suite
const http = require('http');

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

async function runPhase2D1Tests() {
  console.log('====================================================');
  console.log('Phase 2D.1 Church Classes & Roster Foundation Test Suite');
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
  const studentOtherToken = 'test_jwt_student_other';     // student in preparatory
  const parentMaryToken = 'test_jwt_parent_mary';         // parent
  const adminPishoyToken = 'test_jwt_admin_pishoy';       // admin

  // Reset server state for clean, deterministic test execution
  await makePostRequest('/api/church/reset-review-test-state', {});

  // ----------------------------------------------------
  // TEST 1: Authenticated student has authoritative class membership
  // ----------------------------------------------------
  console.log('--- Test 1: Student Class Membership ---');
  const res1a = await makeGetRequest('/api/church/my-class', {}, studentMarkToken);
  assert(
    res1a.statusCode === 200 &&
    res1a.json?.success === true &&
    res1a.json?.classInfo?.classGroupId === 'primary_2' &&
    res1a.json?.classInfo?.grade === 'Grade 4',
    'Test 1a: Student Mark has authoritative association to primary_2 (Grade 4)',
    JSON.stringify(res1a.json)
  );

  const res1b = await makeGetRequest('/api/church/my-class', {}, studentOtherToken);
  assert(
    res1b.statusCode === 200 &&
    res1b.json?.success === true &&
    res1b.json?.classInfo?.classGroupId === 'preparatory' &&
    res1b.json?.classInfo?.grade === 'Prep 1',
    'Test 1b: Student Other has authoritative association to preparatory (Prep 1)',
    JSON.stringify(res1b.json)
  );

  // ----------------------------------------------------
  // TEST 2: Authorized servant can view own class roster
  // ----------------------------------------------------
  console.log('--- Test 2: Authorized Servant Views Own Roster ---');
  const res2 = await makeGetRequest('/api/church/class-roster', {
    classGroupId: 'primary_2'
  }, teacherMinaToken);

  const studentIds = (res2.json?.roster || []).map(s => s.id);

  assert(
    res2.statusCode === 200 &&
    res2.json?.success === true &&
    res2.json?.classGroupId === 'primary_2' &&
    Array.isArray(res2.json?.roster) &&
    studentIds.includes('mark') &&
    studentIds.includes('student-david') &&
    !studentIds.includes('other'),
    'Test 2: Servant Mina views own class roster (primary_2); unrelated students excluded',
    JSON.stringify(res2.json)
  );

  // ----------------------------------------------------
  // TEST 3: Unrelated servant cannot view that roster
  // ----------------------------------------------------
  console.log('--- Test 3: Unrelated Servant Cannot View Roster ---');
  const res3 = await makeGetRequest('/api/church/class-roster', {
    classGroupId: 'primary_2'
  }, teacherOtherToken);

  assert(
    res3.statusCode === 403 &&
    res3.json?.error === 'FORBIDDEN',
    'Test 3: Unrelated servant rejected with 403 FORBIDDEN when attempting to view primary_2 roster',
    JSON.stringify(res3.json)
  );

  // ----------------------------------------------------
  // TEST 4: Student cannot modify class assignment
  // ----------------------------------------------------
  console.log('--- Test 4: Student Cannot Modify Class Assignment ---');
  const res4 = await makePostRequest('/api/church/student/class', {
    studentId: 'mark',
    classGroupId: 'secondary',
    grade: 'Sec 1'
  }, studentMarkToken);

  assert(
    res4.statusCode === 403 &&
    res4.json?.error === 'FORBIDDEN',
    'Test 4: Student cannot modify own or other class assignment (403 FORBIDDEN)',
    JSON.stringify(res4.json)
  );

  // ----------------------------------------------------
  // TEST 5: Parent cannot modify class assignment
  // ----------------------------------------------------
  console.log('--- Test 5: Parent Cannot Modify Class Assignment ---');
  const res5 = await makePostRequest('/api/church/student/class', {
    studentId: 'mark',
    classGroupId: 'secondary',
    grade: 'Sec 1'
  }, parentMaryToken);

  assert(
    res5.statusCode === 403 &&
    res5.json?.error === 'FORBIDDEN',
    'Test 5: Parent cannot modify class assignments (403 FORBIDDEN)',
    JSON.stringify(res5.json)
  );

  // ----------------------------------------------------
  // TEST 6: Student cannot access class roster data
  // ----------------------------------------------------
  console.log('--- Test 6: Student Cannot Access Roster Data ---');
  const res6 = await makeGetRequest('/api/church/class-roster', {
    classGroupId: 'primary_2'
  }, studentMarkToken);

  assert(
    res6.statusCode === 403 &&
    res6.json?.error === 'FORBIDDEN',
    'Test 6: Student cannot access class roster data (403 FORBIDDEN)',
    JSON.stringify(res6.json)
  );

  // ----------------------------------------------------
  // TEST 7: Unauthorized / invalid class access is rejected
  // ----------------------------------------------------
  console.log('--- Test 7: Unauthorized Class Access Rejected ---');
  // Servant Other attempts to assign a student to primary_2
  const res7a = await makePostRequest('/api/church/student/class', {
    studentId: 'other',
    classGroupId: 'primary_2',
    grade: 'Grade 5'
  }, teacherOtherToken);

  assert(
    res7a.statusCode === 403 &&
    res7a.json?.error === 'FORBIDDEN',
    'Test 7a: Servant cannot assign students to a class they do not teach (403 FORBIDDEN)',
    JSON.stringify(res7a.json)
  );

  // Non-existent class group
  const res7b = await makeGetRequest('/api/church/class-roster', {
    classGroupId: 'invalid_class_999'
  }, adminPishoyToken);

  assert(
    res7b.statusCode === 404 &&
    res7b.json?.error === 'CLASS_NOT_FOUND',
    'Test 7b: Querying non-existent class roster returns 404 CLASS_NOT_FOUND',
    JSON.stringify(res7b.json)
  );

  // ----------------------------------------------------
  // TEST 8: Authorized teacher/admin can update class assignment
  // ----------------------------------------------------
  console.log('--- Test 8: Authorized Class Assignment Management ---');
  // Servant Mina assigns student-david to Grade 5 in primary_2
  const res8a = await makePostRequest('/api/church/student/class', {
    studentId: 'student-david',
    classGroupId: 'primary_2',
    grade: 'Grade 5'
  }, teacherMinaToken);

  assert(
    res8a.statusCode === 200 &&
    res8a.json?.success === true &&
    res8a.json?.student?.grade === 'Grade 5',
    'Test 8a: Authorized servant Mina can update student grade within authorized class',
    JSON.stringify(res8a.json)
  );

  // Admin assigns student to preparatory
  const res8b = await makePostRequest('/api/church/student/class', {
    studentId: 'c1',
    classGroupId: 'preparatory',
    grade: 'Prep 1'
  }, adminPishoyToken);

  assert(
    res8b.statusCode === 200 &&
    res8b.json?.success === true &&
    res8b.json?.student?.classGroupId === 'preparatory',
    'Test 8b: Admin can assign student across classes with church-wide authority',
    JSON.stringify(res8b.json)
  );

  // ----------------------------------------------------
  // TEST 9: Student data privacy - only permitted fields exposed
  // ----------------------------------------------------
  console.log('--- Test 9: Student Data Privacy ---');
  const rosterStudent = res2.json?.roster?.[0];
  const forbiddenFields = ['password', 'parentPin', 'screenTimeSeconds', 'privateNotes', 'phone'];
  const hasForbidden = rosterStudent && forbiddenFields.some(f => f in rosterStudent);
  const hasPermitted = rosterStudent && rosterStudent.id && rosterStudent.name && rosterStudent.grade && rosterStudent.avatarUrl;

  assert(
    hasPermitted && !hasForbidden,
    'Test 9: Roster view exposes strictly permitted fields (id, name, grade, avatarUrl, learningSummary) without privacy leaks',
    JSON.stringify(rosterStudent)
  );

  // ----------------------------------------------------
  // TEST 10: Existing learning/mastery access remains secure
  // ----------------------------------------------------
  console.log('--- Test 10: Existing Learning & Mastery Security ---');
  // Teacher Mina can view student Mark's mastery
  const res10a = await makeGetRequest('/api/church/student-mastery', {
    lessonId: 'l-test-multiversion-01',
    studentId: 'mark'
  }, teacherMinaToken);

  assert(
    res10a.statusCode === 200 &&
    res10a.json?.success === true &&
    res10a.json?.mastery?.studentId === 'mark',
    'Test 10a: Authorized servant can inspect student learning mastery from previous phase',
    JSON.stringify(res10a.json)
  );

  // Student Mark cannot view another student's mastery
  const res10b = await makeGetRequest('/api/church/student-mastery', {
    lessonId: 'l-test-multiversion-01',
    studentId: 'other'
  }, studentMarkToken);

  assert(
    res10b.statusCode === 403 &&
    res10b.json?.error === 'FORBIDDEN',
    'Test 10b: Cross-student learning data isolation remains strictly enforced (403 FORBIDDEN)',
    JSON.stringify(res10b.json)
  );

  // ----------------------------------------------------
  // TEST 11: Demo / Guest / Offline Mode Unchanged
  // ----------------------------------------------------
  console.log('--- Test 11: Demo / Guest / Offline Unchanged ---');
  const res11a = await makeGetRequest('/api/church/class-roster', {
    classGroupId: 'primary_2'
  }); // No token

  assert(
    res11a.statusCode === 200 &&
    res11a.json?.success === true &&
    Array.isArray(res11a.json?.roster) &&
    res11a.json?.roster?.length > 0,
    'Test 11a: Unauthenticated GET /class-roster returns demo roster without errors',
    JSON.stringify(res11a.json)
  );

  const res11b = await makeGetRequest('/api/church/my-class'); // No token
  assert(
    res11b.statusCode === 200 &&
    res11b.json?.success === true &&
    res11b.json?.classInfo?.classGroupId === 'primary_2',
    'Test 11b: Unauthenticated GET /my-class returns demo student class association',
    JSON.stringify(res11b.json)
  );

  console.log('\n====================================================');
  console.log(`Results: ${passed} Passed, ${failed} Failed`);
  console.log('====================================================\n');

  if (failed > 0) {
    process.exit(1);
  }
}

runPhase2D1Tests().catch(err => {
  console.error('Fatal error running tests:', err);
  process.exit(1);
});
