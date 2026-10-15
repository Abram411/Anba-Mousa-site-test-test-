import React, { useState, useEffect, useMemo } from 'react';
import { BookOpen } from 'lucide-react';
import { mockLessons } from '../../data';
import { useAuth } from '../../context/AuthContext';
import { useLessons } from '../../context/LessonsContext';
import { isSupabaseConfigured } from '../../lib/supabase';
import { 
  Language, 
  LessonVersion, 
  QuizDraft,
  QuestionDifficulty
} from '../../types';
import { SundaySchoolLessonView } from '../sunday-school/student/SundaySchoolLessonView';
import { SundaySchoolQuizView } from '../sunday-school/student/SundaySchoolQuizView';
import { startLessonProgress, completeSectionProgress, completeLessonProgress } from '../../lib/studentProgressService';
import { submitStudentQuizAttempt } from '../../lib/studentQuizService';
import { getStudentMastery, evaluateStudentMastery } from '../../lib/studentMasteryService';

export function LessonView({ lessonId, onBack, lang = 'ar' }: { lessonId: string; onBack: () => void; lang?: Language }) {
  const { userData, isGuest, addPoints } = useAuth();
  const { 
    lessons, 
    markCompleted,
    lessonSources,
    lessonVersions,
    studentProgress,
    quizAttempts,
    studentMasteries,
    setStudentMastery,
    updateStudentContentProgress,
    recordQuizAttempt
  } = useLessons();

  const lesson = lessons.find(l => l.id === lessonId) || mockLessons.find(l => l.id === lessonId);
  
  // Sunday School Vertical Slice States
  const [isTakingQuiz, setIsTakingQuiz] = useState<boolean>(false);
  const [targetSectionId, setTargetSectionId] = useState<string | undefined>(undefined);

  const currentStudentId = userData?.id || 'u1';
  const versions = (lessonVersions && lessonVersions[lessonId]) || [];
  const isOnlineAuth = Boolean(!isGuest && userData && isSupabaseConfigured);

  // Authoritative Version Resolution for ALL Lessons
  const activePublishedVersion = useMemo<LessonVersion>(() => {
    let resolved: LessonVersion | null = null;

    if (isOnlineAuth) {
      if (lesson?.currentVersionId) {
        if (lesson.latestVersion && lesson.latestVersion.id === lesson.currentVersionId && lesson.latestVersion.status === 'PUBLISHED') {
          resolved = lesson.latestVersion;
        } else {
          resolved = versions.find(v => v.id === lesson.currentVersionId && v.status === 'PUBLISHED') || null;
        }
      }
    } else {
      // Offline / Demo / Guest fallback
      resolved = (lesson?.currentVersionId ? versions.find(v => v.id === lesson.currentVersionId) : null) ||
        lesson?.latestVersion ||
        versions.find(v => v.status === 'APPROVED' || v.status === 'PUBLISHED') ||
        versions[versions.length - 1] ||
        null;
    }

    if (resolved && resolved.sections && resolved.sections.length > 0) {
      return resolved;
    }

    // Build authentic version using only the teacher's actual data
    const lessonTitle = lesson?.title || 'Sunday School Lesson';
    const lessonTitleAr = lesson?.titleAr || lessonTitle;
    const lessonSummary = lesson?.summary || 'Spiritual curriculum lesson for our Sunday School class.';
    const lessonSummaryAr = lesson?.summaryAr || lessonSummary;

    // Only construct quizDraft if the servant actually defined quiz questions
    const hasQuiz = Boolean(lesson?.quiz && lesson.quiz.length > 0);
    const quizDraftQuestions = hasQuiz
      ? lesson!.quiz!.map((q, idx) => ({
          id: q.id || `q-${lessonId}-${idx}`,
          type: 'multiple_choice' as const,
          difficulty: q.difficulty || (idx === 0 ? 'EASY' : idx === 1 ? 'MEDIUM' : 'HARD') as QuestionDifficulty,
          points: q.points || (idx === 0 ? 10 : idx === 1 ? 20 : 30),
          questionEn: q.question,
          questionAr: q.question,
          optionsEn: q.options,
          optionsAr: q.options,
          correctIndex: q.correctIndex,
          explanationEn: `Key takeaway for ${lessonTitle}.`,
          explanationAr: `النقطة الأساسية لدرس ${lessonTitleAr}.`
        }))
      : [];

    const generatedQuiz: QuizDraft | undefined = hasQuiz ? {
      id: `quiz-gen-${lessonId}`,
      lessonId,
      titleEn: `${lessonTitle} Review Quiz`,
      titleAr: `اختبار مراجعة ${lessonTitleAr}`,
      status: 'APPROVED',
      questions: quizDraftQuestions
    } : undefined;

    const mainExplanationAr = lesson?.writtenExplanation || lesson?.teacherNotes || lessonSummaryAr;
    const mainExplanationEn = lesson?.writtenExplanation || lesson?.teacherNotes || lessonSummary;

    return {
      id: `ver-auto-${lessonId}`,
      lessonId,
      versionNumber: 1,
      status: 'PUBLISHED',
      createdBy: lesson?.teacherName || 'Sunday School Servant',
      createdAt: lesson?.date || new Date().toISOString(),
      approvedBy: lesson?.approvedServantName || 'Sunday School Servant',
      approvedAt: lesson?.approvedAt || new Date().toISOString(),
      summaryEn: lessonSummary,
      summaryAr: lessonSummaryAr,
      summaryCop: lesson?.summaryCop,
      bigIdeaEn: lessonSummary,
      bigIdeaAr: lessonSummaryAr,
      objectivesEn: [
        `Learn the spiritual lessons of ${lessonTitle}`,
        'Practice Christian love and obedience at home and church'
      ],
      objectivesAr: [
        `تعلم الدروس الروحية لـ ${lessonTitleAr}`,
        'ممارسة المحبة والطاعة المسيحية في بيوتنا وكنيستنا'
      ],
      sections: [
        {
          id: `sec-${lessonId}-1`,
          order: 1,
          titleEn: `1. The Story of ${lessonTitle}`,
          titleAr: `١. القصة والشرح الإيماني: ${lessonTitleAr}`,
          titleCop: lesson?.titleCop || 'Ⲡⲓⲥⲃⲱ ⲛ̀ⲧⲉ ϯⲉⲕⲕⲗⲏⲥⲓⲁ',
          contentEn: mainExplanationEn,
          contentAr: mainExplanationAr,
          contentCop: lesson?.summaryCop,
          teacherNotes: lesson?.teacherNotes || undefined
        }
      ],
      // Only attach slides if the servant provided slides or slidesUrl
      slides: lesson?.slidesUrl ? [
        {
          number: 1,
          titleEn: lessonTitle,
          titleAr: lessonTitleAr,
          bulletsEn: [lessonSummary, lesson?.grade || 'Class Lesson'],
          bulletsAr: [lessonSummaryAr, lesson?.grade || 'درس المرحلة الدراسية'],
          speakerNotesEn: 'Guide the children through the key points of the lesson.',
          speakerNotesAr: 'توجيه الأولاد للتأمل في النقاط الروحية للدرس.'
        }
      ] : [],
      flashcards: [],
      quizDraft: generatedQuiz
    };
  }, [lesson, versions, isOnlineAuth, lessonId]);

  if (!lesson) {
    return (
      <div className="min-h-[50vh] flex flex-col items-center justify-center p-6 text-center space-y-4">
        <BookOpen className="w-12 h-12 text-gray-400" />
        <h2 className="text-lg font-bold text-gray-800">
          {lang === 'ar' ? 'الدرس غير موجود' : 'Lesson not found'}
        </h2>
        <button
          onClick={onBack}
          className="px-4 py-2 rounded-xl bg-[var(--color-church-blue)] text-white text-xs font-bold"
        >
          {lang === 'ar' ? 'الرجوع للدروس' : 'Back to Lessons'}
        </button>
      </div>
    );
  }

  const activeSources = (lessonSources || []).filter(s => s.lessonId === lessonId);
  const userProgressKey = `${currentStudentId}_${lessonId}`;
  const currentProgress = studentProgress ? studentProgress[userProgressKey] : undefined;
  const userQuizAttempts = (quizAttempts && quizAttempts[userProgressKey]) || [];
  const currentMastery = studentMasteries ? studentMasteries[userProgressKey] : undefined;

  useEffect(() => {
    if (activePublishedVersion && !isGuest && userData) {
      startLessonProgress({
        lessonId,
        versionId: activePublishedVersion.id,
        studentId: currentStudentId
      }).then(({ data }) => {
        if (data && data.sectionsCompleted) {
          updateStudentContentProgress(currentStudentId, lessonId, data.sectionsCompleted, data.completionPercent);
        }
      });

      getStudentMastery(lessonId, currentStudentId, activePublishedVersion.id).then(({ data }) => {
        if (data) {
          setStudentMastery(
            currentStudentId,
            lessonId,
            data.status,
            data.evaluatedBy || 'Automated Curriculum Engine',
            data.teacherNotes
          );
        }
      });
    }
  }, [lessonId, activePublishedVersion?.id, isGuest, userData?.id, currentStudentId]);

  // Quiz View Mode: Render Tiered Sunday School Quiz View
  if (isTakingQuiz && activePublishedVersion.quizDraft) {
    return (
      <div className="px-4 pt-4 pb-20">
        <SundaySchoolQuizView
          quiz={activePublishedVersion.quizDraft}
          lessonId={lessonId}
          studentId={currentStudentId}
          onBackToLesson={() => setIsTakingQuiz(false)}
          onSubmitAttempt={async (attempt) => {
            if (activePublishedVersion) {
              const { data } = await submitStudentQuizAttempt({
                lessonId,
                versionId: activePublishedVersion.id,
                quizId: attempt.quizId,
                answers: attempt.answers.map(a => ({
                  questionId: a.questionId,
                  selectedOptionIndex: a.selectedOptionIndex
                })),
                score: attempt.score,
                percentage: attempt.percentage,
                earnedPoints: attempt.earnedPoints,
                totalPointsPossible: attempt.totalPointsPossible
              });
              if (data) {
                recordQuizAttempt(data);
              }

              // Evaluate student mastery after quiz attempt
              const masteryRes = await evaluateStudentMastery({
                lessonId,
                versionId: activePublishedVersion.id,
                studentId: currentStudentId
              });
              if (masteryRes.data) {
                setStudentMastery(
                  currentStudentId,
                  lessonId,
                  masteryRes.data.status,
                  masteryRes.data.evaluatedBy || 'Automated Curriculum Engine',
                  masteryRes.data.teacherNotes
                );
              }
            } else {
              recordQuizAttempt(attempt);
            }

            const pointsToAdd = attempt.earnedPoints || (attempt.score * 20);
            if (userData && pointsToAdd > 0) {
              try {
                await addPoints(pointsToAdd);
              } catch (e) {
                console.warn(e);
              }
            }
          }}
          onReviewSection={(secId) => {
            setTargetSectionId(secId);
            setIsTakingQuiz(false);
          }}
        />
      </div>
    );
  }

  // Playful Rich Student Lesson Story Reader Mode
  return (
    <div className="px-4 pt-4 pb-20">
      <SundaySchoolLessonView
        lesson={lesson}
        version={activePublishedVersion}
        sources={activeSources}
        progress={currentProgress}
        quizAttempts={userQuizAttempts}
        mastery={currentMastery}
        onBack={onBack}
        lang={lang}
        isOnlineAuth={isOnlineAuth}
        targetSectionId={targetSectionId}
        onMarkSectionRead={async (sectionId, totalSections) => {
          const existingSections = currentProgress?.sectionsCompleted || [];
          const newSections = existingSections.includes(sectionId)
            ? existingSections
            : [...existingSections, sectionId];
          const pct = Math.round((newSections.length / totalSections) * 100);
          updateStudentContentProgress(currentStudentId, lessonId, newSections, pct);

          if (activePublishedVersion) {
            const { data } = await completeSectionProgress({
              lessonId,
              versionId: activePublishedVersion.id,
              sectionId,
              studentId: currentStudentId
            });
            if (data) {
              updateStudentContentProgress(currentStudentId, lessonId, data.sectionsCompleted, data.completionPercent);
            }
          }
        }}
        onCompleteContent={async () => {
          if (!activePublishedVersion) return;
          const allSecIds = (activePublishedVersion.sections || []).map(s => s.id);
          const currentSections = currentProgress?.sectionsCompleted || [];
          if (currentSections.length < allSecIds.length) {
            return;
          }
          updateStudentContentProgress(currentStudentId, lessonId, allSecIds, 100);
          markCompleted(lessonId);

          await completeLessonProgress({
            lessonId,
            versionId: activePublishedVersion.id,
            studentId: currentStudentId
          });

          // Automatically evaluate mastery after lesson content complete
          const masteryRes = await evaluateStudentMastery({
            lessonId,
            versionId: activePublishedVersion.id,
            studentId: currentStudentId
          });
          if (masteryRes.data) {
            setStudentMastery(
              currentStudentId,
              lessonId,
              masteryRes.data.status,
              masteryRes.data.evaluatedBy || 'Automated Curriculum Engine',
              masteryRes.data.teacherNotes
            );
          }

          if (userData) {
            try {
              await addPoints(50);
            } catch (e) {
              console.warn(e);
            }
          }
        }}
        onStartQuiz={() => {
          setTargetSectionId(undefined);
          setIsTakingQuiz(true);
        }}
      />
    </div>
  );
}
