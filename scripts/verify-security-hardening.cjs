// Automated Security Hardening Verification Script
// Tests Phase 2B.2 file access controls on /uploads and /api/upload-media

const fs = require('fs');
const path = require('path');
const http = require('http');

const PORT = 3000;
const BASE_URL = `http://localhost:${PORT}`;
const uploadsDir = path.join(process.cwd(), 'uploads');

if (!fs.existsSync(uploadsDir)) {
  fs.mkdirSync(uploadsDir, { recursive: true });
}

// Setup test files in uploadsDir
// 1. Private draft file uploaded by teacher_mina
const draftFileName = 'test_draft_lesson_source_cross.pdf';
const draftFilePath = path.join(uploadsDir, draftFileName);
fs.writeFileSync(draftFilePath, '%PDF-1.4 [Secret Draft Source - St. Helena Cross Lesson]');

const draftMetaPath = path.join(uploadsDir, `.${draftFileName}.meta.json`);
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

// 2. Private audio file uploaded by teacher_mina
const draftAudioName = 'test_draft_teacher_voice.webm';
const draftAudioPath = path.join(uploadsDir, draftAudioName);
fs.writeFileSync(draftAudioPath, '[Binary audio data of private teacher explanation]');

const draftAudioMetaPath = path.join(uploadsDir, `.${draftAudioName}.meta.json`);
fs.writeFileSync(draftAudioMetaPath, JSON.stringify({
  filename: draftAudioName,
  originalName: 'teacher_voice_explanation_draft.webm',
  mimeType: 'audio/webm',
  size: 51,
  uploadedBy: 'user_teacher_mina_101',
  uploaderRole: 'teacher',
  isPublic: false,
  uploadType: 'source',
  uploadedAt: new Date().toISOString()
}, null, 2));

// 3. Intentionally public feed photo
const publicFeedName = 'test_public_feed_activity.jpg';
const publicFeedPath = path.join(uploadsDir, publicFeedName);
fs.writeFileSync(publicFeedPath, '[JPEG data of church summer camp activity]');

const publicFeedMetaPath = path.join(uploadsDir, `.${publicFeedName}.meta.json`);
fs.writeFileSync(publicFeedMetaPath, JSON.stringify({
  filename: publicFeedName,
  originalName: 'church_activity_summer_2026.jpg',
  mimeType: 'image/jpeg',
  size: 44,
  uploadedBy: 'user_student_david_201',
  uploaderRole: 'student',
  isPublic: true,
  uploadType: 'feed',
  uploadedAt: new Date().toISOString()
}, null, 2));

// Helper HTTP request function
function makeRequest({ path: reqPath, method = 'GET', headers = {}, token = null }) {
  return new Promise((resolve, reject) => {
    const finalHeaders = { ...headers };
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
      let body = '';
      res.on('data', (chunk) => { body += chunk; });
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

    req.on('error', (err) => reject(err));
    req.end();
  });
}

async function runSecurityTests() {
  console.log('====================================================');
  console.log('Coptic Sunday School Security Hardening Test Suite');
  console.log('Auditing /uploads route & Access Control Verification');
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

  // TEST 1: Anonymous user cannot fetch private draft audio directly (Negative test)
  const res1 = await makeRequest({ path: `/uploads/${draftAudioName}` });
  assert(
    res1.statusCode === 401,
    "Test 1: Anonymous request for private draft audio returns 401 Unauthorized",
    `Got status ${res1.statusCode}: ${res1.body}`
  );

  // TEST 2: Student cannot fetch another teacher's draft PDF directly (Negative test)
  const res2 = await makeRequest({
    path: `/uploads/${draftFileName}`,
    token: 'test_jwt_student_std_george_202'
  });
  assert(
    res2.statusCode === 403,
    "Test 2: Student request for teacher's draft PDF returns 403 Forbidden",
    `Got status ${res2.statusCode}: ${res2.body}`
  );

  // TEST 3: Another teacher cannot fetch another teacher's private draft PDF (Negative test)
  const res3 = await makeRequest({
    path: `/uploads/${draftFileName}`,
    token: 'test_jwt_teacher_tch_different_teacher_303'
  });
  assert(
    res3.statusCode === 403,
    "Test 3: Different teacher request for private draft PDF returns 403 Forbidden",
    `Got status ${res3.statusCode}: ${res3.body}`
  );

  // TEST 4: Authorized author teacher CAN fetch their own draft source via Header (Positive test)
  const res4 = await makeRequest({
    path: `/uploads/${draftFileName}`,
    token: 'test_jwt_teacher_user_teacher_mina_101'
  });
  assert(
    res4.statusCode === 200,
    "Test 4: Author teacher request for own draft PDF returns 200 OK (Bearer header)",
    `Got status ${res4.statusCode}`
  );

  // TEST 5: Authorized author teacher CAN fetch their own draft source via Query Token (Positive test)
  const res5 = await makeRequest({
    path: `/uploads/${draftFileName}?token=test_jwt_teacher_user_teacher_mina_101`
  });
  assert(
    res5.statusCode === 200,
    "Test 5: Author teacher request for own draft PDF returns 200 OK (Query param ?token=...)",
    `Got status ${res5.statusCode}`
  );

  // TEST 6: Authorized admin CAN fetch any draft source (Positive test)
  const res6 = await makeRequest({
    path: `/uploads/${draftFileName}`,
    token: 'test_jwt_admin_church_admin_401'
  });
  assert(
    res6.statusCode === 200,
    "Test 6: Church Admin request for teacher draft PDF returns 200 OK",
    `Got status ${res6.statusCode}`
  );

  // TEST 7: Intentionally public sample resource works without auth (Positive test)
  const res7 = await makeRequest({ path: '/uploads/sample_cross_lesson_handout.pdf' });
  assert(
    res7.statusCode === 200,
    "Test 7: Intentionally public sample handout returns 200 OK without authentication",
    `Got status ${res7.statusCode}`
  );

  // TEST 8: Community feed public post photo works without auth (Positive test)
  const res8 = await makeRequest({ path: `/uploads/${publicFeedName}` });
  assert(
    res8.statusCode === 200,
    "Test 8: Community feed public photo returns 200 OK without authentication",
    `Got status ${res8.statusCode}`
  );

  // TEST 9: Directory traversal attempt is blocked (Security test)
  const res9 = await makeRequest({ path: '/uploads/..%2Fpackage.json' });
  assert(
    res9.statusCode === 400 || res9.statusCode === 403 || res9.statusCode === 404,
    "Test 9: Directory traversal attack (/uploads/..%2Fpackage.json) is blocked",
    `Got status ${res9.statusCode}`
  );

  // TEST 10: Nonexistent file returns 404 (Edge case)
  const res10 = await makeRequest({
    path: '/uploads/non_existent_file_9999.pdf',
    token: 'test_jwt_admin_church_admin_401'
  });
  assert(
    res10.statusCode === 404,
    "Test 10: Non-existent file returns 404 Not Found",
    `Got status ${res10.statusCode}`
  );

  console.log('\n====================================================');
  console.log(`Results: ${passed} passed, ${failed} failed`);
  console.log('====================================================\n');

  if (failed > 0) {
    process.exit(1);
  }
}

runSecurityTests().catch(err => {
  console.error("Test execution failed:", err);
  process.exit(1);
});
