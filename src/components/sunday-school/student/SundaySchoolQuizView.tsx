import React, { useState } from 'react';
import { 
  HelpCircle, 
  CheckCircle2, 
  XCircle, 
  RotateCcw, 
  ArrowLeft, 
  Award, 
  Bookmark, 
  ExternalLink,
  ChevronRight,
  Sparkles
} from 'lucide-react';
import { QuizDraft, StudentQuizAttempt, QuizAnswer } from '../../../types';

interface SundaySchoolQuizViewProps {
  quiz: QuizDraft;
  lessonId: string;
  studentId: string;
  onBackToLesson: () => void;
  onSubmitAttempt: (attempt: Omit<StudentQuizAttempt, 'id' | 'attemptedAt'>) => void;
  onReviewSection: (sectionId: string) => void;
}

export const SundaySchoolQuizView: React.FC<SundaySchoolQuizViewProps> = ({
  quiz,
  lessonId,
  studentId,
  onBackToLesson,
  onSubmitAttempt,
  onReviewSection
}) => {
  const [currentQuestionIndex, setCurrentQuestionIndex] = useState<number>(0);
  const [selectedAnswers, setSelectedAnswers] = useState<Record<string, number>>({});
  const [isSubmitted, setIsSubmitted] = useState<boolean>(false);
  const [showExplanation, setShowExplanation] = useState<boolean>(false);

  const questions = quiz.questions || [];
  const currentQuestion = questions[currentQuestionIndex];

  const handleSelectOption = (index: number) => {
    if (isSubmitted) return;
    setSelectedAnswers(prev => ({
      ...prev,
      [currentQuestion.id]: index
    }));
    setShowExplanation(true);
  };

  const handleNext = () => {
    setShowExplanation(false);
    if (currentQuestionIndex < questions.length - 1) {
      setCurrentQuestionIndex(currentQuestionIndex + 1);
    } else {
      finishQuiz();
    }
  };

  const finishQuiz = () => {
    let earnedPoints = 0;
    let totalPossiblePoints = 0;
    let correctCount = 0;

    const recordedAnswers: QuizAnswer[] = questions.map(q => {
      const qDiff = q.difficulty || 'EASY';
      const qPts = q.points || (qDiff === 'HARD' ? 30 : qDiff === 'MEDIUM' ? 20 : 10);
      totalPossiblePoints += qPts;

      const selected = selectedAnswers[q.id];
      const isCorrect = selected === q.correctIndex;
      if (isCorrect) {
        correctCount += 1;
        earnedPoints += qPts;
      }

      return {
        questionId: q.id,
        selectedOptionIndex: selected ?? -1,
        isCorrect,
        feedbackEn: isCorrect 
          ? (q.explanationEn || `Correct! +${qPts} points earned.`) 
          : `Review needed: ${q.explanationEn || 'See lesson text.'}`,
        feedbackAr: q.explanationAr,
        recommendedSectionId: q.sourceRef?.sectionId,
        recommendedSectionTitle: q.sourceRef?.sectionTitle
      };
    });

    const percentage = totalPossiblePoints > 0 
      ? Math.round((earnedPoints / totalPossiblePoints) * 100) 
      : Math.round((correctCount / questions.length) * 100);

    onSubmitAttempt({
      studentId,
      lessonId,
      quizId: quiz.id,
      score: earnedPoints,
      totalScore: totalPossiblePoints || questions.length,
      percentage,
      passed: percentage >= 70,
      answers: recordedAnswers
    });

    setIsSubmitted(true);
  };

  const handleRetake = () => {
    setSelectedAnswers({});
    setCurrentQuestionIndex(0);
    setIsSubmitted(false);
    setShowExplanation(false);
  };

  // Result Calculation
  let finalPoints = 0;
  let finalMaxPoints = 0;
  let finalCorrectCount = 0;
  questions.forEach(q => {
    const qDiff = q.difficulty || 'EASY';
    const qPts = q.points || (qDiff === 'HARD' ? 30 : qDiff === 'MEDIUM' ? 20 : 10);
    finalMaxPoints += qPts;
    if (selectedAnswers[q.id] === q.correctIndex) {
      finalCorrectCount += 1;
      finalPoints += qPts;
    }
  });
  const finalPercentage = finalMaxPoints > 0 
    ? Math.round((finalPoints / finalMaxPoints) * 100) 
    : Math.round((finalCorrectCount / questions.length) * 100);

  return (
    <div className="max-w-3xl mx-auto space-y-6 pb-16">
      {/* Top Header */}
      <div className="flex items-center justify-between gap-4">
        <button
          onClick={onBackToLesson}
          className="px-4 py-2 bg-[var(--mousa-cream-surface)] dark:bg-[#1E1914] hover:bg-[var(--mousa-sand-100)] text-[var(--mousa-teal-deep)] dark:text-[#FAF5EB] rounded-2xl text-xs font-black flex items-center gap-2 border-2 border-[var(--mousa-border-sand)] transition-all cursor-pointer shadow-2xs"
        >
          <ArrowLeft className="w-4 h-4" /> <span>Back to Lesson</span>
        </button>

        <div className="flex items-center gap-2">
          <span className="text-xs px-3.5 py-1 rounded-full bg-[var(--mousa-gold-soft)] text-[var(--mousa-gold-dark)] dark:text-[var(--mousa-gold-light)] border border-[var(--mousa-gold)]/30 font-bold">
            Journey Milestone Review Quiz
          </span>
        </div>
      </div>

      {/* Distinction Banner */}
      <div className="p-4 bg-[var(--mousa-sand-50)] dark:bg-stone-900 rounded-2xl border border-[var(--mousa-border-sand)] text-xs text-[var(--mousa-sand-600)] dark:text-[var(--mousa-sand-400)] space-y-1">
        <span className="font-black text-[var(--mousa-teal-deep)] dark:text-[#FAF5EB] block">
          Assessment & Practice:
        </span>
        <p>
          This review quiz checks your comprehension of the lesson taught in church. Earn blessing points and unlock your Journey of Moses milestone badge!
        </p>
      </div>

      {!isSubmitted ? (
        <div className="bg-[var(--mousa-cream-surface)] dark:bg-[#1E1914] border-2 border-[var(--mousa-border-sand)] rounded-3xl p-6 sm:p-8 space-y-6 shadow-sm">
          {/* Question Progress Counter with Difficulty Badge */}
          <div className="flex items-center justify-between text-xs flex-wrap gap-2">
            <div className="flex items-center gap-2">
              <span className="font-black text-[var(--mousa-gold)] uppercase tracking-wider">
                Question {currentQuestionIndex + 1} of {questions.length}
              </span>
              <span className={`px-2.5 py-0.5 rounded-full text-[11px] font-bold border font-mono ${
                (currentQuestion.difficulty || 'EASY') === 'HARD'
                  ? 'bg-rose-500/20 text-rose-700 dark:text-rose-300 border-rose-500/40'
                  : (currentQuestion.difficulty || 'EASY') === 'MEDIUM'
                  ? 'bg-[var(--mousa-gold-soft)] text-[var(--mousa-gold-dark)] border-[var(--mousa-gold)]/40'
                  : 'bg-emerald-500/20 text-emerald-800 dark:text-emerald-300 border-emerald-500/40'
              }`}>
                {(currentQuestion.difficulty || 'EASY') === 'HARD' ? '🔴 Hard • 30 pts (3x)' :
                 (currentQuestion.difficulty || 'EASY') === 'MEDIUM' ? '🟡 Medium • 20 pts (2x)' :
                 '🟢 Easy • 10 pts (1x)'}
              </span>
            </div>
            <div className="flex gap-1.5">
              {questions.map((_, i) => (
                <span
                  key={i}
                  className={`w-2.5 h-2.5 rounded-full ${
                    i === currentQuestionIndex 
                      ? 'bg-[var(--mousa-gold)]' 
                      : selectedAnswers[questions[i].id] !== undefined 
                      ? 'bg-[var(--mousa-teal)]' 
                      : 'bg-[var(--mousa-sand-200)] dark:bg-stone-800'
                  }`}
                />
              ))}
            </div>
          </div>

          {/* Question Text */}
          <div className="space-y-3">
            <h2 className="text-lg sm:text-xl font-black text-[var(--mousa-teal-deep)] dark:text-[#FAF5EB] font-serif leading-snug">
              {currentQuestion.questionEn}
            </h2>
            <h3 className="text-base text-[var(--mousa-gold-dark)] dark:text-[var(--mousa-gold-light)] font-sans font-bold leading-relaxed" dir="rtl">
              {currentQuestion.questionAr}
            </h3>
          </div>

          {/* Options */}
          <div className="space-y-3 pt-2">
            {currentQuestion.optionsEn.map((opt, oIdx) => {
              const isSelected = selectedAnswers[currentQuestion.id] === oIdx;
              const hasAnswered = selectedAnswers[currentQuestion.id] !== undefined;
              const isCorrectAnswer = oIdx === currentQuestion.correctIndex;

              return (
                <button
                  key={oIdx}
                  onClick={() => handleSelectOption(oIdx)}
                  disabled={hasAnswered}
                  className={`w-full p-4 rounded-2xl border-2 text-left transition-all flex items-center justify-between text-sm cursor-pointer ${
                    hasAnswered && isCorrectAnswer
                      ? 'bg-emerald-50 dark:bg-emerald-950/60 border-emerald-600 text-emerald-900 dark:text-emerald-100 font-bold'
                      : hasAnswered && isSelected && !isCorrectAnswer
                      ? 'bg-rose-50 dark:bg-rose-950/60 border-[var(--mousa-coral)] text-rose-950 dark:text-rose-100 font-medium'
                      : isSelected
                      ? 'bg-[var(--mousa-sand-100)] border-[var(--mousa-gold)] text-[var(--mousa-teal-deep)] font-bold'
                      : 'bg-[var(--mousa-cream)] dark:bg-stone-900/60 border-[var(--mousa-border-sand)] hover:border-[var(--mousa-gold)] text-[var(--mousa-teal-deep)] dark:text-[#FAF5EB]'
                  }`}
                >
                  <div className="space-y-1">
                    <span className="font-serif block">{opt}</span>
                    {currentQuestion.optionsAr && currentQuestion.optionsAr[oIdx] && (
                      <span className="text-xs text-stone-400 font-sans block" dir="rtl">
                        {currentQuestion.optionsAr[oIdx]}
                      </span>
                    )}
                  </div>

                  {hasAnswered && isCorrectAnswer && (
                    <CheckCircle2 className="w-5 h-5 text-emerald-400 shrink-0 ml-2" />
                  )}
                  {hasAnswered && isSelected && !isCorrectAnswer && (
                    <XCircle className="w-5 h-5 text-red-400 shrink-0 ml-2" />
                  )}
                </button>
              );
            })}
          </div>

          {/* Explanation Box (when option selected) */}
          {showExplanation && (
            <div className={`p-4 rounded-2xl border text-xs space-y-2 ${
              selectedAnswers[currentQuestion.id] === currentQuestion.correctIndex
                ? 'bg-emerald-950/40 border-emerald-800/60 text-emerald-200'
                : 'bg-red-950/40 border-red-800/60 text-red-200'
            }`}>
              <div className="flex items-center gap-1.5 font-bold">
                {selectedAnswers[currentQuestion.id] === currentQuestion.correctIndex ? (
                  <><CheckCircle2 className="w-4 h-4" /> Correct Answer!</>
                ) : (
                  <><XCircle className="w-4 h-4" /> Not quite right</>
                )}
              </div>
              <p className="font-serif leading-relaxed text-stone-200">
                {currentQuestion.explanationEn}
              </p>
              {currentQuestion.explanationAr && (
                <p className="font-sans leading-relaxed text-stone-300 pt-1 border-t border-stone-800" dir="rtl">
                  {currentQuestion.explanationAr}
                </p>
              )}
            </div>
          )}

          {/* Navigation Button */}
          <div className="pt-4 border-t border-stone-800 flex justify-end">
            <button
              onClick={handleNext}
              disabled={selectedAnswers[currentQuestion.id] === undefined}
              className="px-6 py-2.5 bg-amber-600 hover:bg-amber-500 disabled:opacity-40 text-white rounded-xl text-xs font-bold flex items-center gap-1.5 shadow-md transition-all active:scale-95"
            >
              <span>{currentQuestionIndex === questions.length - 1 ? 'Finish Assessment' : 'Next Question'}</span>
              <ChevronRight className="w-4 h-4" />
            </button>
          </div>
        </div>
      ) : (
        /* Results Screen */
        <div className="bg-stone-900 border border-stone-800 rounded-3xl p-8 space-y-6 shadow-2xl text-center">
          <div className="w-16 h-16 rounded-3xl bg-amber-600/20 border border-amber-500/40 flex items-center justify-center text-amber-400 mx-auto">
            <Award className="w-8 h-8" />
          </div>

          <div className="space-y-1">
            <h2 className="text-2xl font-bold text-white font-serif">Assessment Completed!</h2>
            <p className="text-xs text-stone-400">
              Your answers have been recorded for classroom review.
            </p>
          </div>

          {/* Big Score Box */}
          <div className="p-6 bg-stone-950 rounded-2xl border border-stone-800 max-w-sm mx-auto space-y-2">
            <div className="text-4xl font-extrabold font-mono text-amber-400">
              {finalPercentage}%
            </div>
            <p className="text-xs font-semibold text-amber-300">
              {finalPoints} / {finalMaxPoints} Points Earned
            </p>
            <p className="text-[11px] text-stone-400">
              {finalCorrectCount} of {questions.length} Questions Answered Correctly
            </p>
          </div>

          {/* Question Review & Targeted Section Jump Links */}
          <div className="space-y-3 text-left pt-4">
            <h3 className="text-xs font-bold uppercase tracking-wider text-stone-400">
              Targeted Review & Diagnostics
            </h3>

            {questions.map((q, idx) => {
              const selected = selectedAnswers[q.id];
              const isCorrect = selected === q.correctIndex;

              return (
                <div
                  key={q.id}
                  className={`p-4 rounded-xl border text-xs flex items-start justify-between gap-3 ${
                    isCorrect ? 'bg-stone-950/60 border-stone-800' : 'bg-amber-950/20 border-amber-900/60'
                  }`}
                >
                  <div className="space-y-1">
                    <div className="flex items-center gap-2">
                      <span className={`w-5 h-5 rounded-full flex items-center justify-center text-[10px] font-bold ${
                        isCorrect ? 'bg-emerald-950 text-emerald-400' : 'bg-red-950 text-red-400'
                      }`}>
                        {idx + 1}
                      </span>
                      <span className="font-semibold text-stone-200">{q.questionEn}</span>
                      <span className={`text-[10px] px-2 py-0.5 rounded-full font-mono shrink-0 ${
                        (q.difficulty || 'EASY') === 'HARD' ? 'bg-rose-950/60 text-rose-300 border border-rose-800' :
                        (q.difficulty || 'EASY') === 'MEDIUM' ? 'bg-amber-950/60 text-amber-300 border border-amber-800' :
                        'bg-emerald-950/60 text-emerald-300 border border-emerald-800'
                      }`}>
                        {q.difficulty || 'EASY'} ({q.points || ((q.difficulty === 'HARD') ? 30 : (q.difficulty === 'MEDIUM') ? 20 : 10)} pts)
                      </span>
                    </div>

                    {!isCorrect && q.explanationEn && (
                      <p className="text-amber-200/90 text-[11px] pl-7">
                        Key detail: {q.explanationEn}
                      </p>
                    )}
                  </div>

                  {!isCorrect && q.sourceRef?.sectionId && (
                    <button
                      onClick={() => onReviewSection(q.sourceRef!.sectionId)}
                      className="px-3 py-1.5 bg-amber-950 hover:bg-amber-900 text-amber-300 border border-amber-800 rounded-xl text-[11px] font-semibold flex items-center gap-1 shrink-0 transition-colors"
                    >
                      <span>Review Section</span>
                      <ExternalLink className="w-3 h-3" />
                    </button>
                  )}
                </div>
              );
            })}
          </div>

          {/* Action Buttons */}
          <div className="pt-4 border-t border-stone-800 flex items-center justify-center gap-3">
            <button
              onClick={handleRetake}
              className="px-4 py-2 bg-stone-800 hover:bg-stone-700 text-stone-300 rounded-xl text-xs font-semibold flex items-center gap-1.5 transition-colors"
            >
              <RotateCcw className="w-4 h-4" /> Retake Quiz
            </button>

            <button
              onClick={onBackToLesson}
              className="px-5 py-2 bg-amber-600 hover:bg-amber-500 text-white rounded-xl text-xs font-bold shadow-md transition-all active:scale-95"
            >
              Return to Lesson
            </button>
          </div>
        </div>
      )}
    </div>
  );
};
