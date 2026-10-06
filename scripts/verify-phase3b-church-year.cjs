/**
 * Verification script for Phase 3B:
 * Church Year & Year-Specific Class Instances Verification Suite
 *
 * Requirements:
 * 1. CHURCH YEAR (Tests 1-6)
 * 2. CLASS INSTANCES (Tests 7-9)
 * 3. JOIN CODES (Tests 10-14)
 * 4. STUDENT MEMBERSHIP (Tests 15-20)
 * 5. SERVANT ASSIGNMENTS (Tests 21-24)
 * 6. NEW-YEAR PROMOTION (Tests 25-32)
 */

const http = require('http');

const PORT = 3000;
const BASE_URL = `http://localhost:${PORT}`;

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

let passedTests = 0;
let failedTests = 0;

function assert(condition, message) {
  if (condition) {
    console.log(`✅ PASS: ${message}`);
    passedTests++;
  } else {
    console.error(`❌ FAIL: ${message}`);
    failedTests++;
  }
}

async function runTests() {
  console.log('====================================================');
  console.log('🧪 Starting Phase 3B Church Year & Class Instances Verification');
  console.log('====================================================\n');

  // Tokens
  const adminToken = createTestToken('admin_bishop', 'admin');
  const servantMinaToken = createTestToken('mina', 'teacher');
  const servantOtherToken = createTestToken('other', 'teacher');
  const studentMarkToken = createTestToken('mark', 'student');
  const parentMaryToken = createTestToken('mary', 'parent');

  // Reset review test state first
  await request('POST', '/api/church/reset-review-test-state');

  // ---------------------------------------------------------------------------
  // SECTION 1: CHURCH YEAR & CLASS INSTANCES BASELINE
  // ---------------------------------------------------------------------------
  console.log('--- TEST 1: Read Current Church Year & Verify 6 Class Instances ---');
  const yearRes = await request('GET', '/api/church/year');
  assert(yearRes.status === 200, 'GET /api/church/year returns 200');
  assert(yearRes.data.success === true, 'Returns success: true');
  assert(yearRes.data.currentChurchYear === '2026–2027', 'Current active year is 2026–2027');
  assert(yearRes.data.churchYear.status === 'ACTIVE', 'Church year status is ACTIVE');
  assert(Array.isArray(yearRes.data.classInstances), 'Returns class instances array');
  assert(yearRes.data.classInstances.length === 6, 'Exactly 6 class instances exist for active year');

  const groupIds = yearRes.data.classInstances.map(i => i.classGroupId);
  const expectedGroups = ['angels', 'primary_1', 'primary_2', 'preparatory', 'secondary', 'university'];
  const allGroupsPresent = expectedGroups.every(g => groupIds.includes(g));
  assert(allGroupsPresent, 'All 6 canonical groups (Angels, Primary 1–3, Primary 4–6, Prep, Sec, Univ) exist');

  // ---------------------------------------------------------------------------
  // SECTION 2: SECURITY - ONLY ADMIN CAN START NEW CHURCH YEAR
  // ---------------------------------------------------------------------------
  console.log('\n--- TEST 2: Security - Non-Admin Forbidden from Starting Church Year ---');
  const studentYearAttempt = await request('POST', '/api/church/admin/start-new-year', {
    targetYear: '2027–2028',
    confirmed: true
  }, { Authorization: `Bearer ${studentMarkToken}` });
  assert(studentYearAttempt.status === 403, 'Student forbidden (403) from starting new year');
  assert(studentYearAttempt.data.error === 'FORBIDDEN', 'Error code is FORBIDDEN for student');

  const servantYearAttempt = await request('POST', '/api/church/admin/start-new-year', {
    targetYear: '2027–2028',
    confirmed: true
  }, { Authorization: `Bearer ${servantMinaToken}` });
  assert(servantYearAttempt.status === 403, 'Servant forbidden (403) from starting new year');

  const parentYearAttempt = await request('POST', '/api/church/admin/start-new-year', {
    targetYear: '2027–2028',
    confirmed: true
  }, { Authorization: `Bearer ${parentMaryToken}` });
  assert(parentYearAttempt.status === 403, 'Parent forbidden (403) from starting new year');

  // ---------------------------------------------------------------------------
  // SECTION 3: PREVENT DUPLICATE / ACCIDENTAL NEW YEAR ACTIVATION
  // ---------------------------------------------------------------------------
  console.log('\n--- TEST 3: Prevent Accidental / Duplicate Year Activation ---');
  const duplicateYearAttempt = await request('POST', '/api/church/admin/start-new-year', {
    targetYear: '2026–2027',
    confirmed: true
  }, { Authorization: `Bearer ${adminToken}` });
  assert(duplicateYearAttempt.status === 400, 'Re-activating currently active year returns 400');
  assert(duplicateYearAttempt.data.error === 'YEAR_ALREADY_ACTIVE', 'Error code is YEAR_ALREADY_ACTIVE');

  const unconfirmedAttempt = await request('POST', '/api/church/admin/start-new-year', {
    targetYear: '2027–2028',
    confirmed: false
  }, { Authorization: `Bearer ${adminToken}` });
  assert(unconfirmedAttempt.status === 400, 'Unconfirmed year creation returns 400');
  assert(unconfirmedAttempt.data.error === 'CONFIRMATION_REQUIRED', 'Error code is CONFIRMATION_REQUIRED');

  // ---------------------------------------------------------------------------
  // SECTION 4: YEAR-SPECIFIC JOIN CODES
  // ---------------------------------------------------------------------------
  console.log('\n--- TEST 4: Year-Specific Join Codes & Grade Compatibility ---');
  const p46Instance = yearRes.data.classInstances.find(i => i.classGroupId === 'primary_2');
  const p13Instance = yearRes.data.classInstances.find(i => i.classGroupId === 'primary_1');
  const prepInstance = yearRes.data.classInstances.find(i => i.classGroupId === 'preparatory');

  assert(Boolean(p46Instance?.code), `Primary 4–6 has join code: ${p46Instance?.code}`);
  assert(Boolean(p13Instance?.code), `Primary 1–3 has join code: ${p13Instance?.code}`);

  // Test 4A: Incompatible Grade Joining is Rejected Server-Side
  // Student with Grade 4 trying to join Primary 1–3 code
  const incompatibleJoin = await request('POST', '/api/church/student/join-class', {
    code: p13Instance.code,
    exactGrade: 'Grade 4',
    studentId: 'test_student_incompat'
  }, { Authorization: `Bearer ${studentMarkToken}` });
  assert(incompatibleJoin.status === 400, 'Grade 4 student joining Primary 1–3 code is rejected (400)');
  assert(incompatibleJoin.data.error === 'INCOMPATIBLE_GRADE', 'Error code is INCOMPATIBLE_GRADE');

  // Grade 4 student trying to join Preparatory
  const prepJoin = await request('POST', '/api/church/student/join-class', {
    code: prepInstance.code,
    exactGrade: 'Grade 4',
    studentId: 'test_student_incompat'
  }, { Authorization: `Bearer ${studentMarkToken}` });
  assert(prepJoin.status === 400, 'Grade 4 student joining Preparatory code is rejected (400)');

  // Test 4B: Compatible Grade Joining Succeeds
  const compatibleJoin = await request('POST', '/api/church/student/join-class', {
    code: p46Instance.code,
    exactGrade: 'Grade 4',
    studentId: 'mark'
  }, { Authorization: `Bearer ${studentMarkToken}` });
  assert(compatibleJoin.status === 200, 'Grade 4 student joining Primary 4–6 code succeeds (200)');
  assert(compatibleJoin.data.success === true, 'Join returns success: true');
  assert(compatibleJoin.data.classInstance.classGroupId === 'primary_2', 'Enrolled into class group primary_2');

  // ---------------------------------------------------------------------------
  // SECTION 5: JOIN CODE REGENERATION
  // ---------------------------------------------------------------------------
  console.log('\n--- TEST 5: Join Code Regeneration ---');
  const oldCode = p46Instance.code;

  // Non-authorized servant (other) cannot regenerate primary_2 code
  const unassignedRegen = await request('POST', '/api/church/classes/primary_2/regenerate-code', {}, {
    Authorization: `Bearer ${servantOtherToken}`
  });
  assert(unassignedRegen.status === 403, 'Unassigned servant forbidden (403) from regenerating code');

  // Authorized servant Mina regenerates primary_2 code
  const regenRes = await request('POST', '/api/church/classes/primary_2/regenerate-code', {}, {
    Authorization: `Bearer ${servantMinaToken}`
  });
  assert(regenRes.status === 200, 'Assigned servant Mina can regenerate code (200)');
  assert(regenRes.data.success === true, 'Regeneration reports success');
  const newCode = regenRes.data.newCode;
  assert(newCode !== oldCode, `New code (${newCode}) is different from old code (${oldCode})`);

  // Old code should now be invalidated for future joins
  const joinWithOldCode = await request('POST', '/api/church/student/join-class', {
    code: oldCode,
    exactGrade: 'Grade 4',
    studentId: 'student_late_joiner'
  });
  assert(joinWithOldCode.status === 404, 'Old code is invalidated for future joins (404)');

  // New code works for future joins
  const joinWithNewCode = await request('POST', '/api/church/student/join-class', {
    code: newCode,
    exactGrade: 'Grade 4',
    studentId: 'student_late_joiner'
  });
  assert(joinWithNewCode.status === 200, 'New regenerated code works for joins (200)');

  // Regeneration did NOT remove existing member Mark
  const rosterAfterRegen = await request('GET', '/api/church/class-roster?classGroupId=primary_2', null, {
    Authorization: `Bearer ${servantMinaToken}`
  });
  assert(rosterAfterRegen.status === 200, 'Roster query returns 200');
  const markStillEnrolled = rosterAfterRegen.data.roster.some(s => s.id === 'mark');
  assert(markStillEnrolled, 'Existing members (Mark) are NOT removed by code regeneration');

  // ---------------------------------------------------------------------------
  // SECTION 6: STUDENT MEMBERSHIP & REMOVAL
  // ---------------------------------------------------------------------------
  console.log('\n--- TEST 6: Student Membership & Authorized Removal ---');

  // Student attempts to self-remove (Must be forbidden)
  const studentSelfRemove = await request('POST', '/api/church/classes/primary_2/remove-student', {
    studentId: 'mark'
  }, { Authorization: `Bearer ${studentMarkToken}` });
  assert(studentSelfRemove.status === 403, 'Student is forbidden (403) from removing themselves or others (NO Leave Class)');

  // Parent attempts to remove student
  const parentRemove = await request('POST', '/api/church/classes/primary_2/remove-student', {
    studentId: 'mark'
  }, { Authorization: `Bearer ${parentMaryToken}` });
  assert(parentRemove.status === 403, 'Parent is forbidden (403) from removing student');

  // Unassigned servant cannot remove student from primary_2
  const unassignedRemove = await request('POST', '/api/church/classes/primary_2/remove-student', {
    studentId: 'mark'
  }, { Authorization: `Bearer ${servantOtherToken}` });
  assert(unassignedRemove.status === 403, 'Unassigned servant forbidden (403) from removing student');

  // Authorized servant removes student
  const servantRemove = await request('POST', '/api/church/classes/primary_2/remove-student', {
    studentId: 'student_late_joiner',
    reason: 'Transferred to another congregation'
  }, { Authorization: `Bearer ${servantMinaToken}` });
  assert(servantRemove.status === 200, 'Assigned servant can remove student (200)');
  assert(servantRemove.data.success === true, 'Removal reports success');

  // Verify student is removed from current active roster
  const rosterAfterRemove = await request('GET', '/api/church/class-roster?classGroupId=primary_2', null, {
    Authorization: `Bearer ${servantMinaToken}`
  });
  const lateJoinerInRoster = rosterAfterRemove.data.roster.some(s => s.id === 'student_late_joiner');
  assert(!lateJoinerInRoster, 'Student is no longer in current-year active roster');

  // ---------------------------------------------------------------------------
  // SECTION 7: SERVANT ASSIGNMENTS (MULTIPLE SERVANTS & MULTI-CLASS)
  // ---------------------------------------------------------------------------
  console.log('\n--- TEST 7: Servant Assignments (Multiple Servants & Multiple Classes) ---');

  // Non-admin cannot manage servant assignments
  const nonAdminAssign = await request('POST', '/api/church/admin/assign-servant', {
    servantId: 'other',
    classGroupId: 'primary_2',
    action: 'ASSIGN'
  }, { Authorization: `Bearer ${servantMinaToken}` });
  assert(nonAdminAssign.status === 403, 'Non-admin forbidden (403) from managing servant assignments');

  // Admin assigns Servant Other to primary_2 (making primary_2 have multiple servants: Mina & Other)
  const assignMultiple = await request('POST', '/api/church/admin/assign-servant', {
    servantId: 'other',
    classGroupId: 'primary_2',
    action: 'ASSIGN'
  }, { Authorization: `Bearer ${adminToken}` });
  assert(assignMultiple.status === 200, 'Admin can assign servant to class (200)');
  assert(assignMultiple.data.success === true, 'Assignment reports success');

  // Now Servant Other is assigned to multiple classes (angels, preparatory, and primary_2)
  const otherAssignedClasses = assignMultiple.data.assignedClasses;
  assert(otherAssignedClasses.includes('primary_2'), 'Servant Other is assigned to primary_2');
  assert(otherAssignedClasses.length >= 2, 'One servant can be assigned to multiple class groups');

  // Servant Other can now view primary_2 roster
  const otherCanAccessP46 = await request('GET', '/api/church/class-roster?classGroupId=primary_2', null, {
    Authorization: `Bearer ${servantOtherToken}`
  });
  assert(otherCanAccessP46.status === 200, 'Newly assigned servant Other can access primary_2 roster (200)');

  // ---------------------------------------------------------------------------
  // SECTION 8: NEW-YEAR PROMOTION & ROLLOVER ENGINE
  // ---------------------------------------------------------------------------
  console.log('\n--- TEST 8: New-Year Promotion Preview & Exceptions ---');

  // Setup students in various grades to test the entire promotion ladder
  // KG1 student
  await request('POST', '/api/church/classes/angels/add-student', {
    studentId: 'student_kg1_test',
    exactGrade: 'KG1'
  }, { Authorization: `Bearer ${adminToken}` });

  // Primary 3 student (should promote to Primary 4 in Primary 4–6)
  await request('POST', '/api/church/classes/primary_1/add-student', {
    studentId: 'student_p3_test',
    exactGrade: 'Primary 3'
  }, { Authorization: `Bearer ${adminToken}` });

  // Prep 3 student (should promote to Secondary 1 in Secondary)
  await request('POST', '/api/church/classes/preparatory/add-student', {
    studentId: 'student_prep3_test',
    exactGrade: 'Prep 3'
  }, { Authorization: `Bearer ${adminToken}` });

  // Secondary 3 student (should graduate)
  await request('POST', '/api/church/classes/secondary/add-student', {
    studentId: 'student_sec3_test',
    exactGrade: 'Secondary 3'
  }, { Authorization: `Bearer ${adminToken}` });

  // Repeat exception student
  await request('POST', '/api/church/classes/primary_2/add-student', {
    studentId: 'student_repeat_test',
    exactGrade: 'Grade 4'
  }, { Authorization: `Bearer ${adminToken}` });

  // Preview transition
  const previewRes = await request('GET', '/api/church/admin/year-transition-preview', null, {
    Authorization: `Bearer ${adminToken}`
  });
  assert(previewRes.status === 200, 'Admin can preview year transition (200)');
  assert(previewRes.data.nextYear === '2027–2028', 'Projects next year as 2027–2028');

  const pKg1 = previewRes.data.previewList.find(p => p.studentId === 'student_kg1_test');
  assert(pKg1?.projectedGrade === 'KG2', 'KG1 projects to KG2');

  const pP3 = previewRes.data.previewList.find(p => p.studentId === 'student_p3_test');
  assert(pP3?.projectedGrade === 'Grade 4' && pP3?.projectedClassGroupId === 'primary_2', 'Primary 3 projects to Grade 4 in primary_2');

  const pPrep3 = previewRes.data.previewList.find(p => p.studentId === 'student_prep3_test');
  assert(pPrep3?.projectedGrade === 'Secondary 1' && pPrep3?.projectedClassGroupId === 'secondary', 'Prep 3 projects to Secondary 1 in secondary');

  const pSec3 = previewRes.data.previewList.find(p => p.studentId === 'student_sec3_test');
  assert(pSec3?.isGraduated === true || pSec3?.projectedClassGroupId === 'university', 'Secondary 3 projects to university/graduation');

  // ---------------------------------------------------------------------------
  // SECTION 9: START NEW CHURCH YEAR EXECUTION
  // ---------------------------------------------------------------------------
  console.log('\n--- TEST 9: Admin Starts New Church Year (2027–2028) ---');
  const startNewYearRes = await request('POST', '/api/church/admin/start-new-year', {
    targetYear: '2027–2028',
    confirmed: true,
    exceptions: {
      'student_repeat_test': { action: 'REPEAT' }
    }
  }, { Authorization: `Bearer ${adminToken}` });

  assert(startNewYearRes.status === 200, 'Start new church year returns 200');
  assert(startNewYearRes.data.success === true, 'New church year started successfully');
  assert(startNewYearRes.data.currentChurchYear === '2027–2028', 'Active church year updated to 2027–2028');
  assert(startNewYearRes.data.newClassInstances.length === 6, 'Creates exactly 6 new class instances for 2027–2028');

  // Verify only one current year is active
  const checkActiveYear = await request('GET', '/api/church/year');
  assert(checkActiveYear.data.currentChurchYear === '2027–2028', 'Only one church year (2027–2028) is active');

  // ---------------------------------------------------------------------------
  // SECTION 10: ARCHIVED-YEAR CODES CANNOT ENROLL STUDENTS INTO CURRENT YEAR
  // ---------------------------------------------------------------------------
  console.log('\n--- TEST 10: Archived-Year Codes Cannot Enroll Students ---');
  // Attempt to use old 2026–2027 code on the new 2027–2028 active year
  const archivedCodeJoin = await request('POST', '/api/church/student/join-class', {
    code: oldCode, // 2026–2027 archived code
    exactGrade: 'Grade 4',
    studentId: 'student_archived_attempt'
  });
  assert(archivedCodeJoin.status === 400 || archivedCodeJoin.status === 404, 'Archived-year code cannot enroll students (400/404)');

  // ---------------------------------------------------------------------------
  // SECTION 11: VERIFY PROMOTIONS & ADMINISTRATIVE EXCEPTIONS IN NEW YEAR
  // ---------------------------------------------------------------------------
  console.log('\n--- TEST 11: Verify Promotions and Historical Preservation ---');

  // Primary 3 student is now in Primary 4 in primary_2 in 2027–2028
  const p46RosterNewYear = await request('GET', '/api/church/class-roster?classGroupId=primary_2', null, {
    Authorization: `Bearer ${adminToken}`
  });
  const promotedStudent = p46RosterNewYear.data.roster.find(s => s.id === 'student_p3_test');
  assert(Boolean(promotedStudent), 'Promoted Primary 3 student is now in Primary 4–6 roster');
  assert(promotedStudent?.grade === 'Grade 4', 'Student grade is now Grade 4');

  // Repeated student stayed in Grade 4 due to administrative exception
  const repeatStudent = p46RosterNewYear.data.roster.find(s => s.id === 'student_repeat_test');
  assert(Boolean(repeatStudent), 'Repeated student exists in roster');
  assert(repeatStudent?.grade === 'Grade 4', 'Repeated student grade remained Grade 4');

  // ---------------------------------------------------------------------------
  // SUMMARY
  // ---------------------------------------------------------------------------
  console.log('\n====================================================');
  console.log(`📊 Test Summary: ${passedTests} passed, ${failedTests} failed`);
  console.log('====================================================');

  if (failedTests > 0) {
    process.exit(1);
  } else {
    console.log('🎉 All Phase 3B Church Year & Class Instances tests PASSED successfully!');
    process.exit(0);
  }
}

runTests().catch(err => {
  console.error('Fatal test error:', err);
  process.exit(1);
});
