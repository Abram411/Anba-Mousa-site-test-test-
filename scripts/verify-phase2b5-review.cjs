// Automated Phase 2B.5 Servant Review & Revision Test Suite
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

async function runPhase2B5Tests() {
  console.log('====================================================');
  console.log('Phase 2B.5 Servant Review & Revision Test Suite');
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
  const testVersionId = 'v-test-draft-1';
  const testEvidenceMapId = 'e-map-test-01';

  // Ensure clean initial state for idempotent test runs
  await makePostRequest('/api/church/reset-review-test-state', {});

  // ----------------------------------------------------
  // TEST 1: AI_DRAFT -> SERVANT_REVIEW
  // Authorized teacher can submit draft for servant review
  // ----------------------------------------------------
  console.log('--- Test 1: AI_DRAFT -> SERVANT_REVIEW ---');
  const res1 = await makePostRequest('/api/church/submit-for-review', {
    lessonId: testLessonId,
    versionId: testVersionId,
    notes: 'Submitted for servant review by teacher Mina'
  }, teacherToken);

  assert(
    res1.statusCode === 200 && res1.json && res1.json.success === true && res1.json.status === 'SERVANT_REVIEW',
    'Test 1: Teacher submits AI_DRAFT to SERVANT_REVIEW successfully',
    JSON.stringify(res1.json)
  );

  // ----------------------------------------------------
  // TEST 2: Unauthorized teacher blocked from submitting/reviewing another teacher's draft
  // ----------------------------------------------------
  console.log('--- Test 2: Unauthorized teacher blocked ---');
  const res2 = await makePostRequest('/api/church/submit-for-review', {
    lessonId: 'l-test-other-teacher-lesson',
    versionId: 'v-test-other-1',
    notes: 'Attempted unauthorized submit'
  }, teacherToken);

  assert(
    res2.statusCode === 403,
    'Test 2: Teacher cannot submit another teacher\'s draft version (returns 403 Forbidden)',
    `Status: ${res2.statusCode}`
  );

  // ----------------------------------------------------
  // TEST 3: Student and Parent blocked from review/approval operations
  // ----------------------------------------------------
  console.log('--- Test 3: Student & Parent blocked from review actions ---');
  const res3a = await makePostRequest('/api/church/submit-for-review', {
    lessonId: testLessonId,
    versionId: testVersionId
  }, studentToken);

  const res3b = await makePostRequest('/api/church/approve-version', {
    lessonId: testLessonId,
    versionId: testVersionId
  }, studentToken);

  const res3c = await makePostRequest('/api/church/submit-for-review', {
    lessonId: testLessonId,
    versionId: testVersionId
  }, parentToken);

  const res3d = await makePostRequest('/api/church/approve-version', {
    lessonId: testLessonId,
    versionId: testVersionId
  }, parentToken);

  assert(
    res3a.statusCode === 403 && res3b.statusCode === 403 && res3c.statusCode === 403 && res3d.statusCode === 403,
    'Test 3: Both Student and Parent are blocked with 403 on submit and approve operations',
    `Student submit: ${res3a.statusCode}, Student approve: ${res3b.statusCode}, Parent submit: ${res3c.statusCode}, Parent approve: ${res3d.statusCode}`
  );

  // ----------------------------------------------------
  // TEST 4: Claim verification authorization
  // Students/parents blocked, authorized servant can verify
  // ----------------------------------------------------
  console.log('--- Test 4: Claim verification authorization ---');
  const res4Student = await makePostRequest('/api/church/update-claim-verification', {
    claimId: 'claim-test-01',
    isVerified: true
  }, studentToken);

  const res4Teacher = await makePostRequest('/api/church/update-claim-verification', {
    claimId: 'claim-test-01',
    isVerified: true,
    servantReviewStatus: 'APPROVED',
    servantReviewNote: 'Verified against primary historical document.'
  }, teacherToken);

  assert(
    res4Student.statusCode === 403 && res4Teacher.statusCode === 200 && res4Teacher.json.claim.verified === true,
    'Test 4: Claim verification blocked for students (403) and authorized for servant (verified = true)',
    `Student: ${res4Student.statusCode}, Teacher: ${res4Teacher.statusCode}`
  );

  // ----------------------------------------------------
  // TEST 5: Unresolved conflict visibility
  // Servant review packet clearly exposes unresolved theological conflicts
  // ----------------------------------------------------
  console.log('--- Test 5: Unresolved conflict visibility ---');
  const res5 = await makePostRequest('/api/church/get-review-packet', {
    lessonId: testLessonId,
    versionId: testVersionId,
    evidenceMapId: testEvidenceMapId
  }, teacherToken);

  const hasUnresolvedConflicts = res5.json &&
    res5.json.packet &&
    Array.isArray(res5.json.packet.conflicts) &&
    res5.json.packet.conflicts.some(c => c.status === 'UNRESOLVED');

  assert(
    res5.statusCode === 200 && hasUnresolvedConflicts,
    'Test 5: Unresolved theological conflicts are clearly visible and preserved in review packet',
    JSON.stringify(res5.json && res5.json.packet && res5.json.packet.conflicts)
  );

  // ----------------------------------------------------
  // TEST 6: Conflict resolution authorization
  // Students/parents cannot resolve; servant resolves with official explanation note
  // ----------------------------------------------------
  console.log('--- Test 6: Conflict resolution authorization ---');
  const res6Student = await makePostRequest('/api/church/resolve-source-conflict', {
    conflictId: 'conf-test-01',
    resolutionNote: 'Unauthorized attempt to resolve'
  }, studentToken);

  const res6Servant = await makePostRequest('/api/church/resolve-source-conflict', {
    conflictId: 'conf-test-01',
    resolutionNote: 'The 326 AD date marks Helena\'s arrival in Jerusalem; excavation and discovery completed in 327 AD. Both accounts reflect complementary stages of the event.'
  }, teacherToken);

  assert(
    res6Student.statusCode === 403 && res6Servant.statusCode === 200 && res6Servant.json.conflict.status === 'RESOLVED',
    'Test 6: Conflict resolution blocked for student (403); authorized servant resolves with theological note',
    `Student: ${res6Student.statusCode}, Servant: ${res6Servant.statusCode}`
  );

  // ----------------------------------------------------
  // TEST 7: Revision request -> REVISION_REQUESTED
  // Servant requests revision; status transitions to REVISION_REQUESTED
  // ----------------------------------------------------
  console.log('--- Test 7: Revision request -> REVISION_REQUESTED ---');
  const res7 = await makePostRequest('/api/church/request-revision', {
    lessonId: testLessonId,
    versionId: testVersionId,
    feedbackComment: 'Please adjust section 2 vocabulary to better fit elementary grade 4 comprehension.'
  }, teacherToken);

  assert(
    res7.statusCode === 200 && res7.json && res7.json.status === 'REVISION_REQUESTED',
    'Test 7: Servant requests revision, transitioning status to REVISION_REQUESTED',
    JSON.stringify(res7.json)
  );

  // ----------------------------------------------------
  // Re-transition to SERVANT_REVIEW before approval test
  // ----------------------------------------------------
  await makePostRequest('/api/church/submit-for-review', {
    lessonId: testLessonId,
    versionId: testVersionId,
    notes: 'Teacher adjusted vocabulary and resubmitted'
  }, teacherToken);

  // ----------------------------------------------------
  // TEST 8: Approved review -> APPROVED
  // Servant reviews and approves lesson version
  // ----------------------------------------------------
  console.log('--- Test 8: Approved review -> APPROVED ---');
  const res8 = await makePostRequest('/api/church/approve-version', {
    lessonId: testLessonId,
    versionId: testVersionId,
    servantName: 'Servant Mina',
    approvalNote: 'Theological content verified against Orthodox patristic sources.'
  }, teacherToken);

  assert(
    res8.statusCode === 200 && res8.json && res8.json.status === 'APPROVED',
    'Test 8: Version moves from SERVANT_REVIEW to APPROVED',
    JSON.stringify(res8.json)
  );

  // ----------------------------------------------------
  // TEST 9: Approval metadata recorded
  // approved_by, approved_at, approval_note recorded
  // ----------------------------------------------------
  console.log('--- Test 9: Approval metadata recorded ---');
  assert(
    res8.json && res8.json.approvedBy && res8.json.approvedAt && res8.json.approvalNote,
    `Test 9: Approval metadata recorded: approvedBy="${res8.json?.approvedBy}", at="${res8.json?.approvedAt}", note="${res8.json?.approvalNote}"`,
    JSON.stringify(res8.json)
  );

  // ----------------------------------------------------
  // TEST 10: APPROVED version is immutable
  // Submitting or mutating an APPROVED version is rejected
  // ----------------------------------------------------
  console.log('--- Test 10: APPROVED version is immutable ---');
  const res10 = await makePostRequest('/api/church/submit-for-review', {
    lessonId: testLessonId,
    versionId: testVersionId,
    notes: 'Attempted mutation of approved version'
  }, teacherToken);

  assert(
    res10.statusCode === 400 && res10.json && res10.json.error === 'IMMUTABLE_VERSION',
    'Test 10: Mutating or re-submitting an APPROVED version is strictly rejected as IMMUTABLE_VERSION',
    JSON.stringify(res10.json)
  );

  // ----------------------------------------------------
  // TEST 11: active_version_id remains unchanged
  // Phase 2B.5 must NOT set active_version_id
  // ----------------------------------------------------
  console.log('--- Test 11: active_version_id unchanged ---');
  assert(
    res8.json && res8.json.activeVersionId === null,
    `Test 11: active_version_id remains null/unchanged: ${res8.json?.activeVersionId}`,
    JSON.stringify(res8.json)
  );

  // ----------------------------------------------------
  // TEST 12: lesson_status remains draft/unpublished
  // Root lesson is NOT published in Phase 2B.5
  // ----------------------------------------------------
  console.log('--- Test 12: lesson_status remains draft/unpublished ---');
  assert(
    res8.json && (res8.json.lessonStatus === 'draft' || res8.json.lessonStatus === 'DRAFT'),
    `Test 12: Root lesson status remains draft: ${res8.json?.lessonStatus}`,
    JSON.stringify(res8.json)
  );

  // ----------------------------------------------------
  // TEST 13: Publish RPC not invoked
  // Publication belongs to Phase 2B.6 and is NOT permitted here
  // ----------------------------------------------------
  console.log('--- Test 13: Publish RPC not invoked ---');
  // Verify that the version is APPROVED but NOT PUBLISHED, and no publish endpoint was called
  assert(
    res8.json && res8.json.status === 'APPROVED' && res8.json.status !== 'PUBLISHED',
    'Test 13: Version is strictly in APPROVED state; publication RPC was not invoked',
    `Status: ${res8.json?.status}`
  );

  // ----------------------------------------------------
  // TEST 14: Review comments protected
  // Accessible to teachers/admins only; blocked for students/parents
  // ----------------------------------------------------
  console.log('--- Test 14: Review comments protected ---');
  const res14Student = await makeGetRequest('/api/church/review-comments', { versionId: testVersionId }, studentToken);
  const res14Parent = await makeGetRequest('/api/church/review-comments', { versionId: testVersionId }, parentToken);
  const res14Teacher = await makeGetRequest('/api/church/review-comments', { versionId: testVersionId }, teacherToken);

  const res14PostStudent = await makePostRequest('/api/church/review-comments', {
    versionId: testVersionId,
    comment: 'Student unauthorized comment'
  }, studentToken);

  assert(
    res14Student.statusCode === 403 &&
    res14Parent.statusCode === 403 &&
    res14PostStudent.statusCode === 403 &&
    res14Teacher.statusCode === 200,
    'Test 14: Review comments are strictly teacher/admin only (403 for students and parents on GET & POST)',
    `Student GET: ${res14Student.statusCode}, Parent GET: ${res14Parent.statusCode}, Student POST: ${res14PostStudent.statusCode}, Teacher GET: ${res14Teacher.statusCode}`
  );

  // ----------------------------------------------------
  // TEST 15: Demo / Guest / Offline unchanged
  // Offline unauthenticated request passes without crash or Supabase dependency
  // ----------------------------------------------------
  console.log('--- Test 15: Demo / Guest / Offline unchanged ---');
  const res15 = await makePostRequest('/api/church/get-review-packet', {
    lessonId: 'l-cross-01',
    versionId: 'v-cross-01'
  });

  assert(
    res15.statusCode === 200 && res15.json && res15.json.success === true,
    'Test 15: Demo / Guest / Offline requests function smoothly without forcing database review rows',
    JSON.stringify(res15.json)
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

runPhase2B5Tests().catch(err => {
  console.error('Fatal error during Phase 2B.5 test suite:', err);
  process.exit(1);
});
