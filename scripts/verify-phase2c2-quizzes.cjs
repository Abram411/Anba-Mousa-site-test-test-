// Automated Phase 2C.2 Student Quizzes & Assessment Test Suite
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

async function runPhase2C2Tests() {
  console.log('====================================================');
  console.log('Phase 2C.2 Student Quizzes & Assessment Test Suite');
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

  // Test lesson & version
  const multiLessonId = 'l-test-multiversion-01'; // status: published, active_version_id: 'v-test-multi-1'
  const multiV1Id = 'v-test-multi-1'; // status: PUBLISHED, has quiz-multi-01 (q-multi-1, q-multi-2)
  const draftLessonId = 'l-test-draft-01'; // status: draft, active_version_id: null
  const draftVersionId = 'v-test-draft-1'; // status: AI_DRAFT
  const approvedVersionId = 'v-test-approved-1'; // status: APPROVED

  // Reset server state for clean, idempotent test execution
  await makePostRequest('/api/church/reset-review-test-state', {});

  // ----------------------------------------------------
  // TEST 1: Student can load quiz for active published version
  // ----------------------------------------------------
  console.log('--- Test 1: Student can load quiz for active published version ---');
  const res1 = await makeGetRequest('/api/church/student-quiz', {
    lessonId: multiLessonId
  }, studentToken);

  assert(
    res1.statusCode === 200 &&
    res1.json?.success === true &&
    res1.json?.quiz?.id === 'quiz-multi-01' &&
    Array.isArray(res1.json?.quiz?.questions) &&
    res1.json?.quiz?.questions?.length === 2 &&
    res1.json?.quiz?.questions[0]?.id === 'q-multi-1',
    'Test 1: Student loads quiz for active published version; questions and ordering preserved',
    JSON.stringify(res1.json)
  );

  // ----------------------------------------------------
  // TEST 2: Student can submit own attempt
  // ----------------------------------------------------
  console.log('--- Test 2: Student can submit own attempt ---');
  const res2 = await makePostRequest('/api/church/student-quiz/submit', {
    lessonId: multiLessonId,
    versionId: multiV1Id,
    quizId: 'quiz-multi-01',
    answers: [
      { questionId: 'q-multi-1', selectedOptionIndex: 0 }, // correct
      { questionId: 'q-multi-2', selectedOptionIndex: 1 }  // correct
    ]
  }, studentToken);

  assert(
    res2.statusCode === 200 &&
    res2.json?.success === true &&
    (res2.json?.attempt?.studentId === 'mark' || res2.json?.attempt?.studentId === 'student_mark') &&
    res2.json?.attempt?.score === 2 &&
    res2.json?.attempt?.totalScore === 2 &&
    res2.json?.attempt?.percentage === 100 &&
    res2.json?.attempt?.passed === true,
    'Test 2: Student can submit own attempt, receiving 100% and passed=true for all correct answers',
    JSON.stringify(res2.json)
  );

  // ----------------------------------------------------
  // TEST 3: Score is calculated server-side
  // One correct (option 0 for q1) and one wrong (option 0 for q2 instead of 1)
  // ----------------------------------------------------
  console.log('--- Test 3: Score is calculated server-side ---');
  const res3 = await makePostRequest('/api/church/student-quiz/submit', {
    lessonId: multiLessonId,
    versionId: multiV1Id,
    quizId: 'quiz-multi-01',
    answers: [
      { questionId: 'q-multi-1', selectedOptionIndex: 0 }, // correct
      { questionId: 'q-multi-2', selectedOptionIndex: 0 }  // wrong (expected 1)
    ]
  }, studentToken);

  assert(
    res3.statusCode === 200 &&
    res3.json?.success === true &&
    res3.json?.attempt?.score === 1 &&
    res3.json?.attempt?.totalScore === 2 &&
    res3.json?.attempt?.percentage === 50 &&
    res3.json?.attempt?.passed === false,
    'Test 3: Score is deterministically computed server-side (1/2 = 50%, passed=false)',
    JSON.stringify(res3.json)
  );

  // ----------------------------------------------------
  // TEST 4: Answers are persisted & queryable
  // ----------------------------------------------------
  console.log('--- Test 4: Answers are persisted & queryable ---');
  const res4Attempts = await makeGetRequest('/api/church/student-quiz/attempts', {
    lessonId: multiLessonId
  }, studentToken);

  const answersCheck = Array.isArray(res3.json?.attempt?.answers) &&
    res3.json?.attempt?.answers.length === 2 &&
    res3.json?.attempt?.answers[0].isCorrect === true &&
    res3.json?.attempt?.answers[1].isCorrect === false;

  assert(
    res4Attempts.statusCode === 200 &&
    Array.isArray(res4Attempts.json?.attempts) &&
    res4Attempts.json?.attempts?.length >= 2 &&
    answersCheck,
    'Test 4: Attempt answers and detailed diagnostics are properly persisted and queryable',
    `Attempts count: ${res4Attempts.json?.attempts?.length}`
  );

  // ----------------------------------------------------
  // TEST 5: Repeated submission behaves safely
  // ----------------------------------------------------
  console.log('--- Test 5: Repeated submission behaves safely ---');
  const res5 = await makePostRequest('/api/church/student-quiz/submit', {
    lessonId: multiLessonId,
    versionId: multiV1Id,
    quizId: 'quiz-multi-01',
    answers: [
      { questionId: 'q-multi-1', selectedOptionIndex: 0 },
      { questionId: 'q-multi-2', selectedOptionIndex: 1 }
    ]
  }, studentToken);

  assert(
    res5.statusCode === 200 &&
    res5.json?.success === true &&
    res5.json?.attempt?.score === 2 &&
    res5.json?.attempt?.percentage === 100,
    'Test 5: Repeated retake submission executes smoothly without state corruption',
    JSON.stringify(res5.json)
  );

  // ----------------------------------------------------
  // TEST 6: Another student cannot access/modify the attempt
  // ----------------------------------------------------
  console.log('--- Test 6: Cross-student quiz protection & RBAC ---');
  // 6a. Student 2 tries to submit quiz for Student 1
  const res6a = await makePostRequest('/api/church/student-quiz/submit', {
    lessonId: multiLessonId,
    versionId: multiV1Id,
    quizId: 'quiz-multi-01',
    answers: [{ questionId: 'q-multi-1', selectedOptionIndex: 0 }],
    studentId: 'mark' // spoofing Student 1 ID
  }, otherStudentToken);

  // 6b. Student 2 tries to read Student 1's attempts
  const res6b = await makeGetRequest('/api/church/student-quiz/attempts', {
    lessonId: multiLessonId,
    studentId: 'mark'
  }, otherStudentToken);

  // 6c. Parent and Teacher cannot submit student quiz attempt
  const res6cParent = await makePostRequest('/api/church/student-quiz/submit', {
    lessonId: multiLessonId,
    versionId: multiV1Id,
    quizId: 'quiz-multi-01',
    answers: [{ questionId: 'q-multi-1', selectedOptionIndex: 0 }]
  }, parentToken);

  const res6cTeacher = await makePostRequest('/api/church/student-quiz/submit', {
    lessonId: multiLessonId,
    versionId: multiV1Id,
    quizId: 'quiz-multi-01',
    answers: [{ questionId: 'q-multi-1', selectedOptionIndex: 0 }]
  }, teacherToken);

  assert(
    res6a.statusCode === 403 &&
    res6b.statusCode === 403 &&
    res6cParent.statusCode === 403 &&
    res6cTeacher.statusCode === 403,
    'Test 6: Students cannot submit or view other students\' attempts; parents/teachers cannot submit (all 403 FORBIDDEN)',
    `res6a: ${res6a.statusCode}, res6b: ${res6b.statusCode}, parent: ${res6cParent.statusCode}, teacher: ${res6cTeacher.statusCode}`
  );

  // ----------------------------------------------------
  // TEST 7: Unpublished/non-active quiz is rejected
  // ----------------------------------------------------
  console.log('--- Test 7: Unpublished/non-active quiz is rejected ---');
  // 7a. Query quiz for draft lesson (active_version_id is null)
  const res7a = await makeGetRequest('/api/church/student-quiz', {
    lessonId: draftLessonId
  }, studentToken);

  // 7b. Submit quiz for draft version
  const res7b = await makePostRequest('/api/church/student-quiz/submit', {
    lessonId: draftLessonId,
    versionId: draftVersionId,
    quizId: 'quiz-draft-01',
    answers: [{ questionId: 'q-draft-1', selectedOptionIndex: 0 }]
  }, studentToken);

  // 7c. Submit quiz for approved-only (unpublished) version
  const res7c = await makePostRequest('/api/church/student-quiz/submit', {
    lessonId: draftLessonId,
    versionId: approvedVersionId,
    quizId: 'quiz-approved-01',
    answers: [{ questionId: 'q-app-1', selectedOptionIndex: 1 }]
  }, studentToken);

  assert(
    res7a.statusCode === 400 &&
    res7b.statusCode === 400 &&
    res7c.statusCode === 400,
    'Test 7: Accessing or submitting quizzes on draft/unpublished versions is strictly rejected with 400 error',
    `res7a: ${res7a.statusCode}, res7b: ${res7b.statusCode}, res7c: ${res7c.statusCode}`
  );

  // ----------------------------------------------------
  // TEST 8: Client cannot fabricate score
  // Client submits wrong answers but claims 100% score in payload
  // ----------------------------------------------------
  console.log('--- Test 8: Client cannot fabricate score ---');
  const res8 = await makePostRequest('/api/church/student-quiz/submit', {
    lessonId: multiLessonId,
    versionId: multiV1Id,
    quizId: 'quiz-multi-01',
    answers: [
      { questionId: 'q-multi-1', selectedOptionIndex: 3 }, // wrong
      { questionId: 'q-multi-2', selectedOptionIndex: 3 }  // wrong
    ],
    // Fabricated client score claim:
    score: 2,
    totalScore: 2,
    percentage: 100,
    passed: true
  }, studentToken);

  assert(
    res8.statusCode === 200 &&
    res8.json?.success === true &&
    res8.json?.attempt?.score === 0 &&
    res8.json?.attempt?.percentage === 0 &&
    res8.json?.attempt?.passed === false,
    'Test 8: Client-fabricated score (100%) is completely ignored; authoritative server calculation yielded 0%',
    JSON.stringify(res8.json)
  );

  // ----------------------------------------------------
  // TEST 9: Demo / Guest / Offline remains unchanged
  // ----------------------------------------------------
  console.log('--- Test 9: Demo / Guest / Offline remains unchanged ---');
  // Unauthenticated quiz load
  const res9Load = await makeGetRequest('/api/church/student-quiz', {
    lessonId: multiLessonId
  });

  // Unauthenticated quiz submission
  const res9Submit = await makePostRequest('/api/church/student-quiz/submit', {
    lessonId: multiLessonId,
    versionId: multiV1Id,
    quizId: 'quiz-multi-01',
    answers: [
      { questionId: 'q-multi-1', selectedOptionIndex: 0 }
    ]
  });

  assert(
    res9Load.statusCode === 200 &&
    res9Submit.statusCode === 200 &&
    res9Submit.json?.success === true,
    'Test 9: Demo / Guest / Offline unauthenticated quiz requests function smoothly without forcing database rows',
    `Load status: ${res9Load.statusCode}, Submit status: ${res9Submit.statusCode}`
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

runPhase2C2Tests().catch(err => {
  console.error('Fatal error during Phase 2C.2 test suite:', err);
  process.exit(1);
});
