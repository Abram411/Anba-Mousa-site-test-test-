import React, { useState, useEffect } from 'react';
import { 
  Users, 
  UserPlus, 
  CheckCircle2, 
  AlertCircle, 
  Clock, 
  Award, 
  BookOpen, 
  RefreshCw,
  Info,
  ShieldCheck,
  GraduationCap,
  ChevronRight
} from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';
import { getMyClass, assignStudentClass, ClassRosterStudent, ServantClassInfo } from '../../lib/classRosterService';
import { CLASS_GROUPS } from '../../lib/classGroups';
import { ClassGroupId } from '../../types';
import { StudentLearningReviewView } from './StudentLearningReviewView';

interface ServantClassManagementProps {
  lang?: 'en' | 'ar';
}

export const ServantClassManagement: React.FC<ServantClassManagementProps> = ({
  lang = 'en'
}) => {
  const isAr = lang === 'ar';

  const [loading, setLoading] = useState<boolean>(true);
  const [classInfo, setClassInfo] = useState<ServantClassInfo | null>(null);
  const [roster, setRoster] = useState<ClassRosterStudent[]>([]);
  const [loadError, setLoadError] = useState<string | null>(null);

  // Drilldown state for student learning review
  const [selectedStudentForReview, setSelectedStudentForReview] = useState<string | null>(null);

  // Assignment form state
  const [studentIdInput, setStudentIdInput] = useState<string>('');
  const [selectedGrade, setSelectedGrade] = useState<string>('');
  const [isSubmitting, setIsSubmitting] = useState<boolean>(false);
  const [assignmentSuccess, setAssignmentSuccess] = useState<string | null>(null);
  const [assignmentError, setAssignmentError] = useState<string | null>(null);

  // Load authoritative class and roster
  const loadClassData = async () => {
    setLoading(true);
    setLoadError(null);
    try {
      const { data, error } = await getMyClass();
      if (error || !data) {
        setLoadError(error?.message || (isAr ? 'تعذر تحميل بيانات الفصل' : 'Failed to load class data'));
        return;
      }

      const info = data.classInfo as ServantClassInfo;
      setClassInfo(info);
      setRoster(data.roster || []);

      // Set default grade if available
      const groupGrades = info?.classGroupId && CLASS_GROUPS[info.classGroupId as ClassGroupId]?.grades;
      if (groupGrades && groupGrades.length > 0 && !selectedGrade) {
        setSelectedGrade(groupGrades[0].code);
      } else if (info?.grades && info.grades.length > 0 && !selectedGrade) {
        setSelectedGrade(info.grades[0]);
      }
    } catch (err: any) {
      setLoadError(err?.message || (isAr ? 'حدث خطأ غير متوقع' : 'Unexpected error loading class'));
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadClassData();
  }, []);

  const handleAssignStudent = async (e: React.FormEvent) => {
    e.preventDefault();
    setAssignmentSuccess(null);
    setAssignmentError(null);

    const trimmedId = studentIdInput.trim();
    if (!trimmedId) {
      setAssignmentError(isAr ? 'يرجى إدخال معرّف أو كود الطالب' : 'Please enter student ID or code');
      return;
    }

    if (!classInfo?.classGroupId || !selectedGrade) {
      setAssignmentError(isAr ? 'يرجى اختيار المرحلة الدراسية المناسبة' : 'Please select an eligible grade');
      return;
    }

    setIsSubmitting(true);
    try {
      const { success, error } = await assignStudentClass(
        trimmedId,
        classInfo.classGroupId as ClassGroupId,
        selectedGrade
      );

      if (!success || error) {
        const rawErr = error?.message || '';
        let friendlyMsg = isAr ? 'فشل تعيين الطالب' : 'Failed to assign student';

        if (rawErr.includes('INVALID_GRADE')) {
          friendlyMsg = isAr 
            ? 'المرحلة الدراسية المختارة غير مطابقة لهذا الفصل الدراسي.' 
            : 'The selected grade does not belong to this class group.';
        } else if (rawErr.includes('STUDENT_NOT_FOUND')) {
          friendlyMsg = isAr 
            ? `لم يتم العثور على طالب بالمعرّف "${trimmedId}". تأكد من صحة الكود.` 
            : `Student with ID "${trimmedId}" was not found in church records.`;
        } else if (rawErr.includes('FORBIDDEN')) {
          friendlyMsg = isAr 
            ? 'ليس لديك الصلاحية لإدارة هذا الفصل أو تعيين طلاب له.' 
            : 'You are not authorized to assign students to this class.';
        } else if (rawErr.includes('PERSISTENCE_FAILED')) {
          friendlyMsg = isAr 
            ? 'فشل حفظ التعيين في قاعدة البيانات. لم يتم التعديل.' 
            : 'Database persistence failed. Changes were not saved.';
        } else if (rawErr) {
          friendlyMsg = rawErr;
        }

        setAssignmentError(friendlyMsg);
        return;
      }

      // Success confirmed by server
      setAssignmentSuccess(
        isAr 
          ? `تم تعيين الطالب (${trimmedId}) بنجاح إلى ${selectedGrade} وتم حفظ السجل رسمياً!`
          : `Student (${trimmedId}) successfully assigned to ${selectedGrade} and persisted!`
      );
      setStudentIdInput('');

      // Refresh authoritative roster
      await loadClassData();
    } catch (err: any) {
      setAssignmentError(err?.message || (isAr ? 'حدث خطأ أثناء الاتصال بالخادم' : 'Server connection error'));
    } finally {
      setIsSubmitting(false);
    }
  };

  const eligibleGrades = classInfo?.classGroupId && CLASS_GROUPS[classInfo.classGroupId as ClassGroupId]?.grades
    ? CLASS_GROUPS[classInfo.classGroupId as ClassGroupId].grades.map(g => ({ code: g.code, label: isAr ? g.name.ar : g.name.en }))
    : (classInfo?.grades || ['Grade 4', 'Grade 5', 'Grade 6']).map(g => ({ code: g, label: g }));

  if (selectedStudentForReview) {
    return (
      <StudentLearningReviewView
        studentId={selectedStudentForReview}
        onBack={() => setSelectedStudentForReview(null)}
        lang={lang}
      />
    );
  }

  return (
    <div className="space-y-6" dir={isAr ? 'rtl' : 'ltr'}>
      {/* Header Bar */}
      <div className="bg-stone-900 border border-stone-800 rounded-2xl p-5 shadow-xl flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
        <div className="flex items-center gap-3.5">
          <div className="w-12 h-12 rounded-xl bg-amber-500/10 border border-amber-500/20 flex items-center justify-center text-amber-400">
            <Users size={24} />
          </div>
          <div>
            <div className="flex items-center gap-2">
              <h2 className="text-xl font-bold text-stone-100">
                {isAr ? 'إدارة الفصل وقائمة الطلاب' : 'Class Management & Roster'}
              </h2>
              <span className="text-[10px] uppercase font-bold tracking-wider px-2 py-0.5 rounded-full bg-emerald-500/10 text-emerald-400 border border-emerald-500/20 flex items-center gap-1">
                <ShieldCheck size={11} />
                {isAr ? 'موثّق' : 'Authoritative'}
              </span>
            </div>
            <p className="text-xs text-stone-400 mt-0.5">
              {classInfo 
                ? (isAr ? `فصلك المعتمد: ${classInfo.classNameAr || classInfo.className}` : `Assigned Class: ${classInfo.className}`)
                : (isAr ? 'جاري تحميل بيانات الفصل...' : 'Loading class details...')}
            </p>
          </div>
        </div>

        <button
          onClick={loadClassData}
          disabled={loading}
          className="px-3.5 py-2 rounded-xl bg-stone-800 hover:bg-stone-700 text-stone-300 text-xs font-semibold flex items-center gap-1.5 transition-colors border border-stone-700 cursor-pointer disabled:opacity-50"
        >
          <RefreshCw size={13} className={loading ? 'animate-spin' : ''} />
          <span>{isAr ? 'تحديث السجل' : 'Refresh Roster'}</span>
        </button>
      </div>

      {loadError && (
        <div className="bg-rose-950/40 border border-rose-800/60 rounded-xl p-4 text-rose-200 text-xs flex items-center gap-2.5">
          <AlertCircle size={16} className="text-rose-400 shrink-0" />
          <span>{loadError}</span>
        </div>
      )}

      {/* Grid: Assignment Form + Roster View */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Left Column: Student Assignment Workflow */}
        <div className="lg:col-span-1 space-y-4">
          <div className="bg-stone-900 border border-stone-800 rounded-2xl p-5 shadow-xl">
            <div className="flex items-center gap-2 mb-4 pb-3 border-b border-stone-800">
              <UserPlus size={18} className="text-amber-400" />
              <h3 className="text-sm font-bold text-stone-200">
                {isAr ? 'تعيين طالب إلى فصلي' : 'Assign Student to My Class'}
              </h3>
            </div>

            <form onSubmit={handleAssignStudent} className="space-y-4 text-xs">
              <div>
                <label className="block text-stone-300 font-medium mb-1.5">
                  {isAr ? 'معرّف الطالب (Student ID / Code)' : 'Student ID or Code'}
                </label>
                <input
                  type="text"
                  value={studentIdInput}
                  onChange={(e) => setStudentIdInput(e.target.value)}
                  placeholder={isAr ? 'مثال: mark أو student-david' : 'e.g. mark or student-david'}
                  className="w-full bg-stone-950 border border-stone-800 focus:border-amber-500 rounded-xl px-3.5 py-2.5 text-stone-100 placeholder-stone-600 outline-none transition-colors"
                  disabled={isSubmitting || loading}
                />
              </div>

              <div>
                <label className="block text-stone-300 font-medium mb-1.5 flex items-center justify-between">
                  <span>{isAr ? 'المرحلة الدراسية المصرح بها' : 'Authorized Grade'}</span>
                  <span className="text-[10px] text-amber-400/80 font-normal">
                    {classInfo?.className || 'Class Group'}
                  </span>
                </label>
                <select
                  value={selectedGrade}
                  onChange={(e) => setSelectedGrade(e.target.value)}
                  className="w-full bg-stone-950 border border-stone-800 focus:border-amber-500 rounded-xl px-3 py-2.5 text-stone-100 outline-none transition-colors"
                  disabled={isSubmitting || loading}
                >
                  {eligibleGrades.map((g) => (
                    <option key={g.code} value={g.code}>
                      {g.label} ({g.code})
                    </option>
                  ))}
                </select>
                <p className="text-[11px] text-stone-500 mt-1">
                  {isAr 
                    ? 'الخيارات مقصورة تلقائياً على المراحل المصرح بها لفصلك فقط.'
                    : 'Restricted strictly to grades authorized for your assigned class.'}
                </p>
              </div>

              {/* Status alerts */}
              <AnimatePresence>
                {assignmentSuccess && (
                  <motion.div
                    initial={{ opacity: 0, y: -4 }}
                    animate={{ opacity: 1, y: 0 }}
                    exit={{ opacity: 0 }}
                    className="p-3 bg-emerald-950/50 border border-emerald-800/80 rounded-xl text-emerald-300 text-xs flex items-start gap-2"
                  >
                    <CheckCircle2 size={15} className="text-emerald-400 shrink-0 mt-0.5" />
                    <span>{assignmentSuccess}</span>
                  </motion.div>
                )}

                {assignmentError && (
                  <motion.div
                    initial={{ opacity: 0, y: -4 }}
                    animate={{ opacity: 1, y: 0 }}
                    exit={{ opacity: 0 }}
                    className="p-3 bg-rose-950/50 border border-rose-800/80 rounded-xl text-rose-300 text-xs flex items-start gap-2"
                  >
                    <AlertCircle size={15} className="text-rose-400 shrink-0 mt-0.5" />
                    <span>{assignmentError}</span>
                  </motion.div>
                )}
              </AnimatePresence>

              <button
                type="submit"
                disabled={isSubmitting || loading || !studentIdInput.trim()}
                className="w-full py-2.5 px-4 rounded-xl bg-amber-500 hover:bg-amber-400 active:bg-amber-600 disabled:opacity-40 text-stone-950 font-bold text-xs flex items-center justify-center gap-1.5 shadow-md transition-all cursor-pointer"
              >
                {isSubmitting ? (
                  <>
                    <RefreshCw size={14} className="animate-spin" />
                    <span>{isAr ? 'جاري التحقق والحفظ...' : 'Persisting Assignment...'}</span>
                  </>
                ) : (
                  <>
                    <CheckCircle2 size={14} />
                    <span>{isAr ? 'تأكيد التعيين وحفظه' : 'Confirm & Persist Assignment'}</span>
                  </>
                )}
              </button>
            </form>
          </div>

          {/* Removal / Policy Note */}
          <div className="bg-stone-900/60 border border-stone-800/80 rounded-2xl p-4 text-[11px] text-stone-400 space-y-2">
            <div className="flex items-center gap-1.5 text-stone-300 font-semibold">
              <Info size={14} className="text-amber-400" />
              <span>{isAr ? 'سياسة النقل والإلغاء' : 'Unassignment / Removal Policy'}</span>
            </div>
            <p className="leading-relaxed">
              {isAr
                ? 'حفاظاً على سجلات الحضور وسجل إتقان الطالب، يتم نقل أو إلغاء تعيين الطلاب من خلال التعيين الإداري المباشر فقط لتجنب حذف البيانات بالخطأ.'
                : 'To protect student mastery records and attendance history, removal is handled via direct reassignment. Deletion without reassignment is deferred.'}
            </p>
          </div>
        </div>

        {/* Right Column: Authorized Roster View */}
        <div className="lg:col-span-2">
          <div className="bg-stone-900 border border-stone-800 rounded-2xl p-5 shadow-xl space-y-4">
            <div className="flex items-center justify-between pb-3 border-b border-stone-800">
              <div className="flex items-center gap-2">
                <GraduationCap size={18} className="text-amber-400" />
                <h3 className="text-sm font-bold text-stone-200">
                  {isAr ? 'الطلاب المقيدون بالفصل' : 'Enrolled Students Roster'}
                </h3>
              </div>
              <span className="text-xs text-stone-400 font-medium">
                {isAr ? `${roster.length} طالب` : `${roster.length} Students`}
              </span>
            </div>

            {loading && roster.length === 0 ? (
              <div className="py-12 text-center text-stone-500 text-xs flex flex-col items-center gap-2">
                <RefreshCw size={20} className="animate-spin text-amber-500" />
                <span>{isAr ? 'جاري تحميل قائمة الطلاب...' : 'Loading roster...'}</span>
              </div>
            ) : roster.length === 0 ? (
              <div className="py-12 text-center text-stone-500 text-xs">
                {isAr ? 'لا يوجد طلاب مسجلون في هذا الفصل حالياً.' : 'No students currently enrolled in this class.'}
              </div>
            ) : (
              <div className="divide-y divide-stone-800/80 max-h-[520px] overflow-y-auto pr-1">
                {roster.map((student) => {
                  const mastery = student.learningSummary?.latestMasteryStatus;
                  const lessonsCount = student.learningSummary?.lessonsCompletedCount ?? 0;
                  const quizScore = student.learningSummary?.latestQuizScore ?? 0;

                  return (
                    <div 
                      key={student.id}
                      className="py-3.5 flex flex-col sm:flex-row sm:items-center justify-between gap-3 text-xs hover:bg-stone-800/30 px-2 rounded-xl transition-colors"
                    >
                      <div className="flex items-center gap-3">
                        <img 
                          src={student.avatarUrl || `https://api.dicebear.com/7.x/avataaars/svg?seed=${student.id}`} 
                          alt={student.name}
                          className="w-10 h-10 rounded-full bg-stone-800 border border-stone-700 object-cover shrink-0" 
                        />
                        <div>
                          <div className="font-bold text-stone-200 text-sm">
                            {student.name}
                          </div>
                          <div className="text-[11px] text-stone-400 flex items-center gap-2 mt-0.5">
                            <span className="text-amber-400/90 font-medium">{student.grade}</span>
                            <span className="text-stone-600">•</span>
                            <span className="text-stone-500">ID: {student.id}</span>
                          </div>
                        </div>
                      </div>

                      {/* Learning Summary - Privacy Safe Reused Data */}
                      <div className="flex items-center gap-2 sm:gap-3 flex-wrap">
                        {/* Mastery status badge */}
                        <span className={`text-[10px] font-bold px-2 py-0.5 rounded-full border flex items-center gap-1 ${
                          mastery === 'MASTERED'
                            ? 'bg-emerald-950/70 border-emerald-800 text-emerald-400'
                            : mastery === 'DEVELOPING'
                            ? 'bg-amber-950/70 border-amber-800 text-amber-400'
                            : mastery === 'NEEDS_REVIEW'
                            ? 'bg-rose-950/70 border-rose-800 text-rose-400'
                            : 'bg-stone-800 border-stone-700 text-stone-400'
                        }`}>
                          <Award size={10} />
                          {mastery || 'NOT_STARTED'}
                        </span>

                        {/* Completed lessons count */}
                        <span className="text-[11px] text-stone-400 bg-stone-950 px-2 py-1 rounded-lg border border-stone-800 flex items-center gap-1">
                          <BookOpen size={11} className="text-stone-500" />
                          <span>{lessonsCount} {isAr ? 'دروس' : 'lessons'}</span>
                        </span>

                        {/* Quiz score */}
                        <span className="text-[11px] font-mono font-medium text-stone-300 bg-stone-950 px-2 py-1 rounded-lg border border-stone-800">
                          {quizScore}% {isAr ? 'تقييم' : 'quiz'}
                        </span>

                        {/* Drill-down button to Learning Review */}
                        <button
                          onClick={() => setSelectedStudentForReview(student.id)}
                          className="px-2.5 py-1 rounded-lg bg-stone-800 hover:bg-amber-500 hover:text-stone-950 text-stone-300 font-semibold text-[11px] transition-all flex items-center gap-1 cursor-pointer shrink-0 border border-stone-700 hover:border-amber-400"
                        >
                          <span>{isAr ? 'تقرير التعلّم' : 'Learning Review'}</span>
                          <ChevronRight size={13} className={isAr ? 'rotate-180' : ''} />
                        </button>
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
};
