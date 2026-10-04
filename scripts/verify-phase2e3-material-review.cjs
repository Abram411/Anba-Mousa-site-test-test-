// Automated Phase 2E.3 Generated Material Review & Student Integration Test Suite
const http = require('http');

const PORT = 3000;
const BASE_URL = `http://localhost:${PORT}`;

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

async function runPhase2E3Tests() {
  console.log('====================================================');
  console.log('Phase 2E.3 Generated Material Review & Integration Suite');
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

  // Tokens
  const teacherMinaToken = 'test_jwt_teacher_mina';
  const teacherOtherToken = 'test_jwt_teacher_other';
  const studentToken = 'test_jwt_student_david';
  const parentToken = 'test_jwt_parent_mary';
  const adminToken = 'test_jwt_admin_church';

  const multiLessonId = 'l-test-multiversion-01';
  const multiV1Id = 'v-test-multi-1';

  // ----------------------------------------------------
  // Setup: Ensure fresh grounded materials packet exists
  // ----------------------------------------------------
  console.log('--- Setup: Generate Fresh Unverified Grounded Materials ---');
  const setupRes = await makeRequest({
    path: `/api/church/lessons/${multiLessonId}/generate-materials`,
    method: 'POST',
    token: teacherMinaToken,
    body: { versionId: multiV1Id, types: 'ALL' }
  });

  assert(
    setupRes.statusCode === 201 && setupRes.json?.success === true,
    'Setup: Fresh materials packet generated for testing (201 Created)',
    `Status ${setupRes.statusCode}: ${setupRes.body}`
  );

  // ----------------------------------------------------
  // TEST 1: Authorized Servant Can Retrieve Generated Materials
  // ----------------------------------------------------
  console.log('\n--- Test 1: Servant Retrieves Generated Materials ---');
  const res1 = await makeRequest({
    path: `/api/church/lessons/${multiLessonId}/materials?versionId=${multiV1Id}`,
    method: 'GET',
    token: teacherMinaToken
  });

  assert(
    res1.statusCode === 200 &&
    res1.json?.success === true &&
    res1.json?.isStudentView === false &&
    Array.isArray(res1.json?.materials?.slides) &&
    res1.json?.materials?.slides.length > 0,
    'Test 1: Authorized servant Mina retrieves full materials packet including unverified items',
    `Status ${res1.statusCode}`
  );

  const initialPacket = res1.json?.materials;
  const slide1 = initialPacket?.slides[0];
  const card1 = initialPacket?.flashcards[0];
  const quiz1 = initialPacket?.quiz[0];

  // ----------------------------------------------------
  // TEST 2: Item-Level Approval by Authorized Servant
  // ----------------------------------------------------
  console.log('\n--- Test 2: Item-Level Material Approval ---');
  const res2 = await makeRequest({
    path: `/api/church/lessons/${multiLessonId}/materials/review`,
    method: 'POST',
    token: teacherMinaToken,
    body: {
      versionId: multiV1Id,
      action: 'APPROVE_ITEM',
      itemType: 'SLIDES',
      itemId: String(slide1.number)
    }
  });

  assert(
    res2.statusCode === 200 &&
    res2.json?.success === true &&
    res2.json?.materials?.slides?.find(s => s.number === slide1.number)?.reviewStatus === 'APPROVED',
    'Test 2a: Servant successfully approves individual slide (Slide #1 -> APPROVED)',
    `Status ${res2.statusCode}: ${res2.body}`
  );

  // Approve card1 as well
  const res2b = await makeRequest({
    path: `/api/church/lessons/${multiLessonId}/materials/review`,
    method: 'POST',
    token: teacherMinaToken,
    body: {
      versionId: multiV1Id,
      action: 'APPROVE_ITEM',
      itemType: 'FLASHCARDS',
      itemId: card1.id
    }
  });

  assert(
    res2b.statusCode === 200 &&
    res2b.json?.materials?.flashcards?.find(f => f.id === card1.id)?.reviewStatus === 'APPROVED',
    'Test 2b: Servant successfully approves individual flashcard (Card #1 -> APPROVED)',
    `Status ${res2b.statusCode}`
  );

  // ----------------------------------------------------
  // TEST 3: Reject / Hide Material by Authorized Servant
  // ----------------------------------------------------
  console.log('\n--- Test 3: Reject / Hide Invalid Material ---');
  const slide2 = initialPacket?.slides[1] || initialPacket?.slides[0];
  const res3 = await makeRequest({
    path: `/api/church/lessons/${multiLessonId}/materials/review`,
    method: 'POST',
    token: teacherMinaToken,
    body: {
      versionId: multiV1Id,
      action: 'REJECT',
      itemType: 'SLIDES',
      itemId: String(slide2.number)
    }
  });

  assert(
    res3.statusCode === 200 &&
    res3.json?.materials?.slides?.find(s => s.number === slide2.number)?.reviewStatus === 'REJECTED',
    'Test 3: Servant rejects invalid/unsupported slide (reviewStatus -> REJECTED)',
    `Status ${res3.statusCode}: ${res3.body}`
  );

  // ----------------------------------------------------
  // TEST 4: Student Cannot Review / Approve Materials
  // ----------------------------------------------------
  console.log('\n--- Test 4: Student Review Protection ---');
  const res4 = await makeRequest({
    path: `/api/church/lessons/${multiLessonId}/materials/review`,
    method: 'POST',
    token: studentToken,
    body: {
      versionId: multiV1Id,
      action: 'APPROVE_ALL'
    }
  });

  assert(
    res4.statusCode === 403 && res4.json?.error === 'FORBIDDEN',
    'Test 4: Student receives 403 FORBIDDEN when attempting to review materials',
    `Status ${res4.statusCode}`
  );

  // ----------------------------------------------------
  // TEST 5: Parent Cannot Review / Approve Materials
  // ----------------------------------------------------
  console.log('\n--- Test 5: Parent Review Protection ---');
  const res5 = await makeRequest({
    path: `/api/church/lessons/${multiLessonId}/materials/review`,
    method: 'POST',
    token: parentToken,
    body: {
      versionId: multiV1Id,
      action: 'APPROVE_ALL'
    }
  });

  assert(
    res5.statusCode === 403 && res5.json?.error === 'FORBIDDEN',
    'Test 5: Parent receives 403 FORBIDDEN when attempting to review materials',
    `Status ${res5.statusCode}`
  );

  // ----------------------------------------------------
  // TEST 6: Cross-Teacher Isolation
  // ----------------------------------------------------
  console.log('\n--- Test 6: Cross-Teacher Review Isolation ---');
  const res6 = await makeRequest({
    path: `/api/church/lessons/${multiLessonId}/materials/review`,
    method: 'POST',
    token: teacherOtherToken,
    body: {
      versionId: multiV1Id,
      action: 'APPROVE_ALL'
    }
  });

  assert(
    res6.statusCode === 403 && res6.json?.error === 'FORBIDDEN',
    'Test 6: Unrelated teacher cannot review another servant\'s lesson materials (403 FORBIDDEN)',
    `Status ${res6.statusCode}`
  );

  // ----------------------------------------------------
  // TEST 7: Unverified & Rejected Materials Hidden from Students
  // ----------------------------------------------------
  console.log('\n--- Test 7: Student Visibility Isolation ---');
  const res7Student = await makeRequest({
    path: `/api/church/lessons/${multiLessonId}/materials`,
    method: 'GET',
    token: studentToken
  });

  assert(
    res7Student.statusCode === 200 && res7Student.json?.isStudentView === true,
    'Test 7a: Student successfully fetches published materials',
    `Status ${res7Student.statusCode}`
  );

  const studentMaterials = res7Student.json?.materials;
  const anyUnverifiedInStudent = studentMaterials.slides.some(s => s.reviewStatus !== 'APPROVED') ||
                                 studentMaterials.flashcards.some(f => f.reviewStatus !== 'APPROVED') ||
                                 studentMaterials.quiz.some(q => q.reviewStatus !== 'APPROVED');

  const rejectedSlideInStudent = studentMaterials.slides.some(s => s.number === slide2.number && s.reviewStatus === 'REJECTED');

  assert(
    !anyUnverifiedInStudent && !rejectedSlideInStudent,
    'Test 7b: Student view strictly excludes UNVERIFIED and REJECTED materials',
    JSON.stringify({ studentSlides: studentMaterials.slides.map(s => ({ n: s.number, st: s.reviewStatus })) })
  );

  // ----------------------------------------------------
  // TEST 8: Draft / Unpublished Lesson Inaccessible to Students
  // ----------------------------------------------------
  console.log('\n--- Test 8: Draft Lesson Material Inaccessible to Students ---');
  const res8 = await makeRequest({
    path: `/api/church/lessons/l-test-draft-01/materials`,
    method: 'GET',
    token: studentToken
  });

  assert(
    res8.statusCode === 403 && res8.json?.error === 'FORBIDDEN',
    'Test 8: Student receives 403 FORBIDDEN for unpublished draft lesson materials',
    `Status ${res8.statusCode}`
  );

  // ----------------------------------------------------
  // TEST 9: Cross-Lesson Material Review Rejection
  // ----------------------------------------------------
  console.log('\n--- Test 9: Cross-Lesson Protection ---');
  const res9 = await makeRequest({
    path: `/api/church/lessons/l-test-draft-01/materials/review`,
    method: 'POST',
    token: teacherMinaToken,
    body: {
      versionId: multiV1Id, // Version belongs to l-test-multiversion-01, not l-test-draft-01!
      action: 'APPROVE_ALL'
    }
  });

  assert(
    res9.statusCode === 400 && res9.json?.error === 'CROSS_LESSON_MISMATCH',
    'Test 9: Attempting to review material under wrong lesson returns 400 CROSS_LESSON_MISMATCH',
    `Status ${res9.statusCode}: ${res9.body}`
  );

  // ----------------------------------------------------
  // TEST 10: Cross-Version Material Review Rejection
  // ----------------------------------------------------
  console.log('\n--- Test 10: Cross-Version Protection ---');
  const res10 = await makeRequest({
    path: `/api/church/lessons/${multiLessonId}/materials/review`,
    method: 'POST',
    token: teacherMinaToken,
    body: {
      versionId: 'v-nonexistent-version-99',
      action: 'APPROVE_ALL'
    }
  });

  assert(
    res10.statusCode === 404 && res10.json?.error === 'MATERIALS_NOT_FOUND',
    'Test 10: Nonexistent version materials review returns 404 MATERIALS_NOT_FOUND',
    `Status ${res10.statusCode}`
  );

  // ----------------------------------------------------
  // TEST 11: Invalid / Forged Client Review Action Rejected
  // ----------------------------------------------------
  console.log('\n--- Test 11: Invalid / Forged Action Protection ---');
  const res11 = await makeRequest({
    path: `/api/church/lessons/${multiLessonId}/materials/review`,
    method: 'POST',
    token: teacherMinaToken,
    body: {
      versionId: multiV1Id,
      action: 'ARBITRARY_BYPASS_ACTION',
      reviewStatus: 'APPROVED' // Attempting to inject review status directly
    }
  });

  assert(
    res11.statusCode === 400 && res11.json?.error === 'INVALID_ACTION',
    'Test 11: Invalid review action is rejected (400 INVALID_ACTION); server enforces allowed actions',
    `Status ${res11.statusCode}`
  );

  // ----------------------------------------------------
  // TEST 12: Provenance Preserved After Approval
  // ----------------------------------------------------
  console.log('\n--- Test 12: Provenance Remains Intact After Review ---');
  const res12ApproveAll = await makeRequest({
    path: `/api/church/lessons/${multiLessonId}/materials/review`,
    method: 'POST',
    token: teacherMinaToken,
    body: {
      versionId: multiV1Id,
      action: 'APPROVE_ALL'
    }
  });

  const reviewedPacket = res12ApproveAll.json?.materials;
  const verifiedSlide = reviewedPacket?.slides[0];
  const verifiedCard = reviewedPacket?.flashcards[0];
  const verifiedQuiz = reviewedPacket?.quiz[0];

  assert(
    verifiedSlide &&
    verifiedSlide.reviewStatus === 'APPROVED' &&
    verifiedSlide.sourceRefs && verifiedSlide.sourceRefs.length > 0 &&
    verifiedCard &&
    verifiedCard.reviewStatus === 'APPROVED' &&
    verifiedCard.sourceRefs && verifiedCard.sourceRefs.length > 0 &&
    verifiedQuiz &&
    verifiedQuiz.reviewStatus === 'APPROVED' &&
    verifiedQuiz.sourceRef !== undefined,
    'Test 12: Strict provenance, source references, and quotes are fully preserved after approval',
    JSON.stringify({ slideSrc: verifiedSlide?.sourceRefs, cardSrc: verifiedCard?.sourceRefs, quizSrc: verifiedQuiz?.sourceRef })
  );

  // ----------------------------------------------------
  // TEST 13: Authoritative Quiz System Scoring Intact
  // ----------------------------------------------------
  console.log('\n--- Test 13: Existing Authoritative Quiz Scoring Still Functions ---');
  const res13Quiz = await makeRequest({
    path: `/api/church/student-quiz?lessonId=${multiLessonId}`,
    method: 'GET',
    token: studentToken
  });

  assert(
    res13Quiz.statusCode === 200 &&
    res13Quiz.json?.success === true &&
    res13Quiz.json?.quiz?.id === 'quiz-multi-01' &&
    Array.isArray(res13Quiz.json?.quiz?.questions),
    'Test 13a: Existing student-quiz loads active published assessment without regression',
    `Status ${res13Quiz.statusCode}`
  );

  const res13Submit = await makeRequest({
    path: `/api/church/student-quiz/submit`,
    method: 'POST',
    token: studentToken,
    body: {
      lessonId: multiLessonId,
      versionId: multiV1Id,
      quizId: 'quiz-multi-01',
      answers: [
        { questionId: 'q-multi-1', selectedOptionIndex: 0 },
        { questionId: 'q-multi-2', selectedOptionIndex: 1 }
      ]
    }
  });

  assert(
    res13Submit.statusCode === 200 &&
    res13Submit.json?.attempt?.percentage === 100 &&
    res13Submit.json?.attempt?.passed === true,
    'Test 13b: Server-side quiz evaluation computes authoritative 100% score accurately',
    JSON.stringify(res13Submit.json?.attempt)
  );

  // ----------------------------------------------------
  // TEST 14: Demo / Guest / Offline Behavior Unchanged
  // ----------------------------------------------------
  console.log('\n--- Test 14: Demo / Guest / Offline Compatibility ---');
  const res14Demo = await makeRequest({
    path: `/api/church/lessons/${multiLessonId}/materials`,
    method: 'GET'
  });

  assert(
    res14Demo.statusCode === 200 &&
    res14Demo.json?.isStudentView === true &&
    Array.isArray(res14Demo.json?.materials?.slides) &&
    res14Demo.json?.materials?.slides.length > 0,
    'Test 14: Demo/Guest/Offline mode accesses approved materials cleanly without requiring tokens or Supabase',
    `Status ${res14Demo.statusCode}`
  );

  console.log('\n====================================================');
  console.log(`Results: ${passed} Passed, ${failed} Failed`);
  console.log('====================================================');

  if (failed > 0) {
    process.exit(1);
  }
}

runPhase2E3Tests().catch(err => {
  console.error('Test runner fatal exception:', err);
  process.exit(1);
});
