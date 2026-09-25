import React, { useState } from 'react';
import { 
  BookOpen, 
  CheckCircle2, 
  Layers, 
  Volume2, 
  HelpCircle, 
  Award, 
  Sparkles, 
  Mic, 
  ChevronRight, 
  ArrowLeft,
  Share2,
  Bookmark,
  Calendar,
  Clock,
  Check
} from 'lucide-react';
import { 
  Lesson, 
  LessonVersion, 
  LessonSource, 
  StudentContentProgress, 
  StudentQuizAttempt, 
  StudentMastery,
  PresentationSlide,
  Language
} from '../../../types';
import { SundaySchoolAudioPlayer } from '../viewers/SundaySchoolAudioPlayer';
import { SlideDeckViewer } from '../viewers/SlideDeckViewer';
import { formatStudentClassDisplay } from '../../../lib/classGroups';
import { useAuth } from '../../../context/AuthContext';
import { isSupabaseConfigured } from '../../../lib/supabase';

interface SundaySchoolLessonViewProps {
  lesson: Lesson;
  version: LessonVersion;
  sources: LessonSource[];
  progress?: StudentContentProgress;
  quizAttempts: StudentQuizAttempt[];
  mastery?: StudentMastery;
  onBack: () => void;
  onMarkSectionRead: (sectionId: string, totalSections: number) => void;
  onCompleteContent: () => void;
  onStartQuiz: () => void;
  onOpenSourceViewer?: (source: LessonSource) => void;
  targetSectionId?: string;
  lang?: Language;
  isOnlineAuth?: boolean;
}

export const SundaySchoolLessonView: React.FC<SundaySchoolLessonViewProps> = ({
  lesson,
  version,
  sources,
  progress,
  quizAttempts,
  mastery,
  onBack,
  onMarkSectionRead,
  onCompleteContent,
  onStartQuiz,
  onOpenSourceViewer,
  targetSectionId,
  lang = 'en' as Language,
  isOnlineAuth
}) => {
  const { userData, isGuest } = useAuth();
  const effectiveOnlineAuth = isOnlineAuth !== undefined ? isOnlineAuth : Boolean(!isGuest && userData && isSupabaseConfigured);

  const [activeAudioMode, setActiveAudioMode] = useState<'TEACHER' | 'AI'>('TEACHER');
  const [showSlidesModal, setShowSlidesModal] = useState<boolean>(false);
  const [activeFlashcardIndex, setActiveFlashcardIndex] = useState<number>(0);
  const [isFlashcardFlipped, setIsFlashcardFlipped] = useState<boolean>(false);

  const teacherVoiceSource = sources.find(s => s.type === 'TEACHER_VOICE');
  const rawSections = version.sections || [];
  // Canonical section ordering according to order_index / order
  const sections = [...rawSections].sort((a, b) => (a.order ?? 0) - (b.order ?? 0));
  const completedSections = progress?.sectionsCompleted || [];
  const isContentCompleted = progress?.status === 'COMPLETED' || completedSections.length === sections.length;
  const latestQuizAttempt = quizAttempts[quizAttempts.length - 1];

  const classInfo = formatStudentClassDisplay(lesson.grade, lang);

  return (
    <div className="max-w-5xl mx-auto space-y-6 pb-16">
      {/* Top Breadcrumb & Actions */}
      <div className="flex items-center justify-between gap-4 flex-wrap">
        <button
          onClick={onBack}
          className="px-3 py-1.5 bg-stone-900 hover:bg-stone-800 text-stone-300 rounded-xl text-xs font-semibold flex items-center gap-1.5 border border-stone-800 transition-colors"
        >
          <ArrowLeft className="w-4 h-4" /> Back to Lessons
        </button>

        <div className="flex items-center gap-2">
          {lesson.approvedServantName && (
            <span className="text-xs px-2.5 py-1 rounded-full bg-emerald-950 text-emerald-300 border border-emerald-800/80 font-medium flex items-center gap-1">
              <CheckCircle2 className="w-3.5 h-3.5" /> Approved by {lesson.approvedServantName}
            </span>
          )}
        </div>
      </div>

      {/* Hero Banner with Coptic Title */}
      <div className="relative rounded-3xl overflow-hidden border border-amber-800/40 bg-gradient-to-br from-stone-950 via-stone-900 to-amber-950/40 p-6 sm:p-10 shadow-2xl">
        <div className="relative z-10 space-y-4 max-w-3xl">
          <div className="flex items-center gap-2 flex-wrap">
            <span className="px-3 py-1 rounded-full bg-amber-600/20 text-amber-300 border border-amber-500/30 text-xs font-bold uppercase tracking-wider flex items-center gap-1.5">
              <span>{classInfo.icon}</span>
              <span>{classInfo.fullDisplay}</span>
            </span>
            <span className="text-xs text-stone-400 flex items-center gap-1">
              <Calendar className="w-3 h-3 text-amber-500" /> {lesson.date}
            </span>
          </div>

          <div>
            {lang === 'ar' ? (
              <div>
                <h1 className="text-2xl sm:text-4xl font-bold text-white font-sans tracking-tight" dir="rtl">
                  {lesson.titleAr || version.summaryAr || lesson.title}
                </h1>
                <div className="flex items-center gap-2 mt-1 flex-wrap">
                  <h2 className="text-sm sm:text-base font-medium text-amber-400 font-serif">
                    {lesson.title}
                  </h2>
                  {(lesson.titleCop || version.summaryCop) && (
                    <span className="text-xs sm:text-sm text-amber-300 font-serif">
                      • {lesson.titleCop || version.summaryCop}
                    </span>
                  )}
                </div>
              </div>
            ) : lang === 'copt' || lang === 'cop' ? (
              <div>
                <h1 className="text-2xl sm:text-4xl font-bold text-white font-serif tracking-tight">
                  {(lesson.titleCop || version.summaryCop) ? `${lesson.titleCop || version.summaryCop}` : lesson.title}
                </h1>
                <div className="flex items-center gap-2 mt-1 flex-wrap">
                  <h2 className="text-sm sm:text-base font-medium text-amber-400 font-serif">
                    {lesson.title}
                  </h2>
                  {lesson.titleAr && (
                    <span className="text-xs sm:text-sm text-amber-300 font-sans" dir="rtl">
                      • {lesson.titleAr}
                    </span>
                  )}
                </div>
              </div>
            ) : (
              <div>
                <div className="flex items-center gap-3">
                  <h1 className="text-2xl sm:text-4xl font-bold text-white font-serif tracking-tight">
                    {(lesson.titleCop || version.summaryCop) ? `${lesson.titleCop || version.summaryCop} • ` : ''}{lesson.title}
                  </h1>
                </div>
                {lesson.titleAr && (
                  <h2 className="text-lg sm:text-xl font-medium text-amber-400 font-sans mt-1" dir="rtl">
                    {lesson.titleAr || version.summaryAr}
                  </h2>
                )}
              </div>
            )}
          </div>

          <p className="text-sm text-stone-300 font-serif leading-relaxed" dir={lang === 'ar' ? 'rtl' : 'ltr'}>
            {lang === 'ar' 
              ? (version.bigIdeaAr || lesson.summaryAr || version.bigIdeaEn || lesson.summary)
              : lang === 'copt' || lang === 'cop'
                ? (version.summaryCop || version.bigIdeaEn || lesson.summary)
                : (version.bigIdeaEn || lesson.summary)}
          </p>

          {/* Quick Stat Strip: Content Progress vs Quiz Score vs Mastery */}
          <div className="pt-2 grid grid-cols-1 sm:grid-cols-3 gap-3">
            {/* Metric 1 */}
            <div className="p-3 bg-stone-900/80 rounded-xl border border-stone-800 text-xs space-y-1">
              <div className="flex items-center justify-between">
                <span className="text-stone-400 font-medium">Lesson Content</span>
                <span className="font-mono font-bold text-blue-400">{progress?.completionPercent || 0}%</span>
              </div>
              <div className="w-full h-1.5 bg-stone-800 rounded-full overflow-hidden">
                <div 
                  className="h-full bg-blue-500 rounded-full" 
                  style={{ width: `${progress?.completionPercent || 0}%` }}
                />
              </div>
            </div>

            {/* Metric 2 */}
            <div className="p-3 bg-stone-900/80 rounded-xl border border-stone-800 text-xs space-y-1">
              <div className="flex items-center justify-between">
                <span className="text-stone-400 font-medium">Separate Quiz</span>
                <span className="font-mono font-bold text-purple-400">
                  {latestQuizAttempt ? `${latestQuizAttempt.percentage}%` : 'Not Taken'}
                </span>
              </div>
              <div className="w-full h-1.5 bg-stone-800 rounded-full overflow-hidden">
                <div 
                  className="h-full bg-purple-500 rounded-full" 
                  style={{ width: `${latestQuizAttempt?.percentage || 0}%` }}
                />
              </div>
            </div>

            {/* Metric 3 */}
            <div className="p-3 bg-stone-900/80 rounded-xl border border-stone-800 text-xs space-y-1">
              <div className="flex items-center justify-between">
                <span className="text-stone-400 font-medium">Teacher Mastery</span>
                <span className={`text-[10px] px-2 py-0.5 rounded-full font-bold uppercase ${
                  mastery?.status === 'MASTERED' ? 'bg-emerald-950 text-emerald-300' :
                  mastery?.status === 'DEVELOPING' ? 'bg-amber-950 text-amber-300' : 'bg-stone-800 text-stone-400'
                }`}>
                  {mastery?.status || 'NOT_STARTED'}
                </span>
              </div>
              <p className="text-[10px] text-stone-500 truncate">
                {mastery?.teacherNotes ? 'Servant note on file' : 'Reviewed by servant'}
              </p>
            </div>
          </div>
        </div>
      </div>

      {/* Audio Experience: Real Servant Voice OR Approved AI Narration */}
      <div className="space-y-3">
        <div className="flex items-center justify-between">
          <h3 className="text-xs font-bold uppercase tracking-wider text-stone-400 flex items-center gap-1.5">
            <Volume2 className="w-4 h-4 text-amber-500" />
            Classroom Audio & Spoken Narration
          </h3>

          <div className="flex bg-stone-900 rounded-xl border border-stone-800 p-0.5 text-xs">
            <button
              onClick={() => setActiveAudioMode('TEACHER')}
              className={`px-3 py-1 rounded-lg font-medium transition-colors flex items-center gap-1.5 ${
                activeAudioMode === 'TEACHER'
                  ? 'bg-amber-600 text-white font-bold'
                  : 'text-stone-400 hover:text-stone-200'
              }`}
            >
              <Mic className="w-3.5 h-3.5" />
              <span>Teacher Voice Audio</span>
            </button>

            <button
              onClick={() => setActiveAudioMode('AI')}
              className={`px-3 py-1 rounded-lg font-medium transition-colors flex items-center gap-1.5 ${
                activeAudioMode === 'AI'
                  ? 'bg-blue-600 text-white font-bold'
                  : 'text-stone-400 hover:text-stone-200'
              }`}
            >
              <Sparkles className="w-3.5 h-3.5" />
              <span>AI Spoken Narration</span>
            </button>
          </div>
        </div>

        {activeAudioMode === 'TEACHER' ? (
          <SundaySchoolAudioPlayer
            type="TEACHER_VOICE"
            title="Classroom Voice Explanation"
            titleAr="شرح الخادم الصوتي في فصل مدارس الأحد"
            subTitle="Real audio recorded by Servant Mina during the church Sunday School session."
            audioUrl={teacherVoiceSource?.fileUrl || 'https://cdn.freesound.org/previews/560/560446_12398463-lq.mp3'}
            durationSeconds={teacherVoiceSource?.durationSeconds || 495}
            recordedBy="Servant Mina"
            transcript={teacherVoiceSource?.transcript}
          />
        ) : (
          <SundaySchoolAudioPlayer
            type="AI_NARRATION"
            title="Approved Educational Narration"
            titleAr="قراءة تعليمية مبنية على محتوى الدرس المعتمد"
            subTitle="AI synthesized audio strictly guided by the servant-approved lesson text."
            audioUrl={version.ttsAudioUrlEn || 'https://cdn.freesound.org/previews/560/560446_12398463-lq.mp3'}
            durationSeconds={180}
            isApproved={version.status === 'APPROVED'}
            transcript={version.narrationScriptEn}
          />
        )}
      </div>

      {/* Classroom Slide Deck Action Card */}
      {version.slides && version.slides.length > 0 && (
        <div className="p-5 bg-gradient-to-r from-amber-950/40 via-stone-900 to-stone-900 border border-amber-800/40 rounded-2xl flex items-center justify-between flex-wrap gap-4 shadow-lg">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-2xl bg-amber-600/20 border border-amber-500/40 flex items-center justify-center text-amber-400">
              <Layers className="w-5 h-5" />
            </div>
            <div>
              <h3 className="text-sm font-bold text-white">Classroom Slide Presentation</h3>
              <p className="text-xs text-stone-400">
                {version.slides.length} visual slides used by your servant on the classroom smart board.
              </p>
            </div>
          </div>

          <button
            onClick={() => setShowSlidesModal(true)}
            className="px-4 py-2 bg-amber-600 hover:bg-amber-500 text-white rounded-xl text-xs font-bold shadow-md transition-all active:scale-95 flex items-center gap-1.5"
          >
            <Layers className="w-4 h-4" /> Open Slide Deck Viewer
          </button>
        </div>
      )}

      {/* Memory Verse Box: Normalized curriculum with explicit empty state for online users */}
      {lesson.scriptureVerseEn || lesson.scriptureVerseAr || lesson.verseReference ? (
        <div className="p-6 bg-stone-950 rounded-2xl border-2 border-amber-600/50 shadow-xl text-center space-y-3">
          <span className="text-xs font-bold uppercase tracking-widest text-amber-500">
            {lang === 'copt' || lang === 'cop' ? '✝ Ⲡⲓⲥϧⲁⲓ ⲉ̀ⲧⲉⲛⲛⲁⲁⲙⲟⲛⲓ ⲙ̀ⲙⲟϥ' : lang === 'ar' ? '✝ آية الحفظ المقررة' : '✝ Holy Scripture Memory Verse'}
          </span>
          {lesson.scriptureVerseEn && (
            <blockquote className="text-lg sm:text-xl font-bold text-white font-serif italic max-w-2xl mx-auto">
              "{lesson.scriptureVerseEn}"
            </blockquote>
          )}
          {lesson.scriptureVerseAr && (
            <p className="text-base text-amber-400/90 font-sans font-medium" dir="rtl">
              "{lesson.scriptureVerseAr}"
            </p>
          )}
          {lesson.verseReference && (
            <span className="inline-block text-xs font-semibold text-stone-400 font-mono">
              {lesson.verseReference}
            </span>
          )}
        </div>
      ) : effectiveOnlineAuth ? (
        /* Authenticated online normalized curriculum: Explicit empty state, NO hardcoded fallback */
        <div className="p-6 bg-stone-950 rounded-2xl border border-stone-800 text-center space-y-2">
          <span className="text-xs font-bold uppercase tracking-widest text-stone-500">
            {lang === 'copt' || lang === 'cop' ? '✝ Ⲡⲓⲥϧⲁⲓ ⲉ̀ⲧⲉⲛⲛⲁⲁⲙⲟⲛⲓ ⲙ̀ⲙⲟϥ' : lang === 'ar' ? '✝ آية الحفظ' : '✝ Holy Scripture Memory Verse'}
          </span>
          <p className="text-xs sm:text-sm text-stone-400 font-serif italic">
            {lang === 'copt' || lang === 'cop'
              ? 'Ⲙ̀ⲙⲟⲛ ⲥϧⲁⲓ ⲉ̀ⲧⲟⲩⲧⲏⲓϥ ϧⲉⲛ ⲧⲁⲓⲥⲃⲱ.'
              : lang === 'ar'
                ? 'لم يتم تحديد آية حفظ لهذا الدرس.'
                : 'No Scripture reference provided for this lesson.'}
          </p>
        </div>
      ) : (
        /* Demo / Guest / legacy-only fallback */
        <div className="p-6 bg-stone-950 rounded-2xl border-2 border-amber-600/50 shadow-xl text-center space-y-3">
          <span className="text-xs font-bold uppercase tracking-widest text-amber-500">
            {lang === 'copt' || lang === 'cop' ? '✝ Ⲡⲓⲥϧⲁⲓ ⲉ̀ⲧⲉⲛⲛⲁⲁⲙⲟⲛⲓ ⲙ̀ⲙⲟϥ' : lang === 'ar' ? '✝ آية الحفظ المقررة' : '✝ Holy Scripture Memory Verse'}
          </span>
          <blockquote className="text-lg sm:text-xl font-bold text-white font-serif italic max-w-2xl mx-auto">
            "For the message of the cross is foolishness to those who are perishing, but to us who are being saved it is the power of God."
          </blockquote>
          <p className="text-base text-amber-400/90 font-sans font-medium" dir="rtl">
            "فإن كلمة الصليب عند الهالكين جهالة، وأما عندنا نحن المخلصين فهي قوة الله." (١ كورنثوس ١: ١٨)
          </p>
          <span className="inline-block text-xs font-semibold text-stone-400 font-mono">
            1 Corinthians 1:18 • ١ كورنثوس ١: ١٨
          </span>
        </div>
      )}

      {/* Lesson Sections List with Checkboxes */}
      <div className="space-y-4">
        <div className="flex items-center justify-between">
          <h3 className="text-xs font-bold uppercase tracking-wider text-stone-400 flex items-center gap-1.5">
            <BookOpen className="w-4 h-4 text-amber-500" />
            {lang === 'copt' || lang === 'cop' ? 'Ⲛⲓⲧⲟⲡⲟⲥ ⲛ̀ⲧⲉ ϯⲥⲃⲱ' : lang === 'ar' ? 'أقسام الدرس والقصة المقررة' : 'Lesson Sections & Story Reading'}
          </h3>
          <span className="text-xs text-stone-400 font-mono">
            {completedSections.length} of {sections.length} {lang === 'copt' || lang === 'cop' ? 'Ⲁⲩⲱϣ' : lang === 'ar' ? 'مقروء' : 'Sections Read'}
          </span>
        </div>

        <div className="space-y-4">
          {sections.map((section, idx) => {
            const isCompleted = completedSections.includes(section.id);
            const isTargeted = targetSectionId === section.id;

            return (
              <div
                key={section.id}
                id={`section-${section.id}`}
                className={`p-6 bg-stone-900 rounded-2xl border transition-all ${
                  isTargeted 
                    ? 'border-amber-500 ring-2 ring-amber-500/50 bg-amber-950/20' 
                    : isCompleted 
                    ? 'border-stone-800' 
                    : 'border-stone-800 hover:border-stone-700'
                }`}
              >
                <div className="flex items-start justify-between gap-4 mb-4">
                  <div className="space-y-1">
                    <div className="flex items-center gap-2 flex-wrap">
                      <span className="w-6 h-6 rounded-full bg-stone-800 text-amber-400 text-xs font-mono font-bold flex items-center justify-center shrink-0">
                        {idx + 1}
                      </span>
                      {lang === 'ar' ? (
                        <h4 className="text-base font-bold text-white font-sans" dir="rtl">
                          {section.titleAr || section.titleEn}
                        </h4>
                      ) : lang === 'copt' || lang === 'cop' ? (
                        <h4 className="text-base font-bold text-white font-serif">
                          {section.titleCop || section.titleEn}
                        </h4>
                      ) : (
                        <h4 className="text-base font-bold text-white font-serif">
                          {section.titleEn}
                        </h4>
                      )}
                      {section.titleCop && lang !== 'copt' && lang !== 'cop' && (
                        <span className="text-amber-400 font-serif text-sm font-semibold">
                          {section.titleCop}
                        </span>
                      )}
                    </div>
                    {lang !== 'ar' && section.titleAr && (
                      <p className="text-xs text-amber-300/80 font-sans ml-8" dir="rtl">
                        {section.titleAr}
                      </p>
                    )}
                    {lang === 'ar' && section.titleEn && section.titleAr !== section.titleEn && (
                      <p className="text-xs text-stone-400 font-serif mr-8">
                        {section.titleEn}
                      </p>
                    )}
                  </div>

                  <button
                    onClick={() => onMarkSectionRead(section.id, sections.length)}
                    className={`px-3 py-1.5 rounded-xl text-xs font-semibold flex items-center gap-1.5 transition-all shrink-0 ${
                      isCompleted
                        ? 'bg-emerald-950 text-emerald-300 border border-emerald-800/60'
                        : 'bg-stone-800 hover:bg-stone-700 text-stone-300 border border-stone-700'
                    }`}
                  >
                    {isCompleted ? <Check className="w-3.5 h-3.5" /> : null}
                    {isCompleted 
                      ? (lang === 'copt' || lang === 'cop' ? 'Ⲁⲩϫⲱⲕ' : lang === 'ar' ? 'تمت القراءة' : 'Completed') 
                      : (lang === 'copt' || lang === 'cop' ? 'Ⲱϣ ⲙ̀ⲡⲁⲓⲧⲟⲡⲟⲥ' : lang === 'ar' ? 'تحديد كمقروء' : 'Mark as Read')}
                  </button>
                </div>

                <div className="space-y-3 text-sm text-stone-200 leading-relaxed pl-8">
                  {/* Coptic content when available - never fabricate missing Coptic */}
                  {section.contentCop && (
                    <div className="p-3 rounded-xl bg-stone-950/60 border border-amber-900/30 text-amber-200 font-serif leading-relaxed">
                      <span className="text-[10px] text-amber-500 font-bold block mb-1 uppercase tracking-wider">
                        Ⲙⲉⲑⲣⲉⲙⲛ̀ⲭⲏⲙⲓ (Coptic)
                      </span>
                      <p>{section.contentCop}</p>
                    </div>
                  )}

                  {lang === 'ar' ? (
                    <>
                      <p className="text-stone-100 font-sans leading-relaxed text-base" dir="rtl">
                        {section.contentAr || section.contentEn}
                      </p>
                      {section.contentEn && section.contentAr !== section.contentEn && (
                        <p className="text-stone-400 font-serif pt-3 border-t border-stone-800/80 leading-relaxed text-xs sm:text-sm">
                          {section.contentEn}
                        </p>
                      )}
                    </>
                  ) : (
                    <>
                      <p className="font-serif">{section.contentEn}</p>
                      {section.contentAr && (
                        <p className="text-stone-300 font-sans pt-3 border-t border-stone-800/80 leading-relaxed" dir="rtl">
                          {section.contentAr}
                        </p>
                      )}
                    </>
                  )}
                </div>

                {section.sourceRefs && section.sourceRefs.length > 0 && (
                  <div className="mt-4 pt-3 border-t border-stone-800/60 flex items-center justify-between text-xs text-stone-500 pl-8">
                    <span className="flex items-center gap-1.5 flex-wrap">
                      <Bookmark className="w-3.5 h-3.5 text-amber-500 shrink-0" />
                      <span className="font-medium text-stone-400">
                        {lang === 'copt' || lang === 'cop' ? 'Ⲛⲓⲡⲏⲅⲏ:' : lang === 'ar' ? 'المصادر الكنسية للفصل:' : 'Classroom Sources:'}
                      </span>
                      <span>{section.sourceRefs.map(r => `${r.sourceName} (${r.location})`).join(', ')}</span>
                    </span>
                  </div>
                )}
              </div>
            );
          })}
        </div>
      </div>

      {/* Interactive Review Flashcards */}
      {version.flashcards && version.flashcards.length > 0 && (
        <div className="p-6 bg-stone-900 border border-stone-800 rounded-2xl space-y-4">
          <div className="flex items-center justify-between">
            <h3 className="text-xs font-bold uppercase tracking-wider text-stone-400">
              Interactive Memory Flashcards ({version.flashcards.length})
            </h3>
            <span className="text-xs font-mono text-stone-500">
              Card {activeFlashcardIndex + 1} of {version.flashcards.length}
            </span>
          </div>

          {/* Flashcard Flip Card */}
          <div
            onClick={() => setIsFlashcardFlipped(!isFlashcardFlipped)}
            className="min-h-[160px] p-6 bg-stone-950 border-2 border-stone-800 hover:border-amber-600/60 rounded-2xl cursor-pointer flex flex-col justify-center items-center text-center transition-all shadow-inner select-none"
          >
            <span className="text-[10px] uppercase font-bold text-amber-500 mb-2">
              {isFlashcardFlipped ? 'Answer / الإجابة (Click to Flip)' : 'Question / السؤال (Click to Reveal)'}
            </span>

            {isFlashcardFlipped ? (
              <div className="space-y-2">
                <p className="text-base font-bold text-emerald-400 font-serif">
                  {version.flashcards[activeFlashcardIndex].backEn}
                </p>
                <p className="text-xs text-stone-300 font-sans" dir="rtl">
                  {version.flashcards[activeFlashcardIndex].backAr}
                </p>
              </div>
            ) : (
              <div className="space-y-2">
                <p className="text-base font-bold text-white font-serif">
                  {version.flashcards[activeFlashcardIndex].frontEn}
                </p>
                <p className="text-xs text-amber-300 font-sans" dir="rtl">
                  {version.flashcards[activeFlashcardIndex].frontAr}
                </p>
              </div>
            )}
          </div>

          <div className="flex justify-between items-center pt-2">
            <button
              onClick={() => {
                setIsFlashcardFlipped(false);
                setActiveFlashcardIndex(prev => Math.max(0, prev - 1));
              }}
              disabled={activeFlashcardIndex === 0}
              className="px-3 py-1.5 bg-stone-800 hover:bg-stone-700 disabled:opacity-30 rounded-xl text-xs text-stone-300"
            >
              Previous Card
            </button>

            <button
              onClick={() => {
                setIsFlashcardFlipped(false);
                setActiveFlashcardIndex(prev => Math.min(version.flashcards!.length - 1, prev + 1));
              }}
              disabled={activeFlashcardIndex === version.flashcards.length - 1}
              className="px-3 py-1.5 bg-stone-800 hover:bg-stone-700 disabled:opacity-30 rounded-xl text-xs text-stone-300"
            >
              Next Card
            </button>
          </div>
        </div>
      )}

      {/* Completion & Quiz Action Card */}
      <div className="p-6 bg-stone-950 border border-stone-800 rounded-3xl flex items-center justify-between flex-wrap gap-4 shadow-xl">
        <div className="space-y-1">
          <h3 className="text-base font-bold text-white">Finished Reading the Lesson?</h3>
          <p className="text-xs text-stone-400">
            Mark your lesson content completed, then take the separate review quiz.
          </p>
        </div>

        <div className="flex items-center gap-3">
          <button
            onClick={onCompleteContent}
            className={`px-4 py-2.5 rounded-xl text-xs font-bold transition-all flex items-center gap-2 ${
              isContentCompleted
                ? 'bg-stone-800 text-emerald-400 border border-emerald-800/40'
                : 'bg-stone-800 hover:bg-stone-700 text-stone-200'
            }`}
          >
            <CheckCircle2 className="w-4 h-4" />
            {isContentCompleted ? 'Content Completed (100%)' : 'Mark Content Finished'}
          </button>

          <button
            onClick={onStartQuiz}
            className="px-5 py-2.5 bg-gradient-to-r from-amber-600 to-amber-700 hover:from-amber-500 hover:to-amber-600 text-white rounded-xl text-xs font-bold shadow-lg flex items-center gap-2 transition-all active:scale-95"
          >
            <HelpCircle className="w-4 h-4" />
            <span>Take Review Quiz</span>
            <ChevronRight className="w-4 h-4" />
          </button>
        </div>
      </div>

      {/* Fullscreen Slide Deck Modal */}
      {showSlidesModal && version.slides && (
        <div className="fixed inset-0 z-50 bg-black/90 backdrop-blur-sm p-4 sm:p-8 flex items-center justify-center">
          <div className="w-full max-w-5xl">
            <SlideDeckViewer
              slides={version.slides}
              onClose={() => setShowSlidesModal(false)}
            />
          </div>
        </div>
      )}
    </div>
  );
};
