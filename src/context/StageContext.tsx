import React, { createContext, useContext, useState, useEffect } from 'react';

export type StageId = 'kg' | 'primary_lower' | 'primary_upper' | 'prep' | 'secondary';

export interface StageInfo {
  id: StageId;
  nameAr: string;
  nameEn: string;
  familyNameAr: string;
  familyNameEn: string;
  patronSaintAr: string;
  patronSaintEn: string;
  gradeRangeAr: string;
  gradeRangeEn: string;
  icon: string;
  themeColor: string;
  accentBadge: string;
}

export const SUNDAY_SCHOOL_STAGES: StageInfo[] = [
  {
    id: 'kg',
    nameAr: 'مرحلة حضانة',
    nameEn: 'Kindergarten',
    familyNameAr: 'أسرة الملائكة الأطهار',
    familyNameEn: 'Holy Angels Family',
    patronSaintAr: 'الملاك ميخائيل رئيس الملائكة',
    patronSaintEn: 'Archangel Michael',
    gradeRangeAr: 'حضانة صغرى وكبرى (٤ - ٦ سنوات)',
    gradeRangeEn: 'KG1 - KG2 (Ages 4-6)',
    icon: '👼',
    themeColor: '#0B2E5C',
    accentBadge: 'bg-blue-50 text-[var(--color-church-blue)] border-blue-200'
  },
  {
    id: 'primary_lower',
    nameAr: 'ابتدائي (١ - ٣)',
    nameEn: 'Primary 1-3',
    familyNameAr: 'أسرة الشهيد العظيم مارجرجس',
    familyNameEn: 'St. George Family',
    patronSaintAr: 'الشهيد العظيم مارجرجس الروماني',
    patronSaintEn: 'St. George the Prince of Martyrs',
    gradeRangeAr: 'أولى وتانية وتالتة ابتدائي (٧ - ٩ سنوات)',
    gradeRangeEn: 'Grades 1 to 3 (Ages 7-9)',
    icon: '🛡️',
    themeColor: '#8B1E2E',
    accentBadge: 'bg-red-50 text-[var(--color-church-burgundy)] border-red-200'
  },
  {
    id: 'primary_upper',
    nameAr: 'ابتدائي (٤ - ٦)',
    nameEn: 'Primary 4-6',
    familyNameAr: 'أسرة القديس الأنبا أنطونيوس',
    familyNameEn: 'St. Anthony Family',
    patronSaintAr: 'أب الرهبان القديس الأنبا أنطونيوس الكبير',
    patronSaintEn: 'St. Anthony the Father of Monks',
    gradeRangeAr: 'رابعة وخامسة وساتة ابتدائي (١٠ - ١٢ سنة)',
    gradeRangeEn: 'Grades 4 to 6 (Ages 10-12)',
    icon: '⛪',
    themeColor: '#C9A227',
    accentBadge: 'bg-amber-50 text-amber-900 border-amber-300'
  },
  {
    id: 'prep',
    nameAr: 'مرحلة إعدادي',
    nameEn: 'Preparatory',
    familyNameAr: 'أسرة القديس البابا كيرلس السادس',
    familyNameEn: 'Pope Kyrillos VI Family',
    patronSaintAr: 'رجل الصلاة القديس البابا كيرلس السادس',
    patronSaintEn: 'St. Pope Kyrillos VI the Man of Prayer',
    gradeRangeAr: 'أولى لتالتة إعدادي (١٣ - ١٥ سنة)',
    gradeRangeEn: 'Prep 1 to 3 (Ages 13-15)',
    icon: '🕯️',
    themeColor: '#0B2E5C',
    accentBadge: 'bg-blue-100 text-[var(--color-church-blue)] border-blue-300'
  },
  {
    id: 'secondary',
    nameAr: 'ثانوي وشباب',
    nameEn: 'Secondary & Youth',
    familyNameAr: 'أسرة القديس حبيب جرجس',
    familyNameEn: 'St. Habib Girgis Family',
    patronSaintAr: 'معلم الأجيال القديس الأرشيدياكون حبيب جرجس',
    patronSaintEn: 'St. Archdeacon Habib Girgis',
    gradeRangeAr: 'أولى لتالتة ثانوي وشباب (١٦ - ١٨+ سنة)',
    gradeRangeEn: 'Secondary 1 to 3 & Youth (Ages 16-18+)',
    icon: '📜',
    themeColor: '#B45309',
    accentBadge: 'bg-amber-100 text-amber-950 border-amber-300'
  }
];

interface StageContextType {
  currentStage: StageInfo;
  stageId: StageId;
  setStageId: (id: StageId) => void;
  allStages: StageInfo[];
}

const StageContext = createContext<StageContextType | undefined>(undefined);

export function StageProvider({ children }: { children: React.ReactNode }) {
  const [stageId, setStageIdState] = useState<StageId>(() => {
    if (typeof window !== 'undefined') {
      const saved = localStorage.getItem('church_user_stage') as StageId | null;
      if (saved && SUNDAY_SCHOOL_STAGES.some(s => s.id === saved)) return saved;
    }
    return 'primary_upper'; // Default to Primary 4-6
  });

  const setStageId = (id: StageId) => {
    setStageIdState(id);
    if (typeof window !== 'undefined') {
      localStorage.setItem('church_user_stage', id);
    }
  };

  const currentStage = SUNDAY_SCHOOL_STAGES.find(s => s.id === stageId) || SUNDAY_SCHOOL_STAGES[2];

  return (
    <StageContext.Provider value={{ currentStage, stageId, setStageId, allStages: SUNDAY_SCHOOL_STAGES }}>
      {children}
    </StageContext.Provider>
  );
}

export function useStage() {
  const ctx = useContext(StageContext);
  if (!ctx) {
    throw new Error('useStage must be used within a StageProvider');
  }
  return ctx;
}
