import React from 'react';
import { Flame, Medal, ChevronRight, Play, Cross, Palette, Sparkles, BookOpen, ShieldCheck } from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';
import { mockLessons } from '../../data';
import { BibleVerseCard } from '../shared/BibleVerseCard';
import { FamilyAltarCard } from './FamilyAltarCard';
import { useAuth } from '../../context/AuthContext';
import { useStage } from '../../context/StageContext';
import { getUserRank } from '../../lib/pointsService';
import { Language } from '../../types';
import { CopticCard } from '../design-system/CopticCard';
import { CopticBadge } from '../design-system/CopticBadge';
import { CopticButton } from '../design-system/CopticButton';

interface HomeTabProps {
  onNavigate: (tab: string, lessonId?: string) => void;
  onOpenTeacherStudio?: () => void;
  onOpenParentPortal?: () => void;
  lang: Language;
}

export function HomeTab({ onNavigate, onOpenTeacherStudio, onOpenParentPortal, lang }: HomeTabProps) {
  const { userData } = useAuth();
  const { currentStage } = useStage();
  const nextLesson = mockLessons.find(l => !l.isCompleted);
  const userRank = userData ? getUserRank(userData.id, userData) : null;

  if (!userData) return null;

  const isCoptic = lang === 'copt' || lang === 'cop';
  const isTeacher = userData.role === 'teacher';
  const isParent = userData.role === 'parent';

  return (
    <motion.div 
      initial={{ opacity: 0, y: 15 }} 
      animate={{ opacity: 1, y: 0 }} 
      exit={{ opacity: 0, y: -15 }}
      transition={{ duration: 0.3 }}
      className="pb-24 pt-6 px-4 w-full max-w-7xl mx-auto space-y-6"
    >
      {/* Header */}
      <motion.div 
        initial={{ y: -20, opacity: 0 }} 
        animate={{ y: 0, opacity: 1 }} 
        exit={{ y: -10, opacity: 0 }}
        transition={{ duration: 0.25, delay: 0.05 }} 
        className="flex justify-between items-center"
      >
        <div>
          <div className="flex flex-wrap items-center gap-2">
            <h1 className="text-2xl font-bold text-[var(--color-church-blue)] md:text-3xl">
              {isCoptic ? 'Ⲭⲉⲣⲉ' : lang === 'ar' ? 'أهلاً' : 'Hi'}, {userData.fullName.split(' ')[0]} 👋
            </h1>
            {isTeacher && (
              <span className="text-xs bg-amber-100 dark:bg-amber-950 text-amber-900 dark:text-amber-200 border border-amber-300 dark:border-amber-800 font-bold px-2 py-0.5 rounded-full">
                {isCoptic ? '⛪ Ⲡⲓⲇⲓⲁⲕⲟⲛ' : lang === 'ar' ? '⛪ خادم كنسي' : '⛪ Servant'}
              </span>
            )}
            {isParent && (
              <span className="text-xs bg-emerald-100 dark:bg-emerald-950 text-emerald-900 dark:text-emerald-200 border border-emerald-300 dark:border-emerald-800 font-bold px-2 py-0.5 rounded-full">
                {isCoptic ? '👨‍👩‍👧 Ⲡⲓⲓⲱⲧ' : lang === 'ar' ? '👨‍👩‍👧 ولي أمر' : '👨‍👩‍👧 Parent'}
              </span>
            )}
            {currentStage && (
              <span className="text-xs bg-blue-100 dark:bg-blue-950 text-blue-900 dark:text-blue-200 border border-blue-300 dark:border-blue-800 font-bold px-2.5 py-0.5 rounded-full flex items-center gap-1">
                <span>{currentStage.icon}</span>
                <span>{lang === 'ar' ? currentStage.nameAr : currentStage.nameEn}</span>
              </span>
            )}
          </div>
          <p className="text-[var(--color-church-burgundy)] dark:text-amber-300 font-bold md:text-lg mt-0.5">
            {isTeacher 
              ? (isCoptic ? 'Ⲡⲓⲥⲙⲟⲩ ⲛ̀ⲧⲉ ϯⲇⲓⲁⲕⲟⲛⲓⲁ ⲛⲉⲙⲁⲕ ⲙ̀ⲫⲟⲟⲩ' : lang === 'ar' ? 'بركة الخدمة والتعليم معك اليوم' : 'Blessings on your ministry & teaching today')
              : (isCoptic ? 'Ⲁⲕⲥⲉⲃⲧⲱⲧ ⲉ̀ⲡⲓⲙⲱⲓⲧ ⲛ̀ⲧⲉ ⲡⲓⲛⲁϩϯ ⲙ̀ⲫⲟⲟⲩ;' : lang === 'ar' ? 'مستعد لرحلة الإيمان والتعلم اليوم؟' : 'Ready for your journey of faith today?')}
          </p>
        </div>
        <img src={userData.avatarUrl} alt="Avatar" className="w-12 h-12 md:w-16 md:h-16 rounded-full border-2 border-[var(--color-church-gold)] bg-white shadow-sm object-cover" />
      </motion.div>

      {/* Trilingual Design System & Coptic Language Lab Showcase Banner */}
      <CopticCard variant="sacred" padding="md" className="shadow-xs hover:border-[var(--brand-gold)] transition-colors">
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
          <div className="space-y-1">
            <div className="flex items-center gap-2">
              <span className="text-xl">☦</span>
              <CopticBadge variant="burgundy" size="sm">Trilingual Architecture</CopticBadge>
              <CopticBadge variant="gold" size="sm">Bohairic Standard</CopticBadge>
            </div>
            <h2 className="text-lg sm:text-xl font-bold text-[var(--brand-burgundy)] dark:text-[var(--brand-gold)]">
              {isCoptic
                ? 'Ⲡⲓⲥⲩⲥⲧⲏⲙⲁ ⲛ̀ⲧⲉ ⲡⲓⲥⲙⲟⲧ ⲛ̀ⲣⲉⲙⲛ̀ⲭⲏⲙⲓ'
                : lang === 'ar'
                  ? 'نظام التصميم القبطي والمختبر اللغوي'
                  : 'Coptic Orthodox Design System & Language Lab'}
            </h2>
            <p className="text-xs text-[var(--color-neutral)] max-w-xl">
              {isCoptic
                ? 'Ⲭⲣⲱⲙⲁ ⲛ̀ⲧⲉ ϯⲉⲕⲕⲗⲏⲥⲓⲁ, ⲛⲓⲥϧⲁⲓ ⲉⲑⲟⲩⲁⲃ, ⲛⲉⲙ ⲡⲓⲱϣ ⲛ̀ⲅⲁⲙⲧ ⲛ̀ⲁⲥⲡⲓ (English, العربية, Ⲙⲉⲑⲣⲉⲙⲛ̀ⲭⲏⲙⲓ).'
                : lang === 'ar'
                  ? 'ألوان كنسية موثقة، تدرجات طباعية مقدسة، ومحرك قراءة ثلاثي اللغات مع فحص جودة الترجمة القبطية.'
                  : 'Authentic liturgical palette, sacred/UI dual typography roles, trilingual scripture reader, and Bohairic QA registry.'}
            </p>
          </div>

          <div className="flex items-center gap-2 flex-wrap shrink-0">
            <CopticButton
              variant="primary"
              size="sm"
              icon={<Palette size={15} />}
              onClick={() => onNavigate('designSystem')}
            >
              {isCoptic ? 'Ⲡⲓⲥⲙⲟⲧ' : lang === 'ar' ? 'نظام التصميم' : 'Design System'}
            </CopticButton>
            <CopticButton
              variant="outline"
              size="sm"
              icon={<ShieldCheck size={15} />}
              onClick={() => onNavigate('localizationQa')}
            >
              {isCoptic ? 'Ⲡⲓϫⲱⲕ' : lang === 'ar' ? 'جودة الترجمة' : 'Coptic QA'}
            </CopticButton>
          </div>
        </div>
      </CopticCard>

      {/* Quick Role Privilege Cards for Teachers / Parents */}
      {(isTeacher || isParent) && (
        <motion.div 
          initial={{ opacity: 0, scale: 0.95 }} 
          animate={{ opacity: 1, scale: 1 }} 
          exit={{ opacity: 0, scale: 0.95 }}
          transition={{ duration: 0.25, delay: 0.1 }}
          className="grid grid-cols-1 sm:grid-cols-2 gap-3"
        >
          {isTeacher && onOpenTeacherStudio && (
            <div className="bg-amber-50 dark:bg-amber-950/40 border border-[var(--color-church-gold)]/40 rounded-2xl p-4 flex items-center justify-between shadow-2xs">
              <div className="flex items-center gap-3">
                <span className="text-2xl p-2 bg-white dark:bg-slate-800 rounded-xl shadow-2xs">⛪</span>
                <div>
                  <h4 className="font-bold text-xs sm:text-sm text-amber-950 dark:text-amber-200">
                    {lang === 'copt' ? 'Ⲡⲓⲙⲁⲛ̀ⲥⲃⲱ ⲛ̀ⲧⲉ ⲡⲓⲇⲓⲁⲕⲟⲛ' : lang === 'ar' ? 'استوديو الخادم والذكاء الاصطناعي' : 'Servant AI Curriculum Studio'}
                  </h4>
                  <p className="text-[11px] text-amber-800 dark:text-amber-300">
                    {lang === 'copt' ? 'Ⲑⲁⲙⲓⲟ ⲛ̀ⲛⲓⲥⲃⲱ ⲛⲉⲙ ⲛⲓⲇⲟⲕⲓⲙⲏ' : lang === 'ar' ? 'تحضير الدروس، الاختبارات والإشراف' : 'Generate lessons, edit quizzes & moderate'}
                  </p>
                </div>
              </div>
              <button 
                onClick={onOpenTeacherStudio}
                className="px-3 py-1.5 rounded-xl bg-[var(--color-church-gold)] hover:opacity-90 text-[var(--color-church-blue)] font-extrabold text-xs shadow-xs transition-all cursor-pointer shrink-0"
              >
                {lang === 'copt' ? 'Ϣⲉ ⲉ̀ϧⲟⲩⲛ' : lang === 'ar' ? 'دخول الاستوديو' : 'Launch Studio'}
              </button>
            </div>
          )}

          {(isParent || isTeacher) && onOpenParentPortal && (
            <div className="bg-rose-50 dark:bg-slate-900 border border-[var(--color-church-burgundy)]/30 rounded-2xl p-4 flex items-center justify-between shadow-2xs">
              <div className="flex items-center gap-3">
                <span className="text-2xl p-2 bg-white dark:bg-slate-800 rounded-xl shadow-2xs">👨‍👩‍👧</span>
                <div>
                  <h4 className="font-bold text-xs sm:text-sm text-[var(--color-church-burgundy)] dark:text-rose-300">
                    {lang === 'copt' ? 'Ⲡⲓⲡⲩⲗⲏ ⲛ̀ⲧⲉ ⲛⲓⲓⲟϯ' : lang === 'ar' ? 'بوابة متابعة الأبناء' : 'Parent Portal & Child Tracking'}
                  </h4>
                  <p className="text-[11px] text-gray-600 dark:text-gray-400">
                    {lang === 'copt' ? 'Ⲛⲓⲁⲗⲱⲟⲩⲓ ⲛⲉⲙ ⲡⲟⲩⲧⲁⲓⲟ' : lang === 'ar' ? 'أوقات الشاشة، الحضور، وموافقة الجوائز' : 'Screen time, attendance & reward approvals'}
                  </p>
                </div>
              </div>
              <button 
                onClick={onOpenParentPortal}
                className="px-3 py-1.5 rounded-xl bg-[var(--color-church-burgundy)] hover:bg-[#6e1623] text-white font-bold text-xs shadow-xs transition-all cursor-pointer shrink-0"
              >
                {lang === 'copt' ? 'Ⲛⲁⲩ ⲉ̀ⲛⲓⲁⲗⲱⲟⲩⲓ' : lang === 'ar' ? 'عرض الأبناء' : 'View Children'}
              </button>
            </div>
          )}
        </motion.div>
      )}

      {/* Bible Verse */}
      <motion.div
        initial={{ opacity: 0, y: 15 }}
        animate={{ opacity: 1, y: 0 }}
        exit={{ opacity: 0, y: -10 }}
        transition={{ duration: 0.25, delay: 0.15 }}
      >
        <BibleVerseCard lang={lang} />
      </motion.div>

      {/* Weekly Family Altar Prompt */}
      <motion.div
        initial={{ opacity: 0, y: 15 }}
        animate={{ opacity: 1, y: 0 }}
        exit={{ opacity: 0, y: -10 }}
        transition={{ duration: 0.25, delay: 0.2 }}
      >
        <FamilyAltarCard lang={lang} />
      </motion.div>

      {/* Stats Row */}
      <motion.div 
        initial={{ opacity: 0, y: 15 }}
        animate={{ opacity: 1, y: 0 }}
        exit={{ opacity: 0, scale: 0.96 }}
        transition={{ duration: 0.25, delay: 0.2 }}
        className="grid grid-cols-2 md:grid-cols-4 gap-4"
      >
        <div className="bg-white rounded-2xl p-4 shadow-sm border border-[var(--color-church-cream-dark)] flex items-center gap-3">
          <div className="bg-[var(--color-church-cream)] p-2 md:p-3 rounded-full text-[var(--color-church-gold)]">
            <Flame size={24} className="md:w-8 md:h-8" fill="currentColor" />
          </div>
          <div>
            <p className="text-sm text-gray-500 font-bold">{lang === 'copt' ? 'Ⲛⲓⲉϩⲟⲟⲩ' : lang === 'ar' ? 'أيام متتالية' : 'Streak'}</p>
            <p className="text-xl md:text-2xl font-bold text-[var(--color-church-blue)]">{userData.currentStreak} {lang === 'copt' ? 'Ⲛ̀ⲉϩⲟⲟⲩ' : lang === 'ar' ? 'يوم' : 'Days'}</p>
          </div>
        </div>
        
        <div 
          onClick={() => onNavigate('points')}
          className="bg-white rounded-2xl p-4 shadow-sm border border-[var(--color-church-cream-dark)] flex items-center gap-3 cursor-pointer hover:bg-gray-50 transition-colors"
        >
          <div className="bg-[var(--color-church-cream)] p-2 md:p-3 rounded-full text-[var(--color-church-gold)]">
            <Medal size={24} className="md:w-8 md:h-8" fill="currentColor" />
          </div>
          <div>
            <p className="text-sm text-gray-500 font-bold">{lang === 'copt' ? 'Ⲛⲓⲧⲁⲓⲟ' : lang === 'ar' ? 'النقاط' : 'Points'}</p>
            <p className="text-xl md:text-2xl font-bold text-[var(--color-church-blue)]">{userData.points}</p>
          </div>
        </div>
      </motion.div>

      <div className="md:grid md:grid-cols-2 md:gap-8 space-y-6 md:space-y-0">
        {/* Main Action - Next Lesson */}
        {nextLesson && (
          <motion.div 
            initial={{ opacity: 0, y: 20 }} 
            animate={{ opacity: 1, y: 0 }} 
            exit={{ opacity: 0, y: -10 }} 
            transition={{ duration: 0.3, delay: 0.25 }} 
            className="bg-[var(--color-church-blue)] text-white rounded-3xl p-6 md:p-8 shadow-md relative overflow-hidden h-full flex flex-col justify-center"
          >
            <div className="absolute top-0 right-0 w-32 h-32 md:w-64 md:h-64 bg-white opacity-5 rounded-full -mr-10 -mt-10 blur-xl"></div>
            <div className="absolute -bottom-10 -left-10 text-[var(--color-church-gold)] opacity-10">
              <Cross size={160} strokeWidth={1} />
            </div>
            
            <h2 className="text-[var(--color-church-gold-light)] font-bold text-sm md:text-base uppercase tracking-wider mb-2">
              {lang === 'copt' ? 'Ϯⲥⲃⲱ ⲙ̀ⲫⲟⲟⲩ' : lang === 'ar' ? 'درس النهاردة' : "Today's Lesson"}
            </h2>
            <h3 className="text-2xl md:text-3xl font-bold mb-2 md:mb-4 leading-tight">{nextLesson.title}</h3>
            <p className="text-blue-100 mb-6 md:text-lg text-sm line-clamp-2 md:line-clamp-none">{nextLesson.summary}</p>
            
            <motion.button 
              whileHover={{ scale: 1.02 }}
              whileTap={{ scale: 0.98 }}
              onClick={() => onNavigate('lessons', nextLesson.id)}
              className="w-full bg-[var(--color-church-burgundy)] hover:bg-[#6e1623] text-white font-bold py-4 md:py-5 md:text-lg rounded-xl flex items-center justify-center gap-2 transition-colors shadow-sm relative z-10 mt-auto cursor-pointer border border-red-700/50"
            >
              <Play size={20} fill="currentColor" />
              {lang === 'copt' ? 'Ⲁⲣⲓϩⲏⲧⲥ ⲉ̀ϯⲥⲃⲱ' : lang === 'ar' ? 'ابدأ الدرس' : 'Start Lesson'} (+{nextLesson.pointsAvailable} {lang === 'copt' ? 'ⲧⲁⲓⲟ' : 'pts'})
            </motion.button>
          </motion.div>
        )}

        {/* Leaderboard Preview */}
        <motion.div 
          initial={{ opacity: 0, y: 20 }} 
          animate={{ opacity: 1, y: 0 }} 
          exit={{ opacity: 0, y: -10 }} 
          transition={{ duration: 0.3, delay: 0.3 }} 
          className="bg-white rounded-2xl p-5 md:p-8 shadow-sm border border-[var(--color-church-cream-dark)] h-full flex flex-col justify-center"
        >
          <div className="flex justify-between items-center mb-6">
            <h3 className="font-bold text-[var(--color-church-blue)] md:text-xl">
              {lang === 'copt' ? 'Ⲡⲓⲧⲁⲝⲓⲥ ⲛ̀ⲧⲉ ϯⲉⲃⲇⲟⲙⲁⲥ' : lang === 'ar' ? 'ترتيب الأسبوع' : 'Weekly Rank'}
            </h3>
            <button onClick={() => onNavigate('points')} className="text-sm md:text-base font-bold text-[var(--color-church-burgundy)] flex items-center hover:underline cursor-pointer">
              {lang === 'copt' ? 'Ⲛⲁⲩ ⲉ̀ⲡⲧⲏⲣϥ' : lang === 'ar' ? 'عرض الكل' : 'View All'} <ChevronRight size={16} />
            </button>
          </div>
          
          {userRank && (
            <div className="flex items-center gap-4 p-4 bg-[var(--color-church-cream)] rounded-xl border border-[var(--color-church-gold)]/20 mb-6">
              <div className="font-bold text-xl text-[var(--color-church-blue)] w-8 text-center">#{userRank.rank}</div>
              <img src={userData.avatarUrl} alt="You" className="w-12 h-12 md:w-16 md:h-16 rounded-full bg-white object-cover" />
              <div className="flex-1">
                <p className="font-bold text-lg text-[var(--color-church-blue)]">{lang === 'copt' ? 'Ⲛ̀ⲑⲟⲕ' : lang === 'ar' ? 'أنت' : 'You'}</p>
              </div>
              <div className="font-bold text-lg text-[var(--color-church-gold)]">{userRank.pointsThisWeek} pts</div>
            </div>
          )}
          <p className="text-center text-sm md:text-base text-gray-500 mt-auto">
            {lang === 'copt' ? 'Ⲁⲣⲓϩⲟⲧⲡ! ϯⲥⲃⲱ ⲛⲓⲃⲉⲛ ⲥⲱⲕ ⲙ̀ⲙⲟⲕ ⲉ̀ⲡϣⲱⲓ.' : lang === 'ar' ? 'عاش! كل درس بيقربك للقمة.' : 'Keep going! Every lesson helps you climb.'}
          </p>
        </motion.div>
      </div>

    </motion.div>
  );
}
