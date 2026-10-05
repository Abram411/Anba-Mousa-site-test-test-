/**
 * Verification script for Phase 3A:
 * 1. Sunday School Class/Grade Selector On First Login
 * 2. Deterministic Church Class Group derivation (e.g. Primary 4 -> Primary 4–6)
 * 3. User onboarding flow requesting account activation and manual approval
 * 4. Servant Roster Assignment & Notification
 * 5. Role-based security enforcement (Students/Parents cannot review; Servants only review assigned class; Admin has church-wide access)
 */

const http = require('http');

const PORT = 3000;
const BASE_URL = `http://localhost:${PORT}`;

// Helper: Make HTTP request
function request(method, path, body = null, headers = {}) {
  return new Promise((resolve, reject) => {
    const url = new URL(path, BASE_URL);
    const reqOptions = {
      hostname: url.hostname,
      port: url.port,
      path: url.pathname + url.search,
      method,
      headers: {
        'Content-Type': 'application/json',
        ...headers
      }
    };

    const req = http.request(reqOptions, (res) => {
      let data = '';
      res.on('data', chunk => data += chunk);
      res.on('end', () => {
        try {
          const json = data ? JSON.parse(data) : {};
          resolve({ status: res.statusCode, data: json });
        } catch (e) {
          resolve({ status: res.statusCode, raw: data });
        }
      });
    });

    req.on('error', reject);

    if (body) {
      req.write(JSON.stringify(body));
    }
    req.end();
  });
}

function createTestToken(userId, role) {
  return `test_jwt_${role}_${userId}`;
}

async function runTests() {
  console.log('====================================================');
  console.log('🧪 Starting Phase 3A Onboarding & Roster Assignment Verification');
  console.log('====================================================\n');

  let passed = 0;
  let failed = 0;

  function assert(condition, message, extra = '') {
    if (condition) {
      console.log(`✅ PASS: ${message}`);
      passed++;
    } else {
      console.error(`❌ FAIL: ${message} ${extra}`);
      failed++;
    }
  }

  try {
    // Tokens for testing
    const studentToken = createTestToken('student_new_youssef_777', 'student');
    const teacherMinaToken = createTestToken('mina', 'teacher'); // assigned to primary_2
    const teacherOtherToken = createTestToken('other', 'teacher'); // assigned to preparatory & angels
    const adminToken = createTestToken('admin_pishoy', 'admin'); // admin access

    // ------------------------------------------------------------------
    // TEST 1: Student submits account activation & exact grade request
    // Exact grade: "Grade 4" (Primary 4) -> Deterministic class group: "primary_2" (Primary 4–6)
    // ------------------------------------------------------------------
    console.log('\n--- TEST 1: Student Submits Onboarding Request with Exact Grade ---');
    const res1 = await request('POST', '/api/church/onboarding/request', {
      studentId: 'student_new_youssef_777',
      studentName: 'Youssef Mina',
      phone: '+20 100 123 4567',
      requestedGrade: 'Grade 4',
      requestedClassGroupId: 'primary_2',
      notes: 'New student joining Sunday school Grade 4'
    }, {
      'Authorization': `Bearer ${studentToken}`
    });

    assert(res1.status === 200, 'Student request returns 200');
    assert(res1.data.success === true, 'Student request reports success');
    assert(res1.data.request?.status === 'PENDING_APPROVAL', 'Request status is PENDING_APPROVAL');
    assert(res1.data.request?.requestedClassGroupId === 'primary_2', 'Requested class group is Primary 4–6 (primary_2)');
    assert(res1.data.request?.requestedGrade === 'Grade 4', 'Requested grade is Grade 4');
    const requestId = res1.data.request?.id;

    // ------------------------------------------------------------------
    // TEST 2: Student checks their own activation status
    // ------------------------------------------------------------------
    console.log('\n--- TEST 2: Student Checks Their Activation Status ---');
    const res2 = await request('GET', `/api/church/onboarding/my-status?studentId=student_new_youssef_777`, null, {
      'Authorization': `Bearer ${studentToken}`
    });

    assert(res2.status === 200, 'My-status endpoint returns 200');
    assert(res2.data.request?.id === requestId, 'Returns latest submitted request');
    assert(res2.data.request?.status === 'PENDING_APPROVAL', 'Status is pending servant approval');
    assert(res2.data.isEnrolled === false, 'Student is not yet enrolled in official roster');

    // ------------------------------------------------------------------
    // TEST 3: Validation: Invalid grade for class group is rejected
    // (e.g. Prep 1 inside primary_2)
    // ------------------------------------------------------------------
    console.log('\n--- TEST 3: Invalid Grade for Class Group is Safely Rejected ---');
    const res3 = await request('POST', '/api/church/onboarding/request', {
      studentId: 'student_invalid_test',
      requestedGrade: 'Prep 1',
      requestedClassGroupId: 'primary_2'
    }, {
      'Authorization': `Bearer ${studentToken}`
    });

    assert(res3.status === 400, 'Returns 400 for mismatch between grade and class group');
    assert(res3.data.error === 'INVALID_GRADE', 'Error code is INVALID_GRADE');

    // ------------------------------------------------------------------
    // TEST 4: Security: Student cannot view all pending activation requests
    // ------------------------------------------------------------------
    console.log('\n--- TEST 4: Student Forbidden from Viewing Other Requests ---');
    const res4 = await request('GET', '/api/church/onboarding/requests', null, {
      'Authorization': `Bearer ${studentToken}`
    });

    assert(res4.status === 403, 'Student is forbidden (403) from listing onboarding requests');
    assert(res4.data.error === 'FORBIDDEN', 'Error code is FORBIDDEN');

    // ------------------------------------------------------------------
    // TEST 5: Security: Student cannot approve their own or other requests
    // ------------------------------------------------------------------
    console.log('\n--- TEST 5: Student Forbidden from Approving Requests ---');
    const res5 = await request('POST', '/api/church/onboarding/review', {
      requestId: requestId,
      action: 'APPROVE'
    }, {
      'Authorization': `Bearer ${studentToken}`
    });

    assert(res5.status === 403, 'Student is forbidden (403) from approving requests');

    // ------------------------------------------------------------------
    // TEST 6: Security: Cross-class check: Servant Mina cannot access Preparatory requests
    // ------------------------------------------------------------------
    console.log('\n--- TEST 6: Cross-Class Security: Servant Forbidden from Unrelated Class ---');
    const res6a = await request('GET', `/api/church/onboarding/requests?classGroupId=preparatory`, null, {
      'Authorization': `Bearer ${teacherMinaToken}`
    });
    assert(res6a.status === 403, 'Servant Mina is forbidden (403) from accessing preparatory requests');

    // ------------------------------------------------------------------
    // TEST 7: Servant Mina lists pending activation requests for Primary 4–6
    // ------------------------------------------------------------------
    console.log('\n--- TEST 7: Servant Mina Lists Pending Activation Requests for Assigned Class ---');
    const res7 = await request('GET', `/api/church/onboarding/requests?classGroupId=primary_2`, null, {
      'Authorization': `Bearer ${teacherMinaToken}`
    });

    assert(res7.status === 200, 'Servant Mina can fetch pending requests for primary_2 (200)');
    assert(Array.isArray(res7.data.requests), 'Returns an array of pending requests');
    const foundReq = res7.data.requests.find(r => r.id === requestId);
    assert(Boolean(foundReq), 'Servant Mina sees the newly submitted activation request');
    assert(foundReq?.studentName === 'Youssef Mina', 'Request contains student name');

    // ------------------------------------------------------------------
    // TEST 8: Servant Mina reviews and APPROVES request -> Authoritative Roster Assignment
    // ------------------------------------------------------------------
    console.log('\n--- TEST 8: Servant Approves Request & Enrolls to Official Roster ---');
    const res8 = await request('POST', '/api/church/onboarding/review', {
      requestId: requestId,
      action: 'APPROVE',
      assignedGrade: 'Grade 4',
      reviewNotes: 'Welcome to Primary 4-6 Sunday School!'
    }, {
      'Authorization': `Bearer ${teacherMinaToken}`
    });

    assert(res8.status === 200, 'Approval returns 200');
    assert(res8.data.success === true, 'Approval reports success');
    assert(res8.data.request?.status === 'APPROVED', 'Request status is now APPROVED');
    assert(res8.data.enrolledStudent?.grade === 'Grade 4', 'Student enrolled with Grade 4');
    assert(res8.data.enrolledStudent?.classGroupId === 'primary_2', 'Student enrolled in class primary_2');

    // ------------------------------------------------------------------
    // TEST 9: Student checks status again: Now APPROVED and Enrolled in Roster
    // ------------------------------------------------------------------
    console.log('\n--- TEST 9: Verify Student Status is now APPROVED & Enrolled ---');
    const res9 = await request('GET', `/api/church/onboarding/my-status?studentId=student_new_youssef_777`, null, {
      'Authorization': `Bearer ${studentToken}`
    });

    assert(res9.status === 200, 'My-status returns 200');
    assert(res9.data.request?.status === 'APPROVED', 'Request status is now APPROVED');
    assert(res9.data.isEnrolled === true, 'Student is now officially enrolled in class');
    assert(res9.data.studentClass?.classGroupId === 'primary_2', 'Enrolled class is primary_2');

    // ------------------------------------------------------------------
    // TEST 10: Admin has church-wide access across all classes
    // ------------------------------------------------------------------
    console.log('\n--- TEST 10: Admin has Church-Wide Review Capability ---');
    const res10 = await request('GET', '/api/church/onboarding/requests?classGroupId=preparatory', null, {
      'Authorization': `Bearer ${adminToken}`
    });
    assert(res10.status === 200, 'Admin can view requests across any class group (200)');

    // ------------------------------------------------------------------
    // TEST 11: Rejection Workflow
    // ------------------------------------------------------------------
    console.log('\n--- TEST 11: Test Rejection Workflow ---');
    const res11a = await request('POST', '/api/church/onboarding/request', {
      studentId: 'student_reject_test_99',
      studentName: 'Temp Student',
      requestedGrade: 'Grade 5',
      requestedClassGroupId: 'primary_2'
    }, {
      'Authorization': `Bearer ${studentToken}`
    });

    const rejectReqId = res11a.data.request?.id;
    assert(Boolean(rejectReqId), 'Created request to test rejection');

    const res11b = await request('POST', '/api/church/onboarding/review', {
      requestId: rejectReqId,
      action: 'REJECT',
      reviewNotes: 'Duplicate submission'
    }, {
      'Authorization': `Bearer ${teacherMinaToken}`
    });

    assert(res11b.status === 200, 'Rejection returns 200');
    assert(res11b.data.request?.status === 'REJECTED', 'Status updated to REJECTED');

    console.log('\n====================================================');
    console.log(`📊 Test Summary: ${passed} passed, ${failed} failed`);
    console.log('====================================================');

    if (failed > 0) {
      process.exit(1);
    } else {
      console.log('🎉 All Phase 3A Onboarding & Roster Assignment tests PASSED successfully!');
      process.exit(0);
    }
  } catch (err) {
    console.error('Fatal test error:', err);
    process.exit(1);
  }
}

runTests();
