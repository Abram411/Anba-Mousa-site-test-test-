// Automated Phase 2E.1 Media & Source Management Test Suite
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

async function runPhase2E1Tests() {
  console.log('====================================================');
  console.log('Phase 2E.1 Media & Source Management Test Suite');
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
  // TEST 1: Authorized Servant Retrieves Own & Published Sources
  // ----------------------------------------------------
  console.log('--- Test 1: Authorized Servant Source Listing ---');
  const res1 = await makeRequest({
    path: '/api/church/sources',
    token: teacherMinaToken
  });

  assert(
    res1.statusCode === 200 && res1.json && res1.json.success === true,
    'Test 1: Servant Mina retrieves curriculum sources (200 OK)',
    `Status ${res1.statusCode}: ${res1.body}`
  );

  const sources1 = res1.json?.sources || [];
  const foundCrossPdf = sources1.find(s => s.id === 'src-cross-01');
  const foundCrossVoice = sources1.find(s => s.id === 'src-cross-02');
  const foundMulti = sources1.find(s => s.id === 'src-multi-01');
  const leakedOther = sources1.find(s => s.id === 'src-other-01');

  assert(
    Boolean(foundCrossPdf && foundCrossVoice && foundMulti),
    'Test 1b: Servant receives own draft sources and published curriculum sources',
    `Found sources: ${sources1.map(s => s.id).join(', ')}`
  );

  assert(
    !leakedOther,
    'Test 1c: Another teacher\'s private draft source is NOT exposed in Mina\'s library',
    `Leaked: ${leakedOther?.id}`
  );

  // ----------------------------------------------------
  // TEST 2: Safe Metadata & Provenance Properties
  // ----------------------------------------------------
  console.log('\n--- Test 2: Safe Metadata Verification ---');
  const draftSource = sources1.find(s => s.id === 'src-draft-01');
  assert(
    draftSource &&
    draftSource.originalFilename === 'St_Helena_Feast_Cross_Handout.pdf' &&
    draftSource.type === 'PDF' &&
    typeof draftSource.fileSize === 'number' &&
    draftSource.rightsStatus === 'TEACHER_OWNED' &&
    draftSource.processingStatus === 'INDEXED' &&
    draftSource.isPublic === false &&
    draftSource.evidenceMapAvailable === true &&
    draftSource.evidenceClaimsCount >= 1,
    'Test 2: Source payload contains safe metadata and evidence availability flags',
    JSON.stringify(draftSource)
  );

  assert(
    !res1.body.includes('password') && !res1.body.includes('secret') && !res1.body.includes('db_conn'),
    'Test 2b: No private internals or credentials leaked in sources payload',
    ''
  );

  // ----------------------------------------------------
  // TEST 3: Cross-Teacher Draft Isolation
  // ----------------------------------------------------
  console.log('\n--- Test 3: Cross-Teacher Draft Isolation ---');
  const res3a = await makeRequest({
    path: '/api/church/sources',
    token: teacherOtherToken
  });

  const sources3a = res3a.json?.sources || [];
  const leakedMinaDraft = sources3a.find(s => s.id === 'src-cross-01' || s.id === 'src-draft-01');
  assert(
    !leakedMinaDraft,
    'Test 3a: Other teacher cannot see Mina\'s private draft sources',
    `Found: ${sources3a.map(s => s.id).join(', ')}`
  );

  const res3b = await makeRequest({
    path: '/api/church/sources?lessonId=l-cross-01',
    token: teacherOtherToken
  });

  assert(
    res3b.statusCode === 403,
    'Test 3b: Other teacher querying Mina\'s draft lessonId returns 403 FORBIDDEN',
    `Status ${res3b.statusCode}: ${res3b.body}`
  );

  // ----------------------------------------------------
  // TEST 4: Student & Parent Rejection
  // ----------------------------------------------------
  console.log('\n--- Test 4: Student & Parent Access Control ---');
  const res4Student = await makeRequest({
    path: '/api/church/sources',
    token: studentToken
  });

  assert(
    res4Student.statusCode === 403,
    'Test 4a: Student access to source library is rejected (403 FORBIDDEN)',
    `Status ${res4Student.statusCode}: ${res4Student.body}`
  );

  const res4Parent = await makeRequest({
    path: '/api/church/sources',
    token: parentToken
  });

  assert(
    res4Parent.statusCode === 403,
    'Test 4b: Parent access to source library is rejected (403 FORBIDDEN)',
    `Status ${res4Parent.statusCode}: ${res4Parent.body}`
  );

  // ----------------------------------------------------
  // TEST 5: Church Admin Universal Oversight
  // ----------------------------------------------------
  console.log('\n--- Test 5: Church Admin Universal Oversight ---');
  const res5 = await makeRequest({
    path: '/api/church/sources',
    token: adminToken
  });

  const adminSources = res5.json?.sources || [];
  const adminHasMina = adminSources.some(s => s.id === 'src-cross-01');
  const adminHasOther = adminSources.some(s => s.id === 'src-other-01');
  const adminHasPublished = adminSources.some(s => s.id === 'src-multi-01');

  assert(
    res5.statusCode === 200 && adminHasMina && adminHasOther && adminHasPublished,
    'Test 5: Church Admin has universal oversight across all teacher sources and published curriculum',
    `Admin count: ${adminSources.length}`
  );

  // ----------------------------------------------------
  // TEST 6: Single Source Inspection & Privacy
  // ----------------------------------------------------
  console.log('\n--- Test 6: Single Source Inspection & 404 Safety ---');
  const res6a = await makeRequest({
    path: '/api/church/sources/src-cross-01',
    token: teacherMinaToken
  });

  assert(
    res6a.statusCode === 200 && res6a.json?.source?.id === 'src-cross-01',
    'Test 6a: Author teacher can inspect own source by ID',
    res6a.body
  );

  const res6b = await makeRequest({
    path: '/api/church/sources/nonexistent-source-id',
    token: teacherMinaToken
  });

  assert(
    res6b.statusCode === 404 && res6b.json?.error === 'SOURCE_NOT_FOUND',
    'Test 6b: Nonexistent source returns 404 SOURCE_NOT_FOUND without crashing',
    res6b.body
  );

  const res6c = await makeRequest({
    path: '/api/church/sources/src-cross-01',
    token: teacherOtherToken
  });

  assert(
    res6c.statusCode === 403,
    'Test 6c: Unrelated teacher cannot inspect another teacher\'s draft source by ID (403 FORBIDDEN)',
    res6c.body
  );

  // ----------------------------------------------------
  // TEST 7: Read-Only Evidence Connection
  // ----------------------------------------------------
  console.log('\n--- Test 7: Read-Only Evidence Provenance Inspection ---');
  const res7a = await makeRequest({
    path: '/api/church/sources/src-draft-01/evidence',
    token: teacherMinaToken
  });

  assert(
    res7a.statusCode === 200 &&
    res7a.json?.readOnly === true &&
    res7a.json?.evidenceMapAvailable === true &&
    Array.isArray(res7a.json?.claims) &&
    res7a.json.claims.length > 0,
    'Test 7a: Evidence endpoint returns read-only claims and provenance references',
    res7a.body
  );

  const res7Student = await makeRequest({
    path: '/api/church/sources/src-draft-01/evidence',
    token: studentToken
  });

  assert(
    res7Student.statusCode === 403,
    'Test 7b: Student is blocked from inspecting evidence map details (403 FORBIDDEN)',
    res7Student.body
  );

  // ----------------------------------------------------
  // TEST 8: Safe Source Ingestion / Creation
  // ----------------------------------------------------
  console.log('\n--- Test 8: Source Ingestion / Attachment ---');
  const newTextSource = {
    lessonId: 'l-cross-01',
    type: 'TEACHER_TEXT',
    originalFilename: 'servant_sermon_notes.txt',
    description: 'Notes on Emperor Constantine and St. Helena',
    teacherNotes: 'Memory verse from 1 Corinthians 1:18',
    rightsStatus: 'TEACHER_OWNED',
    priority: 'PRIMARY'
  };

  const res8a = await makeRequest({
    path: '/api/church/sources',
    method: 'POST',
    token: teacherMinaToken,
    body: newTextSource
  });

  assert(
    res8a.statusCode === 201 && res8a.json?.success === true && res8a.json?.source?.type === 'TEACHER_TEXT',
    'Test 8a: Authorized teacher can attach new curriculum text source (201 Created)',
    res8a.body
  );

  const createdSourceId = res8a.json?.source?.id;

  // Reject unsupported source type
  const res8b = await makeRequest({
    path: '/api/church/sources',
    method: 'POST',
    token: teacherMinaToken,
    body: {
      lessonId: 'l-cross-01',
      type: 'UNSUPPORTED_EXE_FORMAT',
      originalFilename: 'harmful.exe'
    }
  });

  assert(
    res8b.statusCode === 400 && res8b.json?.error === 'INVALID_SOURCE_TYPE',
    'Test 8b: Unsupported file type is safely rejected (400 INVALID_SOURCE_TYPE)',
    res8b.body
  );

  // Reject attaching to another teacher's draft lesson
  const res8c = await makeRequest({
    path: '/api/church/sources',
    method: 'POST',
    token: teacherOtherToken,
    body: {
      lessonId: 'l-cross-01',
      type: 'PDF',
      originalFilename: 'intruder_handout.pdf'
    }
  });

  assert(
    res8c.statusCode === 403,
    'Test 8c: Teacher cannot attach sources to another teacher\'s draft lesson (403 FORBIDDEN)',
    res8c.body
  );

  // ----------------------------------------------------
  // TEST 9: Safe Detach / Deletion Rules
  // ----------------------------------------------------
  console.log('\n--- Test 9: Safe Detach / Deletion Invariants ---');
  
  // 1. Cannot delete published lesson source
  const res9Published = await makeRequest({
    path: '/api/church/sources/src-multi-01',
    method: 'DELETE',
    token: teacherMinaToken
  });

  assert(
    res9Published.statusCode === 400 && res9Published.json?.error === 'IMMUTABLE_PUBLISHED_LESSON',
    'Test 9a: Cannot delete or detach source from published curriculum (400 IMMUTABLE_PUBLISHED_LESSON)',
    res9Published.body
  );

  // 2. Other teacher cannot delete Mina's source
  const res9Other = await makeRequest({
    path: `/api/church/sources/${createdSourceId}`,
    method: 'DELETE',
    token: teacherOtherToken
  });

  assert(
    res9Other.statusCode === 403,
    'Test 9b: Another teacher cannot delete teacher Mina\'s source (403 FORBIDDEN)',
    res9Other.body
  );

  // 3. Mina can safely delete own draft source
  const res9Mina = await makeRequest({
    path: `/api/church/sources/${createdSourceId}`,
    method: 'DELETE',
    token: teacherMinaToken
  });

  assert(
    res9Mina.statusCode === 200 && res9Mina.json?.success === true,
    'Test 9c: Author teacher can safely detach own draft source (200 OK)',
    res9Mina.body
  );

  // ----------------------------------------------------
  // TEST 10: Storage & Path Traversal Protections
  // ----------------------------------------------------
  console.log('\n--- Test 10: Path Traversal & Storage Security ---');
  const res10Traversal = await makeRequest({
    path: '/uploads/..%2Fpackage.json'
  });

  assert(
    res10Traversal.statusCode === 400 || res10Traversal.statusCode === 403 || res10Traversal.statusCode === 404,
    'Test 10a: Directory traversal attack on /uploads is blocked',
    `Status ${res10Traversal.statusCode}`
  );

  const res10Storage = await makeRequest({
    path: '/api/storage/status'
  });

  assert(
    res10Storage.statusCode === 200 && res10Storage.json?.provider === 'local-server',
    'Test 10b: Local server uploads storage architecture verified without external cloud providers',
    res10Storage.body
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

runPhase2E1Tests().catch(err => {
  console.error('Fatal error running Phase 2E.1 tests:', err);
  process.exit(1);
});
