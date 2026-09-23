import { Language } from '../types';
import { TRANSLATION_REGISTRY } from '../localization/registry';

export interface LanguageOption {
  code: Language;
  label: string;
  sub: string;
  dir: 'ltr' | 'rtl';
  churchDialect: string;
  flagSymbol: string;
}

export const LANGUAGE_OPTIONS: LanguageOption[] = [
  {
    code: 'ar',
    label: 'العربية',
    sub: 'Arabic',
    dir: 'rtl',
    churchDialect: 'عربي (طقس الكنيسة القبطية الأرثوذكسية)',
    flagSymbol: '🇪🇬',
  },
  {
    code: 'en',
    label: 'English',
    sub: 'English',
    dir: 'ltr',
    churchDialect: 'English (Coptic Orthodox Liturgical)',
    flagSymbol: '🌐',
  },
  {
    code: 'cop' as Language,
    label: 'Ϯⲁⲥⲡⲓ ⲛ̀ⲣⲉⲙⲛ̀ⲭⲏⲙⲓ',
    sub: 'Ⲙⲉⲑⲣⲉⲙⲛ̀ⲭⲏⲙⲓ',
    dir: 'ltr',
    churchDialect: 'Bohairic Coptic (اللغة القبطية الكنسية البحيرية)',
    flagSymbol: '☥',
  },
];

export const I18N_DICTIONARY: Record<string, { ar: string; en: string; copt: string; cop?: string }> = {
  // App Titles & Greetings
  churchName: {
    ar: 'كنيسة القديس الأنبا موسى الأسود',
    en: 'St. Moses the Strong Church',
    copt: 'Ϯⲉⲕⲕⲗⲏⲥⲓⲁ ⲛ̀ⲧⲉ Ⲫⲁⲅⲓⲟⲥ Ⲁⲃⲃⲁ Ⲙⲱⲩⲥⲏⲥ',
  },
  sundaySchool: {
    ar: 'مدارس الأحد الكنسية',
    en: 'Sunday School',
    copt: 'Ⲛⲓⲥⲃⲱ ⲛ̀ⲧⲉ ϯⲕⲩⲣⲓⲁⲕⲏ',
  },
  welcomeGreeting: {
    ar: 'أهلاً',
    en: 'Welcome',
    copt: 'Ⲭⲉⲣⲉ',
  },
  peaceGreeting: {
    ar: 'سلام لجميعكم',
    en: 'Peace be with all',
    copt: 'Ⲓⲣⲏⲛⲏ ⲡⲁⲥⲓ',
  },
  faithJourney: {
    ar: 'مستعد لرحلة الإيمان والتعلم اليوم؟',
    en: 'Ready for your journey of faith today?',
    copt: 'Ⲁⲕⲥⲉⲃⲧⲱⲧ ⲉ̀ⲡⲓⲙⲱⲓⲧ ⲛ̀ⲧⲉ ⲡⲓⲛⲁϩϯ ⲛⲉⲙ ϯⲥⲃⲱ ⲙ̀ⲫⲟⲟⲩ;',
  },
  servantBlessing: {
    ar: 'بركة الخدمة والتعليم معك اليوم',
    en: 'Blessings on your ministry & teaching today',
    copt: 'Ⲡⲓⲥⲙⲟⲩ ⲛ̀ⲧⲉ ϯⲇⲓⲁⲕⲟⲛⲓⲁ ⲛⲉⲙ ϯⲥⲃⲱ ⲛⲉⲙⲁⲕ ⲙ̀ⲫⲟⲟⲩ',
  },

  // Navigation Tabs
  navHome: {
    ar: 'الرئيسية',
    en: 'Home',
    copt: 'Ⲡⲓⲏⲓ',
  },
  navLessons: {
    ar: 'الدروس',
    en: 'Lessons',
    copt: 'Ⲛⲓⲥⲃⲱ',
  },
  navHymns: {
    ar: 'مدرسة الألحان',
    en: 'Hymns',
    copt: 'Ⲛⲓϩⲱⲥ',
  },
  navAgpeya: {
    ar: 'الأجبية',
    en: 'Agpeya',
    copt: 'Ϯⲁϫⲡⲓⲁ',
  },
  navCalendar: {
    ar: 'السنكسار والتقويم',
    en: 'Synaxarium',
    copt: 'Ⲡⲓⲥⲩⲛⲁⲝⲁⲣⲓⲟⲛ',
  },
  navPoints: {
    ar: 'النقاط',
    en: 'Points',
    copt: 'Ⲛⲓⲧⲁⲓⲟ',
  },
  navFeed: {
    ar: 'المجتمع',
    en: 'Community',
    copt: 'Ϯⲕⲟⲓⲛⲱⲛⲓⲁ',
  },
  navProfile: {
    ar: 'حسابي',
    en: 'Profile',
    copt: 'Ⲡⲁⲣⲁⲛ',
  },
  navServant: {
    ar: 'الخادم',
    en: 'Servant',
    copt: 'Ⲡⲓⲇⲓⲁⲕⲟⲛⲟⲥ',
  },
  navFamily: {
    ar: 'الأهل',
    en: 'Family',
    copt: 'Ⲛⲓⲓⲟϯ',
  },

  // Roles
  roleStudent: {
    ar: 'تلميذ',
    en: 'Student',
    copt: 'Ⲡⲓⲙⲁⲑⲏⲧⲏⲥ',
  },
  roleServant: {
    ar: 'خادم كنسي',
    en: 'Servant',
    copt: 'Ⲡⲓⲇⲓⲁⲕⲟⲛⲟⲥ',
  },
  roleParent: {
    ar: 'ولي أمر',
    en: 'Parent',
    copt: 'Ⲡⲓⲓⲱⲧ',
  },
  roleAdmin: {
    ar: 'مشرف كنسي',
    en: 'Admin',
    copt: 'Ⲡⲓⲁⲣⲭⲱⲛ',
  },

  // Bible Verse & Memory
  scriptureVerse: {
    ar: 'آية الأسبوع للحفظ',
    en: 'Memory Scripture Verse',
    copt: 'Ϯⲣⲏϯ ⲛ̀ⲧⲉ ⲡⲓⲥⲁϫⲓ ⲛ̀ⲧⲉ Ⲫϯ',
  },
  reciteVerse: {
    ar: 'تسميع الآية بالذكاء الاصطناعي',
    en: 'Recite Verse With AI',
    copt: 'Ⲧⲁϫⲣⲟ ⲛ̀ϯⲣⲏϯ ϧⲉⲛ ⲡⲓⲥⲁϫⲓ',
  },
  listenAudio: {
    ar: 'استمع للنطق',
    en: 'Listen',
    copt: 'Ⲥⲱⲧⲉⲙ',
  },
  familyAltar: {
    ar: 'المذبح العائلي',
    en: 'Family Altar',
    copt: 'Ⲡⲓⲙⲁⲛ̀ⲉⲣϣⲱⲟⲩϣⲓ ⲛ̀ⲧⲉ ⲡⲓⲏⲓ',
  },
  dailyPrayer: {
    ar: 'صلاة اليوم المشتركة',
    en: 'Daily United Prayer',
    copt: 'Ϯⲉⲩⲭⲏ ⲛ̀ⲧⲉ ⲡⲓⲉϩⲟⲟⲩ',
  },

  // Common UI Actions
  start: {
    ar: 'ابدأ',
    en: 'Start',
    copt: 'Ⲁⲣⲓϩⲏⲧⲥ',
  },
  continue: {
    ar: 'متابعة',
    en: 'Continue',
    copt: 'Ⲟⲩⲱϣ',
  },
  close: {
    ar: 'إغلاق',
    en: 'Close',
    copt: 'Ⲙⲁϣⲑⲁⲙ',
  },
  save: {
    ar: 'حفظ',
    en: 'Save',
    copt: 'Ⲁⲣⲉϩ',
  },
  done: {
    ar: 'تم بنجاح',
    en: 'Done',
    copt: 'Ⲁϥϫⲱⲕ ⲉ̀ⲃⲟⲗ',
  },
  cancel: {
    ar: 'إلغاء',
    en: 'Cancel',
    copt: 'Ⲭⲱ ⲉ̀ⲃⲟⲗ',
  },
  search: {
    ar: 'بحث...',
    en: 'Search...',
    copt: 'Ⲕⲱϯ...',
  },
  notifications: {
    ar: 'الإشعارات الكنسية',
    en: 'Church Notifications',
    copt: 'Ⲛⲓⲧⲁⲙⲟ ⲛ̀ⲧⲉ ϯⲉⲕⲕⲗⲏⲥⲓⲁ',
  },
  lightTheme: {
    ar: 'الوضع النهاري الكنسي',
    en: 'Light Church Theme',
    copt: 'Ⲡⲓⲟⲩⲱⲓⲛⲓ ⲛ̀ⲧⲉ ϯⲉⲕⲕⲗⲏⲥⲓⲁ',
  },
  darkTheme: {
    ar: 'الوضع الليلي الهادئ',
    en: 'Dark Church Theme',
    copt: 'Ⲡⲓⲉ̀ϫⲱⲣϩ ⲛ̀ⲣⲉⲙⲛ̀ⲭⲏⲙⲓ',
  },
  logout: {
    ar: 'تسجيل الخروج',
    en: 'Sign Out',
    copt: 'Ⲓ̀ ⲉ̀ⲃⲟⲗ',
  },
  login: {
    ar: 'تسجيل الدخول',
    en: 'Sign In',
    copt: 'Ϣⲉ ⲉ̀ϧⲟⲩⲛ',
  },
  fasting: {
    ar: 'صوم كنسي',
    en: 'Fasting',
    copt: 'Ϯⲛⲏⲥⲧⲓⲁ',
  },
  feast: {
    ar: 'عيد سيدي',
    en: 'Feast',
    copt: 'Ⲡⲓϣⲁⲓ ⲉⲑⲟⲩⲁⲃ',
  },
  copticLanguageTitle: {
    ar: 'اللغة القبطية الكنسية (البحيرية)',
    en: 'Bohairic Church Coptic',
    copt: 'Ϯⲁⲥⲡⲓ ⲛ̀ⲣⲉⲙⲛ̀ⲭⲏⲙⲓ (Ⲙⲉⲑⲣⲉⲙⲛ̀ⲭⲏⲙⲓ)',
  },
};

export function t(key: string, lang: Language): string {
  const norm = (lang === 'copt' || lang === 'cop') ? 'cop' : lang === 'ar' ? 'ar' : 'en';
  
  // 1. Check registry
  if (TRANSLATION_REGISTRY[key]) {
    const entry = TRANSLATION_REGISTRY[key];
    if (norm === 'cop' && entry.cop) return entry.cop;
    if (norm === 'ar' && entry.ar) return entry.ar;
    if (norm === 'en' && entry.en) return entry.en;
  }

  // 2. Check legacy dictionary
  if (I18N_DICTIONARY[key]) {
    const legacy = I18N_DICTIONARY[key];
    if (norm === 'cop' && (legacy.copt || (legacy as any).cop)) {
      return legacy.copt || (legacy as any).cop;
    }
    if (norm === 'ar' && legacy.ar) return legacy.ar;
    if (norm === 'en' && legacy.en) return legacy.en;
  }

  return key;
}

export function getLocalizedText(
  item: { en: string; ar: string; copt?: string; cop?: string },
  lang: Language
): string {
  if ((lang === 'copt' || lang === 'cop') && (item.cop || item.copt)) {
    return (item.cop || item.copt)!;
  }
  if (lang === 'ar') {
    return item.ar;
  }
  return item.en;
}
