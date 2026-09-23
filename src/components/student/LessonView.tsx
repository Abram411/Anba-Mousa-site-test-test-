import React, { useState } from 'react';
import { ArrowLeft, Check, X, Star, Wand2 } from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';
import { mockLessons } from '../../data';
import { playSound } from '../../utils/audio';
import { useAuth } from '../../context/AuthContext';
import { useLessons } from '../../context/LessonsContext';
import { recordLessonProgress } from '../../lib/supabaseDatabase';
import { Language, LessonVersion, LessonSource, StudentContentProgress, StudentQuizAttempt, StudentMastery } from '../../types';
import { SundaySchoolLessonView } from '../sunday-school/student/SundaySchoolLessonView';
import { SundaySchoolQuizView } from '../sunday-school/student/SundaySchoolQuizView';

type QuizState = 'intro' | 'q1' | 'q2' | 'q3' | 'q4' | 'q5' | 'complete';

export function LessonView({ lessonId, onBack, lang = 'en' }: { lessonId: string, onBack: () => void, lang?: Language }) {
  const { userData, addPoints } = useAuth();
  const { 
    lessons, 
    markCompleted,
    lessonSources,
    lessonVersions,
    studentProgress,
    quizAttempts,
    studentMasteries,
    updateStudentContentProgress,
    recordQuizAttempt
  } = useLessons();

  const lesson = lessons.find(l => l.id === lessonId) || mockLessons.find(l => l.id === lessonId);
  const [step, setStep] = useState<QuizState>('intro');
  const [earnedPoints, setEarnedPoints] = useState(0);
  const [answers, setAnswers] = useState<{title: string, question: string, isCorrect: boolean, earned: number, selected: string, correct: string, aiFeedback?: string}[]>([]);
  const [reflectionText, setReflectionText] = useState("");
  const [isAnalyzing, setIsAnalyzing] = useState(false);

  // Sunday School Vertical Slice States
  const [isTakingQuiz, setIsTakingQuiz] = useState<boolean>(false);
  const [targetSectionId, setTargetSectionId] = useState<string | undefined>(undefined);

  if (!lesson) return <div>Lesson not found</div>;

  const currentStudentId = userData?.id || 'u1';
  const versions = lessonVersions[lessonId] || [];
  const latestApprovedVersion = versions.find(v => v.status === 'APPROVED') || versions[versions.length - 1];
  const activeSources = lessonSources.filter(s => s.lessonId === lessonId);
  const userProgressKey = `${currentStudentId}_${lessonId}`;
  const currentProgress = studentProgress[userProgressKey];
  const userQuizAttempts = quizAttempts[userProgressKey] || [];
  const currentMastery = studentMasteries[userProgressKey];

  // If Sunday School lesson version exists, render rich Sunday School experience
  if (latestApprovedVersion) {
    if (isTakingQuiz && latestApprovedVersion.quizDraft) {
      return (
        <div className="px-4 pt-4">
          <SundaySchoolQuizView
            quiz={latestApprovedVersion.quizDraft}
            lessonId={lessonId}
            studentId={currentStudentId}
            onBackToLesson={() => setIsTakingQuiz(false)}
            onSubmitAttempt={async (attempt) => {
              recordQuizAttempt(attempt);
              if (userData && attempt.score > 0) {
                try {
                  await addPoints(attempt.score * 20);
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

    return (
      <div className="px-4 pt-4">
        <SundaySchoolLessonView
          lesson={lesson}
          version={latestApprovedVersion}
          sources={activeSources}
          progress={currentProgress}
          quizAttempts={userQuizAttempts}
          mastery={currentMastery}
          onBack={onBack}
          targetSectionId={targetSectionId}
          onMarkSectionRead={(sectionId, totalSections) => {
            const existingSections = currentProgress?.sectionsCompleted || [];
            const newSections = existingSections.includes(sectionId)
              ? existingSections
              : [...existingSections, sectionId];
            const pct = Math.round((newSections.length / totalSections) * 100);
            updateStudentContentProgress(currentStudentId, lessonId, newSections, pct);
          }}
          onCompleteContent={async () => {
            const allSecIds = latestApprovedVersion.sections.map(s => s.id);
            updateStudentContentProgress(currentStudentId, lessonId, allSecIds, 100);
            markCompleted(lessonId);
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

  const handleAnswer = (title: string, question: string, selectedLabel: string, isCorrect: boolean, points: number, correctLabel: string, aiFeedback?: string) => {
    playSound(isCorrect ? 'success' : 'error');
    setAnswers(prev => [...prev, { title, question, isCorrect, earned: isCorrect ? points : 0, selected: selectedLabel, correct: correctLabel, aiFeedback }]);
    setEarnedPoints(prev => prev + (isCorrect ? points : 0));
    advanceStep();
  };

  const completeLesson = async () => {
     markCompleted(lessonId);
     if (userData && earnedPoints > 0) {
        try {
           await addPoints(earnedPoints);
           await recordLessonProgress(userData.id, lessonId, earnedPoints, earnedPoints, true);
        } catch(err) {
           console.error("Error saving points:", err);
        }
     }
     onBack();
  };

  const advanceStep = () => {
    const sequence: QuizState[] = ['intro', 'q1', 'q2', 'q3', 'q4', 'q5', 'complete'];
    const currentIndex = sequence.indexOf(step);
    if (currentIndex < sequence.length - 1) {
      if (sequence[currentIndex + 1] === 'complete') playSound('badge');
      setStep(sequence[currentIndex + 1]);
    }
  };

  const submitReflection = async () => {
    if (reflectionText.trim().length < 2) return;
    setIsAnalyzing(true);
    
    try {
       const res = await fetch('/api/grade-reflection', {
         method: 'POST',
         headers: { 'Content-Type': 'application/json' },
         body: JSON.stringify({ reflectionText, lessonTitle: lesson.title, lang })
       });
       
       if (!res.ok) throw new Error("Failed");
       
       const data = await res.json();
       
       setIsAnalyzing(false);
       handleAnswer(
         'Reflection', 
         lang === 'ar' ? 'ماذا تعلمت من القصة؟' : 'What did you learn from this story?', 
         reflectionText, 
         data.isGood, 
         data.isGood ? 40 : 10, 
         lang === 'ar' ? 'أي إجابة عميقة صحيحة!' : 'Any thoughtful answer is correct!', 
         data.feedback
       );
    } catch (err) {
       console.warn("Reflection evaluation fallback active:", err);
       setIsAnalyzing(false);
       
       // Fallback mock logic if API fails
       const isGood = reflectionText.length > 15;
       const feedback = isGood 
         ? (lang === 'ar' ? "تأمل ممتاز! لقد فهمت الرسالة بعمق." : "Great reflection! You really understood the core message.") 
         : (lang === 'ar' ? "إجابة قصيرة جداً. حاول أن تشرح أكثر ما تعلمته." : "A bit too short. Remember to explain how this applies to you.");
       
       handleAnswer('Reflection', lang === 'ar' ? 'ماذا تعلمت من القصة؟' : 'What did you learn from this story?', reflectionText, isGood, isGood ? 40 : 10, lang === 'ar' ? 'أي إجابة عميقة صحيحة!' : 'Any thoughtful answer is correct!', feedback);
    }
  };

  const renderContent = () => {
    switch (step) {
      case 'intro':
        return (
          <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} className="space-y-6">
            <h1 className="text-3xl font-bold text-[var(--color-church-blue)]">{lesson.title}</h1>
            <div className="bg-white p-6 rounded-3xl shadow-sm border border-[var(--color-church-cream-dark)] text-lg leading-relaxed text-gray-700">
              <p>{lesson.summary}</p>
              <p className="mt-6 font-bold text-[var(--color-church-burgundy)]">
                {lang === 'copt' 
                  ? 'Ⲁⲕⲥⲉⲃⲧⲱⲧ ⲉ̀ⲁⲣⲓϩⲏⲧⲥ ⲛ̀ϯⲇⲟⲕⲓⲙⲏ ⲟⲩⲟϩ ⲱⲗⲓ ⲛ̀ϩⲁⲛⲧⲁⲓⲟ;' 
                  : lang === 'ar' 
                    ? 'جاهز تبدأ وتحوش نقط؟' 
                    : 'Are you ready to test your knowledge and earn points?'}
              </p>
            </div>
            <motion.button 
              whileHover={{ scale: 1.05 }}
              whileTap={{ scale: 0.95 }}
              onClick={advanceStep}
              className="w-full bg-[var(--color-church-burgundy)] hover:bg-[#6e1623] text-white font-bold text-lg py-5 rounded-2xl shadow-xl transition-colors cursor-pointer"
            >
              {lang === 'copt' ? 'Ⲁⲣⲓϩⲏⲧⲥ ⲛ̀ϯⲇⲟⲕⲓⲙⲏ' : lang === 'ar' ? 'ابدأ الاختبار' : 'Start Quiz'}
            </motion.button>
          </motion.div>
        );
      
      case 'q1': // Recall
        return <QuizQuestion 
          title={lang === 'copt' ? 'Ⲡⲓϣⲓⲛⲓ ⲁ̅' : lang === 'ar' ? 'السؤال 1' : 'Question 1'}
          points={10}
          question={`Where did ${lesson.title.includes('Mina') ? 'St. Mina' : 'Noah'} live?`}
          options={[
            { label: 'Egypt', isCorrect: lesson.title.includes('Mina') },
            { label: 'Mesopotamia', isCorrect: !lesson.title.includes('Mina') },
            { label: 'Greece', isCorrect: false }
          ]}
          onAnswer={handleAnswer}
        />;
        
      case 'q2': // Understanding
        return <QuizQuestion 
          title={lang === 'copt' ? 'Ⲡⲓϣⲓⲛⲓ ⲃ̅' : lang === 'ar' ? 'السؤال 2' : 'Question 2'}
          points={30}
          question={lang === 'copt' ? 'Ⲉⲑⲃⲉ ⲟⲩ ⲟⲩⲛⲓϣϯ ⲧⲉ ⲧⲁⲓⲥⲧⲟⲣⲓⲁ;' : lang === 'ar' ? 'لماذا هذه القصة مهمة؟' : `Why is this story important?`}
          options={[
            { label: lang === 'copt' ? 'Ⲥϯⲥⲃⲱ ⲉ̀ⲛⲁϩϯ ⲉ̀Ⲫϯ' : lang === 'ar' ? 'تعلمنا أن نثق بالله' : 'It teaches us to trust God', isCorrect: true },
            { label: lang === 'copt' ? 'Ⲥϯⲥⲃⲱ ⲉ̀ⲑⲁⲙⲓⲟ ⲛ̀ϩⲁⲛϫⲟⲓ' : lang === 'ar' ? 'تعلمنا بناء السفن' : 'It teaches us to build boats', isCorrect: false }
          ]}
          onAnswer={handleAnswer}
        />;

      case 'q3': // Reflection with AI simulated check
        return (
          <motion.div initial={{ opacity: 0, scale: 0.9 }} animate={{ opacity: 1, scale: 1 }} className="space-y-6">
            <div className="flex justify-between items-center text-[var(--color-church-gold)] font-bold bg-white px-4 py-2 rounded-full shadow-sm">
              <span>{lang === 'copt' ? 'Ⲙⲉⲩⲓ (Ⲥϧⲁⲓ)' : lang === 'ar' ? 'تأمل (كتابة)' : 'Reflection'}</span>
              <span>40 pts</span>
            </div>
            <h2 className="text-2xl font-bold text-[var(--color-church-blue)]">{lang === 'copt' ? 'Ⲟⲩ ⲡⲉⲧⲁⲕⲧⲥⲁⲃⲟ ⲉ̀ⲃⲟⲗ ϧⲉⲛ ϯⲥⲧⲟⲣⲓⲁ;' : lang === 'ar' ? 'ماذا تعلمت من القصة؟' : 'What did you learn from this story?'}</h2>
            
            <div className="relative">
              <textarea 
                className="w-full bg-white border-2 border-[var(--color-church-cream-dark)] rounded-3xl p-6 h-40 focus:border-[var(--color-church-burgundy)] focus:ring-4 focus:ring-red-100 outline-none resize-none text-lg transition-all"
                placeholder={lang === 'copt' ? 'Ⲥϧⲁⲓ ⲡⲉⲕⲉⲣⲟⲩⲱ ⲙ̀ⲡⲁⲓⲙⲁ...' : lang === 'ar' ? 'اكتب إجابتك هنا...' : 'Type your answer here...'}
                value={reflectionText}
                onChange={(e) => setReflectionText(e.target.value)}
                disabled={isAnalyzing}
              />
              <AnimatePresence>
                {isAnalyzing && (
                  <motion.div 
                    initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
                    className="absolute inset-0 bg-white/90 backdrop-blur-sm rounded-3xl flex flex-col items-center justify-center text-[var(--color-church-blue)]"
                  >
                    <motion.div animate={{ rotate: 360 }} transition={{ repeat: Infinity, duration: 2, ease: "linear" }}>
                      <Wand2 size={40} className="text-[var(--color-church-gold)] mb-4" />
                    </motion.div>
                    <p className="font-bold text-lg animate-pulse">{lang === 'copt' ? 'Ⲡⲓⲥⲁϧ ⲛ̀ⲥⲁⲃⲉ ⲱϣ ⲙ̀ⲡⲉⲕⲉⲣⲟⲩⲱ...' : lang === 'ar' ? 'المعلم الذكي يقرأ إجابتك...' : 'AI is reading your answer...'}</p>
                  </motion.div>
                )}
              </AnimatePresence>
            </div>
            
            <motion.button 
              whileHover={{ scale: 1.05 }}
              whileTap={{ scale: 0.95 }}
              onClick={submitReflection}
              disabled={isAnalyzing || reflectionText.length === 0}
              className="w-full bg-[var(--color-church-burgundy)] disabled:bg-gray-300 disabled:text-gray-500 text-white font-bold text-xl py-5 rounded-2xl shadow-xl transition-all"
            >
              {lang === 'copt' ? 'Ⲧⲁϫⲣⲟ ⲙ̀ⲡⲓⲉⲣⲟⲩⲱ' : lang === 'ar' ? 'تأكيد الإجابة' : 'Submit Answer'}
            </motion.button>
          </motion.div>
        );

      case 'q4': // Skipping sequencing/matching for briefness in this mock
      case 'q5':
        return (
          <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="space-y-6 text-center py-20">
            <motion.div 
              animate={{ rotate: 360, scale: [1, 1.2, 1] }} 
              transition={{ repeat: Infinity, duration: 2 }}
              className="text-[var(--color-church-gold)] mx-auto w-16 h-16 flex items-center justify-center"
            >
              <Star size={64} fill="currentColor" />
            </motion.div>
            <h2 className="text-2xl font-bold text-[var(--color-church-blue)]">{lang === 'copt' ? 'ⲥⲉⲥⲟⲃϯ ⲙ̀ⲡⲓⲕⲉⲇⲟⲕⲓⲙⲏ...' : lang === 'ar' ? 'جاري التحميل...' : 'Loading next challenge...'}</h2>
            {setTimeout(advanceStep, 800) && null}
          </motion.div>
        );

      case 'complete':
        return (
          <motion.div initial={{ scale: 0.8, opacity: 0 }} animate={{ scale: 1, opacity: 1 }} transition={{ type: "spring", bounce: 0.5 }} className="space-y-6 pb-10">
            <div className="text-center">
               <motion.div 
                 initial={{ y: -50 }} animate={{ y: 0 }} transition={{ type: "spring", bounce: 0.7 }}
                 className="w-32 h-32 bg-[var(--color-church-gold)] rounded-full mx-auto flex items-center justify-center shadow-xl shadow-[var(--color-church-gold)]/40 mb-6"
               >
                  <Star size={64} className="text-white" fill="currentColor" />
               </motion.div>
               <h2 className="text-4xl font-bold text-[var(--color-church-blue)] mb-2">{lang === 'copt' ? 'Ϩⲱⲃ ⲉⲛⲉⲥⲱϥ!' : lang === 'ar' ? 'عمل رائع!' : 'Awesome Job!'}</h2>
               <p className="text-[var(--color-church-burgundy)] font-bold text-3xl">+{earnedPoints} {lang === 'copt' ? 'ⲛ̀ⲧⲁⲓⲟ' : lang === 'ar' ? 'نقطة' : 'Points'}</p>
            </div>
            
            <div className="bg-white rounded-3xl p-6 shadow-sm border border-[var(--color-church-cream-dark)] space-y-5">
              <h3 className="font-bold text-[var(--color-church-blue)] border-b border-gray-100 pb-3 text-lg">{lang === 'copt' ? 'Ⲧⲁϫⲣⲟ ⲛ̀ⲛⲉⲕⲉⲣⲟⲩⲱ' : lang === 'ar' ? 'مراجعة الإجابات' : 'Your Answers Review'}</h3>
              {answers.map((ans, i) => (
                 <div key={i} className="space-y-2 pb-4 border-b border-gray-50 last:border-0 last:pb-0">
                   <p className="font-bold text-[var(--color-church-blue)] text-sm">{ans.question}</p>
                   
                   {ans.isCorrect ? (
                     <div className="bg-green-50 text-green-700 p-3 rounded-xl border border-green-100">
                       <p className="flex items-center gap-2 font-bold"><Check size={18}/> {ans.selected}</p>
                       <p className="text-xs font-bold text-green-600 mt-1">+{ans.earned} pts</p>
                     </div>
                   ) : (
                     <div className="bg-red-50 p-4 rounded-xl border border-red-100">
                        <p className="text-[var(--color-church-burgundy)] flex items-center gap-2 font-bold line-through"><X size={18}/> {ans.selected}</p>
                        <p className="text-gray-800 text-sm mt-3 font-medium bg-white p-2 rounded-lg border border-red-100">
                          {lang === 'copt' ? 'Ⲡⲓⲉⲣⲟⲩⲱ ⲉⲧⲥⲟⲩⲧⲱⲛ:' : lang === 'ar' ? 'الإجابة الصحيحة:' : 'Correct answer:'} <span className="font-bold text-green-600 ml-1">{ans.correct}</span>
                        </p>
                        <p className="text-xs text-gray-500 mt-3 flex items-center gap-1 font-bold">
                          {lang === 'copt' ? 'Ⲙⲡⲉⲣⲉⲣϩⲟϯ! Ⲙⲟϣⲓ ⲉ̀ⲃⲟⲗ ϧⲉⲛ ϯⲥⲃⲱ. Ⲫϯ ⲙⲉⲓ ⲙ̀ⲡⲉⲕϧⲓⲥⲓ. 🙏' : lang === 'ar' ? 'لا تقلق، استمر في التعلم! الله يحب مجهودك. 🙏' : "Don't worry, keep learning! God loves your effort. 🙏"}
                        </p>
                     </div>
                   )}
                   
                   {/* Display AI Feedback if present */}
                   {ans.aiFeedback && (
                      <div className="bg-blue-50 border border-blue-100 p-3 rounded-xl mt-2 flex gap-3 items-start">
                         <Wand2 size={16} className="text-[var(--color-church-blue)] shrink-0 mt-0.5" />
                         <p className="text-sm font-medium text-[var(--color-church-blue)]">{ans.aiFeedback}</p>
                      </div>
                   )}
                 </div>
              ))}
            </div>
            
            <motion.button 
              whileHover={{ scale: 1.05 }}
              whileTap={{ scale: 0.95 }}
              onClick={completeLesson}
              className="w-full bg-[var(--color-church-burgundy)] hover:bg-[#6e1623] text-white font-bold text-xl py-5 rounded-2xl shadow-xl cursor-pointer"
            >
              {lang === 'copt' ? 'Ⲱⲗⲓ ⲛ̀ⲛⲓⲧⲁⲓⲟ ⲟⲩⲟϩ ⲕⲟⲧⲕ' : lang === 'ar' ? 'اجمع النقاط وعُد للدروس' : 'Collect Points & Return'}
            </motion.button>
          </motion.div>
        );
    }
  };

  return (
    <div className="min-h-screen bg-[var(--color-church-cream)] p-4 md:p-8 pb-24 relative overflow-hidden">
      {/* Background decoration */}
      <div className="absolute top-0 left-0 w-full h-64 bg-gradient-to-b from-white/60 to-transparent pointer-events-none" />
      
      <div className="max-w-7xl mx-auto w-full relative z-10">
        <button onClick={onBack} className="p-3 mb-6 bg-white hover:bg-gray-50 rounded-full shadow-md text-[var(--color-church-blue)] transition-colors">
          <ArrowLeft size={24} />
        </button>
        
        <div className="max-w-md md:max-w-2xl mx-auto">
          <AnimatePresence mode="wait">
            <motion.div key={step}>
              {renderContent()}
            </motion.div>
          </AnimatePresence>
        </div>
      </div>
    </div>
  );
}

function QuizQuestion({ title, points, question, options, onAnswer }: any) {
  const correctOption = options.find((o:any) => o.isCorrect)?.label || '';
  return (
    <motion.div initial={{ opacity: 0, x: 50 }} animate={{ opacity: 1, x: 0 }} exit={{ opacity: 0, x: -50 }} className="space-y-6">
      <div className="flex justify-between items-center bg-white px-4 py-2 rounded-full shadow-sm text-[var(--color-church-burgundy)] font-bold">
        <span>{title}</span>
        <span>{points} pts</span>
      </div>
      
      <h2 className="text-3xl font-bold text-[var(--color-church-blue)] leading-tight">{question}</h2>
      
      <div className="space-y-4 mt-8">
        {options.map((opt: any, i: number) => (
          <motion.button 
            whileHover={{ scale: 1.02 }}
            whileTap={{ scale: 0.95 }}
            key={i}
            onClick={() => onAnswer(title, question, opt.label, opt.isCorrect, points, correctOption)}
            className="w-full bg-white border-2 border-[var(--color-church-cream-dark)] hover:border-[var(--color-church-burgundy)] text-[var(--color-church-blue)] font-bold text-xl py-6 px-6 rounded-2xl text-left shadow-sm transition-colors"
          >
            {opt.label}
          </motion.button>
        ))}
      </div>
    </motion.div>
  );
}
