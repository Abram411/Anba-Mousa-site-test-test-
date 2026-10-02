// Automated Phase 2C.3 Student Mastery & Learning Results Test Suite
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

async function runPhase2C3Tests() {
  console.log('====================================================');
  console.log('Phase 2C.3 Student Mastery & Learning Results Test Suite');
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

  // Test lesson & versions
  const multiLessonId = 'l-test-multiversion-01'; // status: published, active_version_id: 'v-test-multi-1'
  const multiV1Id = 'v-test-multi-1'; // status: PUBLISHED, 3 sections, quiz with 2 questions
  const draftLessonId = 'l-test-draft-01'; // status: draft, active_version_id: null
  const draftVersionId = 'v-test-draft-1'; // status: AI_DRAFT
  const approvedVersionId = 'v-test-approved-1'; // status: APPROVED

  // Reset server review state for clean, deterministic test execution
  await makePostRequest('/api/church/reset-review-test-state', {});

  // ----------------------------------------------------
  // TEST 1: Initial mastery state for untouched published lesson
  // ----------------------------------------------------
  console.log('--- Test 1: Initial mastery state ---');
  const res1 = await makeGetRequest('/api/church/student-mastery', {
    lessonId: multiLessonId
  }, studentToken);

  assert(
    res1.statusCode === 200 &&
    res1.json?.success === true &&
    res1.json?.mastery?.status === 'NOT_STARTED' &&
    res1.json?.mastery?.contentCompleted === false &&
    res1.json?.mastery?.completionPercent === 0 &&
    res1.json?.mastery?.quizScore === 0,
    'Test 1: Initial mastery status is NOT_STARTED with 0% progress and 0 quiz score',
    JSON.stringify(res1.json)
  );

  // ----------------------------------------------------
  // TEST 2: Deterministic evaluation during progress (Developing state)
  // ----------------------------------------------------
  console.log('--- Test 2: Developing state after partial progress ---');
  // Student starts lesson and completes section 1
  await makePostRequest('/api/church/student-progress/start', {
    lessonId: multiLessonId,
    versionId: multiV1Id
  }, studentToken);

  await makePostRequest('/api/church/student-progress/complete-section', {
    lessonId: multiLessonId,
    versionId: multiV1Id,
    sectionId: 'sec-multi-1'
  }, studentToken);

  const res2 = await makeGetRequest('/api/church/student-mastery', {
    lessonId: multiLessonId
  }, studentToken);

  assert(
    res2.statusCode === 200 &&
    res2.json?.success === true &&
    res2.json?.mastery?.status === 'DEVELOPING' &&
    res2.json?.mastery?.contentCompleted === false &&
    res2.json?.mastery?.completionPercent === 33 &&
    res2.json?.mastery?.versionId === multiV1Id,
    'Test 2: Student mastery transitions to DEVELOPING when sections are in progress',
    JSON.stringify(res2.json)
  );

  // ----------------------------------------------------
  // TEST 3: Needs Review state on low quiz score (< 60%)
  // ----------------------------------------------------
  console.log('--- Test 3: Needs Review state after low quiz score ---');
  // Student submits 0/2 correct answers (0%)
  await makePostRequest('/api/church/student-quiz/submit', {
    lessonId: multiLessonId,
    versionId: multiV1Id,
    quizId: 'quiz-multi-01',
    answers: [
      { questionId: 'q-multi-1', selectedOptionIndex: 3 }, // Incorrect (correct is 0)
      { questionId: 'q-multi-2', selectedOptionIndex: 3 }  // Incorrect (correct is 1)
    ]
  }, studentToken);

  const res3 = await makeGetRequest('/api/church/student-mastery', {
    lessonId: multiLessonId
  }, studentToken);

  assert(
    res3.statusCode === 200 &&
    res3.json?.success === true &&
    res3.json?.mastery?.status === 'NEEDS_REVIEW' &&
    res3.json?.mastery?.quizScore === 0 &&
    res3.json?.mastery?.contentCompleted === false,
    'Test 3: Student mastery transitions to NEEDS_REVIEW when assessment score is below 60%',
    JSON.stringify(res3.json)
  );

  // ----------------------------------------------------
  // TEST 4: Full Mastery achieved only when 100% content completed AND quiz >= 80%
  // ----------------------------------------------------
  console.log('--- Test 4: Mastered state when 100% content complete and quiz >= 80% ---');
  // Complete remaining sections (2 and 3)
  await makePostRequest('/api/church/student-progress/complete-section', {
    lessonId: multiLessonId,
    versionId: multiV1Id,
    sectionId: 'sec-multi-2'
  }, studentToken);

  await makePostRequest('/api/church/student-progress/complete-section', {
    lessonId: multiLessonId,
    versionId: multiV1Id,
    sectionId: 'sec-multi-3'
  }, studentToken);

  // Complete lesson content
  await makePostRequest('/api/church/student-progress/complete-lesson', {
    lessonId: multiLessonId,
    versionId: multiV1Id
  }, studentToken);

  // Retake quiz and get 100% (2/2 correct)
  await makePostRequest('/api/church/student-quiz/submit', {
    lessonId: multiLessonId,
    versionId: multiV1Id,
    quizId: 'quiz-multi-01',
    answers: [
      { questionId: 'q-multi-1', selectedOptionIndex: 0 }, // Correct
      { questionId: 'q-multi-2', selectedOptionIndex: 1 }  // Correct
    ]
  }, studentToken);

  // Explicitly evaluate student mastery
  const res4 = await makePostRequest('/api/church/student-mastery/evaluate', {
    lessonId: multiLessonId,
    versionId: multiV1Id
  }, studentToken);

  assert(
    res4.statusCode === 200 &&
    res4.json?.success === true &&
    res4.json?.mastery?.status === 'MASTERED' &&
    res4.json?.mastery?.contentCompleted === true &&
    res4.json?.mastery?.completionPercent === 100 &&
    res4.json?.mastery?.quizScore === 100,
    'Test 4: Full MASTERED status achieved after 100% content completed and 100% quiz score',
    JSON.stringify(res4.json)
  );

  // ----------------------------------------------------
  // TEST 5: Client cannot fabricate mastery values
  // ----------------------------------------------------
  console.log('--- Test 5: Client-fabricated values are completely ignored ---');
  // Other student tries to fake mastery with a fabricated payload
  const res5 = await makePostRequest('/api/church/student-mastery/evaluate', {
    lessonId: multiLessonId,
    versionId: multiV1Id,
    status: 'MASTERED',
    quizScore: 100,
    contentCompleted: true,
    completionPercent: 100
  }, otherStudentToken);

  assert(
    res5.statusCode === 200 &&
    res5.json?.success === true &&
    res5.json?.mastery?.status === 'NOT_STARTED' &&
    res5.json?.mastery?.contentCompleted === false &&
    res5.json?.mastery?.completionPercent === 0 &&
    res5.json?.mastery?.quizScore === 0,
    'Test 5: Client-fabricated mastery payload ignored; server evaluated true status NOT_STARTED',
    JSON.stringify(res5.json)
  );

  // ----------------------------------------------------
  // TEST 6: Cross-student protection & RBAC
  // ----------------------------------------------------
  console.log('--- Test 6: Cross-student protection & RBAC ---');
  // Student A tries to view Student B's mastery -> 403
  const res6a = await makeGetRequest('/api/church/student-mastery', {
    lessonId: multiLessonId,
    studentId: 'user_student_other_102'
  }, studentToken);

  assert(
    res6a.statusCode === 403 &&
    res6a.json?.error === 'FORBIDDEN',
    'Test 6a: Student cannot read another student\'s mastery (403 FORBIDDEN)',
    JSON.stringify(res6a.json)
  );

  // Student A tries to evaluate for Student B -> 403
  const res6b = await makePostRequest('/api/church/student-mastery/evaluate', {
    lessonId: multiLessonId,
    versionId: multiV1Id,
    studentId: 'user_student_other_102'
  }, studentToken);

  assert(
    res6b.statusCode === 403 &&
    res6b.json?.error === 'FORBIDDEN',
    'Test 6b: Student cannot evaluate mastery for another student (403 FORBIDDEN)',
    JSON.stringify(res6b.json)
  );

  // Parents and servants cannot evaluate student mastery directly -> 403
  const res6c = await makePostRequest('/api/church/student-mastery/evaluate', {
    lessonId: multiLessonId,
    versionId: multiV1Id,
    studentId: 'user_student_mark_101'
  }, teacherToken);

  assert(
    res6c.statusCode === 403 &&
    res6c.json?.error === 'FORBIDDEN',
    'Test 6c: Servants cannot directly write mastery evaluations (403 FORBIDDEN)',
    JSON.stringify(res6c.json)
  );

  // Teacher can read student's mastery for pastoral oversight
  const res6d = await makeGetRequest('/api/church/student-mastery', {
    lessonId: multiLessonId,
    studentId: 'mark'
  }, teacherToken);

  assert(
    res6d.statusCode === 200 &&
    res6d.json?.success === true &&
    res6d.json?.mastery?.studentId === 'mark' &&
    res6d.json?.mastery?.status === 'MASTERED',
    'Test 6d: Teacher can view student mastery results for pastoral guidance',
    JSON.stringify(res6d.json)
  );

  // ----------------------------------------------------
  // TEST 7: Version Safety & Draft Rejection
  // ----------------------------------------------------
  console.log('--- Test 7: Version Safety & Draft Rejection ---');
  // Mastery on draft lesson rejected
  const res7a = await makeGetRequest('/api/church/student-mastery', {
    lessonId: draftLessonId
  }, studentToken);

  assert(
    res7a.statusCode === 400 &&
    res7a.json?.error === 'INVALID_STATE',
    'Test 7a: Mastery query on draft lesson rejected with 400 INVALID_STATE',
    JSON.stringify(res7a.json)
  );

  // Mastery evaluate on AI_DRAFT version rejected
  const res7b = await makePostRequest('/api/church/student-mastery/evaluate', {
    lessonId: draftLessonId,
    versionId: draftVersionId
  }, studentToken);

  assert(
    res7b.statusCode === 400,
    'Test 7b: Mastery evaluate on AI_DRAFT version strictly rejected with 400 error',
    JSON.stringify(res7b.json)
  );

  // Mastery evaluate on APPROVED (unpublished) version rejected
  const res7c = await makePostRequest('/api/church/student-mastery/evaluate', {
    lessonId: draftLessonId,
    versionId: approvedVersionId
  }, studentToken);

  assert(
    res7c.statusCode === 400,
    'Test 7c: Mastery evaluate on APPROVED (unpublished) version strictly rejected with 400 error',
    JSON.stringify(res7c.json)
  );

  // ----------------------------------------------------
  // TEST 8: Progress Integration & Non-Falsification
  // ----------------------------------------------------
  console.log('--- Test 8: Progress Integration & Non-Falsification ---');
  // Check that evaluating mastery does not falsely mark lesson content completed in progress
  const progressRes = await makeGetRequest('/api/church/student-progress', {
    lessonId: multiLessonId
  }, otherStudentToken);

  assert(
    progressRes.statusCode === 200 &&
    (progressRes.json?.progress === null || progressRes.json?.progress?.status !== 'COMPLETED'),
    'Test 8: Mastery evaluation never falsely marks lesson complete in progress store',
    JSON.stringify(progressRes.json)
  );

  // ----------------------------------------------------
  // TEST 9: Demo / Guest / Offline Mode Unchanged
  // ----------------------------------------------------
  console.log('--- Test 9: Demo / Guest / Offline remains unchanged ---');
  const res9a = await makeGetRequest('/api/church/student-mastery', {
    lessonId: multiLessonId
  }); // No token

  assert(
    res9a.statusCode === 200 &&
    res9a.json?.success === true &&
    res9a.json?.mastery !== undefined,
    'Test 9a: Unauthenticated GET /student-mastery functions smoothly in demo mode',
    JSON.stringify(res9a.json)
  );

  const res9b = await makePostRequest('/api/church/student-mastery/evaluate', {
    lessonId: multiLessonId,
    versionId: multiV1Id
  }); // No token

  assert(
    res9b.statusCode === 200 &&
    res9b.json?.success === true &&
    res9b.json?.mastery !== undefined,
    'Test 9b: Unauthenticated POST /student-mastery/evaluate functions smoothly in demo mode',
    JSON.stringify(res9b.json)
  );

  console.log('\n====================================================');
  console.log(`Results: ${passed} Passed, ${failed} Failed`);
  console.log('====================================================\n');

  if (failed > 0) {
    process.exit(1);
  }
}

runPhase2C3Tests().catch(err => {
  console.error('Fatal error running tests:', err);
  process.exit(1);
});
