import { LeaderboardEntry, User } from '../types';
import { mockLeaderboard } from '../data';

const LEADERBOARD_STORAGE_KEY = 'church_leaderboard_data';
const PURCHASES_STORAGE_KEY = 'church_reward_purchases';

export function getLeaderboard(currentUser?: User | null): LeaderboardEntry[] {
  let list: LeaderboardEntry[] = [];
  if (typeof window !== 'undefined') {
    try {
      const saved = localStorage.getItem(LEADERBOARD_STORAGE_KEY);
      if (saved) {
        list = JSON.parse(saved);
      }
    } catch (e) {
      console.warn('Error reading leaderboard from localStorage:', e);
    }
  }

  if (!list || list.length === 0) {
    list = [...mockLeaderboard];
  }

  // Ensure current user is in leaderboard if logged in
  if (currentUser) {
    const existingIndex = list.findIndex(
      (e) => e.studentId === currentUser.id || (currentUser.id.startsWith('guest_') && e.studentId === 'u1')
    );

    if (existingIndex >= 0) {
      list[existingIndex] = {
        ...list[existingIndex],
        studentId: currentUser.id,
        studentName: currentUser.fullName.split(' ')[0] + ' ' + (currentUser.fullName.split(' ')[1]?.[0] || '') + '.',
        avatarUrl: currentUser.avatarUrl || list[existingIndex].avatarUrl,
        pointsThisWeek: Math.max(list[existingIndex].pointsThisWeek, Math.min(currentUser.points, 250)),
      };
    } else {
      list.push({
        id: 'lb_' + currentUser.id,
        studentId: currentUser.id,
        studentName: currentUser.fullName.split(' ')[0] + ' ' + (currentUser.fullName.split(' ')[1]?.[0] || '') + '.',
        avatarUrl: currentUser.avatarUrl,
        pointsThisWeek: Math.min(currentUser.points, 120),
        rank: list.length + 1,
      });
    }

    // Sort by pointsThisWeek descending
    list.sort((a, b) => b.pointsThisWeek - a.pointsThisWeek);
    list = list.map((item, index) => ({
      ...item,
      rank: index + 1,
    }));

    if (typeof window !== 'undefined') {
      try {
        localStorage.setItem(LEADERBOARD_STORAGE_KEY, JSON.stringify(list));
      } catch (e) {}
    }
  }

  return list;
}

export function updateLeaderboardUser(
  currentUser: User,
  pointsDelta: number
): LeaderboardEntry[] {
  let list = getLeaderboard(currentUser);

  const userIndex = list.findIndex((e) => e.studentId === currentUser.id);
  if (userIndex >= 0) {
    list[userIndex].pointsThisWeek = Math.max(0, (list[userIndex].pointsThisWeek || 0) + pointsDelta);
    list[userIndex].avatarUrl = currentUser.avatarUrl;
    list[userIndex].studentName = currentUser.fullName.split(' ')[0] + ' ' + (currentUser.fullName.split(' ')[1]?.[0] || '') + '.';
  } else {
    list.push({
      id: 'lb_' + currentUser.id,
      studentId: currentUser.id,
      studentName: currentUser.fullName.split(' ')[0] + ' ' + (currentUser.fullName.split(' ')[1]?.[0] || '') + '.',
      avatarUrl: currentUser.avatarUrl,
      pointsThisWeek: Math.max(0, pointsDelta),
      rank: list.length + 1,
    });
  }

  list.sort((a, b) => b.pointsThisWeek - a.pointsThisWeek);
  list = list.map((item, idx) => ({ ...item, rank: idx + 1 }));

  if (typeof window !== 'undefined') {
    try {
      localStorage.setItem(LEADERBOARD_STORAGE_KEY, JSON.stringify(list));
      window.dispatchEvent(new CustomEvent('church_leaderboard_updated', { detail: list }));
    } catch (e) {}
  }

  return list;
}

export function getUserRank(userId: string, currentUser?: User | null): LeaderboardEntry | undefined {
  const list = getLeaderboard(currentUser);
  return list.find((e) => e.studentId === userId);
}

export function getSavedPurchases(userId: string): any[] {
  if (typeof window === 'undefined') return [];
  try {
    const saved = localStorage.getItem(`${PURCHASES_STORAGE_KEY}_${userId}`);
    if (saved) return JSON.parse(saved);
  } catch (e) {}
  return [];
}

export function saveRewardPurchaseLocal(userId: string, purchase: any): void {
  if (typeof window === 'undefined') return;
  try {
    const existing = getSavedPurchases(userId);
    const updated = [purchase, ...existing];
    localStorage.setItem(`${PURCHASES_STORAGE_KEY}_${userId}`, JSON.stringify(updated));
    window.dispatchEvent(new CustomEvent('church_purchases_updated', { detail: updated }));
  } catch (e) {}
}

export function awardPoints(
  first: string | number,
  second: string | number,
  third?: string
): number {
  if (typeof window === 'undefined') return 0;
  
  let targetUserId: string | undefined;
  let pointsToAdd = 0;
  let reason = '';

  if (typeof first === 'string' && typeof second === 'number') {
    targetUserId = first;
    pointsToAdd = second;
    reason = third || '';
  } else if (typeof first === 'number') {
    pointsToAdd = first;
    reason = typeof second === 'string' ? second : '';
  }

  try {
    const isGuest = Boolean(localStorage.getItem('church_guest_user'));
    const storageKey = isGuest ? 'church_guest_user' : 'church_auth_user';
    const userJson = localStorage.getItem(storageKey);
    if (userJson) {
      const user = JSON.parse(userJson);
      if (!targetUserId || user.id === targetUserId) {
        user.points = (user.points || 0) + pointsToAdd;
        localStorage.setItem(storageKey, JSON.stringify(user));
        updateLeaderboardUser(user, pointsToAdd);
        window.dispatchEvent(new CustomEvent('church_user_updated', { detail: user }));
        return user.points;
      }
    }
  } catch (e) {
    console.warn('Error awarding points:', e);
  }
  return pointsToAdd;
}
