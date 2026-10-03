// Automated Phase 2D.1-P Class & Servant Persistence Test Suite
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

async function runPhase2D1PTests() {
  console.log('====================================================');
  console.log('Phase 2D.1-P Persist Class & Servant Assignments Test Suite');
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

  // Clean state reset
  await makePostRequest('/api/church/reset-review-test-state', {});

  // ----------------------------------------------------
  // TEST 1: Student Class Assignment Persistence
  // ----------------------------------------------------
  console.log('--- Test 1: Student Class Assignment Persistence ---');
  // Update student-david to Grade 6 in primary_2
  const res1 = await makePostRequest('/api/church/student/class', {
    studentId: 'student-david',
    classGroupId: 'primary_2',
    grade: 'Grade 6'
  }, teacherMinaToken);

  assert(
    res1.statusCode === 200 &&
    res1.json?.success === true &&
    res1.json?.student?.grade === 'Grade 6' &&
    res1.json?.relationshipPersisted === true,
    'Test 1a: Teacher Mina assigns student-david to Grade 6 in primary_2',
    JSON.stringify(res1.json)
  );

  // Check persistent file on disk
  const classFile = path.join(__dirname, '..', 'uploads', 'class_roster_persistence.json');
  const fileExists = fs.existsSync(classFile);
  let fileContent = null;
  if (fileExists) {
    try { fileContent = JSON.parse(fs.readFileSync(classFile, 'utf-8')); } catch (_) {}
  }

  assert(
    fileExists &&
    fileContent &&
    fileContent.studentClasses?.['student-david']?.grade === 'Grade 6' &&
    fileContent.studentClasses?.['student-david']?.classGroupId === 'primary_2',
    'Test 1b: Assignment is physically written to persistent storage (class_roster_persistence.json)',
    JSON.stringify(fileContent?.studentClasses?.['student-david'])
  );

  // ----------------------------------------------------
  // TEST 2: Servant -> Student Relationship Persistence
  // ----------------------------------------------------
  console.log('--- Test 2: Servant -> Student Relationship Persistence ---');
  const rels = fileContent?.teacherStudentRelationships || [];
  const foundRel = rels.find(r => r.teacherId === 'mina' && r.studentId === 'student-david');

  assert(
    Boolean(foundRel) &&
    foundRel.relationshipType === 'teacher_student',
    'Test 2: Servant teacher_student relationship persisted to relationship store',
    JSON.stringify(foundRel)
  );

  // ----------------------------------------------------
  // TEST 3: Read Paths Derivation from Canonical Grades
  // ----------------------------------------------------
  console.log('--- Test 3: Read Paths Canonical Derivation ---');
  const res3a = await makeGetRequest('/api/church/my-class', {}, studentMarkToken);
  assert(
    res3a.statusCode === 200 &&
    res3a.json?.success === true &&
    res3a.json?.classInfo?.classGroupId === 'primary_2' &&
    res3a.json?.classInfo?.grade === 'Grade 4',
    'Test 3a: GET /my-class derives primary_2 class group from Grade 4',
    JSON.stringify(res3a.json)
  );

  const res3b = await makeGetRequest('/api/church/my-class', {}, studentOtherToken);
  assert(
    res3b.statusCode === 200 &&
    res3b.json?.success === true &&
    res3b.json?.classInfo?.classGroupId === 'preparatory' &&
    res3b.json?.classInfo?.grade === 'Prep 1',
    'Test 3b: GET /my-class derives preparatory class group from Prep 1',
    JSON.stringify(res3b.json)
  );

  const res3c = await makeGetRequest('/api/church/class-roster', { classGroupId: 'primary_2' }, teacherMinaToken);
  const davidInRoster = res3c.json?.roster?.find(s => s.id === 'student-david');
  assert(
    res3c.statusCode === 200 &&
    davidInRoster &&
    davidInRoster.grade === 'Grade 6',
    'Test 3c: GET /class-roster reflects the persisted Grade 6 for student-david',
    JSON.stringify(davidInRoster)
  );

  // ----------------------------------------------------
  // TEST 4: Student Data Privacy on Persistent Reads
  // ----------------------------------------------------
  console.log('--- Test 4: Student Data Privacy on Reads ---');
  const privateFields = ['email', 'password', 'parent_id', 'parentPin', 'screen_time_seconds', 'points'];
  const hasPrivateInClassInfo = privateFields.some(f => f in (res3a.json?.classInfo || {}));
  const hasPrivateInRoster = res3c.json?.roster?.some(s => privateFields.some(f => f in s));

  assert(
    !hasPrivateInClassInfo && !hasPrivateInRoster,
    'Test 4: Neither /my-class nor /class-roster leaks private profile fields',
    JSON.stringify({ classInfo: res3a.json?.classInfo, rosterSample: res3c.json?.roster?.[0] })
  );

  // ----------------------------------------------------
  // TEST 5: RBAC Restrictions Remain Authoritative
  // ----------------------------------------------------
  console.log('--- Test 5: RBAC Restrictions ---');
  // Student cannot update class
  const res5a = await makePostRequest('/api/church/student/class', {
    studentId: 'student-david',
    classGroupId: 'primary_2',
    grade: 'Grade 5'
  }, studentMarkToken);

  assert(
    res5a.statusCode === 403 &&
    res5a.json?.error === 'FORBIDDEN',
    'Test 5a: Student cannot modify class assignment (403 FORBIDDEN)',
    JSON.stringify(res5a.json)
  );

  // Parent cannot update class
  const res5b = await makePostRequest('/api/church/student/class', {
    studentId: 'student-david',
    classGroupId: 'primary_2',
    grade: 'Grade 5'
  }, parentMaryToken);

  assert(
    res5b.statusCode === 403 &&
    res5b.json?.error === 'FORBIDDEN',
    'Test 5b: Parent cannot modify class assignment (403 FORBIDDEN)',
    JSON.stringify(res5b.json)
  );

  // Unrelated servant cannot assign to primary_2
  const res5c = await makePostRequest('/api/church/student/class', {
    studentId: 'student-david',
    classGroupId: 'primary_2',
    grade: 'Grade 5'
  }, teacherOtherToken);

  assert(
    res5c.statusCode === 403 &&
    res5c.json?.error === 'FORBIDDEN',
    'Test 5c: Unrelated servant cannot assign students to primary_2 (403 FORBIDDEN)',
    JSON.stringify(res5c.json)
  );

  // ----------------------------------------------------
  // TEST 6: Failure Safety - Clean Server Errors
  // ----------------------------------------------------
  console.log('--- Test 6: Failure Safety ---');
  // Invalid grade that does not map to class group
  const res6a = await makePostRequest('/api/church/student/class', {
    studentId: 'student-david',
    classGroupId: 'primary_2',
    grade: 'Prep 2' // Prep 2 belongs to preparatory, not primary_2
  }, teacherMinaToken);

  assert(
    res6a.statusCode === 400 &&
    res6a.json?.error === 'INVALID_GRADE',
    'Test 6a: Incompatible grade rejected cleanly with 400 INVALID_GRADE',
    JSON.stringify(res6a.json)
  );

  // Missing studentId
  const res6b = await makePostRequest('/api/church/student/class', {
    classGroupId: 'primary_2'
  }, teacherMinaToken);

  assert(
    res6b.statusCode === 400 &&
    res6b.json?.error === 'MISSING_PARAMS',
    'Test 6b: Missing params rejected cleanly with 400 MISSING_PARAMS',
    JSON.stringify(res6b.json)
  );

  // Non-existent class group
  const res6c = await makePostRequest('/api/church/student/class', {
    studentId: 'student-david',
    classGroupId: 'non_existent_group'
  }, adminPishoyToken);

  assert(
    res6c.statusCode === 404 &&
    res6c.json?.error === 'CLASS_NOT_FOUND',
    'Test 6c: Non-existent class group rejected with 404 CLASS_NOT_FOUND',
    JSON.stringify(res6c.json)
  );

  console.log('\n====================================================');
  console.log(`Results: ${passed} Passed, ${failed} Failed`);
  console.log('====================================================\n');

  if (failed > 0) {
    process.exit(1);
  }
}

runPhase2D1PTests().catch(err => {
  console.error('Fatal error running tests:', err);
  process.exit(1);
});
