import { supabase } from './supabase';
import { 
  ChurchYear, 
  ChurchClassInstance, 
  ClassMembership, 
  AdminUserItem, 
  ClassGroupId,
  StudentClassAssociation 
} from '../types';

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
 * 1. Get current church year and class instances
 */
export async function getCurrentChurchYear(): Promise<{
  success: boolean;
  currentChurchYear: string;
  churchYear: ChurchYear;
  classInstances: ChurchClassInstance[];
  error?: string;
}> {
  const headers = await getAuthHeader();
  try {
    const res = await fetch('/api/church/year', {
      method: 'GET',
      headers
    });
    const json = await res.json().catch(() => null);
    if (!res.ok || !json?.success) {
      return {
        success: false,
        currentChurchYear: '2026–2027',
        churchYear: {
          id: 'year-2026-2027',
          year: '2026–2027',
          status: 'ACTIVE',
          startDate: '2026-09-01',
          createdAt: new Date().toISOString(),
          createdBy: 'system'
        },
        classInstances: [],
        error: json?.message || 'Failed to fetch church year'
      };
    }
    return json;
  } catch (err: any) {
    return {
      success: false,
      currentChurchYear: '2026–2027',
      churchYear: {
        id: 'year-2026-2027',
        year: '2026–2027',
        status: 'ACTIVE',
        startDate: '2026-09-01',
        createdAt: new Date().toISOString(),
        createdBy: 'system'
      },
      classInstances: [],
      error: err?.message
    };
  }
}

/**
 * 2. Onboard Student Exact Grade (First login)
 */
export async function onboardStudentGrade(
  exactGrade: string
): Promise<{
  success: boolean;
  exactGrade?: string;
  classGroupId?: ClassGroupId;
  classGroupName?: string;
  error?: string;
}> {
  const headers = await getAuthHeader();
  try {
    const res = await fetch('/api/church/student/onboard-grade', {
      method: 'POST',
      headers,
      body: JSON.stringify({ exactGrade })
    });
    const json = await res.json().catch(() => null);
    if (!res.ok || !json?.success) {
      return {
        success: false,
        error: json?.message || json?.error || 'Failed to set exact grade'
      };
    }
    return json;
  } catch (err: any) {
    return {
      success: false,
      error: err?.message || 'Network error setting grade'
    };
  }
}

/**
 * 3. Student Joins Class using Servant-Supplied Code
 */
export async function joinClassWithCode(
  code: string
): Promise<{
  success: boolean;
  message?: string;
  classInstance?: ChurchClassInstance;
  studentClass?: StudentClassAssociation;
  error?: string;
}> {
  const headers = await getAuthHeader();
  try {
    const res = await fetch('/api/church/student/join-class', {
      method: 'POST',
      headers,
      body: JSON.stringify({ code: code.trim() })
    });
    const json = await res.json().catch(() => null);
    if (!res.ok || !json?.success) {
      return {
        success: false,
        error: json?.message || json?.error || 'Failed to join class'
      };
    }
    return json;
  } catch (err: any) {
    return {
      success: false,
      error: err?.message || 'Network error joining class'
    };
  }
}

/**
 * 4. Regenerate Class Code (Servant & Admin)
 */
export async function regenerateClassCode(
  classGroupId: string
): Promise<{
  success: boolean;
  newCode?: string;
  classInstance?: ChurchClassInstance;
  error?: string;
}> {
  const headers = await getAuthHeader();
  try {
    const res = await fetch(`/api/church/classes/${encodeURIComponent(classGroupId)}/regenerate-code`, {
      method: 'POST',
      headers,
      body: JSON.stringify({})
    });
    const json = await res.json().catch(() => null);
    if (!res.ok || !json?.success) {
      return {
        success: false,
        error: json?.message || json?.error || 'Failed to regenerate class code'
      };
    }
    return json;
  } catch (err: any) {
    return {
      success: false,
      error: err?.message || 'Network error'
    };
  }
}

/**
 * 5. Remove Student from Current Church-Year Class (Servant & Admin)
 */
export async function removeStudentFromClass(
  classGroupId: string,
  studentId: string,
  reason?: string
): Promise<{
  success: boolean;
  message?: string;
  error?: string;
}> {
  const headers = await getAuthHeader();
  try {
    const res = await fetch(`/api/church/classes/${encodeURIComponent(classGroupId)}/remove-student`, {
      method: 'POST',
      headers,
      body: JSON.stringify({ studentId, reason })
    });
    const json = await res.json().catch(() => null);
    if (!res.ok || !json?.success) {
      return {
        success: false,
        error: json?.message || json?.error || 'Failed to remove student'
      };
    }
    return json;
  } catch (err: any) {
    return {
      success: false,
      error: err?.message || 'Network error'
    };
  }
}

/**
 * 6. Add Student to Class (Servant & Admin)
 */
export async function addStudentToClass(
  classGroupId: string,
  studentId: string,
  exactGrade?: string
): Promise<{
  success: boolean;
  student?: any;
  message?: string;
  error?: string;
}> {
  const headers = await getAuthHeader();
  try {
    const res = await fetch(`/api/church/classes/${encodeURIComponent(classGroupId)}/add-student`, {
      method: 'POST',
      headers,
      body: JSON.stringify({ studentId, exactGrade })
    });
    const json = await res.json().catch(() => null);
    if (!res.ok || !json?.success) {
      return {
        success: false,
        error: json?.message || json?.error || 'Failed to add student'
      };
    }
    return json;
  } catch (err: any) {
    return {
      success: false,
      error: err?.message || 'Network error'
    };
  }
}

/**
 * 7. Admin: Get Users List
 */
export async function getAdminUsers(): Promise<{
  success: boolean;
  users: AdminUserItem[];
  error?: string;
}> {
  const headers = await getAuthHeader();
  try {
    const res = await fetch('/api/church/admin/users', {
      method: 'GET',
      headers
    });
    const json = await res.json().catch(() => null);
    if (!res.ok || !json?.success) {
      return {
        success: false,
        users: [],
        error: json?.message || json?.error || 'Failed to fetch users'
      };
    }
    return { success: true, users: json.users || [] };
  } catch (err: any) {
    return {
      success: false,
      users: [],
      error: err?.message || 'Network error'
    };
  }
}

/**
 * 8. Admin: Promote/Demote User Role
 */
export async function promoteUserRole(
  userId: string,
  role: 'teacher' | 'student' | 'admin'
): Promise<{
  success: boolean;
  userId?: string;
  newRole?: string;
  error?: string;
}> {
  const headers = await getAuthHeader();
  try {
    const res = await fetch('/api/church/admin/promote-user', {
      method: 'POST',
      headers,
      body: JSON.stringify({ userId, role })
    });
    const json = await res.json().catch(() => null);
    if (!res.ok || !json?.success) {
      return {
        success: false,
        error: json?.message || json?.error || 'Failed to update user role'
      };
    }
    return json;
  } catch (err: any) {
    return {
      success: false,
      error: err?.message || 'Network error'
    };
  }
}

/**
 * 9. Admin: Assign/Unassign Servant to Class Group
 */
export async function assignServantToClass(
  servantId: string,
  classGroupId: string,
  action: 'ASSIGN' | 'REMOVE'
): Promise<{
  success: boolean;
  servantId?: string;
  assignedClasses?: string[];
  error?: string;
}> {
  const headers = await getAuthHeader();
  try {
    const res = await fetch('/api/church/admin/assign-servant', {
      method: 'POST',
      headers,
      body: JSON.stringify({ servantId, classGroupId, action })
    });
    const json = await res.json().catch(() => null);
    if (!res.ok || !json?.success) {
      return {
        success: false,
        error: json?.message || json?.error || 'Failed to update servant assignment'
      };
    }
    return json;
  } catch (err: any) {
    return {
      success: false,
      error: err?.message || 'Network error'
    };
  }
}

/**
 * 10. Admin: Preview New Church Year Rollover
 */
export async function previewYearTransition(): Promise<{
  success: boolean;
  currentYear?: string;
  nextYear?: string;
  previewList?: Array<{
    studentId: string;
    name: string;
    currentGrade: string;
    currentClassGroupId: string;
    projectedGrade: string;
    projectedClassGroupId: string;
    isGraduated: boolean;
    explanation: string;
  }>;
  error?: string;
}> {
  const headers = await getAuthHeader();
  try {
    const res = await fetch('/api/church/admin/year-transition-preview', {
      method: 'GET',
      headers
    });
    const json = await res.json().catch(() => null);
    if (!res.ok || !json?.success) {
      return {
        success: false,
        error: json?.message || json?.error || 'Failed to load year transition preview'
      };
    }
    return json;
  } catch (err: any) {
    return {
      success: false,
      error: err?.message || 'Network error'
    };
  }
}

/**
 * 11. Admin: Start New Church Year (Two-Step Safety execution)
 */
export async function startNewChurchYear(
  targetYear: string,
  exceptions?: Record<string, { action: 'REPEAT' | 'MANUAL' | 'GRADUATE', manualGrade?: string }>
): Promise<{
  success: boolean;
  message?: string;
  currentChurchYear?: string;
  newClassInstances?: ChurchClassInstance[];
  error?: string;
}> {
  const headers = await getAuthHeader();
  try {
    const res = await fetch('/api/church/admin/start-new-year', {
      method: 'POST',
      headers,
      body: JSON.stringify({ targetYear, confirmed: true, exceptions })
    });
    const json = await res.json().catch(() => null);
    if (!res.ok || !json?.success) {
      return {
        success: false,
        error: json?.message || json?.error || 'Failed to start new church year'
      };
    }
    return json;
  } catch (err: any) {
    return {
      success: false,
      error: err?.message || 'Network error'
    };
  }
}
