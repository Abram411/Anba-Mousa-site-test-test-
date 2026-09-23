// Curated high-resolution Coptic Orthodox avatars for Sunday School students, parents, and teachers
export interface CopticAvatarPreset {
  id: string;
  nameEn: string;
  nameAr: string;
  category: 'saints' | 'students' | 'deacons';
  svgDataUri: string;
}

// Generate sharp, beautiful SVG data URIs with rich gradients, halos, and Coptic motifs
function createSvgAvatar(bgGradient: [string, string], haloColor: string, iconEmoji: string, accessoryEmoji: string, crossColor: string): string {
  const svg = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 120 120" width="120" height="120">
    <defs>
      <linearGradient id="bg" x1="0%" y1="0%" x2="100%" y2="100%">
        <stop offset="0%" stop-color="${bgGradient[0]}" />
        <stop offset="100%" stop-color="${bgGradient[1]}" />
      </linearGradient>
      <radialGradient id="halo" cx="50%" cy="45%" r="40%">
        <stop offset="0%" stop-color="${haloColor}" stop-opacity="0.85" />
        <stop offset="70%" stop-color="${haloColor}" stop-opacity="0.35" />
        <stop offset="100%" stop-color="${haloColor}" stop-opacity="0" />
      </radialGradient>
      <filter id="shadow" x="-10%" y="-10%" width="120%" height="120%">
        <feDropShadow dx="0" dy="2" stdDeviation="2" flood-opacity="0.25" />
      </filter>
    </defs>
    <!-- Background circle -->
    <circle cx="60" cy="60" r="58" fill="url(#bg)" stroke="${crossColor}" stroke-width="2.5" />
    <!-- Divine Light Halo -->
    <circle cx="60" cy="52" r="36" fill="url(#halo)" />
    <!-- Inner Accent Ring -->
    <circle cx="60" cy="60" r="54" fill="none" stroke="rgba(255,255,255,0.25)" stroke-dasharray="3,3" stroke-width="1.5" />
    <!-- Center Character Emoji / Symbol -->
    <text x="60" y="66" font-size="44" text-anchor="middle" dominant-baseline="middle" filter="url(#shadow)">${iconEmoji}</text>
    <!-- Accessory badge at bottom right -->
    <circle cx="86" cy="86" r="16" fill="#ffffff" stroke="${crossColor}" stroke-width="2" filter="url(#shadow)" />
    <text x="86" y="89" font-size="16" text-anchor="middle" dominant-baseline="middle">${accessoryEmoji}</text>
    <!-- Coptic cross accent at top -->
    <g transform="translate(60, 16) scale(0.65)" text-anchor="middle" fill="${crossColor}">
      <text x="0" y="4" font-size="16" font-family="sans-serif" font-weight="bold">☩</text>
    </g>
  </svg>`;
  return `data:image/svg+xml;utf8,${encodeURIComponent(svg)}`;
}

export const COPTIC_AVATARS: CopticAvatarPreset[] = [
  {
    id: 'st-mark',
    nameEn: 'St. Mark the Apostle',
    nameAr: 'مارمرقس الرسول كاروز الديار المصرية',
    category: 'saints',
    svgDataUri: createSvgAvatar(['#881337', '#4c0519'], '#fbbf24', '🦁', '📜', '#f59e0b')
  },
  {
    id: 'st-george',
    nameEn: 'St. George the Prince of Martyrs',
    nameAr: 'الشهيد العظيم مارجرجس الروماني',
    category: 'saints',
    svgDataUri: createSvgAvatar(['#1e3a8a', '#172554'], '#fde047', '⚔️', '🐎', '#fbbf24')
  },
  {
    id: 'st-demiana',
    nameEn: 'St. Demiana and the 40 Virgins',
    nameAr: 'القديسة العفيفة دميانة',
    category: 'saints',
    svgDataUri: createSvgAvatar(['#831843', '#500724'], '#fbcfe8', '👑', '🕊️', '#f472b6')
  },
  {
    id: 'archangel-michael',
    nameEn: 'Archangel Michael',
    nameAr: 'رئيس الملائكة الجليل ميخائيل',
    category: 'saints',
    svgDataUri: createSvgAvatar(['#0f766e', '#134e4a'], '#fef08a', '🪽', '⚖️', '#2dd4bf')
  },
  {
    id: 'virgin-mary',
    nameEn: 'The Holy Virgin Mary (Theotokos)',
    nameAr: 'أم النور القديسة مريم العذراء',
    category: 'saints',
    svgDataUri: createSvgAvatar(['#1d4ed8', '#1e1b4b'], '#fef9c3', '✨', '🌹', '#60a5fa')
  },
  {
    id: 'st-philopateer',
    nameEn: 'St. Philopateer Abu Seifein',
    nameAr: 'الشهيد فيلوباتير مرقوريوس (أبو سيفين)',
    category: 'saints',
    svgDataUri: createSvgAvatar(['#701a75', '#4a044e'], '#fef08a', '🛡️', '🗡️', '#e879f9')
  },
  {
    id: 'st-mina',
    nameEn: 'St. Mina the Wonderworker',
    nameAr: 'الشهيد مارمينا العجائبي',
    category: 'saints',
    svgDataUri: createSvgAvatar(['#9a3412', '#431407'], '#fed7aa', '🐪', '🌿', '#fb923c')
  },
  {
    id: 'deacon-boy',
    nameEn: 'Coptic Deacon in Tunic',
    nameAr: 'شماس قبطي بالتونية والبطرشيل',
    category: 'deacons',
    svgDataUri: createSvgAvatar(['#0369a1', '#082f49'], '#fed7aa', '👦', '✝️', '#38bdf8')
  },
  {
    id: 'sunday-school-boy',
    nameEn: 'Sunday School Student (Boy)',
    nameAr: 'فتى مدارس الأحد مبتسم بالصليب',
    category: 'students',
    svgDataUri: createSvgAvatar(['#047857', '#064e3b'], '#a7f3d0', '👦', '📖', '#34d399')
  },
  {
    id: 'sunday-school-girl',
    nameEn: 'Sunday School Student (Girl)',
    nameAr: 'فتاة مدارس الأحد بالضفائر والصليب',
    category: 'students',
    svgDataUri: createSvgAvatar(['#b45309', '#78350f'], '#fef3c7', '👧', '🌸', '#f59e0b')
  },
  {
    id: 'david-shepherd',
    nameEn: 'Young David the Psalmist',
    nameAr: 'داود الراعي المرنم الصغير',
    category: 'saints',
    svgDataUri: createSvgAvatar(['#4d7c0f', '#1a2e05'], '#ecfccb', '🎶', '🐑', '#84cc16')
  },
  {
    id: 'coptic-cross-dove',
    nameEn: 'Holy Cross & Peaceful Dove',
    nameAr: 'الصليب القبطي وحمامة الروح القدس',
    category: 'saints',
    svgDataUri: createSvgAvatar(['#6b21a8', '#3b0764'], '#f3e8ff', '☩', '🕊️', '#c084fc')
  }
];

export const DEFAULT_STUDENT_AVATAR = COPTIC_AVATARS[7].svgDataUri; // Deacon Boy
export const DEFAULT_PARENT_AVATAR = COPTIC_AVATARS[0].svgDataUri; // St. Mark
export const DEFAULT_TEACHER_AVATAR = COPTIC_AVATARS[3].svgDataUri; // Archangel Michael
