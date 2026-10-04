// Phase 3 Final QA, End-to-End Integration Verification & Production Hardening Suite
const fs = require('fs');
const path = require('path');
const http = require('http');

const PORT = 3000;
const BASE_URL = `http://localhost:${PORT}`;
const uploadsDir = path.join(process.cwd(), 'uploads');

if (!fs.existsSync(uploadsDir)) {
  fs.mkdirSync(uploadsDir, { recursive: true });
}

// Ensure test files exist in uploadsDir
const draftFileName = 'test_draft_lesson_source_cross.pdf';
const draftFilePath = path.join(uploadsDir, draftFileName);
if (!fs.existsSync(draftFilePath)) {
  fs.writeFileSync(draftFilePath, '%PDF-1.4 [Secret Draft Source - St. Helena Cross Lesson]');
}

const draftMetaPath = path.join(uploadsDir, `.${draftFileName}.meta.json`);
if (!fs.existsSync(draftMetaPath)) {
  fs.writeFileSync(draftMetaPath, JSON.stringify({
    filename: draftFileName,
    originalName: 'St_Helena_Cross_Curriculum_Draft.pdf',
    mimeType: 'application/pdf',
    size: 53,
    uploadedBy: 'user_teacher_mina_101',
    uploaderRole: 'teacher',
    lessonId: 'l-cross-01',
    isPublic: false,
    uploadType: 'source',
    uploadedAt: new Date().toISOString()
  }, null, 2));
}

function makeRequest({ path: reqPath, method = 'GET', headers = {}, token = null, body = null }) {
  return new Promise((resolve, reject) => {
    const finalHeaders = { ...headers };
    let requestData = null;

    if (body) {
      requestData = typeof body === 'string' ? body : JSON.stringify(body);
      finalHeaders['Content-Type'] = 'application/json';
      finalHeaders['Content-Length'] = Buffer.byteLength(requestData);
    }

    if (token) {
      finalHeaders['Authorization'] = `Bearer ${token}`;
    }

    const url = new URL(reqPath, BASE_URL);
    const options = {
      hostname: url.hostname,
      port: url.port,
      path: url.pathname + url.search,
      method: method,
      headers: finalHeaders
    };

    const req = http.request(options, (res) => {
      let responseBody = '';
      res.on('data', (chunk) => { responseBody += chunk; });
      res.on('end', () => {
        let json = null;
        try { json = JSON.parse(responseBody); } catch (_) {}
        resolve({
          statusCode: res.statusCode,
          headers: res.headers,
          body: responseBody,
          json
        });
      });
    });

    req.on('error', (err) => reject(err));
    if (requestData) req.write(requestData);
    req.end();
  });
}

async function runPhase3FinalQASuite() {
  console.log('================================================================');
  console.log('PHASE 3 FINAL QA: COMPREHENSIVE INTEGRATION & HARDENING SUITE');
  console.log('================================================================\n');

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

  // Authoritative Test Tokens
  const teacherMinaToken = 'test_jwt_teacher_mina';
  const teacherOtherToken = 'test_jwt_teacher_other';
  const studentDavidToken = 'test_jwt_student_david';
  const studentMarkToken = 'test_jwt_student_mark';
  const parentMaryToken = 'test_jwt_parent_mary';
  const parentOtherToken = 'test_jwt_parent_other';
  const adminToken = 'test_jwt_admin_church';

  // Constants & Fixtures
  const publishedLessonId = 'l-test-multiversion-01';
  const publishedVersionId = 'v-test-multi-1';
  const draftLessonId = 'l-test-draft-01';
  const draftVersionId = 'v-test-draft-1';

  // Clean initial state for idempotent test runs
  await makeRequest({
    path: '/api/church/reset-review-test-state',
    method: 'POST'
  });

  // Ensure fresh materials generated and approved for publishedLessonId
  await makeRequest({
    path: `/api/church/lessons/${publishedLessonId}/generate-materials`,
    method: 'POST',
    token: teacherMinaToken,
    body: { versionId: publishedVersionId, types: 'ALL' }
  });
  await makeRequest({
    path: `/api/church/lessons/${publishedLessonId}/materials/review`,
    method: 'POST',
    token: teacherMinaToken,
    body: { versionId: publishedVersionId, action: 'APPROVE_ALL' }
  });

  // ============================================================================
  // SECTION 1: FULL STUDENT JOURNEY TRACE
  // ============================================================================
  console.log('--- SECTION 1: Full Online Student Journey ---');

  // 1.1 Published lesson discovery via /api/church/active-version
  const s1 = await makeRequest({
    path: `/api/church/active-version?lessonId=${publishedLessonId}`,
    token: studentDavidToken
  });
  assert(
    s1.statusCode === 200 &&
    s1.json?.activeVersion?.id === publishedVersionId &&
    s1.json?.activeVersion?.status === 'PUBLISHED',
    '1.1 Student discovers published lesson and authoritative active version',
    `Active version: ${s1.json?.activeVersion?.id}`
  );

  // 1.2 Draft unpublished lesson does not leak published version to student
  const s1Draft = await makeRequest({
    path: `/api/church/active-version?lessonId=${draftLessonId}`,
    token: studentDavidToken
  });
  assert(
    s1Draft.statusCode === 200 && s1Draft.json?.activeVersion === null,
    '1.2 Draft unpublished lesson does not expose active version to student',
    JSON.stringify(s1Draft.json)
  );

  // 1.3 Student starts lesson progress
  const sStart = await makeRequest({
    path: '/api/church/student-progress/start',
    method: 'POST',
    token: studentMarkToken,
    body: {
      lessonId: publishedLessonId,
      versionId: publishedVersionId
    }
  });
  assert(
    sStart.statusCode === 200 &&
    sStart.json?.success === true &&
    sStart.json?.progress?.status === 'IN_PROGRESS',
    '1.3 Student starts lesson progress tracking (IN_PROGRESS, 0%)',
    `Status ${sStart.statusCode}`
  );

  // 1.4 Section progress completion
  await makeRequest({
    path: '/api/church/student-progress/complete-section',
    method: 'POST',
    token: studentMarkToken,
    body: { lessonId: publishedLessonId, versionId: publishedVersionId, sectionId: 'sec-multi-1' }
  });
  await makeRequest({
    path: '/api/church/student-progress/complete-section',
    method: 'POST',
    token: studentMarkToken,
    body: { lessonId: publishedLessonId, versionId: publishedVersionId, sectionId: 'sec-multi-2' }
  });
  const sComp = await makeRequest({
    path: '/api/church/student-progress/complete-section',
    method: 'POST',
    token: studentMarkToken,
    body: { lessonId: publishedLessonId, versionId: publishedVersionId, sectionId: 'sec-multi-3' }
  });
  assert(
    sComp.statusCode === 200 && sComp.json?.progress?.status === 'COMPLETED',
    '1.4 Full section completion marks progress as COMPLETED (100%)',
    `Status ${sComp.json?.progress?.status}`
  );

  // 1.5 Active quiz retrieval
  const sQuiz = await makeRequest({
    path: `/api/church/student-quiz?lessonId=${publishedLessonId}`,
    token: studentMarkToken
  });
  assert(
    sQuiz.statusCode === 200 && sQuiz.json?.quiz?.id === 'quiz-multi-01',
    '1.5 Student loads active published quiz',
    `Status ${sQuiz.statusCode}`
  );

  // 1.6 Server-side score evaluation (client score claim discarded)
  const sSubmit = await makeRequest({
    path: '/api/church/student-quiz/submit',
    method: 'POST',
    token: studentMarkToken,
    body: {
      lessonId: publishedLessonId,
      versionId: publishedVersionId,
      quizId: 'quiz-multi-01',
      answers: [
        { questionId: 'q-multi-1', selectedOptionIndex: 0 },
        { questionId: 'q-multi-2', selectedOptionIndex: 1 }
      ],
      score: 999, // Forged client claim
      percentage: 1000 // Forged client claim
    }
  });
  assert(
    sSubmit.statusCode === 200 &&
    sSubmit.json?.attempt?.score === 2 &&
    sSubmit.json?.attempt?.percentage === 100 &&
    sSubmit.json?.attempt?.passed === true,
    '1.6 Server computes deterministic 100% quiz score and ignores client score forgery',
    JSON.stringify(sSubmit.json?.attempt)
  );

  // 1.7 Attempt query isolation: Mark reads own attempt, cannot read David's attempt
  const sAttemptsSelf = await makeRequest({
    path: `/api/church/student-quiz/attempts?lessonId=${publishedLessonId}`,
    token: studentMarkToken
  });
  const sAttemptsOther = await makeRequest({
    path: `/api/church/student-quiz/attempts?lessonId=${publishedLessonId}&studentId=david`,
    token: studentMarkToken
  });
  assert(
    sAttemptsSelf.statusCode === 200 &&
    Array.isArray(sAttemptsSelf.json?.attempts) &&
    sAttemptsSelf.json?.attempts.length > 0 &&
    sAttemptsOther.statusCode === 403,
    '1.7 Student accesses own quiz attempts; cross-student attempt query is rejected (403)',
    `Self status: ${sAttemptsSelf.statusCode}, Other status: ${sAttemptsOther.statusCode}`
  );

  // 1.8 Approved generated materials retrieval (slides & flashcards)
  const sMaterials = await makeRequest({
    path: `/api/church/lessons/${publishedLessonId}/materials`,
    token: studentMarkToken
  });
  assert(
    sMaterials.statusCode === 200 &&
    sMaterials.json?.isStudentView === true &&
    Array.isArray(sMaterials.json?.materials?.slides) &&
    sMaterials.json?.materials?.slides.length > 0 &&
    sMaterials.json?.materials?.slides.every(s => s.reviewStatus === 'APPROVED'),
    '1.8 Student receives strictly APPROVED generated materials for published lesson',
    `Slides count: ${sMaterials.json?.materials?.slides?.length}`
  );

  // ============================================================================
  // SECTION 2: FULL SERVANT JOURNEY TRACE
  // ============================================================================
  console.log('\n--- SECTION 2: Full Servant Journey & Roster Governance ---');

  // 2.1 Servant accesses assigned classes
  const tClasses = await makeRequest({
    path: '/api/church/classes',
    token: teacherMinaToken
  });
  assert(
    tClasses.statusCode === 200 && Array.isArray(tClasses.json?.classes),
    '2.1 Servant Mina queries assigned classes',
    `Classes count: ${tClasses.json?.classes?.length}`
  );

  // 2.2 Servant queries class roster
  const tRoster = await makeRequest({
    path: '/api/church/class-roster?classGroupId=primary_2',
    token: teacherMinaToken
  });
  assert(
    tRoster.statusCode === 200 && Array.isArray(tRoster.json?.roster),
    '2.2 Servant accesses class roster with student details',
    `Students in roster: ${tRoster.json?.roster?.length}`
  );

  // 2.3 Servant queries student learning review
  const tReview = await makeRequest({
    path: '/api/church/student-learning-review/student-david',
    token: teacherMinaToken
  });
  assert(
    tReview.statusCode === 200 &&
    tReview.json?.success === true &&
    tReview.json?.student?.id === 'student-david',
    '2.3 Servant accesses authoritative student learning review',
    `David review studentId: ${tReview.json?.student?.id}`
  );

  // 2.4 Cross-teacher draft source isolation
  const tSources = await makeRequest({
    path: '/api/church/sources',
    token: teacherMinaToken
  });
  const otherTeacherPrivateSource = (tSources.json?.sources || []).some(
    s => s.uploadedBy === 'user_teacher_other_404' && s.isPublic === false
  );
  assert(
    tSources.statusCode === 200 && !otherTeacherPrivateSource,
    '2.4 Servant Mina cannot see private sources of other teachers in library',
    `Mina sources count: ${tSources.json?.sources?.length}`
  );

  // 2.5 Servant cannot approve/publish unauthorized teacher's lesson
  const tPublishForeign = await makeRequest({
    path: '/api/church/publish-lesson-version',
    method: 'POST',
    token: teacherMinaToken,
    body: {
      lessonId: 'l-test-other-teacher-lesson',
      versionId: 'v-test-other-draft-1'
    }
  });
  assert(
    tPublishForeign.statusCode === 403 && tPublishForeign.json?.error === 'FORBIDDEN',
    '2.5 Servant Mina cannot publish another servant\'s lesson (403 FORBIDDEN)',
    `Status ${tPublishForeign.statusCode}`
  );

  // 2.6 Servant generates and reviews learning materials
  const tGen = await makeRequest({
    path: `/api/church/lessons/${publishedLessonId}/generate-materials`,
    method: 'POST',
    token: teacherMinaToken,
    body: { versionId: publishedVersionId, types: 'ALL' }
  });
  assert(
    tGen.statusCode === 201 && tGen.json?.status === 'UNVERIFIED',
    '2.6 Servant generates grounded materials initialized as UNVERIFIED',
    `Status ${tGen.statusCode}`
  );

  const tApprove = await makeRequest({
    path: `/api/church/lessons/${publishedLessonId}/materials/review`,
    method: 'POST',
    token: teacherMinaToken,
    body: { versionId: publishedVersionId, action: 'APPROVE_ALL' }
  });
  assert(
    tApprove.statusCode === 200 && tApprove.json?.status === 'APPROVED',
    '2.7 Servant approves valid materials transitioning packet to APPROVED',
    `Status ${tApprove.statusCode}`
  );

  // ============================================================================
  // SECTION 3: FULL PARENT JOURNEY TRACE
  // ============================================================================
  console.log('\n--- SECTION 3: Full Parent Journey Trace ---');

  // 3.1 Parent Mary queries linked children
  const pChildren = await makeRequest({
    path: '/api/church/parent/children',
    token: parentMaryToken
  });
  const childIds = pChildren.json?.children?.map(c => c.id) || [];
  assert(
    pChildren.statusCode === 200 &&
    Array.isArray(pChildren.json?.children) &&
    childIds.includes('mark'),
    '3.1 Parent Mary successfully queries linked children (Mark included)',
    `Children: ${childIds.join(', ')}`
  );

  // 3.2 Parent Mary views learning review for linked child
  const pReviewLinked = await makeRequest({
    path: '/api/church/parent/child-learning-review/mark',
    token: parentMaryToken
  });
  assert(
    pReviewLinked.statusCode === 200 &&
    pReviewLinked.json?.student?.id === 'mark',
    '3.2 Parent Mary accesses child learning review for legitimately linked child Mark',
    `Mark review studentId: ${pReviewLinked.json?.student?.id}`
  );

  // 3.3 Parent Mary blocked from unlinked child
  const pReviewUnlinked = await makeRequest({
    path: '/api/church/parent/child-learning-review/other',
    token: parentMaryToken
  });
  assert(
    pReviewUnlinked.statusCode === 403 && pReviewUnlinked.json?.error === 'FORBIDDEN',
    '3.3 Parent Mary is rejected with 403 FORBIDDEN when attempting to access unlinked child',
    `Status ${pReviewUnlinked.statusCode}`
  );

  // 3.4 Parent cannot modify learning review (strictly read-only)
  const pMutate = await makeRequest({
    path: '/api/church/parent/child-learning-review/mark',
    method: 'POST',
    token: parentMaryToken,
    body: { masteryState: 'MASTERED' }
  });
  assert(
    pMutate.statusCode === 405 || pMutate.statusCode === 404,
    '3.4 Parent child-learning-review endpoint strictly rejects write operations (read-only)',
    `Status ${pMutate.statusCode}`
  );

  // 3.5 Parent cannot review materials or access teacher drafts
  const pReviewMat = await makeRequest({
    path: `/api/church/lessons/${publishedLessonId}/materials/review`,
    method: 'POST',
    token: parentMaryToken,
    body: { versionId: publishedVersionId, action: 'APPROVE_ALL' }
  });
  assert(
    pReviewMat.statusCode === 403 && pReviewMat.json?.error === 'FORBIDDEN',
    '3.5 Parent is forbidden from reviewing or approving curriculum materials (403)',
    `Status ${pReviewMat.statusCode}`
  );

  // ============================================================================
  // SECTION 4: AI & CONTENT SAFETY PIPELINE AUDIT
  // ============================================================================
  console.log('\n--- SECTION 4: AI Content Safety & Grounding Invariants ---');

  // 4.1 AI generation refuses unapproved/draft lessons
  const aiDraftGen = await makeRequest({
    path: `/api/church/lessons/${draftLessonId}/generate-materials`,
    method: 'POST',
    token: teacherMinaToken,
    body: { versionId: draftVersionId }
  });
  assert(
    aiDraftGen.statusCode === 400 && aiDraftGen.json?.error === 'LESSON_NOT_APPROVED',
    '4.1 Material generation refused for AI_DRAFT version (400 LESSON_NOT_APPROVED)',
    `Status ${aiDraftGen.statusCode}`
  );

  // 4.2 Cross-lesson material review mismatch rejection
  const crossLessonRev = await makeRequest({
    path: `/api/church/lessons/${draftLessonId}/materials/review`,
    method: 'POST',
    token: teacherMinaToken,
    body: { versionId: publishedVersionId, action: 'APPROVE_ALL' }
  });
  assert(
    crossLessonRev.statusCode === 400 && crossLessonRev.json?.error === 'CROSS_LESSON_MISMATCH',
    '4.2 Cross-lesson material review is strictly rejected (400 CROSS_LESSON_MISMATCH)',
    `Status ${crossLessonRev.statusCode}`
  );

  // 4.3 Student cannot see materials if unverified or rejected
  await makeRequest({
    path: `/api/church/lessons/${publishedLessonId}/generate-materials`,
    method: 'POST',
    token: teacherMinaToken,
    body: { versionId: publishedVersionId }
  }); // reset to UNVERIFIED
  const studentSeeUnverified = await makeRequest({
    path: `/api/church/lessons/${publishedLessonId}/materials`,
    token: studentDavidToken
  });
  assert(
    studentSeeUnverified.statusCode === 200 &&
    (studentSeeUnverified.json?.materials?.slides || []).length === 0,
    '4.3 Students receive 0 slides when newly generated materials are in UNVERIFIED state',
    `Slides: ${studentSeeUnverified.json?.materials?.slides?.length}`
  );

  // Re-approve for downstream tests
  await makeRequest({
    path: `/api/church/lessons/${publishedLessonId}/materials/review`,
    method: 'POST',
    token: teacherMinaToken,
    body: { versionId: publishedVersionId, action: 'APPROVE_ALL' }
  });

  // ============================================================================
  // SECTION 5: ROLE & AUTHORIZATION MATRIX
  // ============================================================================
  console.log('\n--- SECTION 5: Comprehensive Role & Authorization Matrix ---');

  // Matrix: Test sensitive routes with Student, Parent, Servant, Admin
  const authMatrixTests = [
    {
      name: 'Source library access',
      path: '/api/church/sources',
      method: 'GET',
      studentExpected: 403,
      parentExpected: 403,
      servantExpected: 200,
      adminExpected: 200
    },
    {
      name: 'Publishing endpoint access',
      path: '/api/church/publish-lesson-version',
      method: 'POST',
      body: { lessonId: publishedLessonId, versionId: publishedVersionId },
      studentExpected: 403,
      parentExpected: 403,
      servantExpected: 200,
      adminExpected: 200
    },
    {
      name: 'Material review access',
      path: `/api/church/lessons/${publishedLessonId}/materials/review`,
      method: 'POST',
      body: { versionId: publishedVersionId, action: 'APPROVE_ALL' },
      studentExpected: 403,
      parentExpected: 403,
      servantExpected: 200,
      adminExpected: 200
    },
    {
      name: 'Class roster access',
      path: '/api/church/class-roster?classGroupId=primary_2',
      method: 'GET',
      studentExpected: 403,
      parentExpected: 403,
      servantExpected: 200,
      adminExpected: 200
    }
  ];

  for (const t of authMatrixTests) {
    const rStudent = await makeRequest({ path: t.path, method: t.method, token: studentDavidToken, body: t.body });
    const rParent = await makeRequest({ path: t.path, method: t.method, token: parentMaryToken, body: t.body });
    const rServant = await makeRequest({ path: t.path, method: t.method, token: teacherMinaToken, body: t.body });
    const rAdmin = await makeRequest({ path: t.path, method: t.method, token: adminToken, body: t.body });

    assert(
      rStudent.statusCode === t.studentExpected,
      `5.X [${t.name}] Student rejected with expected status ${t.studentExpected}`,
      `Got ${rStudent.statusCode}`
    );
    assert(
      rParent.statusCode === t.parentExpected,
      `5.X [${t.name}] Parent rejected with expected status ${t.parentExpected}`,
      `Got ${rParent.statusCode}`
    );
    assert(
      rServant.statusCode === t.servantExpected,
      `5.X [${t.name}] Authorized servant allowed with status ${t.servantExpected}`,
      `Got ${rServant.statusCode}`
    );
    assert(
      rAdmin.statusCode === t.adminExpected,
      `5.X [${t.name}] Admin oversight allowed with status ${t.adminExpected}`,
      `Got ${rAdmin.statusCode}`
    );
  }

  // ============================================================================
  // SECTION 6: FILE & UPLOAD SECURITY
  // ============================================================================
  console.log('\n--- SECTION 6: File & Upload Security Auditing ---');

  // 6.1 Path traversal blocked
  const traversal1 = await makeRequest({ path: '/uploads/..%2Fpackage.json' });
  const traversal2 = await makeRequest({ path: '/uploads/%2e%2e%2fpackage.json' });
  assert(
    (traversal1.statusCode === 400 || traversal1.statusCode === 403) &&
    (traversal2.statusCode === 400 || traversal2.statusCode === 403),
    '6.1 Path traversal attacks on /uploads are strictly blocked (400/403 Forbidden)',
    `Traversal statuses: ${traversal1.statusCode}, ${traversal2.statusCode}`
  );

  // 6.2 Anonymous access to private teacher source blocked
  const anonPrivate = await makeRequest({ path: `/uploads/${draftFileName}` });
  assert(
    anonPrivate.statusCode === 401 || anonPrivate.statusCode === 403,
    '6.2 Anonymous access to private teacher upload is denied',
    `Status ${anonPrivate.statusCode}`
  );

  // 6.3 Student access to teacher draft source blocked
  const studentPrivate = await makeRequest({
    path: `/uploads/${draftFileName}`,
    token: studentDavidToken
  });
  assert(
    studentPrivate.statusCode === 403,
    '6.3 Student access to teacher draft document is forbidden (403)',
    `Status ${studentPrivate.statusCode}`
  );

  // 6.4 Author teacher can access own draft source
  const authorPrivate = await makeRequest({
    path: `/uploads/${draftFileName}`,
    token: teacherMinaToken
  });
  assert(
    authorPrivate.statusCode === 200,
    '6.4 Author teacher Mina can access own draft file (200 OK)',
    `Status ${authorPrivate.statusCode}`
  );

  // ============================================================================
  // SECTION 7: DEMO, GUEST & OFFLINE RESILIENCE
  // ============================================================================
  console.log('\n--- SECTION 7: Demo / Guest / Offline Compatibility ---');

  // 7.1 Unauthenticated materials request
  const demoMaterials = await makeRequest({ path: `/api/church/lessons/${publishedLessonId}/materials` });
  assert(
    demoMaterials.statusCode === 200 &&
    demoMaterials.json?.isStudentView === true &&
    Array.isArray(demoMaterials.json?.materials?.slides),
    '7.1 Demo / Guest student accesses approved materials without crash or Supabase requirement',
    `Status ${demoMaterials.statusCode}`
  );

  // 7.2 Unauthenticated quiz load & submission
  const demoQuiz = await makeRequest({ path: `/api/church/student-quiz?lessonId=${publishedLessonId}` });
  const demoSubmit = await makeRequest({
    path: '/api/church/student-quiz/submit',
    method: 'POST',
    body: {
      lessonId: publishedLessonId,
      versionId: publishedVersionId,
      quizId: 'quiz-multi-01',
      answers: [{ questionId: 'q-multi-1', selectedOptionIndex: 0 }]
    }
  });
  assert(
    demoQuiz.statusCode === 200 && demoSubmit.statusCode === 200 && demoSubmit.json?.success === true,
    '7.2 Demo / Guest student loads and submits quiz smoothly in offline mode',
    `Quiz status: ${demoQuiz.statusCode}, Submit status: ${demoSubmit.statusCode}`
  );

  // 7.3 Unauthenticated parent child review fallback
  const demoParent = await makeRequest({ path: '/api/church/parent/children' });
  assert(
    demoParent.statusCode === 200 && Array.isArray(demoParent.json?.children),
    '7.3 Demo parent mode loads sample children safely without auth error',
    `Children count: ${demoParent.json?.children?.length}`
  );

  // ============================================================================
  // SECTION 8: DATA & VERSION INTEGRITY INVARIANTS
  // ============================================================================
  console.log('\n--- SECTION 8: Data & Version Integrity Invariants ---');

  // 8.1 Active published version pointer invariant
  const vCheck = await makeRequest({
    path: `/api/church/active-version?lessonId=${publishedLessonId}`,
    token: teacherMinaToken
  });
  assert(
    vCheck.statusCode === 200 &&
    vCheck.json?.activeVersion?.id === publishedVersionId &&
    vCheck.json?.activeVersion?.status === 'PUBLISHED',
    '8.1 Published lesson active_version_id points strictly to active published version',
    `Active version: ${vCheck.json?.activeVersion?.id}`
  );

  // 8.2 Direct client manipulation blocked
  const vMutate = await makeRequest({
    path: `/api/church/lessons/${publishedLessonId}`,
    method: 'PATCH',
    token: studentDavidToken,
    body: { active_version_id: 'v-hacked-99', status: 'draft' }
  });
  assert(
    vMutate.statusCode === 403 || vMutate.statusCode === 404 || vMutate.statusCode === 405,
    '8.2 Client direct mutation of active_version_id is blocked',
    `Status ${vMutate.statusCode}`
  );

  console.log('\n================================================================');
  console.log(`PHASE 3 FINAL QA RESULTS: ${passed} Passed, ${failed} Failed`);
  console.log('================================================================');

  if (failed > 0) {
    process.exit(1);
  }
}

runPhase3FinalQASuite().catch(err => {
  console.error('Final QA suite fatal exception:', err);
  process.exit(1);
});
