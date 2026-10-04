import { supabase } from './supabase';
import { PresentationSlide, FlashcardItem, QuizQuestionDraft } from '../types';

export interface GeneratedSlideItem extends PresentationSlide {
  sectionId?: string;
  sectionTitle?: string;
  scriptureRef?: string;
  reviewStatus: 'UNVERIFIED' | 'REVIEWED' | 'APPROVED';
}

export interface GeneratedFlashcardItem extends FlashcardItem {
  sectionId?: string;
  sectionTitle?: string;
  sourceRefs?: Array<{ sourceId: string; sourceName: string; location: string }>;
  reviewStatus: 'UNVERIFIED' | 'REVIEWED' | 'APPROVED';
}

export interface GeneratedQuizQuestionItem extends QuizQuestionDraft {
  sectionId?: string;
  sectionTitle?: string;
  reviewStatus: 'UNVERIFIED' | 'REVIEWED' | 'APPROVED';
}

export interface GeneratedMaterialsPacket {
  lessonId: string;
  versionId: string;
  generatedBy?: string;
  generatedAt?: string;
  reviewedBy?: string;
  reviewedAt?: string;
  slides: GeneratedSlideItem[];
  flashcards: GeneratedFlashcardItem[];
  quiz: GeneratedQuizQuestionItem[];
}

export interface MaterialsServiceResult<T> {
  data: T | null;
  error: Error | null;
}

async function getAuthHeader(): Promise<Record<string, string>> {
  const headers: Record<string, string> = {};
  if (supabase) {
    try {
      const { data: { session } } = await supabase.auth.getSession();
      if (session?.access_token) {
        headers['Authorization'] = `Bearer ${session.access_token}`;
      }
    } catch {
      // fallback
    }
  }
  return headers;
}

/**
 * 1. generateLessonMaterials
 *
 * Requests the authoritative backend to generate grounded learning materials (Slides, Flashcards, Quiz)
 * for an APPROVED or PUBLISHED lesson version with verified evidence.
 */
export async function generateLessonMaterials(
  lessonId: string,
  versionId?: string,
  types: Array<'SLIDES' | 'FLASHCARDS' | 'QUIZ'> | 'ALL' = 'ALL'
): Promise<MaterialsServiceResult<GeneratedMaterialsPacket>> {
  try {
    const headers = await getAuthHeader();
    headers['Content-Type'] = 'application/json';

    const response = await fetch(`/api/church/lessons/${encodeURIComponent(lessonId)}/generate-materials`, {
      method: 'POST',
      headers,
      body: JSON.stringify({
        versionId,
        types
      })
    });

    if (!response.ok) {
      const errJson = await response.json().catch(() => null);
      throw new Error(errJson?.message || errJson?.error || `Generation failed: ${response.status}`);
    }

    const data = await response.json();
    return { data: data.materials || null, error: null };
  } catch (err: any) {
    console.warn('Error generating lesson materials:', err);
    return { data: null, error: err instanceof Error ? err : new Error(String(err)) };
  }
}

/**
 * 2. fetchLessonMaterials
 *
 * Retrieves learning materials for a lesson.
 * Students receive strictly APPROVED items for published lessons.
 * Servants receive all materials including unverified items for review.
 */
export async function fetchLessonMaterials(
  lessonId: string,
  versionId?: string
): Promise<MaterialsServiceResult<GeneratedMaterialsPacket>> {
  try {
    const headers = await getAuthHeader();
    const query = versionId ? `?versionId=${encodeURIComponent(versionId)}` : '';

    const response = await fetch(`/api/church/lessons/${encodeURIComponent(lessonId)}/materials${query}`, {
      headers
    });

    if (!response.ok) {
      const errJson = await response.json().catch(() => null);
      throw new Error(errJson?.message || errJson?.error || `Fetch materials failed: ${response.status}`);
    }

    const data = await response.json();
    return { data: data.materials || null, error: null };
  } catch (err: any) {
    console.warn('Error fetching lesson materials:', err);
    return { data: null, error: err instanceof Error ? err : new Error(String(err)) };
  }
}

/**
 * 3. reviewLessonMaterials
 *
 * Servant review and approval of generated materials.
 * Transitions items from UNVERIFIED to APPROVED for student publication.
 */
export async function reviewLessonMaterials(
  lessonId: string,
  versionId: string,
  action: 'APPROVE_ALL' | 'APPROVE_ITEM' | 'REJECT',
  itemType?: 'SLIDES' | 'FLASHCARDS' | 'QUIZ',
  itemId?: string
): Promise<MaterialsServiceResult<GeneratedMaterialsPacket>> {
  try {
    const headers = await getAuthHeader();
    headers['Content-Type'] = 'application/json';

    const response = await fetch(`/api/church/lessons/${encodeURIComponent(lessonId)}/materials/review`, {
      method: 'POST',
      headers,
      body: JSON.stringify({
        versionId,
        action,
        itemType,
        itemId
      })
    });

    if (!response.ok) {
      const errJson = await response.json().catch(() => null);
      throw new Error(errJson?.message || errJson?.error || `Review action failed: ${response.status}`);
    }

    const data = await response.json();
    return { data: data.materials || null, error: null };
  } catch (err: any) {
    console.warn('Error reviewing lesson materials:', err);
    return { data: null, error: err instanceof Error ? err : new Error(String(err)) };
  }
}
