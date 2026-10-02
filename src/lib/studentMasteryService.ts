import { supabase, isSupabaseConfigured } from './supabase';
import { StudentMastery } from '../types';

export interface EvaluateStudentMasteryInput {
  lessonId: string;
  versionId: string;
  studentId?: string;
}

// In-memory fallback for guest/offline resilience
const LOCAL_MASTERY_STORE: Record<string, StudentMastery> = {};

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
 * 1. getStudentMastery(lessonId, studentId?, versionId?)
 * Fetches the student's authoritative mastery evaluation on a published lesson.
 * Strict RBAC: Authenticated students can only read their own mastery.
 */
export async function getStudentMastery(
  lessonId: string,
  studentId?: string,
  versionId?: string
): Promise<{ data: StudentMastery | null; error: Error | null }> {
  if (!lessonId) {
    return { data: null, error: new Error('lessonId is required') };
  }

  const headers = await getAuthHeader();
  try {
    const query = new URLSearchParams({ lessonId });
    if (studentId) query.set('studentId', studentId);
    if (versionId) query.set('versionId', versionId);

    const res = await fetch(`/api/church/student-mastery?${query.toString()}`, {
      method: 'GET',
      headers
    });

    const json = await res.json().catch(() => null);
    if (!res.ok || !json?.success) {
      return {
        data: null,
        error: new Error(json?.message || json?.error || `HTTP ${res.status}: Failed to fetch student mastery`)
      };
    }

    const mastery: StudentMastery = json.mastery;
    const key = `${mastery.studentId}_${lessonId}`;
    LOCAL_MASTERY_STORE[key] = mastery;

    return { data: mastery, error: null };
  } catch (err: any) {
    // Offline / Demo fallback
    const key = `${studentId || 'u1'}_${lessonId}`;
    return { data: LOCAL_MASTERY_STORE[key] || null, error: null };
  }
}

/**
 * 2. evaluateStudentMastery(input)
 * Triggers deterministic server-side evaluation of student mastery based on
 * actual progress and quiz attempts on the active published version.
 * Client cannot fabricate or submit custom scores or statuses.
 */
export async function evaluateStudentMastery(
  input: EvaluateStudentMasteryInput
): Promise<{ data: StudentMastery | null; error: Error | null }> {
  const { lessonId, versionId, studentId } = input;
  if (!lessonId || !versionId) {
    return { data: null, error: new Error('lessonId and versionId are required') };
  }

  const headers = await getAuthHeader();
  try {
    const res = await fetch('/api/church/student-mastery/evaluate', {
      method: 'POST',
      headers,
      body: JSON.stringify({ lessonId, versionId, studentId })
    });

    const json = await res.json().catch(() => null);
    if (!res.ok || !json?.success) {
      return {
        data: null,
        error: new Error(json?.message || json?.error || `HTTP ${res.status}: Failed to evaluate student mastery`)
      };
    }

    const mastery: StudentMastery = json.mastery;
    const key = `${mastery.studentId}_${lessonId}`;
    LOCAL_MASTERY_STORE[key] = mastery;

    return { data: mastery, error: null };
  } catch (err: any) {
    // Pure offline demo fallback
    const sId = studentId || 'u1';
    const key = `${sId}_${lessonId}`;
    return { data: LOCAL_MASTERY_STORE[key] || null, error: null };
  }
}
