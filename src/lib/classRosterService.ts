import { supabase, isSupabaseConfigured } from './supabase';
import { ClassRosterStudent, StudentClassAssociation, ClassGroupId } from '../types';
export type { ClassRosterStudent, StudentClassAssociation, ClassGroupId };
import { getClassGroupForGrade, CLASS_GROUPS } from './classGroups';
import { sundaySchoolRoster } from './parentChildService';

// In-memory fallback for demo / guest / offline resilience
const DEMO_STUDENT_CLASS: StudentClassAssociation = {
  studentId: 'u1',
  grade: '4th Grade Elementary',
  classGroupId: 'primary_2',
  className: 'Primary 2 (Grades 4-6)',
  servants: ['Servant Mina']
};

async function getAuthHeader(): Promise<Record<string, string>> {
  const headers: Record<string, string> = {
    'Content-Type': 'application/json'
  };
  if (supabase) {
    try {
      const { data } = await supabase.auth.getSession();
      const token = data?.session?.access_token;
      if (token) {
        headers['Authorization'] = `Bearer ${token}`;
      }
    } catch (_) {}
  }
  return headers;
}

/**
 * 1. getClassRoster(classGroupId?)
 * Fetches the student roster for an authorized servant's class.
 * Strict RBAC: Servants cannot access rosters for classes they are not assigned to.
 * Students and parents are blocked from accessing class rosters.
 */
export async function getClassRoster(
  classGroupId?: string
): Promise<{ data: ClassRosterStudent[] | null; error: Error | null }> {
  const headers = await getAuthHeader();
  try {
    const query = new URLSearchParams();
    if (classGroupId) query.set('classGroupId', classGroupId);

    const res = await fetch(`/api/church/class-roster?${query.toString()}`, {
      method: 'GET',
      headers
    });

    const json = await res.json().catch(() => null);
    if (!res.ok || !json?.success) {
      return {
        data: null,
        error: new Error(json?.message || json?.error || `HTTP ${res.status}: Failed to fetch class roster`)
      };
    }

    return { data: json.roster, error: null };
  } catch (err: any) {
    // Pure offline demo fallback
    const targetGroup = classGroupId || 'primary_2';
    const fallbackStudents: ClassRosterStudent[] = sundaySchoolRoster
      .filter(s => {
        const group = getClassGroupForGrade(s.gradeEn);
        return group ? group.id === targetGroup : targetGroup === 'primary_2';
      })
      .map(s => ({
        id: s.id,
        name: s.nameEn,
        grade: s.gradeEn,
        classGroupId: targetGroup as ClassGroupId,
        avatarUrl: s.avatarUrl,
        learningSummary: {
          latestMasteryStatus: 'DEVELOPING',
          lessonsCompletedCount: 1,
          latestQuizScore: 85
        }
      }));

    return { data: fallbackStudents.length > 0 ? fallbackStudents : null, error: null };
  }
}

/**
 * 2. getMyStudentClass()
 * Retrieves the authoritative class and grade association for the currently logged-in student.
 */
export async function getMyStudentClass(): Promise<{ data: StudentClassAssociation | null; error: Error | null }> {
  const headers = await getAuthHeader();
  try {
    const res = await fetch('/api/church/my-class', {
      method: 'GET',
      headers
    });

    const json = await res.json().catch(() => null);
    if (!res.ok || !json?.success) {
      return {
        data: null,
        error: new Error(json?.message || json?.error || `HTTP ${res.status}: Failed to fetch student class`)
      };
    }

    return { data: json.classInfo, error: null };
  } catch (err: any) {
    return { data: DEMO_STUDENT_CLASS, error: null };
  }
}

export interface ServantClassInfo {
  servantId: string;
  role: string;
  classGroupId: ClassGroupId;
  className: string;
  classNameAr?: string;
  grades?: string[];
  stage?: string;
  servants?: string[];
  churchYear?: string;
  classCode?: string;
  classInstanceId?: string;
}

export interface MyClassResult {
  classInfo: ServantClassInfo | StudentClassAssociation;
  roster?: ClassRosterStudent[];
}

/**
 * 2b. getMyClass()
 * Authoritative endpoint for both servants and students.
 * For servants, returns assigned class group and persisted roster.
 * For students, returns student class association.
 */
export async function getMyClass(): Promise<{ data: MyClassResult | null; error: Error | null }> {
  const headers = await getAuthHeader();
  try {
    const res = await fetch('/api/church/my-class', {
      method: 'GET',
      headers
    });

    const json = await res.json().catch(() => null);
    if (!res.ok || !json?.success) {
      return {
        data: null,
        error: new Error(json?.message || json?.error || `HTTP ${res.status}: Failed to fetch class`)
      };
    }

    return {
      data: {
        classInfo: json.classInfo,
        roster: json.roster
      },
      error: null
    };
  } catch (err: any) {
    return {
      data: {
        classInfo: DEMO_STUDENT_CLASS,
        roster: []
      },
      error: null
    };
  }
}

/**
 * 3. assignStudentClass(studentId, classGroupId, grade)
 * Updates a student's authoritative class and grade.
 * Strict RBAC: Only authorized teachers and admins can modify class assignments.
 * Students and parents are strictly forbidden.
 */
export async function assignStudentClass(
  studentId: string,
  classGroupId: ClassGroupId,
  grade: string
): Promise<{ success: boolean; error: Error | null }> {
  if (!studentId || !classGroupId || !grade) {
    return { success: false, error: new Error('studentId, classGroupId, and grade are required') };
  }

  const headers = await getAuthHeader();
  try {
    const res = await fetch('/api/church/student/class', {
      method: 'POST',
      headers,
      body: JSON.stringify({ studentId, classGroupId, grade })
    });

    const json = await res.json().catch(() => null);
    if (!res.ok || !json?.success) {
      return {
        success: false,
        error: new Error(json?.message || json?.error || `HTTP ${res.status}: Failed to assign student class`)
      };
    }

    return { success: true, error: null };
  } catch (err: any) {
    return { success: false, error: new Error(err?.message || 'Network error updating class assignment') };
  }
}

export interface StudentLessonReview {
  lessonId: string;
  title: string;
  titleAr?: string;
  category: string;
  versionId: string;
  progressStatus: 'NOT_STARTED' | 'IN_PROGRESS' | 'COMPLETED';
  completionPercent: number;
  sectionsCompleted: string[];
  totalSections: number;
  latestQuizScore: number;
  latestQuizPercentage: number;
  quizPassed: boolean;
  quizAttemptsCount: number;
  masteryStatus: 'NOT_STARTED' | 'DEVELOPING' | 'NEEDS_REVIEW' | 'MASTERED';
  needsReview: boolean;
  lastActivityAt?: string | null;
}

export interface StudentLearningReviewData {
  student: {
    id: string;
    name: string;
    grade: string;
    classGroupId: ClassGroupId;
    avatarUrl: string;
  };
  summary: {
    totalLessons: number;
    completedLessonsCount: number;
    masteredCount: number;
    developingCount: number;
    needsReviewCount: number;
    averageQuizScore: number;
  };
  lessons: StudentLessonReview[];
  needsReviewItems: StudentLessonReview[];
  recentActivity: Array<{
    type: 'quiz' | 'lesson_completed' | 'section_completed' | 'mastery';
    lessonTitle: string;
    description: string;
    timestamp: string;
  }>;
}

/**
 * 4. getStudentLearningReview(studentId)
 * Authoritative read-only endpoint for servants inspecting learning progress of students in their assigned class.
 */
export async function getStudentLearningReview(
  studentId: string
): Promise<{ data: StudentLearningReviewData | null; error: Error | null }> {
  if (!studentId) {
    return { data: null, error: new Error('studentId is required') };
  }

  const headers = await getAuthHeader();
  try {
    const res = await fetch(`/api/church/student-learning-review/${encodeURIComponent(studentId)}`, {
      method: 'GET',
      headers
    });

    const json = await res.json().catch(() => null);
    if (!res.ok || !json?.success) {
      return {
        data: null,
        error: new Error(json?.message || json?.error || `HTTP ${res.status}: Failed to fetch learning review`)
      };
    }

    return {
      data: {
        student: json.student,
        summary: json.summary,
        lessons: json.lessons || [],
        needsReviewItems: json.needsReviewItems || [],
        recentActivity: json.recentActivity || []
      },
      error: null
    };
  } catch (err: any) {
    // Pure offline demo fallback
    const matched = sundaySchoolRoster.find(s => s.id === studentId);
    const demoReview: StudentLearningReviewData = {
      student: {
        id: studentId,
        name: matched?.nameEn || `Student ${studentId}`,
        grade: matched?.gradeEn || 'Grade 4',
        classGroupId: 'primary_2',
        avatarUrl: matched?.avatarUrl || `https://api.dicebear.com/7.x/avataaars/svg?seed=${studentId}`
      },
      summary: {
        totalLessons: 1,
        completedLessonsCount: 1,
        masteredCount: 1,
        developingCount: 0,
        needsReviewCount: 0,
        averageQuizScore: 85
      },
      lessons: [
        {
          lessonId: 'l-test-multiversion-01',
          title: 'St. Mark Sunday School Lesson',
          titleAr: 'درس القديس مرقس الرسول',
          category: 'bible',
          versionId: 'v-test-multi-1',
          progressStatus: 'COMPLETED',
          completionPercent: 100,
          sectionsCompleted: ['sec-multi-1'],
          totalSections: 1,
          latestQuizScore: 100,
          latestQuizPercentage: 100,
          quizPassed: true,
          quizAttemptsCount: 1,
          masteryStatus: 'MASTERED',
          needsReview: false,
          lastActivityAt: new Date().toISOString()
        }
      ],
      needsReviewItems: [],
      recentActivity: [
        {
          type: 'lesson_completed',
          lessonTitle: 'St. Mark Sunday School Lesson',
          description: 'Completed all required published sections',
          timestamp: new Date().toISOString()
        }
      ]
    };

    return { data: demoReview, error: null };
  }
}

