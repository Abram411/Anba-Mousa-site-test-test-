// Automated Phase 2E.2 Generated Learning Materials Test Suite
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

async function runPhase2E2Tests() {
  console.log('====================================================');
  console.log('Phase 2E.2 Generated Learning Materials Test Suite');
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

  // ----------------------------------------------------
  // TEST 1: Authorized Servant Can Generate Materials
  // ----------------------------------------------------
  console.log('--- Test 1: Authorized Servant Generation ---');
  const res1 = await makeRequest({
    path: '/api/church/lessons/l-test-multiversion-01/generate-materials',
    method: 'POST',
    token: teacherMinaToken,
    body: { versionId: 'v-test-multi-1', types: 'ALL' }
  });

  assert(
    res1.statusCode === 201 && res1.json?.success === true,
    'Test 1a: Authorized servant Mina generates learning materials (201 Created)',
    `Status ${res1.statusCode}: ${res1.body}`
  );

  const materials1 = res1.json?.materials;
  assert(
    materials1 &&
    Array.isArray(materials1.slides) && materials1.slides.length > 0 &&
    Array.isArray(materials1.flashcards) && materials1.flashcards.length > 0 &&
    Array.isArray(materials1.quiz) && materials1.quiz.length > 0,
    'Test 1b: Generates structured Slides, Flashcards, and Quiz items',
    JSON.stringify({ slides: materials1?.slides?.length, flashcards: materials1?.flashcards?.length, quiz: materials1?.quiz?.length })
  );

  // ----------------------------------------------------
  // TEST 2: Items Remain UNVERIFIED until Servant Review
  // ----------------------------------------------------
  console.log('\n--- Test 2: Unverified Default Status ---');
  const allSlidesUnverified = materials1.slides.every(s => s.reviewStatus === 'UNVERIFIED');
  const allCardsUnverified = materials1.flashcards.every(f => f.reviewStatus === 'UNVERIFIED');
  const allQuizUnverified = materials1.quiz.every(q => q.reviewStatus === 'UNVERIFIED');

  assert(
    allSlidesUnverified && allCardsUnverified && allQuizUnverified && res1.json?.status === 'UNVERIFIED',
    'Test 2: All generated materials strictly initialize with reviewStatus = UNVERIFIED',
    ''
  );

  // ----------------------------------------------------
  // TEST 3: Strict Provenance & Cross-Lesson Boundary
  // ----------------------------------------------------
  console.log('\n--- Test 3: Provenance & Cross-Lesson Boundary ---');
  // Check source references belong strictly to l-test-multiversion-01 (e.g. src-multi-01)
  const slideSources = materials1.slides.flatMap(s => s.sourceRefs || []);
  const cardSources = materials1.flashcards.flatMap(f => f.sourceRefs || []);
  const quizSources = materials1.quiz.map(q => q.sourceRef).filter(Boolean);

  const allRefs = [...slideSources, ...cardSources, ...quizSources];
  const hasLeakedForeignSource = allRefs.some(ref => 
    ref.sourceId === 'src-other-01' || 
    ref.sourceName === 'Other_Teacher_Private_Notes.pdf'
  );

  assert(
    !hasLeakedForeignSource && allRefs.length > 0,
    'Test 3: Every generated item has strict provenance and cannot reference another lesson\'s sources',
    JSON.stringify(allRefs[0])
  );

  // ----------------------------------------------------
  // TEST 4: Client Cannot Forge Approval / Review State
  // ----------------------------------------------------
  console.log('\n--- Test 4: Forgery Prevention ---');
  const res4Forged = await makeRequest({
    path: '/api/church/lessons/l-test-multiversion-01/generate-materials',
    method: 'POST',
    token: teacherMinaToken,
    body: {
      versionId: 'v-test-multi-1',
      reviewStatus: 'APPROVED',
      status: 'APPROVED',
      isApproved: true
    }
  });

  const forgedMaterials = res4Forged.json?.materials;
  const anySlideApproved = (forgedMaterials?.slides || []).some(s => s.reviewStatus === 'APPROVED');
  assert(
    res4Forged.json?.status === 'UNVERIFIED' && !anySlideApproved,
    'Test 4: Client-supplied approval status is ignored; server always enforces UNVERIFIED on generation',
    res4Forged.body
  );

  // ----------------------------------------------------
  // TEST 5: Student & Parent Rejection from Generation
  // ----------------------------------------------------
  console.log('\n--- Test 5: Role Protections on Generation ---');
  const res5Student = await makeRequest({
    path: '/api/church/lessons/l-test-multiversion-01/generate-materials',
    method: 'POST',
    token: studentToken,
    body: { versionId: 'v-test-multi-1' }
  });

  assert(
    res5Student.statusCode === 403 && res5Student.json?.error === 'FORBIDDEN',
    'Test 5a: Student is rejected from material generation (403 FORBIDDEN)',
    res5Student.body
  );

  const res5Parent = await makeRequest({
    path: '/api/church/lessons/l-test-multiversion-01/generate-materials',
    method: 'POST',
    token: parentToken,
    body: { versionId: 'v-test-multi-1' }
  });

  assert(
    res5Parent.statusCode === 403 && res5Parent.json?.error === 'FORBIDDEN',
    'Test 5b: Parent is rejected from material generation (403 FORBIDDEN)',
    res5Parent.body
  );

  // ----------------------------------------------------
  // TEST 6: Unrelated Servant Rejection
  // ----------------------------------------------------
  console.log('\n--- Test 6: Cross-Teacher Isolation ---');
  const res6Other = await makeRequest({
    path: '/api/church/lessons/l-test-multiversion-01/generate-materials',
    method: 'POST',
    token: teacherOtherToken,
    body: { versionId: 'v-test-multi-1' }
  });

  assert(
    res6Other.statusCode === 403 && res6Other.json?.error === 'FORBIDDEN',
    'Test 6: Unrelated servant is rejected from generating another teacher\'s materials (403 FORBIDDEN)',
    res6Other.body
  );

  // ----------------------------------------------------
  // TEST 7: Draft / Unapproved Version Rejection
  // ----------------------------------------------------
  console.log('\n--- Test 7: Version Status Safety ---');
  const res7Draft = await makeRequest({
    path: '/api/church/lessons/l-test-draft-01/generate-materials',
    method: 'POST',
    token: teacherMinaToken,
    body: { versionId: 'v-test-draft-1' } // Status is AI_DRAFT
  });

  assert(
    res7Draft.statusCode === 400 && res7Draft.json?.error === 'LESSON_NOT_APPROVED',
    'Test 7: Generation refused for AI_DRAFT version (400 LESSON_NOT_APPROVED)',
    res7Draft.body
  );

  // ----------------------------------------------------
  // TEST 8: Missing Evidence Map Rejection
  // ----------------------------------------------------
  console.log('\n--- Test 8: Evidence Map Requirement ---');
  // l-cross-01 has no claims in serverReviewState.claims
  const res8NoEvidence = await makeRequest({
    path: '/api/church/lessons/l-cross-01/generate-materials',
    method: 'POST',
    token: teacherMinaToken,
    body: { versionId: 'v-nonexistent' }
  });

  assert(
    res8NoEvidence.statusCode === 400 || res8NoEvidence.statusCode === 404,
    'Test 8: Generation refused when version or evidence map is missing or invalid',
    res8NoEvidence.body
  );

  // ----------------------------------------------------
  // TEST 9: Unverified Materials Hidden from Students
  // ----------------------------------------------------
  console.log('\n--- Test 9: Student Publication Isolation ---');
  const res9Student = await makeRequest({
    path: '/api/church/lessons/l-test-multiversion-01/materials',
    token: studentToken
  });

  const studentMaterials = res9Student.json?.materials;
  assert(
    res9Student.statusCode === 200 &&
    (studentMaterials?.slides || []).length === 0 &&
    (studentMaterials?.flashcards || []).length === 0,
    'Test 9: Students cannot see UNVERIFIED materials on a published lesson',
    JSON.stringify(studentMaterials)
  );

  // ----------------------------------------------------
  // TEST 10: Draft / Unpublished Lesson Inaccessible to Students
  // ----------------------------------------------------
  console.log('\n--- Test 10: Draft Lesson Inaccessible to Students ---');
  const res10StudentDraft = await makeRequest({
    path: '/api/church/lessons/l-test-draft-01/materials',
    token: studentToken
  });

  assert(
    res10StudentDraft.statusCode === 403 && res10StudentDraft.json?.error === 'FORBIDDEN',
    'Test 10: Students cannot access materials for unpublished draft lesson (403 FORBIDDEN)',
    res10StudentDraft.body
  );

  // ----------------------------------------------------
  // TEST 11: Servant Review & Approval Flow
  // ----------------------------------------------------
  console.log('\n--- Test 11: Servant Review & Approval ---');
  const res11Approve = await makeRequest({
    path: '/api/church/lessons/l-test-multiversion-01/materials/review',
    method: 'POST',
    token: teacherMinaToken,
    body: { versionId: 'v-test-multi-1', action: 'APPROVE_ALL' }
  });

  assert(
    res11Approve.statusCode === 200 && res11Approve.json?.status === 'APPROVED',
    'Test 11a: Authorized servant reviews and approves materials (200 OK, status: APPROVED)',
    res11Approve.body
  );

  // Student now receives approved materials!
  const res11StudentAfter = await makeRequest({
    path: '/api/church/lessons/l-test-multiversion-01/materials',
    token: studentToken
  });

  const studentApproved = res11StudentAfter.json?.materials;
  assert(
    res11StudentAfter.statusCode === 200 &&
    (studentApproved?.slides || []).length > 0 &&
    (studentApproved?.flashcards || []).length > 0 &&
    (studentApproved?.slides || []).every(s => s.reviewStatus === 'APPROVED'),
    'Test 11b: Students receive approved materials after official servant review',
    JSON.stringify({ slidesCount: studentApproved?.slides?.length, cardsCount: studentApproved?.flashcards?.length })
  );

  // ----------------------------------------------------
  // TEST 12: Student & Parent Cannot Review or Approve
  // ----------------------------------------------------
  console.log('\n--- Test 12: Review Role Protection ---');
  const res12StudentReview = await makeRequest({
    path: '/api/church/lessons/l-test-multiversion-01/materials/review',
    method: 'POST',
    token: studentToken,
    body: { versionId: 'v-test-multi-1', action: 'APPROVE_ALL' }
  });

  assert(
    res12StudentReview.statusCode === 403,
    'Test 12: Students cannot approve or mutate reviewStatus (403 FORBIDDEN)',
    res12StudentReview.body
  );

  // ----------------------------------------------------
  // TEST 13: Demo / Guest / Offline Compatibility
  // ----------------------------------------------------
  console.log('\n--- Test 13: Demo / Offline Compatibility ---');
  const res13Demo = await makeRequest({
    path: '/api/church/lessons/l-test-multiversion-01/materials'
  });

  assert(
    res13Demo.statusCode === 200 && res13Demo.json?.success === true,
    'Test 13: Unauthenticated / Demo mode returns materials safely without error',
    res13Demo.body
  );

  // ----------------------------------------------------
  // Summary
  // ----------------------------------------------------
  console.log('\n====================================================');
  console.log(`Results: ${passed} Passed, ${failed} Failed`);
  console.log('====================================================');

  if (failed > 0) {
    process.exit(1);
  }
}

runPhase2E2Tests().catch(err => {
  console.error('Fatal error running Phase 2E.2 tests:', err);
  process.exit(1);
});
