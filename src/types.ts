export type Role = 'student' | 'teacher' | 'parent' | 'admin';

export type Locale = 'en' | 'ar' | 'cop';
export type Language = 'en' | 'ar' | 'cop' | 'copt';

export type CopticReviewStatus = 'DRAFT' | 'REVIEW_REQUIRED' | 'VERIFIED' | 'APPROVED';

export interface TranslationRegistryEntry {
  key: string;
  en: string;
  ar: string;
  cop: string;
  source?: string;
  sourceType?: 'LITURGICAL_TEXT' | 'ECCLESIASTICAL_TRADITION' | 'CHURCH_APPROVED' | 'UI_CONVENTION';
  reviewStatus: CopticReviewStatus;
  reviewer?: string;
  reviewedAt?: string;
  notes?: string;
}

export interface TerminologyGlossaryItem {
  termId: string;
  concept: string;
  english: string;
  arabic: string;
  coptic: string;
  copticSource: string;
  reviewStatus: CopticReviewStatus;
  preferredTerm: string;
  forbiddenAlternatives?: string[];
  notes?: string;
}

export interface User {
  id: string; // Firebase Auth UID
  fullName: string;
  role: Role;
  avatarUrl: string;
  points: number;
  currentStreak: number;
  longestStreak: number;
  parentEmail?: string;
  parentId?: string;
  parentName?: string;
  linkCode?: string;
  childLinkCode?: string;
  isLinkedToParent?: boolean;
  dailyScreenTimeLimitMinutes?: number;
  parentBlessingMessage?: string;
  parentBlessingDate?: string;
  phone?: string;
  grade?: string;
  parentPin?: string;
  requireRewardApproval?: boolean;
  pushNotificationsEnabled?: boolean;
  notifyLessonCompletion?: boolean;
  notifyEventReminders?: boolean;
  screenTimeSeconds?: number; // total screen time in seconds
  lastActive?: string;
}

export type LessonStatus = 'draft' | 'published';

export type ClassSessionStatus = 
  | 'DRAFT'
  | 'SOURCES_ADDED'
  | 'AI_PROCESSING'
  | 'AI_DRAFT_READY'
  | 'SERVANT_REVIEW'
  | 'REVISION_REQUESTED'
  | 'APPROVED'
  | 'PUBLISHED'
  | 'ARCHIVED';

export type SourceType = 
  | 'TEACHER_TEXT'
  | 'TEACHER_VOICE'
  | 'TEACHER_VIDEO'
  | 'PDF'
  | 'DOCX'
  | 'PPTX'
  | 'IMAGE'
  | 'YOUTUBE_VIDEO'
  | 'OTHER_APPROVED_RESOURCE';

export type RightsStatus = 
  | 'ORIGINAL'
  | 'CHURCH_OWNED'
  | 'TEACHER_OWNED'
  | 'LICENSED'
  | 'PERMISSION_GRANTED'
  | 'PERMISSION_PENDING'
  | 'RESTRICTED'
  | 'DO_NOT_PUBLISH';

export type SourceProcessingStatus = 'PENDING' | 'EXTRACTED' | 'INDEXED' | 'FAILED';
export type SourcePriority = 'PRIMARY' | 'SUPPLEMENTARY';

export interface LessonSource {
  id: string;
  lessonId: string;
  sessionId?: string;
  uploadedBy: string;
  type: SourceType;
  originalFilename: string;
  mimeType: string;
  storageBucket?: string;
  storagePath?: string;
  fileUrl?: string;
  fileSize?: number;
  contentHash?: string;
  description?: string;
  teacherNotes?: string;
  rightsStatus: RightsStatus;
  processingStatus: SourceProcessingStatus;
  priority: SourcePriority;
  transcript?: string;
  extractedContent?: string;
  pageCount?: number;
  slideCount?: number;
  durationSeconds?: number;
  youtubeId?: string;
  createdAt: string;
}

export interface ClaimEvidence {
  claimId: string;
  statementEn: string;
  statementAr: string;
  sourceId: string;
  sourceName: string;
  sourceLocation: string; // e.g. "page 4", "02:15-03:40", "slide 3"
  verified: boolean;
  unsupported?: boolean;
}

export interface SourceConflict {
  id: string;
  sourceAId: string;
  sourceAName: string;
  sourceBId: string;
  sourceBName: string;
  conflictDescriptionEn: string;
  conflictDescriptionAr: string;
  status: 'UNRESOLVED' | 'RESOLVED';
  resolutionNote?: string;
}

export interface EvidenceMap {
  mainTopicsEn: string[];
  mainTopicsAr: string[];
  importantClaims: ClaimEvidence[];
  bibleReferences: Array<{ reference: string; textEn: string; textAr: string; sourceId: string }>;
  teacherExplanations: string[];
  conflicts: SourceConflict[];
  unsupportedClaims: string[];
}

export interface OutlineSection {
  id: string;
  order: number;
  titleEn: string;
  titleAr: string;
  titleCop?: string;
  objectiveEn: string;
  objectiveAr: string;
  sourceRefs: Array<{ sourceId: string; sourceName: string; location: string }>;
}

export interface LessonOutline {
  id: string;
  lessonId: string;
  sections: OutlineSection[];
  isApprovedByTeacher: boolean;
  approvedAt?: string;
}

export interface SlideItem {
  number: number;
  titleEn: string;
  titleAr: string;
  bulletsEn: string[];
  bulletsAr: string[];
  speakerNotesEn?: string;
  speakerNotesAr?: string;
  sourceRefs: Array<{ sourceId: string; sourceName: string; location: string }>;
  imageUrl?: string;
}

export type PresentationSlide = SlideItem;

export interface QuizQuestionDraft {
  id: string;
  type: 'multiple_choice' | 'true_false' | 'short_answer';
  questionEn: string;
  questionAr: string;
  optionsEn: string[];
  optionsAr: string[];
  correctIndex: number;
  explanationEn: string;
  explanationAr: string;
  sourceRef: {
    sectionId: string;
    sectionTitle: string;
    sourceId: string;
    location: string;
  };
}

export interface QuizDraft {
  id: string;
  lessonId: string;
  titleEn: string;
  titleAr: string;
  instructionsEn: string;
  instructionsAr: string;
  questions: QuizQuestionDraft[];
  status: 'DRAFT' | 'REVIEW_REQUIRED' | 'APPROVED';
}

export interface FlashcardItem {
  id: string;
  frontEn: string;
  frontAr: string;
  backEn: string;
  backAr: string;
  sourceRef?: string;
}

export interface LessonSectionItem {
  id: string;
  order: number;
  titleEn: string;
  titleAr: string;
  titleCop?: string;
  contentEn: string;
  contentAr: string;
  contentCop?: string;
  sourceRefs: Array<{ sourceId: string; sourceName: string; location: string }>;
  teacherNotes?: string;
  hasUnresolvedComments?: boolean;
}

export type LessonSection = LessonSectionItem;

export type LessonVersionStatus = 
  | 'AI_DRAFT'
  | 'SERVANT_REVIEW'
  | 'REVISION_REQUESTED'
  | 'APPROVED'
  | 'PUBLISHED';

export interface LessonVersion {
  id: string;
  lessonId: string;
  versionNumber: number;
  status: LessonVersionStatus;
  createdBy: string;
  createdAt: string;
  approvedBy?: string;
  approvedAt?: string;
  approvalNote?: string;
  changeReason?: string;
  summaryEn: string;
  summaryAr: string;
  summaryCop?: string;
  bigIdeaEn: string;
  bigIdeaAr: string;
  objectivesEn: string[];
  objectivesAr: string[];
  sections: LessonSectionItem[];
  recapEn: string;
  recapAr: string;
  flashcards: FlashcardItem[];
  slides: SlideItem[];
  quizDraft: QuizDraft;
  narrationScriptEn: string;
  narrationScriptAr: string;
  ttsAudioUrlEn?: string;
  ttsAudioUrlAr?: string;
  ttsStatus: 'NONE' | 'PENDING' | 'GENERATED' | 'STALE';
}

export type CommentType = 
  | 'INCORRECT'
  | 'MISLEADING'
  | 'UNSUPPORTED'
  | 'WRONG_SOURCE'
  | 'WRONG_TRANSLATION'
  | 'WRONG_THEOLOGY'
  | 'WRONG_CONTEXT'
  | 'TOO_SIMPLE'
  | 'TOO_COMPLEX'
  | 'MISSING_INFORMATION'
  | 'AGE_LEVEL'
  | 'TONE'
  | 'OTHER';

export interface ServantComment {
  id: string;
  lessonVersionId: string;
  sectionId: string;
  quoteHighlighted?: string;
  comment: string;
  commentType: CommentType;
  authorName: string;
  createdAt: string;
  resolved: boolean;
  resolutionNote?: string;
}

export type ContentProgressStatus = 'NOT_STARTED' | 'OPENED' | 'IN_PROGRESS' | 'COMPLETED';

export interface StudentContentProgress {
  studentId: string;
  lessonId: string;
  status: ContentProgressStatus;
  sectionsCompleted: string[]; // section IDs
  totalSections: number;
  completionPercent: number;
  startedAt?: string;
  completedAt?: string;
  lastPositionSectionId?: string;
}

export type QuizAttemptStatus = 'NOT_STARTED' | 'IN_PROGRESS' | 'SUBMITTED' | 'GRADED' | 'REVIEWED';

export interface QuizAnswer {
  questionId: string;
  selectedOptionIndex?: number;
  selectedIndex?: number;
  isCorrect: boolean;
  feedbackEn: string;
  feedbackAr?: string;
  recommendedSectionId?: string;
  recommendedSectionTitle?: string;
}

export interface StudentQuizAttempt {
  id: string;
  studentId: string;
  lessonId: string;
  quizId: string;
  status?: QuizAttemptStatus;
  score: number;
  totalScore: number;
  percentage: number;
  passed?: boolean;
  answers: QuizAnswer[];
  submittedAt?: string;
  attemptedAt?: string;
}

export type MasteryStatus = 'NOT_ASSESSED' | 'NEEDS_REVIEW' | 'DEVELOPING' | 'MASTERED' | 'NOT_STARTED' | 'NEEDS_SUPPORT';

export interface StudentMastery {
  studentId: string;
  lessonId: string;
  status: MasteryStatus;
  evaluatedBy?: string;
  evaluatedAt?: string;
  teacherNotes?: string;
}

export interface SearchAuditLog {
  id: string;
  lessonId: string;
  query: string;
  urls: string[];
  domains: string[];
  citations: string[];
  retrievedAt: string;
  status: 'PENDING_REVIEW' | 'APPROVED' | 'DISCARDED';
}

export interface ClassSession {
  id: string;
  classId: string;
  teacherId: string;
  teacherName: string;
  title: string;
  topic: string;
  description: string;
  date: string;
  ageGroup: string;
  grade: string;
  churchId?: string;
  status: ClassSessionStatus;
  allowInternetSearch: boolean;
  activeLessonId?: string;
  createdAt: string;
  updatedAt: string;
}

export interface QuizQuestion {
  question: string;
  options: string[];
  correctIndex: number;
  type?: 'multiple_choice' | 'free_write';
  sourceRef?: string;
}

export interface Lesson {
  id: string;
  classSessionId?: string;
  title: string;
  titleAr?: string;
  titleCop?: string;
  summary: string;
  summaryAr?: string;
  summaryCop?: string;
  status: LessonStatus;
  date: string;
  ageGroup?: string;
  grade?: string;
  teacherId?: string;
  teacherName?: string;
  pointsAvailable: number;
  isCompleted?: boolean;
  quiz?: QuizQuestion[];
  currentVersionId?: string;
  versionsCount?: number;
  // Deep Sunday School Links
  sourcesCount?: number;
  latestVersion?: LessonVersion;
  evidenceMap?: EvidenceMap;
  outline?: LessonOutline;
  approvedServantName?: string;
  approvedAt?: string;
}

export interface Hymn {
  id: string;
  titleEn: string;
  titleAr: string;
  titleCopt?: string;
  descriptionEn: string;
  descriptionAr: string;
  season: 'Annual' | 'Kiahk' | 'Holy Week' | 'Joyous Days' | 'Fasting';
  audioUrl: string;
  lyricsEn: string;
  lyricsAr: string;
  lyricsCopt: string;
}

export type LessonCategory = 'bible_stories' | 'hymns_rituals' | 'church_history' | 'ethics_prayers';

export interface ChildLessonProgress {
  lessonId: string;
  lessonTitleEn: string;
  lessonTitleAr: string;
  category: LessonCategory;
  dateCompleted?: string;
  status: 'completed' | 'in_progress' | 'assigned';
  quizScore?: {
    correct: number;
    total: number;
  };
  pointsEarned: number;
  pointsMax: number;
  memoryVerseEn: string;
  memoryVerseAr: string;
  teacherNoteEn?: string;
  teacherNoteAr?: string;
}

export interface ChildProfile {
  id: string;
  nameEn: string;
  nameAr: string;
  age: number;
  gradeEn: string;
  gradeAr: string;
  avatarUrl: string;
  points: number;
  rank: number;
  attendanceRate: number; // e.g. 96 (%)
  screenTimeMinutes: number;
  completedLessonsCount: number;
  totalLessonsCount: number;
  verseMemorizedCount: number;
  pendingRewardsCount: number;
  lessons: ChildLessonProgress[];
  // Linked account attributes
  linkCode?: string;
  parentId?: string;
  isRealAccount?: boolean; // true if linked to an active student user
  studentId?: string; // id of the student profile if linked
  dailyScreenTimeLimitMinutes?: number;
  parentBlessingMessage?: string;
  parentBlessingDate?: string;
}

export interface ChurchEventNotification {
  id: string;
  titleEn: string;
  titleAr: string;
  category: 'liturgy' | 'sunday_school' | 'family' | 'hymn';
  date: string;
  timeEn: string;
  timeAr: string;
  locationEn: string;
  locationAr: string;
  descriptionEn: string;
  descriptionAr: string;
  priority: 'feast' | 'high' | 'normal';
  isRead: boolean;
  isRsvp?: boolean;
  rsvpCount?: number;
  hasReminder?: boolean;
}


export interface Badge {
  id: string;
  title: string;
  pointsThreshold: number;
  icon: string; // lucide icon name
  unlockedAt?: string;
}

export interface Reply {
  id: string;
  authorName: string;
  authorAvatar?: string;
  content: string;
  createdAt: string;
  reactions?: { heart: number; candle: number; cross: number };
}

export interface Comment {
  id: string;
  authorName: string;
  authorAvatar?: string;
  content: string;
  replies: Reply[];
  createdAt: string;
  reactions?: { heart: number; candle: number; cross: number };
}

export interface Post {
  id: string;
  authorId: string;
  authorName: string;
  authorAvatar: string;
  content: string;
  reactions: { heart: number; candle: number; cross: number };
  comments: Comment[];
  createdAt: string;
  mediaType?: 'image' | 'video' | 'youtube' | 'audio' | 'embed';
  mediaUrl?: string;
  mediaThumbnail?: string;
  mediaProvider?: string;
}

export interface RewardItem {
  id: string;
  title: string;
  titleAr: string;
  pointsCost: number;
  iconType: string;
}

export interface LeaderboardEntry {
  id: string;
  studentId: string;
  studentName: string;
  avatarUrl: string;
  pointsThisWeek: number;
  rank: number;
}
