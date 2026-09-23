import React, { useState } from 'react';
import { X, Plus, Trash2, Save, CheckCircle, AlertCircle, BookOpen } from 'lucide-react';
import { Lesson, QuizQuestion, Language } from '../../types';

interface LessonEditModalProps {
  lesson: Lesson;
  isOpen: boolean;
  onClose: () => void;
  onSave: (updated: Partial<Lesson>) => void;
  lang: Language;
}

export function LessonEditModal({ lesson, isOpen, onClose, onSave, lang }: LessonEditModalProps) {
  if (!isOpen) return null;

  const [title, setTitle] = useState(lesson.title);
  const [summary, setSummary] = useState(lesson.summary);
  const [pointsAvailable, setPointsAvailable] = useState(lesson.pointsAvailable || 150);
  const [status, setStatus] = useState(lesson.status || 'published');
  const [quizQuestions, setQuizQuestions] = useState<QuizQuestion[]>(() => {
    if (lesson.quiz && lesson.quiz.length > 0) return lesson.quiz;
    return [
      {
        question: lang === 'ar' ? 'ما الفكرة الرئيسية للدرس؟' : 'What is the main takeaway of this lesson?',
        options: [
          lang === 'ar' ? 'الإيمان ومحبة الله' : 'Faith and loving God',
          lang === 'ar' ? 'الابتعاد عن الصلاة' : 'Avoiding prayer',
          lang === 'ar' ? 'الكسل' : 'Laziness',
          lang === 'ar' ? 'التردد' : 'Hesitation'
        ],
        correctIndex: 0
      }
    ];
  });

  const handleAddQuestion = () => {
    setQuizQuestions([
      ...quizQuestions,
      {
        question: lang === 'ar' ? 'سؤال جديد' : 'New Question',
        options: [
          lang === 'ar' ? 'الإجابة الأولى (صحيحة)' : 'Option 1 (Correct)',
          lang === 'ar' ? 'الإجابة الثانية' : 'Option 2',
          lang === 'ar' ? 'الإجابة الثالثة' : 'Option 3',
          lang === 'ar' ? 'الإجابة الرابعة' : 'Option 4'
        ],
        correctIndex: 0
      }
    ]);
  };

  const handleQuestionChange = (qIndex: number, newText: string) => {
    const updated = [...quizQuestions];
    updated[qIndex].question = newText;
    setQuizQuestions(updated);
  };

  const handleOptionChange = (qIndex: number, oIndex: number, newOption: string) => {
    const updated = [...quizQuestions];
    updated[qIndex].options[oIndex] = newOption;
    setQuizQuestions(updated);
  };

  const handleCorrectIndexChange = (qIndex: number, correctIdx: number) => {
    const updated = [...quizQuestions];
    updated[qIndex].correctIndex = correctIdx;
    setQuizQuestions(updated);
  };

  const handleDeleteQuestion = (qIndex: number) => {
    setQuizQuestions(quizQuestions.filter((_, i) => i !== qIndex));
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!title.trim()) {
      alert(lang === 'ar' ? 'يرجى إدخال عنوان الدرس' : 'Please provide a lesson title');
      return;
    }
    onSave({
      title,
      summary,
      pointsAvailable: Number(pointsAvailable) || 150,
      status: status as any,
      quiz: quizQuestions
    });
    onClose();
  };

  return (
    <div 
      className="fixed inset-0 z-50 bg-black/60 backdrop-blur-xs flex items-center justify-center p-3 sm:p-4 overflow-y-auto"
      dir={lang === 'ar' ? 'rtl' : 'ltr'}
    >
      <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-3xl shadow-2xl max-w-2xl w-full p-6 space-y-6 max-h-[90vh] overflow-y-auto text-start my-auto">
        
        {/* Header */}
        <div className="flex items-center justify-between pb-3 border-b border-gray-100 dark:border-slate-800">
          <div className="flex items-center gap-2.5">
            <div className="w-10 h-10 rounded-2xl bg-[var(--color-church-cream)] dark:bg-slate-800 text-[var(--color-church-blue)] flex items-center justify-center">
              <BookOpen size={20} />
            </div>
            <div>
              <h3 className="text-lg font-bold text-[var(--color-church-blue)] dark:text-white">
                {lang === 'ar' ? 'تعديل الدرس وإدارته' : 'Edit & Manage Lesson'}
              </h3>
              <p className="text-xs text-gray-500">
                {lang === 'ar' ? 'صلاحيات المعلم / خادم مدارس الأحد' : 'Teacher & Servant Privileges'}
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-1.5 rounded-xl hover:bg-gray-100 dark:hover:bg-slate-800 text-gray-400 hover:text-gray-600 transition-colors"
          >
            <X size={20} />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="space-y-5">
          {/* Title & Status */}
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
            <div className="sm:col-span-2">
              <label className="block text-xs font-bold text-gray-700 dark:text-gray-300 uppercase tracking-wider mb-1.5">
                {lang === 'ar' ? 'عنوان الدرس' : 'Lesson Title'}
              </label>
              <input
                type="text"
                value={title}
                onChange={(e) => setTitle(e.target.value)}
                required
                className="w-full text-sm font-semibold px-4 py-2.5 rounded-xl border border-gray-200 dark:border-slate-700 bg-gray-50 dark:bg-slate-800/50 focus:bg-white focus:outline-none focus:ring-2 focus:ring-[var(--color-church-gold)] text-gray-900 dark:text-white"
              />
            </div>
            <div>
              <label className="block text-xs font-bold text-gray-700 dark:text-gray-300 uppercase tracking-wider mb-1.5">
                {lang === 'ar' ? 'حالة النشر' : 'Status'}
              </label>
              <select
                value={status}
                onChange={(e) => setStatus(e.target.value as any)}
                className="w-full text-sm font-semibold px-3 py-2.5 rounded-xl border border-gray-200 dark:border-slate-700 bg-gray-50 dark:bg-slate-800/50 focus:outline-none focus:ring-2 focus:ring-[var(--color-church-gold)] text-gray-900 dark:text-white"
              >
                <option value="published">{lang === 'ar' ? 'منشور للطلاب ✅' : 'Published ✅'}</option>
                <option value="draft">{lang === 'ar' ? 'مسودة قيد الإعداد 📝' : 'Draft 📝'}</option>
              </select>
            </div>
          </div>

          {/* Points Available */}
          <div>
            <label className="block text-xs font-bold text-gray-700 dark:text-gray-300 uppercase tracking-wider mb-1.5">
              {lang === 'ar' ? 'النقاط الممنوحة' : 'Points Available'}
            </label>
            <input
              type="number"
              min={10}
              max={500}
              step={10}
              value={pointsAvailable}
              onChange={(e) => setPointsAvailable(Number(e.target.value))}
              className="w-36 text-sm font-semibold px-4 py-2 rounded-xl border border-gray-200 dark:border-slate-700 bg-gray-50 dark:bg-slate-800/50 text-gray-900 dark:text-white"
            />
          </div>

          {/* Summary */}
          <div>
            <label className="block text-xs font-bold text-gray-700 dark:text-gray-300 uppercase tracking-wider mb-1.5">
              {lang === 'ar' ? 'ملخص ومحتوى الدرس' : 'Lesson Summary & Content'}
            </label>
            <textarea
              rows={3}
              value={summary}
              onChange={(e) => setSummary(e.target.value)}
              className="w-full text-sm px-4 py-2.5 rounded-xl border border-gray-200 dark:border-slate-700 bg-gray-50 dark:bg-slate-800/50 focus:bg-white focus:outline-none focus:ring-2 focus:ring-[var(--color-church-gold)] text-gray-900 dark:text-white leading-relaxed"
            />
          </div>

          {/* Quizzes & Questions */}
          <div className="space-y-4 pt-3 border-t border-gray-100 dark:border-slate-800">
            <div className="flex items-center justify-between">
              <span className="text-xs font-bold uppercase tracking-wider text-gray-700 dark:text-gray-300">
                {lang === 'ar' ? `أسئلة الاختبار (${quizQuestions.length})` : `Quiz Questions (${quizQuestions.length})`}
              </span>
              <button
                type="button"
                onClick={handleAddQuestion}
                className="text-xs font-bold px-3 py-1.5 rounded-xl bg-blue-50 text-[var(--color-church-blue)] hover:bg-blue-100 flex items-center gap-1 transition-colors"
              >
                <Plus size={14} />
                <span>{lang === 'ar' ? 'إضافة سؤال' : 'Add Question'}</span>
              </button>
            </div>

            <div className="space-y-4">
              {quizQuestions.map((q, qIdx) => (
                <div key={qIdx} className="p-4 rounded-2xl bg-gray-50 dark:bg-slate-800/60 border border-gray-200/80 dark:border-slate-700 space-y-3">
                  <div className="flex items-center justify-between gap-2">
                    <span className="w-6 h-6 rounded-full bg-[var(--color-church-blue)] text-white text-xs font-bold flex items-center justify-center shrink-0">
                      {qIdx + 1}
                    </span>
                    <input
                      type="text"
                      value={q.question}
                      onChange={(e) => handleQuestionChange(qIdx, e.target.value)}
                      placeholder={lang === 'ar' ? 'نص السؤال...' : 'Question prompt...'}
                      className="flex-1 text-xs font-bold px-3 py-1.5 rounded-lg border border-gray-200 dark:border-slate-600 bg-white dark:bg-slate-900 text-gray-800 dark:text-gray-100"
                    />
                    <button
                      type="button"
                      onClick={() => handleDeleteQuestion(qIdx)}
                      className="text-red-500 hover:text-red-700 p-1"
                      title={lang === 'ar' ? 'حذف السؤال' : 'Delete Question'}
                    >
                      <Trash2 size={16} />
                    </button>
                  </div>

                  {/* Options */}
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 pt-1">
                    {q.options.map((opt, oIdx) => (
                      <div key={oIdx} className="flex items-center gap-2">
                        <input
                          type="radio"
                          name={`correct-${qIdx}`}
                          checked={q.correctIndex === oIdx}
                          onChange={() => handleCorrectIndexChange(qIdx, oIdx)}
                          title={lang === 'ar' ? 'حدد كإجابة صحيحة' : 'Mark as correct answer'}
                          className="accent-[var(--color-church-gold)] shrink-0 cursor-pointer"
                        />
                        <input
                          type="text"
                          value={opt}
                          onChange={(e) => handleOptionChange(qIdx, oIdx, e.target.value)}
                          placeholder={`Option ${oIdx + 1}`}
                          className={`flex-1 text-xs px-2.5 py-1.5 rounded-lg border ${
                            q.correctIndex === oIdx 
                              ? 'border-emerald-500 bg-emerald-50/50 dark:bg-emerald-950/20 font-bold' 
                              : 'border-gray-200 dark:border-slate-700 bg-white dark:bg-slate-900'
                          }`}
                        />
                      </div>
                    ))}
                  </div>
                </div>
              ))}
            </div>
          </div>

          {/* Action buttons */}
          <div className="flex gap-3 pt-4 border-t border-gray-100 dark:border-slate-800">
            <button
              type="submit"
              className="flex-1 py-3 px-4 rounded-xl bg-[var(--color-church-blue)] hover:opacity-95 text-white text-sm font-bold flex items-center justify-center gap-2 shadow-md transition-all cursor-pointer"
            >
              <Save size={16} />
              <span>{lang === 'ar' ? 'حفظ التعديلات' : 'Save Changes'}</span>
            </button>
            <button
              type="button"
              onClick={onClose}
              className="py-3 px-5 rounded-xl bg-gray-100 hover:bg-gray-200 dark:bg-slate-800 dark:hover:bg-slate-700 text-gray-700 dark:text-gray-300 text-sm font-bold transition-all cursor-pointer"
            >
              {lang === 'ar' ? 'إلغاء' : 'Cancel'}
            </button>
          </div>
        </form>

      </div>
    </div>
  );
}
