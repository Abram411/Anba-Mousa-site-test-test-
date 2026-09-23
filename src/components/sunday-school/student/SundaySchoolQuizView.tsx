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
    let score = 0;
    const recordedAnswers: QuizAnswer[] = questions.map(q => {
      const selected = selectedAnswers[q.id];
      const isCorrect = selected === q.correctIndex;
      if (isCorrect) score += 1;

      return {
        questionId: q.id,
        selectedOptionIndex: selected ?? -1,
        isCorrect,
        feedbackEn: isCorrect 
          ? (q.explanationEn || 'Correct! Excellent job.') 
          : `Review needed: ${q.explanationEn || 'See lesson text.'}`,
        feedbackAr: q.explanationAr,
        recommendedSectionId: q.sourceRef?.sectionId,
        recommendedSectionTitle: q.sourceRef?.sectionTitle
      };
    });

    const percentage = Math.round((score / questions.length) * 100);

    onSubmitAttempt({
      studentId,
      lessonId,
      quizId: quiz.id,
      score,
      totalScore: questions.length,
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
  let finalScore = 0;
  questions.forEach(q => {
    if (selectedAnswers[q.id] === q.correctIndex) finalScore += 1;
  });
  const finalPercentage = Math.round((finalScore / questions.length) * 100);

  return (
    <div className="max-w-3xl mx-auto space-y-6 pb-16">
      {/* Top Header */}
      <div className="flex items-center justify-between gap-4">
        <button
          onClick={onBackToLesson}
          className="px-3 py-1.5 bg-stone-900 hover:bg-stone-800 text-stone-300 rounded-xl text-xs font-semibold flex items-center gap-1.5 border border-stone-800 transition-colors"
        >
          <ArrowLeft className="w-4 h-4" /> Back to Lesson
        </button>

        <div className="flex items-center gap-2">
          <span className="text-xs px-3 py-1 rounded-full bg-purple-950 text-purple-300 border border-purple-800 font-medium">
            Separate Review Assessment
          </span>
        </div>
      </div>

      {/* Distinction Banner */}
      <div className="p-4 bg-stone-900/90 rounded-2xl border border-stone-800 text-xs text-stone-400 space-y-1">
        <span className="font-semibold text-stone-200 block">
          Assessment & Practice Distinction:
        </span>
        <p>
          This review quiz checks your comprehension of the lesson taught in church. Quiz scores provide helpful practice, but your Sunday School servant personally reviews your lesson mastery.
        </p>
      </div>

      {!isSubmitted ? (
        <div className="bg-stone-900 border border-stone-800 rounded-3xl p-6 sm:p-8 space-y-6 shadow-2xl">
          {/* Question Progress Counter */}
          <div className="flex items-center justify-between text-xs">
            <span className="font-bold text-amber-500 uppercase tracking-wider">
              Question {currentQuestionIndex + 1} of {questions.length}
            </span>
            <div className="flex gap-1.5">
              {questions.map((_, i) => (
                <span
                  key={i}
                  className={`w-2.5 h-2.5 rounded-full ${
                    i === currentQuestionIndex 
                      ? 'bg-amber-500' 
                      : selectedAnswers[questions[i].id] !== undefined 
                      ? 'bg-purple-600' 
                      : 'bg-stone-800'
                  }`}
                />
              ))}
            </div>
          </div>

          {/* Question Text */}
          <div className="space-y-3">
            <h2 className="text-lg sm:text-xl font-bold text-white font-serif leading-snug">
              {currentQuestion.questionEn}
            </h2>
            <h3 className="text-base text-amber-300/90 font-sans leading-relaxed" dir="rtl">
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
                  className={`w-full p-4 rounded-2xl border text-left transition-all flex items-center justify-between text-sm ${
                    hasAnswered && isCorrectAnswer
                      ? 'bg-emerald-950/60 border-emerald-600 text-emerald-100 font-medium'
                      : hasAnswered && isSelected && !isCorrectAnswer
                      ? 'bg-red-950/60 border-red-600 text-red-100 font-medium'
                      : isSelected
                      ? 'bg-amber-950/60 border-amber-500 text-amber-100'
                      : 'bg-stone-950/80 border-stone-800 text-stone-300 hover:border-stone-700 hover:bg-stone-950'
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
            <p className="text-xs text-stone-300">
              {finalScore} of {questions.length} Questions Answered Correctly
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
