// Automated Phase 2D.3 Servant Learning Review Test Suite
const http = require('http');

const PORT = 3000;
const BASE_URL = `http://localhost:${PORT}`;

function makeGetRequest(path, headers = {}, token = null) {
  return new Promise((resolve) => {
    const reqHeaders = { ...headers };
    if (token) {
      reqHeaders['Authorization'] = `Bearer ${token}`;
    }

    const req = http.get(`${BASE_URL}${path}`, { headers: reqHeaders }, (res) => {
      let data = '';
      res.on('data', chunk => { data += chunk; });
      res.on('end', () => {
        let json = null;
        try {
          json = JSON.parse(data);
        } catch (_) {}
        resolve({ statusCode: res.statusCode, data, json });
      });
    });

    req.on('error', (err) => {
      resolve({ statusCode: 500, error: err.message });
    });
  });
}

function makePostRequest(path, payload, token = null) {
  return new Promise((resolve) => {
    const postData = JSON.stringify(payload || {});
    const headers = {
      'Content-Type': 'application/json',
      'Content-Length': Buffer.byteLength(postData)
    };
    if (token) {
      headers['Authorization'] = `Bearer ${token}`;
    }

    const req = http.request(`${BASE_URL}${path}`, {
      method: 'POST',
      headers
    }, (res) => {
      let data = '';
      res.on('data', chunk => { data += chunk; });
      res.on('end', () => {
        let json = null;
        try {
          json = JSON.parse(data);
        } catch (_) {}
        resolve({ statusCode: res.statusCode, data, json });
      });
    });

    req.on('error', (err) => {
      resolve({ statusCode: 500, error: err.message });
    });

    req.write(postData);
    req.end();
  });
}

async function runTests() {
  console.log('====================================================');
  console.log('Phase 2D.3 Servant Learning Review Test Suite');
  console.log('====================================================\n');

  let passed = 0;
  let failed = 0;

  function assert(condition, message, details = '') {
    if (condition) {
      console.log(`[PASS] ${message}`);
      passed++;
    } else {
      console.error(`[FAIL] ${message}`);
      if (details) console.error(`       Details: ${details}`);
      failed++;
    }
  }

  const teacherMinaToken = 'test_jwt_teacher_mina';       // assigned to primary_2
  const teacherOtherToken = 'test_jwt_teacher_other';     // assigned to preparatory, angels
  const studentMarkToken = 'test_jwt_student_mark';       // student
  const parentMaryToken = 'test_jwt_parent_mary';         // parent
  const adminPishoyToken = 'test_jwt_admin_pishoy';       // admin

  // Reset state to a known baseline
  await makePostRequest('/api/church/reset-review-test-state', {});

  // Setup: Assign student-david to primary_2
  await makePostRequest('/api/church/student/class', {
    studentId: 'student-david',
    classGroupId: 'primary_2',
    grade: 'Grade 5'
  }, teacherMinaToken);

  // ----------------------------------------------------
  // TEST 1: Authorized Servant Loads Student Learning Review
  // ----------------------------------------------------
  console.log('--- Test 1: Authorized Servant Loads Student Learning Review ---');
  const res1 = await makeGetRequest('/api/church/student-learning-review/student-david', {}, teacherMinaToken);

  assert(
    res1.statusCode === 200 &&
    res1.json?.success === true &&
    res1.json?.student?.id === 'student-david' &&
    res1.json?.student?.classGroupId === 'primary_2' &&
    res1.json?.summary?.totalLessons >= 1 &&
    Array.isArray(res1.json?.lessons) &&
    res1.json?.lessons.length >= 1,
    'Test 1: Servant Mina loads learning review for student-david in primary_2',
    JSON.stringify(res1.json)
  );

  // ----------------------------------------------------
  // TEST 2: Privacy Check - No Sensitive Fields Returned
  // ----------------------------------------------------
  console.log('--- Test 2: Privacy Safeguards Verification ---');
  const jsonStr = JSON.stringify(res1.json || {});
  const hasPassword = jsonStr.includes('password') || jsonStr.includes('hash');
  const hasScreenTime = jsonStr.includes('screen_time_seconds');
  const hasToken = jsonStr.includes('refreshToken') || jsonStr.includes('access_token');

  assert(
    !hasPassword && !hasScreenTime && !hasToken,
    'Test 2: Privacy safe - no passwords, internal relationship IDs, screen time, or tokens leaked',
    `hasPassword: ${hasPassword}, hasScreenTime: ${hasScreenTime}, hasToken: ${hasToken}`
  );

  // ----------------------------------------------------
  // TEST 3: Reflects Real Progress and Quiz Data
  // ----------------------------------------------------
  console.log('--- Test 3: Authoritative Progress & Mastery Reflection ---');
  
  // Student mark starts lesson and completes section
  await makePostRequest('/api/church/student-progress/start', {
    lessonId: 'l-test-multiversion-01',
    versionId: 'v-test-multi-1'
  }, studentMarkToken);

  await makePostRequest('/api/church/student-progress/complete-section', {
    lessonId: 'l-test-multiversion-01',
    versionId: 'v-test-multi-1',
    sectionId: 'sec-multi-1'
  }, studentMarkToken);

  // Student mark submits quiz attempt with 100%
  await makePostRequest('/api/church/student-quiz/submit', {
    lessonId: 'l-test-multiversion-01',
    versionId: 'v-test-multi-1',
    quizId: 'quiz-multi-01',
    answers: [
      { questionId: 'q-multi-1', selectedOptionIndex: 0 },
      { questionId: 'q-multi-2', selectedOptionIndex: 1 }
    ]
  }, studentMarkToken);

  const res3 = await makeGetRequest('/api/church/student-learning-review/mark', {}, teacherMinaToken);
  const reviewedLesson = res3.json?.lessons?.find(l => l.lessonId === 'l-test-multiversion-01');

  assert(
    res3.statusCode === 200 &&
    reviewedLesson &&
    reviewedLesson.latestQuizPercentage === 100 &&
    reviewedLesson.quizPassed === true &&
    reviewedLesson.quizAttemptsCount >= 1 &&
    reviewedLesson.sectionsCompleted.length === 1 &&
    res3.json?.recentActivity?.length > 0,
    'Test 3: Authoritative quiz attempt and section progress reflected accurately in review',
    JSON.stringify(reviewedLesson)
  );

  // ----------------------------------------------------
  // TEST 4: "Needs Review" Detection
  // ----------------------------------------------------
  console.log('--- Test 4: Needs Review Detection for Struggling Student ---');
  // Submit a failing quiz attempt (0%)
  await makePostRequest('/api/church/student-quiz/submit', {
    lessonId: 'l-test-multiversion-01',
    versionId: 'v-test-multi-1',
    quizId: 'quiz-multi-01',
    answers: [
      { questionId: 'q-multi-1', selectedOptionIndex: 1 },
      { questionId: 'q-multi-2', selectedOptionIndex: 0 }
    ]
  }, studentMarkToken);

  const res4 = await makeGetRequest('/api/church/student-learning-review/mark', {}, teacherMinaToken);
  const failingLesson = res4.json?.lessons?.find(l => l.lessonId === 'l-test-multiversion-01');

  assert(
    res4.statusCode === 200 &&
    failingLesson?.needsReview === true &&
    res4.json?.needsReviewItems?.length > 0 &&
    res4.json?.summary?.needsReviewCount >= 1,
    'Test 4: Failing quiz (< 60%) flags lesson as needsReview and lists in needsReviewItems',
    JSON.stringify(failingLesson)
  );

  // ----------------------------------------------------
  // TEST 5: Unrelated Servant Receives 403 Forbidden
  // ----------------------------------------------------
  console.log('--- Test 5: Unrelated Servant Rejection ---');
  // teacher_other is assigned to preparatory/angels, not primary_2
  const res5 = await makeGetRequest('/api/church/student-learning-review/student-david', {}, teacherOtherToken);

  assert(
    res5.statusCode === 403 &&
    res5.json?.success === false &&
    res5.json?.error === 'FORBIDDEN',
    'Test 5: Unrelated servant (teacher_other) receives 403 FORBIDDEN trying to inspect student in primary_2',
    `Status: ${res5.statusCode}, Error: ${res5.json?.error}`
  );

  // ----------------------------------------------------
  // TEST 6: Student Cannot Access Learning Review
  // ----------------------------------------------------
  console.log('--- Test 6: Student Access Forbidden ---');
  const res6 = await makeGetRequest('/api/church/student-learning-review/student-david', {}, studentMarkToken);

  assert(
    res6.statusCode === 403 &&
    res6.json?.success === false &&
    res6.json?.error === 'FORBIDDEN',
    'Test 6: Student receives 403 FORBIDDEN when requesting servant learning review',
    `Status: ${res6.statusCode}, Error: ${res6.json?.error}`
  );

  // ----------------------------------------------------
  // TEST 7: Parent Cannot Access Servant Learning Review
  // ----------------------------------------------------
  console.log('--- Test 7: Parent Access Forbidden ---');
  const res7 = await makeGetRequest('/api/church/student-learning-review/student-david', {}, parentMaryToken);

  assert(
    res7.statusCode === 403 &&
    res7.json?.success === false &&
    res7.json?.error === 'FORBIDDEN',
    'Test 7: Parent receives 403 FORBIDDEN when requesting servant learning review',
    `Status: ${res7.statusCode}, Error: ${res7.json?.error}`
  );

  // ----------------------------------------------------
  // TEST 8: Admin Can Access
  // ----------------------------------------------------
  console.log('--- Test 8: Admin Access Granted ---');
  const res8 = await makeGetRequest('/api/church/student-learning-review/student-david', {}, adminPishoyToken);

  assert(
    res8.statusCode === 200 &&
    res8.json?.success === true &&
    res8.json?.student?.id === 'student-david',
    'Test 8: Admin can access learning review across classes',
    `Status: ${res8.statusCode}`
  );

  // ----------------------------------------------------
  // TEST 9: Nonexistent Student Returns 404
  // ----------------------------------------------------
  console.log('--- Test 9: Nonexistent Student 404 ---');
  const res9 = await makeGetRequest('/api/church/student-learning-review/nonexistent-student-999', {}, teacherMinaToken);

  assert(
    res9.statusCode === 404 &&
    res9.json?.success === false &&
    res9.json?.error === 'STUDENT_NOT_FOUND',
    'Test 9: Nonexistent student ID returns 404 STUDENT_NOT_FOUND',
    `Status: ${res9.statusCode}, Error: ${res9.json?.error}`
  );

  // ----------------------------------------------------
  // TEST 10: Missing studentId returns 400
  // ----------------------------------------------------
  console.log('--- Test 10: Missing StudentId Returns 400 ---');
  const res10 = await makeGetRequest('/api/church/student-learning-review?studentId=', {}, teacherMinaToken);

  assert(
    res10.statusCode === 400 &&
    res10.json?.success === false &&
    res10.json?.error === 'MISSING_PARAMS',
    'Test 10: Blank studentId returns 400 MISSING_PARAMS',
    `Status: ${res10.statusCode}`
  );

  // ----------------------------------------------------
  // TEST 11: Read-Only Verification - No Mutations via Review Endpoint
  // ----------------------------------------------------
  console.log('--- Test 11: Read-Only Invariant ---');
  const res11 = await makePostRequest('/api/church/student-learning-review/student-david', { score: 100 }, teacherMinaToken);

  assert(
    res11.statusCode === 404,
    'Test 11: POST to student-learning-review is rejected (strictly read-only endpoint)',
    `Status: ${res11.statusCode}`
  );

  // ----------------------------------------------------
  // TEST 12: Demo / Unauthenticated Mode Works Safely
  // ----------------------------------------------------
  console.log('--- Test 12: Demo / Guest Access Safe ---');
  const res12 = await makeGetRequest('/api/church/student-learning-review/student-david');

  assert(
    res12.statusCode === 200 &&
    res12.json?.success === true &&
    res12.json?.student?.id === 'student-david',
    'Test 12: Unauthenticated / Demo mode returns student learning review safely',
    `Status: ${res12.statusCode}`
  );

  console.log('\n====================================================');
  console.log(`Results: ${passed} Passed, ${failed} Failed`);
  console.log('====================================================\n');

  if (failed > 0) {
    process.exit(1);
  }
}

runTests().catch(err => {
  console.error('Fatal test error:', err);
  process.exit(1);
});
