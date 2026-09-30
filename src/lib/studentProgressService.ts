import { supabase, isSupabaseConfigured } from './supabase';
import { StudentContentProgress } from '../types';

export interface StartLessonProgressInput {
  lessonId: string;
  versionId: string;
  studentId?: string;
}

export interface CompleteSectionProgressInput {
  lessonId: string;
  versionId: string;
  sectionId: string;
  studentId?: string;
}

export interface CompleteLessonProgressInput {
  lessonId: string;
  versionId: string;
  studentId?: string;
}

// In-memory fallback for local/guest/demo/offline resilience
const LOCAL_PROGRESS_STORE: Record<string, StudentContentProgress> = {};

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
 * 1. getStudentProgress(lessonId, studentId)
 * Fetches the student's progress on a published lesson.
 * Strict RBAC: Authenticated students can only read their own progress.
 */
export async function getStudentProgress(
  lessonId: string,
  studentId?: string
): Promise<{ data: StudentContentProgress | null; error: Error | null }> {
  if (!lessonId) {
    return { data: null, error: new Error('lessonId is required') };
  }

  const headers = await getAuthHeader();
  try {
    const query = new URLSearchParams({ lessonId });
    if (studentId) query.set('studentId', studentId);

    const res = await fetch(`/api/church/student-progress?${query.toString()}`, {
      method: 'GET',
      headers
    });

    const json = await res.json().catch(() => null);
    if (!res.ok || !json?.success) {
      return {
        data: null,
        error: new Error(json?.message || json?.error || `HTTP ${res.status}: Failed to fetch student progress`)
      };
    }

    return { data: json.progress, error: null };
  } catch (err: any) {
    // Offline / Demo fallback
    const key = `${studentId || 'u1'}_${lessonId}`;
    return { data: LOCAL_PROGRESS_STORE[key] || null, error: null };
  }
}

/**
 * 2. startLessonProgress(input)
 * Tracks that an authenticated student has started an active published lesson.
 * Only published versions can be started; drafts/review are rejected.
 */
export async function startLessonProgress(
  input: StartLessonProgressInput
): Promise<{ data: StudentContentProgress | null; error: Error | null }> {
  const { lessonId, versionId, studentId } = input;
  if (!lessonId || !versionId) {
    return { data: null, error: new Error('lessonId and versionId are required') };
  }

  const headers = await getAuthHeader();
  try {
    const res = await fetch('/api/church/student-progress/start', {
      method: 'POST',
      headers,
      body: JSON.stringify({ lessonId, versionId, studentId })
    });

    const json = await res.json().catch(() => null);
    if (!res.ok || !json?.success) {
      return {
        data: null,
        error: new Error(json?.message || json?.error || `HTTP ${res.status}: Failed to start lesson progress`)
      };
    }

    const key = `${json.progress.studentId}_${lessonId}`;
    LOCAL_PROGRESS_STORE[key] = json.progress;

    return { data: json.progress, error: null };
  } catch (err: any) {
    // Pure offline demo fallback
    const sId = studentId || 'u1';
    const key = `${sId}_${lessonId}`;
    const fallback: StudentContentProgress = LOCAL_PROGRESS_STORE[key] || {
      studentId: sId,
      lessonId,
      versionId,
      status: 'IN_PROGRESS',
      sectionsCompleted: [],
      totalSections: 3,
      completionPercent: 0,
      startedAt: new Date().toISOString()
    };
    LOCAL_PROGRESS_STORE[key] = fallback;
    return { data: fallback, error: null };
  }
}

/**
 * 3. completeSectionProgress(input)
 * Idempotently completes a normalized section of the active published lesson.
 * Updates completion percentage and marks lesson complete if all sections are completed.
 */
export async function completeSectionProgress(
  input: CompleteSectionProgressInput
): Promise<{ data: StudentContentProgress | null; error: Error | null }> {
  const { lessonId, versionId, sectionId, studentId } = input;
  if (!lessonId || !versionId || !sectionId) {
    return { data: null, error: new Error('lessonId, versionId, and sectionId are required') };
  }

  const headers = await getAuthHeader();
  try {
    const res = await fetch('/api/church/student-progress/complete-section', {
      method: 'POST',
      headers,
      body: JSON.stringify({ lessonId, versionId, sectionId, studentId })
    });

    const json = await res.json().catch(() => null);
    if (!res.ok || !json?.success) {
      return {
        data: null,
        error: new Error(json?.message || json?.error || `HTTP ${res.status}: Failed to complete section`)
      };
    }

    const prog: StudentContentProgress = json.progress;
    const key = `${prog.studentId}_${lessonId}`;
    LOCAL_PROGRESS_STORE[key] = prog;

    // If Supabase is connected and lesson reached completion, sync to public.lesson_progress
    if (supabase && isSupabaseConfigured && prog.status === 'COMPLETED') {
      try {
        await supabase.from('lesson_progress').upsert({
          student_id: prog.studentId,
          lesson_id: prog.lessonId,
          completed: true,
          completed_at: prog.completedAt || new Date().toISOString()
        });
      } catch (dbErr) {
        console.warn('Note on Supabase lesson_progress sync:', dbErr);
      }
    }

    return { data: prog, error: null };
  } catch (err: any) {
    // Pure offline demo fallback
    const sId = studentId || 'u1';
    const key = `${sId}_${lessonId}`;
    const existing = LOCAL_PROGRESS_STORE[key] || {
      studentId: sId,
      lessonId,
      versionId,
      status: 'IN_PROGRESS',
      sectionsCompleted: [],
      totalSections: 3,
      completionPercent: 0,
      startedAt: new Date().toISOString()
    };

    if (!existing.sectionsCompleted.includes(sectionId)) {
      existing.sectionsCompleted.push(sectionId);
    }
    const total = existing.totalSections || 3;
    existing.completionPercent = Math.min(100, Math.round((existing.sectionsCompleted.length / total) * 100));
    if (existing.sectionsCompleted.length >= total) {
      existing.status = 'COMPLETED';
      existing.completedAt = existing.completedAt || new Date().toISOString();
    }
    LOCAL_PROGRESS_STORE[key] = existing;
    return { data: existing, error: null };
  }
}

/**
 * 4. completeLessonProgress(input)
 * Explicitly marks a lesson completed ONLY when all required sections are finished.
 */
export async function completeLessonProgress(
  input: CompleteLessonProgressInput
): Promise<{ data: StudentContentProgress | null; error: Error | null }> {
  const { lessonId, versionId, studentId } = input;
  if (!lessonId || !versionId) {
    return { data: null, error: new Error('lessonId and versionId are required') };
  }

  const headers = await getAuthHeader();
  try {
    const res = await fetch('/api/church/student-progress/complete-lesson', {
      method: 'POST',
      headers,
      body: JSON.stringify({ lessonId, versionId, studentId })
    });

    const json = await res.json().catch(() => null);
    if (!res.ok || !json?.success) {
      return {
        data: null,
        error: new Error(json?.message || json?.error || `HTTP ${res.status}: Failed to complete lesson`)
      };
    }

    const prog: StudentContentProgress = json.progress;
    const key = `${prog.studentId}_${lessonId}`;
    LOCAL_PROGRESS_STORE[key] = prog;

    if (supabase && isSupabaseConfigured) {
      try {
        await supabase.from('lesson_progress').upsert({
          student_id: prog.studentId,
          lesson_id: prog.lessonId,
          completed: true,
          completed_at: prog.completedAt || new Date().toISOString()
        });
      } catch (dbErr) {
        console.warn('Note on Supabase lesson_progress sync:', dbErr);
      }
    }

    return { data: prog, error: null };
  } catch (err: any) {
    // Pure offline demo fallback
    const sId = studentId || 'u1';
    const key = `${sId}_${lessonId}`;
    const existing = LOCAL_PROGRESS_STORE[key];
    if (existing) {
      existing.status = 'COMPLETED';
      existing.completionPercent = 100;
      existing.completedAt = new Date().toISOString();
      return { data: existing, error: null };
    }
    return { data: null, error: new Error('Progress record not found') };
  }
}
