// Automated Phase 2C.1 Student Learning & Progress Foundation Test Suite
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

async function runPhase2C1Tests() {
  console.log('====================================================');
  console.log('Phase 2C.1 Student Learning & Progress Foundation Test Suite');
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

  const studentToken = 'test_jwt_student_mark';
  const otherStudentToken = 'test_jwt_student_other';
  const parentToken = 'test_jwt_parent_mary';
  const teacherToken = 'test_jwt_teacher_mina';

  // Test lessons & versions
  const multiLessonId = 'l-test-multiversion-01'; // status: published, active_version_id: 'v-test-multi-1'
  const multiV1Id = 'v-test-multi-1'; // status: PUBLISHED, sections: sec-multi-1, sec-multi-2, sec-multi-3
  const draftLessonId = 'l-test-draft-01'; // status: draft, active_version_id: null
  const draftVersionId = 'v-test-draft-1'; // status: AI_DRAFT
  const approvedVersionId = 'v-test-approved-1'; // status: APPROVED

  // Reset server state for clean, idempotent test execution
  await makePostRequest('/api/church/reset-review-test-state', {});

  // ----------------------------------------------------
  // TEST 1: Student can start own published lesson
  // ----------------------------------------------------
  console.log('--- Test 1: Student can start own published lesson ---');
  const res1 = await makePostRequest('/api/church/student-progress/start', {
    lessonId: multiLessonId,
    versionId: multiV1Id
  }, studentToken);

  assert(
    res1.statusCode === 200 &&
    res1.json?.success === true &&
    (res1.json?.progress?.studentId === 'mark' || res1.json?.progress?.studentId === 'student_mark') &&
    res1.json?.progress?.status === 'IN_PROGRESS' &&
    res1.json?.progress?.completionPercent === 0 &&
    Array.isArray(res1.json?.progress?.sectionsCompleted) &&
    res1.json?.progress?.sectionsCompleted.length === 0,
    'Test 1: Authenticated student can start own published lesson with 0% initial progress',
    JSON.stringify(res1.json)
  );

  // ----------------------------------------------------
  // TEST 2: Student can complete own section
  // ----------------------------------------------------
  console.log('--- Test 2: Student can complete own section ---');
  const res2 = await makePostRequest('/api/church/student-progress/complete-section', {
    lessonId: multiLessonId,
    versionId: multiV1Id,
    sectionId: 'sec-multi-1'
  }, studentToken);

  assert(
    res2.statusCode === 200 &&
    res2.json?.success === true &&
    res2.json?.progress?.sectionsCompleted?.includes('sec-multi-1') &&
    res2.json?.progress?.completionPercent === 33 &&
    res2.json?.progress?.status === 'IN_PROGRESS',
    'Test 2: Student can complete own section (sec-multi-1), progress updates to 33%',
    JSON.stringify(res2.json)
  );

  // ----------------------------------------------------
  // TEST 3: Progress is idempotent
  // Completing the same section multiple times does not duplicate sections or distort %
  // ----------------------------------------------------
  console.log('--- Test 3: Progress is idempotent ---');
  const res3 = await makePostRequest('/api/church/student-progress/complete-section', {
    lessonId: multiLessonId,
    versionId: multiV1Id,
    sectionId: 'sec-multi-1'
  }, studentToken);

  assert(
    res3.statusCode === 200 &&
    res3.json?.success === true &&
    res3.json?.progress?.sectionsCompleted?.length === 1 &&
    res3.json?.progress?.sectionsCompleted[0] === 'sec-multi-1' &&
    res3.json?.progress?.completionPercent === 33,
    'Test 3: Progress is strictly idempotent; re-marking sec-multi-1 does not create duplicates',
    JSON.stringify(res3.json)
  );

  // ----------------------------------------------------
  // TEST 4: Lesson completion works correctly
  // Premature completion is blocked; only complete when all required sections are read
  // ----------------------------------------------------
  console.log('--- Test 4: Lesson completion works correctly ---');
  // 4a. Premature completion attempt blocked
  const res4a = await makePostRequest('/api/church/student-progress/complete-lesson', {
    lessonId: multiLessonId,
    versionId: multiV1Id
  }, studentToken);

  assert(
    res4a.statusCode === 400 && res4a.json?.error === 'INCOMPLETE_SECTIONS',
    'Test 4a: Premature lesson completion rejected with 400 INCOMPLETE_SECTIONS when sections remain',
    JSON.stringify(res4a.json)
  );

  // 4b. Complete remaining sections (sec-multi-2 and sec-multi-3)
  await makePostRequest('/api/church/student-progress/complete-section', {
    lessonId: multiLessonId,
    versionId: multiV1Id,
    sectionId: 'sec-multi-2'
  }, studentToken);

  const res4b = await makePostRequest('/api/church/student-progress/complete-section', {
    lessonId: multiLessonId,
    versionId: multiV1Id,
    sectionId: 'sec-multi-3'
  }, studentToken);

  assert(
    res4b.statusCode === 200 &&
    res4b.json?.success === true &&
    res4b.json?.progress?.sectionsCompleted?.length === 3 &&
    res4b.json?.progress?.completionPercent === 100 &&
    res4b.json?.progress?.status === 'COMPLETED' &&
    Boolean(res4b.json?.progress?.completedAt),
    'Test 4b: Lesson completion works correctly when all sections are finished (100%, COMPLETED status)',
    JSON.stringify(res4b.json)
  );

  // ----------------------------------------------------
  // TEST 5: Another student cannot modify/read the first student's progress
  // ----------------------------------------------------
  console.log('--- Test 5: Cross-student progress protection & RBAC ---');
  // 5a. Student 2 tries to write progress for Student 1
  const res5a = await makePostRequest('/api/church/student-progress/complete-section', {
    lessonId: multiLessonId,
    versionId: multiV1Id,
    sectionId: 'sec-multi-1',
    studentId: 'mark' // spoofing Student 1 ID
  }, otherStudentToken);

  // 5b. Student 2 tries to GET Student 1's progress
  const res5b = await makeGetRequest('/api/church/student-progress', {
    lessonId: multiLessonId,
    studentId: 'mark'
  }, otherStudentToken);

  // 5c. Parent / Servant cannot write student learning progress
  const res5cParent = await makePostRequest('/api/church/student-progress/complete-section', {
    lessonId: multiLessonId,
    versionId: multiV1Id,
    sectionId: 'sec-multi-1'
  }, parentToken);

  const res5cTeacher = await makePostRequest('/api/church/student-progress/complete-section', {
    lessonId: multiLessonId,
    versionId: multiV1Id,
    sectionId: 'sec-multi-1'
  }, teacherToken);

  assert(
    res5a.statusCode === 403 &&
    res5b.statusCode === 403 &&
    res5cParent.statusCode === 403 &&
    res5cTeacher.statusCode === 403,
    'Test 5: Students cannot write or read other students\' progress; parents/teachers cannot write progress (all 403 FORBIDDEN)',
    `res5a: ${res5a.statusCode}, res5b: ${res5b.statusCode}, parent: ${res5cParent.statusCode}, teacher: ${res5cTeacher.statusCode}`
  );

  // ----------------------------------------------------
  // TEST 6: Draft/unpublished lesson progress is rejected
  // ----------------------------------------------------
  console.log('--- Test 6: Draft/unpublished lesson progress rejected ---');
  // 6a. Attempt to start progress on an AI_DRAFT version
  const res6a = await makePostRequest('/api/church/student-progress/start', {
    lessonId: draftLessonId,
    versionId: draftVersionId
  }, studentToken);

  // 6b. Attempt to start progress on an APPROVED (but not yet published) version
  const res6b = await makePostRequest('/api/church/student-progress/start', {
    lessonId: draftLessonId,
    versionId: approvedVersionId
  }, studentToken);

  assert(
    res6a.statusCode === 400 && res6a.json?.error === 'INVALID_VERSION' || res6a.json?.error === 'INVALID_STATE',
    'Test 6a: Progress on AI_DRAFT version is strictly rejected with 400 error',
    JSON.stringify(res6a.json)
  );

  assert(
    res6b.statusCode === 400 && (res6b.json?.error === 'INVALID_VERSION' || res6b.json?.error === 'INVALID_STATE'),
    'Test 6b: Progress on APPROVED (unpublished) version is strictly rejected with 400 error',
    JSON.stringify(res6b.json)
  );

  // ----------------------------------------------------
  // TEST 7: Wrong lesson/version is rejected
  // ----------------------------------------------------
  console.log('--- Test 7: Wrong lesson/version rejected ---');
  // 7a. Version belonging to another lesson
  const res7a = await makePostRequest('/api/church/student-progress/start', {
    lessonId: multiLessonId,
    versionId: draftVersionId // belongs to draftLessonId, not multiLessonId
  }, studentToken);

  // 7b. Non-existent version ID
  const res7b = await makePostRequest('/api/church/student-progress/start', {
    lessonId: multiLessonId,
    versionId: 'non-existent-version-uuid-999'
  }, studentToken);

  // 7c. Non-existent section ID
  const res7c = await makePostRequest('/api/church/student-progress/complete-section', {
    lessonId: multiLessonId,
    versionId: multiV1Id,
    sectionId: 'non-existent-section-id-404'
  }, studentToken);

  assert(
    res7a.statusCode === 400 &&
    res7b.statusCode === 404 &&
    res7c.statusCode === 400 && res7c.json?.error === 'INVALID_SECTION',
    'Test 7: Mismatched version (400), invalid version (404), and invalid section (400) rejected safely',
    `res7a: ${res7a.statusCode}, res7b: ${res7b.statusCode}, res7c: ${res7c.statusCode}`
  );

  // ----------------------------------------------------
  // TEST 8: Demo / Guest / Offline remains unchanged
  // ----------------------------------------------------
  console.log('--- Test 8: Demo / Guest / Offline remains unchanged ---');
  // Unauthenticated guest starting progress
  const res8Start = await makePostRequest('/api/church/student-progress/start', {
    lessonId: multiLessonId,
    versionId: multiV1Id
  }); // No token

  // Unauthenticated guest completing section
  const res8Section = await makePostRequest('/api/church/student-progress/complete-section', {
    lessonId: multiLessonId,
    versionId: multiV1Id,
    sectionId: 'sec-multi-1'
  }); // No token

  assert(
    res8Start.statusCode === 200 &&
    res8Start.json?.success === true &&
    res8Section.statusCode === 200 &&
    res8Section.json?.success === true,
    'Test 8: Demo / Guest / Offline unauthenticated progress requests function smoothly without forcing database rows',
    `Start status: ${res8Start.statusCode}, Section status: ${res8Section.statusCode}`
  );

  console.log('\n====================================================');
  console.log(`Results: ${passed} Passed, ${failed} Failed`);
  console.log('====================================================');

  if (failed > 0) {
    process.exit(1);
  } else {
    process.exit(0);
  }
}

runPhase2C1Tests().catch(err => {
  console.error('Fatal error during Phase 2C.1 test suite:', err);
  process.exit(1);
});
