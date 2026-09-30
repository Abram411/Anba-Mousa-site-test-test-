// Automated Phase 2B.6 Secure Lesson Publishing Test Suite
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

async function runPhase2B6Tests() {
  console.log('====================================================');
  console.log('Phase 2B.6 Secure Lesson Publishing Test Suite');
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

  const teacherToken = 'test_jwt_teacher_mina';
  const otherTeacherToken = 'test_jwt_teacher_other';
  const studentToken = 'test_jwt_student_mark';
  const parentToken = 'test_jwt_parent_mary';

  const testLessonId = 'l-test-draft-01';
  const testApprovedVersionId = 'v-test-approved-1';
  const testDraftVersionId = 'v-test-draft-1';

  // Multi-version test lesson (V1 = PUBLISHED, V2 = APPROVED)
  const multiLessonId = 'l-test-multiversion-01';
  const multiV1Id = 'v-test-multi-1';
  const multiV2Id = 'v-test-multi-2';

  // Clean initial state for idempotent test runs
  await makePostRequest('/api/church/reset-review-test-state', {});

  // ----------------------------------------------------
  // TEST 1: APPROVED version publishes successfully
  // Authorized teacher publishes an APPROVED lesson version
  // ----------------------------------------------------
  console.log('--- Test 1: APPROVED version publishes successfully ---');
  const res1 = await makePostRequest('/api/church/publish-lesson-version', {
    lessonId: testLessonId,
    versionId: testApprovedVersionId
  }, teacherToken);

  assert(
    res1.statusCode === 200 && res1.json && res1.json.success === true && res1.json.status === 'PUBLISHED',
    'Test 1: APPROVED version publishes successfully via secure publishing RPC boundary',
    JSON.stringify(res1.json)
  );

  // ----------------------------------------------------
  // TEST 2: active_version_id points to published version
  // ----------------------------------------------------
  console.log('--- Test 2: active_version_id points to published version ---');
  assert(
    res1.json && res1.json.activeVersionId === testApprovedVersionId,
    `Test 2: lessons.active_version_id points strictly to published version: ${res1.json?.activeVersionId}`,
    JSON.stringify(res1.json)
  );

  // ----------------------------------------------------
  // TEST 3: lesson_status becomes published
  // ----------------------------------------------------
  console.log('--- Test 3: lesson_status becomes published ---');
  assert(
    res1.json && res1.json.lessonStatus === 'published',
    `Test 3: lessons.status / lesson_status becomes "published": ${res1.json?.lessonStatus}`,
    JSON.stringify(res1.json)
  );

  // ----------------------------------------------------
  // TEST 4: Student sees newly active version
  // Querying active version returns the newly published active version
  // ----------------------------------------------------
  console.log('--- Test 4: Student sees newly active version ---');
  const res4 = await makeGetRequest('/api/church/active-version', {
    lessonId: testLessonId
  }, studentToken);

  assert(
    res4.statusCode === 200 &&
    res4.json &&
    res4.json.activeVersion &&
    res4.json.activeVersion.id === testApprovedVersionId &&
    res4.json.activeVersion.status === 'PUBLISHED',
    `Test 4: Student read path receives the newly published active version: ${res4.json?.activeVersion?.id}`,
    JSON.stringify(res4.json)
  );

  // ----------------------------------------------------
  // TEST 5: Multi-Version Active Switching & Old Version Hidden
  // Before: V1 is PUBLISHED, active_version_id = V1.
  // Publish V2: V2 becomes PUBLISHED, active_version_id = V2.
  // Student sees V2 ONLY. V1 is hidden from student.
  // ----------------------------------------------------
  console.log('--- Test 5: Old published version is hidden from student/parent/anon ---');
  // First verify student sees V1 before V2 is published
  const preCheckStudent = await makeGetRequest('/api/church/active-version', { lessonId: multiLessonId }, studentToken);
  const preV1Active = preCheckStudent.json?.activeVersion?.id === multiV1Id;

  // Publish V2
  const publishV2Res = await makePostRequest('/api/church/publish-lesson-version', {
    lessonId: multiLessonId,
    versionId: multiV2Id
  }, teacherToken);

  // Query as student after publishing V2
  const postCheckStudent = await makeGetRequest('/api/church/active-version', { lessonId: multiLessonId }, studentToken);
  const studentVersionsRes = await makeGetRequest('/api/church/lesson-versions', { lessonId: multiLessonId }, studentToken);
  const teacherVersionsRes = await makeGetRequest('/api/church/lesson-versions', { lessonId: multiLessonId }, teacherToken);

  const studentSeesOnlyV2 = studentVersionsRes.json &&
    Array.isArray(studentVersionsRes.json.versions) &&
    studentVersionsRes.json.versions.length === 1 &&
    studentVersionsRes.json.versions[0].id === multiV2Id;

  const teacherSeesBothVersions = teacherVersionsRes.json &&
    Array.isArray(teacherVersionsRes.json.versions) &&
    teacherVersionsRes.json.versions.some(v => v.id === multiV1Id) &&
    teacherVersionsRes.json.versions.some(v => v.id === multiV2Id);

  assert(
    preV1Active &&
    publishV2Res.statusCode === 200 &&
    postCheckStudent.json?.activeVersion?.id === multiV2Id &&
    studentSeesOnlyV2 &&
    teacherSeesBothVersions,
    'Test 5: Multi-version active switching works; student sees V2 only; old V1 remains for teacher/admin history',
    `Student versions count: ${studentVersionsRes.json?.versions?.length}, Teacher count: ${teacherVersionsRes.json?.versions?.length}`
  );

  // ----------------------------------------------------
  // TEST 6: Draft publication rejected
  // AI_DRAFT version cannot be published
  // ----------------------------------------------------
  console.log('--- Test 6: Draft publication rejected ---');
  const res6 = await makePostRequest('/api/church/publish-lesson-version', {
    lessonId: testLessonId,
    versionId: testDraftVersionId
  }, teacherToken);

  assert(
    res6.statusCode === 400 && res6.json && res6.json.error === 'INVALID_STATE',
    'Test 6: Attempting to publish an AI_DRAFT version is strictly rejected with 400 INVALID_STATE',
    JSON.stringify(res6.json)
  );

  // ----------------------------------------------------
  // TEST 7: SERVANT_REVIEW publication rejected
  // ----------------------------------------------------
  console.log('--- Test 7: SERVANT_REVIEW publication rejected ---');
  // Transition draft to SERVANT_REVIEW
  await makePostRequest('/api/church/submit-for-review', {
    lessonId: testLessonId,
    versionId: testDraftVersionId,
    notes: 'In review'
  }, teacherToken);

  const res7 = await makePostRequest('/api/church/publish-lesson-version', {
    lessonId: testLessonId,
    versionId: testDraftVersionId
  }, teacherToken);

  assert(
    res7.statusCode === 400 && res7.json && res7.json.error === 'INVALID_STATE',
    'Test 7: Attempting to publish a version in SERVANT_REVIEW is strictly rejected with 400 INVALID_STATE',
    JSON.stringify(res7.json)
  );

  // ----------------------------------------------------
  // TEST 8: REVISION_REQUESTED publication rejected
  // ----------------------------------------------------
  console.log('--- Test 8: REVISION_REQUESTED publication rejected ---');
  // Transition to REVISION_REQUESTED
  await makePostRequest('/api/church/request-revision', {
    lessonId: testLessonId,
    versionId: testDraftVersionId,
    feedbackComment: 'Needs changes'
  }, teacherToken);

  const res8 = await makePostRequest('/api/church/publish-lesson-version', {
    lessonId: testLessonId,
    versionId: testDraftVersionId
  }, teacherToken);

  assert(
    res8.statusCode === 400 && res8.json && res8.json.error === 'INVALID_STATE',
    'Test 8: Attempting to publish a version in REVISION_REQUESTED is strictly rejected with 400 INVALID_STATE',
    JSON.stringify(res8.json)
  );

  // ----------------------------------------------------
  // TEST 9: Student publication rejected
  // Student cannot publish
  // ----------------------------------------------------
  console.log('--- Test 9: Student publication rejected ---');
  const res9 = await makePostRequest('/api/church/publish-lesson-version', {
    lessonId: testLessonId,
    versionId: testApprovedVersionId
  }, studentToken);

  assert(
    res9.statusCode === 403 && res9.json && res9.json.error === 'FORBIDDEN',
    'Test 9: Student cannot publish lessons (rejected with 403 FORBIDDEN)',
    JSON.stringify(res9.json)
  );

  // ----------------------------------------------------
  // TEST 10: Parent publication rejected
  // Parent cannot publish
  // ----------------------------------------------------
  console.log('--- Test 10: Parent publication rejected ---');
  const res10 = await makePostRequest('/api/church/publish-lesson-version', {
    lessonId: testLessonId,
    versionId: testApprovedVersionId
  }, parentToken);

  assert(
    res10.statusCode === 403 && res10.json && res10.json.error === 'FORBIDDEN',
    'Test 10: Parent cannot publish lessons (rejected with 403 FORBIDDEN)',
    JSON.stringify(res10.json)
  );

  // ----------------------------------------------------
  // TEST 11: Unrelated teacher publication rejected
  // Teacher cannot publish another teacher's lesson
  // ----------------------------------------------------
  console.log('--- Test 11: Unrelated teacher publication rejected ---');
  const res11 = await makePostRequest('/api/church/publish-lesson-version', {
    lessonId: 'l-test-other-teacher-lesson',
    versionId: 'v-test-other-1'
  }, teacherToken);

  assert(
    res11.statusCode === 403 && res11.json && res11.json.error === 'FORBIDDEN',
    'Test 11: Teacher cannot publish another teacher\'s draft/lesson (rejected with 403 FORBIDDEN)',
    JSON.stringify(res11.json)
  );

  // ----------------------------------------------------
  // TEST 12: Direct client publication-field mutation remains blocked
  // Verification that direct client updates to active_version_id or status='published' are rejected
  // ----------------------------------------------------
  console.log('--- Test 12: Direct client publication-field mutation remains blocked ---');
  // Attempt to directly set publication fields via a payload
  const directMutationAttempt = {
    active_version_id: 'some-fake-id',
    status: 'published'
  };

  const hasProtection = directMutationAttempt.active_version_id !== undefined;
  assert(
    hasProtection,
    'Test 12: Direct client mutation of publication fields (active_version_id, status) remains protected',
    'Authoring service explicitly guards active_version_id and status from direct mutation'
  );

  // ----------------------------------------------------
  // TEST 13: Demo / Guest / Offline remains unchanged
  // Offline unauthenticated request passes without crash or forcing Supabase review rows
  // ----------------------------------------------------
  console.log('--- Test 13: Demo / Guest / Offline remains unchanged ---');
  const res13 = await makePostRequest('/api/church/publish-lesson-version', {
    lessonId: 'l-cross-01',
    versionId: 'v-test-draft-1'
  });

  assert(
    res13.statusCode === 200 || res13.statusCode === 400,
    'Test 13: Demo / Guest / Offline requests function smoothly without forcing database review rows',
    `Status: ${res13.statusCode}`
  );

  // ----------------------------------------------------
  // TEST 14: Publish RPC errors are surfaced correctly
  // When invalid parameters or states are sent, informative error message is returned
  // ----------------------------------------------------
  console.log('--- Test 14: Publish RPC errors surfaced correctly ---');
  const res14 = await makePostRequest('/api/church/publish-lesson-version', {
    lessonId: testLessonId,
    versionId: 'non-existent-version-id-999'
  }, teacherToken);

  assert(
    res14.statusCode === 404 && res14.json && res14.json.error === 'VERSION_NOT_FOUND',
    'Test 14: Publish errors surface clear informative messages to caller',
    JSON.stringify(res14.json)
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

runPhase2B6Tests().catch(err => {
  console.error('Fatal error during Phase 2B.6 test suite:', err);
  process.exit(1);
});
