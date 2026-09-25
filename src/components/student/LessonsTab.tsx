import React, { useState, useMemo } from 'react';
import { BookOpen, CheckCircle, Clock, Search, Plus, Sparkles, Edit3, Eye, Filter } from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';
import { useLessons } from '../../context/LessonsContext';
import { useAuth } from '../../context/AuthContext';
import { Lesson, Language } from '../../types';
import { LessonEditModal } from '../teacher/LessonEditModal';
import { formatStudentClassDisplay } from '../../lib/classGroups';

interface LessonsTabProps {
  onStartLesson: (id: string) => void;
  onOpenTeacherStudio?: () => void;
  lang: Language;
}

export function LessonsTab({ onStartLesson, onOpenTeacherStudio, lang }: LessonsTabProps) {
  const { userData } = useAuth();
  const { lessons, updateLesson, refreshCurriculum } = useLessons();
  const [searchQuery, setSearchQuery] = useState('');
  const [filterMode, setFilterMode] = useState<'all' | 'published' | 'drafts'>('all');
  const [editingLesson, setEditingLesson] = useState<Lesson | null>(null);

  const isTeacher = userData?.role === 'teacher';

  const filteredLessons = useMemo(() => {
    let result = lessons;

    // Filter by status if teacher chooses to filter
    if (isTeacher) {
      if (filterMode === 'published') {
        result = result.filter(l => l.status === 'published');
      } else if (filterMode === 'drafts') {
        result = result.filter(l => l.status === 'draft');
      }
    } else {
      // Students only see published lessons
      result = result.filter(l => l.status === 'published');
    }

    if (!searchQuery.trim()) return result;
    const query = searchQuery.toLowerCase();
    return result.filter(lesson => 
      lesson.title.toLowerCase().includes(query) ||
      (lesson.titleAr && lesson.titleAr.toLowerCase().includes(query)) ||
      (lesson.summary && lesson.summary.toLowerCase().includes(query)) ||
      (lesson.summaryAr && lesson.summaryAr.toLowerCase().includes(query))
    );
  }, [lessons, searchQuery, filterMode, isTeacher]);

  return (
    <motion.div 
      initial={{ opacity: 0, y: 15 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, y: -15 }}
      transition={{ duration: 0.3 }}
      className="pb-24 pt-6 px-4 w-full max-w-7xl mx-auto space-y-6" 
      dir={lang === 'ar' ? 'rtl' : 'ltr'}
    >
      {/* Top Banner & Header */}
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
        <div className="flex items-center gap-3">
          <div className="bg-[var(--color-church-blue)] p-2.5 md:p-3 rounded-2xl text-white shadow-sm">
            <BookOpen size={24} className="md:w-8 md:h-8" />
          </div>
          <div>
            <h1 className="text-2xl font-bold text-[var(--color-church-blue)] md:text-3xl">
              {lang === 'copt' ? 'Ⲛⲓⲥⲃⲱ ⲛ̀ⲧⲉ ϯⲉⲕⲕⲗⲏⲥⲓⲁ' : lang === 'ar' ? 'دروس مدارس الأحد' : 'Sunday School Lessons'}
            </h1>
            <p className="text-xs md:text-sm text-gray-500">
              {lang === 'copt' ? 'Ϩⲁⲛⲥⲃⲱ ⲙ̀ⲡⲛⲉⲩⲙⲁⲧⲓⲕⲟⲛ ⲛⲉⲙ ⲛⲓⲇⲟⲕⲓⲙⲏ' : lang === 'ar' ? 'محتوى روحي، قصص كتابية، واختبارات تفاعلية' : 'Spiritual curriculum, Bible stories & interactive quizzes'}
            </p>
          </div>
        </div>

        {/* Teacher Action Controls */}
        {isTeacher && (
          <div className="flex items-center gap-2 flex-wrap">
            {onOpenTeacherStudio && (
              <button
                onClick={onOpenTeacherStudio}
                className="px-4 py-2.5 rounded-xl bg-[var(--color-church-gold)] hover:bg-[var(--color-church-gold-light)] text-[var(--color-church-blue)] font-bold text-xs sm:text-sm flex items-center gap-2 shadow-sm transition-all cursor-pointer"
              >
                <Sparkles size={16} />
                <span>{lang === 'copt' ? '+ Ⲑⲁⲙⲓⲟ ⲛ̀ϯⲥⲃⲱ (AI)' : lang === 'ar' ? '+ إعداد درس بالذكاء الاصطناعي' : '+ Create Lesson with AI'}</span>
              </button>
            )}
          </div>
        )}
      </div>

      {/* Search & Filter Bar */}
      <div className="flex flex-col sm:flex-row gap-3 items-stretch sm:items-center justify-between">
        <div className="relative flex-1 max-w-md">
          <div className={`absolute inset-y-0 ${lang === 'ar' ? 'right-0 pr-3' : 'left-0 pl-3'} flex items-center pointer-events-none`}>
            <Search className="h-4 w-4 text-gray-400" />
          </div>
          <input
            type="text"
            placeholder={lang === 'copt' ? 'Ⲕⲱϯ ⲛ̀ⲥⲁ ⲟⲩⲥⲃⲱ...' : lang === 'ar' ? 'ابحث عن درس أو قصة كتابية...' : 'Search lessons or Bible stories...'}
            className={`block w-full rounded-xl border border-gray-200 bg-white py-2.5 ${lang === 'ar' ? 'pr-9 pl-4' : 'pl-9 pr-4'} text-xs sm:text-sm placeholder-gray-400 focus:border-[var(--color-church-gold)] focus:outline-none focus:ring-1 focus:ring-[var(--color-church-gold)] transition-colors shadow-2xs`}
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
          />
        </div>

        {/* Teacher status filter tabs */}
        {isTeacher && (
          <div className="flex bg-gray-100 p-1 rounded-xl text-xs font-bold text-gray-600 self-start sm:self-auto">
            <button
              onClick={() => setFilterMode('all')}
              className={`px-3 py-1.5 rounded-lg transition-all ${filterMode === 'all' ? 'bg-white text-[var(--color-church-blue)] shadow-2xs' : 'hover:text-gray-900'}`}
            >
              {lang === 'copt' ? 'Ⲡⲧⲏⲣϥ' : lang === 'ar' ? 'الكل' : 'All'}
            </button>
            <button
              onClick={() => setFilterMode('published')}
              className={`px-3 py-1.5 rounded-lg transition-all ${filterMode === 'published' ? 'bg-white text-emerald-700 shadow-2xs' : 'hover:text-gray-900'}`}
            >
              {lang === 'copt' ? 'Ⲉⲧϩⲓⲱⲓϣ' : lang === 'ar' ? 'المنشورة' : 'Published'}
            </button>
            <button
              onClick={() => setFilterMode('drafts')}
              className={`px-3 py-1.5 rounded-lg transition-all ${filterMode === 'drafts' ? 'bg-white text-amber-700 shadow-2xs' : 'hover:text-gray-900'}`}
            >
              {lang === 'copt' ? 'Ϩⲁⲛⲥϧⲁⲓ' : lang === 'ar' ? 'المسودات' : 'Drafts'}
            </button>
          </div>
        )}
      </div>

      {/* Lesson Cards Grid */}
      <div className="space-y-4 md:grid md:grid-cols-2 lg:grid-cols-3 md:gap-6 md:space-y-0">
        <AnimatePresence mode="popLayout">
          {filteredLessons.length > 0 ? (
            filteredLessons.map((lesson, index) => (
              <motion.div 
                key={lesson.id} 
                layout
                initial={{ opacity: 0, y: 20, scale: 0.95 }}
                animate={{ opacity: 1, y: 0, scale: 1 }}
                exit={{ opacity: 0, y: -10, scale: 0.95 }}
                transition={{ duration: 0.25, delay: index * 0.04 }}
                className={`bg-white rounded-3xl p-5 md:p-6 shadow-sm border flex flex-col transition-all hover:shadow-md ${
                  lesson.isCompleted ? 'border-green-200' : 'border-[var(--color-church-cream-dark)]'
                }`}
              >
                {/* Card Header with Title & Badges */}
                <div className="flex justify-between items-start mb-2 gap-2">
                  <div className="space-y-1 flex-1">
                    <div className="flex items-center gap-2 flex-wrap">
                      <h3 className="font-bold text-base md:text-lg text-[var(--color-church-blue)] leading-snug">
                        {lang === 'ar' 
                          ? (lesson.titleAr || lesson.title) 
                          : lang === 'copt' || lang === 'cop'
                            ? (lesson.titleCop || lesson.title)
                            : lesson.title}
                      </h3>
                      {isTeacher && (
                        <span className={`text-[10px] px-2 py-0.5 rounded-full font-bold ${
                          lesson.status === 'published'
                            ? 'bg-emerald-100 text-emerald-800'
                            : 'bg-amber-100 text-amber-800'
                        }`}>
                          {lesson.status === 'published' 
                            ? (lang === 'copt' || lang === 'cop' ? 'Ⲉⲧϩⲓⲱⲓϣ ✅' : lang === 'ar' ? 'منشور ✅' : 'Published') 
                            : (lang === 'copt' || lang === 'cop' ? 'Ϩⲁⲛⲥϧⲁⲓ 📝' : lang === 'ar' ? 'مسودة 📝' : 'Draft')}
                        </span>
                      )}
                      {lesson.grade && (
                        <span className="text-[10px] px-2 py-0.5 rounded-full font-bold bg-amber-50 text-amber-900 border border-amber-200/80 flex items-center gap-1">
                          <span>{formatStudentClassDisplay(lesson.grade, lang).icon}</span>
                          <span>{formatStudentClassDisplay(lesson.grade, lang).fullDisplay}</span>
                        </span>
                      )}
                    </div>
                  </div>

                  {lesson.isCompleted ? (
                    <CheckCircle className="text-green-500 shrink-0" size={22} fill="currentColor" stroke="white" />
                  ) : (
                    <div className="bg-[var(--color-church-cream)] text-[var(--color-church-gold)] text-xs font-bold px-2.5 py-1 rounded-full whitespace-nowrap shadow-2xs">
                      {lesson.pointsAvailable || 150} {lang === 'copt' || lang === 'cop' ? 'ⲧⲁⲓⲟ' : 'pts'}
                    </div>
                  )}
                </div>
                
                {/* Summary */}
                <p className="text-gray-600 text-xs md:text-sm mb-5 flex-1 leading-relaxed line-clamp-3" dir={lang === 'ar' ? 'rtl' : 'ltr'}>
                  {lang === 'ar' 
                    ? (lesson.summaryAr || lesson.summary) 
                    : lang === 'copt' || lang === 'cop'
                      ? (lesson.summaryCop || lesson.summary)
                      : lesson.summary}
                </p>
                
                {/* Footer Actions */}
                <div className="flex items-center justify-between mt-auto pt-3 border-t border-gray-100 gap-2">
                  <span className="text-[11px] text-gray-400 font-medium flex items-center gap-1">
                    <Clock size={13} /> 
                    <span>{lesson.date}</span>
                  </span>
                  
                  <div className="flex items-center gap-2">
                    {/* Teacher Quick Edit Button */}
                    {isTeacher && (
                      <button
                        onClick={() => setEditingLesson(lesson)}
                        className="px-3 py-1.5 rounded-xl bg-blue-50 text-[var(--color-church-blue)] hover:bg-blue-100 text-xs font-bold flex items-center gap-1 transition-colors cursor-pointer"
                        title={lang === 'copt' ? 'Ϣⲉⲃⲓⲱ' : lang === 'ar' ? 'تعديل هذا الدرس' : 'Edit lesson'}
                      >
                        <Edit3 size={13} />
                        <span>{lang === 'copt' ? 'Ϣⲉⲃⲓⲱ' : lang === 'ar' ? 'تعديل' : 'Edit'}</span>
                      </button>
                    )}

                    {/* Start / Review Button */}
                    <button 
                      onClick={() => onStartLesson(lesson.id)}
                      className={`px-4 py-1.5 rounded-xl font-bold text-xs sm:text-sm transition-all cursor-pointer flex items-center gap-1 ${
                        lesson.isCompleted 
                          ? 'bg-gray-100 text-gray-600 hover:bg-gray-200' 
                          : 'bg-[var(--color-church-gold)] text-[var(--color-church-blue)] hover:bg-[var(--color-church-gold-light)] shadow-xs'
                      }`}
                    >
                      {isTeacher && <Eye size={14} />}
                      <span>
                        {lesson.isCompleted 
                          ? (lang === 'copt' ? 'Ⲟⲩⲁϩⲙⲉϥ' : lang === 'ar' ? 'مراجعة' : 'Review') 
                          : (isTeacher 
                              ? (lang === 'copt' ? 'Ⲛⲁⲩ' : lang === 'ar' ? 'معاينة' : 'Preview') 
                              : (lang === 'copt' ? 'Ⲁⲣⲓϩⲏⲧⲥ' : lang === 'ar' ? 'ابدأ' : 'Start'))}
                      </span>
                    </button>
                  </div>
                </div>
              </motion.div>
            ))
          ) : (
            <motion.div 
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              className="text-center py-12 bg-white rounded-3xl border border-gray-100 shadow-sm col-span-full space-y-2"
            >
              <Search className="mx-auto h-10 w-10 text-gray-300 mb-1" />
              <h3 className="text-base font-bold text-gray-800">
                {lang === 'copt' ? 'Ⲙ̀ⲙⲟⲛ ϩⲁⲛⲥⲃⲱ ⲉⲩϣⲱⲡ' : lang === 'ar' ? 'لا توجد دروس مطابقة' : 'No lessons found'}
              </h3>
              <p className="text-xs text-gray-400">
                {lang === 'copt' ? 'Ⲕⲱϯ ϧⲉⲛ ϩⲁⲛⲥⲁϫⲓ ⲕⲉⲭⲱⲟⲩⲛⲓ.' : lang === 'ar' ? 'جرب البحث بكلمات أخرى أو تغيير الفلتر.' : 'Try adjusting your search terms or filter mode.'}
              </p>
            </motion.div>
          )}
        </AnimatePresence>
      </div>

      {/* Teacher Lesson Edit Modal */}
      {editingLesson && (
        <LessonEditModal
          lesson={editingLesson}
          isOpen={Boolean(editingLesson)}
          onClose={() => setEditingLesson(null)}
          onSave={async (updates) => {
            updateLesson(editingLesson.id, updates);
            if (refreshCurriculum) {
              await refreshCurriculum();
            }
          }}
          lang={lang}
        />
      )}
    </motion.div>
  );
}
