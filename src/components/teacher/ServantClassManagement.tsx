import React, { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'motion/react';
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
  ChevronRight,
  Key,
  Calendar,
  UserMinus,
  AlertTriangle,
  Sparkles,
  UserCheck
} from 'lucide-react';
import { useAuth } from '../../context/AuthContext';
import { getMyClass, assignStudentClass, ClassRosterStudent, ServantClassInfo } from '../../lib/classRosterService';
import { CLASS_GROUPS } from '../../lib/classGroups';
import { ClassGroupId, OnboardingActivationRequest, ChurchClassInstance } from '../../types';
import { getPendingActivationRequests, reviewActivationRequest } from '../../lib/onboardingService';
import { 
  getCurrentChurchYear, 
  regenerateClassCode, 
  removeStudentFromClass, 
  previewYearTransition, 
  startNewChurchYear,
  assignServantToClass 
} from '../../lib/churchYearService';
import { StudentLearningReviewView } from './StudentLearningReviewView';

interface ServantClassManagementProps {
  lang?: 'en' | 'ar';
}

export const ServantClassManagement: React.FC<ServantClassManagementProps> = ({
  lang = 'en'
}) => {
  const isAr = lang === 'ar';
  const { userData } = useAuth();
  const isAdmin = userData?.role === 'admin';

  const [loading, setLoading] = useState<boolean>(true);
  const [classInfo, setClassInfo] = useState<ServantClassInfo | null>(null);
  const [roster, setRoster] = useState<ClassRosterStudent[]>([]);
  const [loadError, setLoadError] = useState<string | null>(null);

  // Church Year & Class Instances state
  const [currentYear, setCurrentYear] = useState<string>('2026–2027');
  const [joinCode, setJoinCode] = useState<string>('');
  const [regeneratingCode, setRegeneratingCode] = useState<boolean>(false);
  const [codeSuccessMessage, setCodeSuccessMessage] = useState<string | null>(null);
  const [allClassInstances, setAllClassInstances] = useState<ChurchClassInstance[]>([]);

  // Student Removal state
  const [studentToRemove, setStudentToRemove] = useState<ClassRosterStudent | null>(null);
  const [isRemovingStudent, setIsRemovingStudent] = useState<boolean>(false);
  const [removalReason, setRemovalReason] = useState<string>('');

  // Admin New Church Year Modal state
  const [showAdminYearModal, setShowAdminYearModal] = useState<boolean>(false);
  const [adminYearStep, setAdminYearStep] = useState<1 | 2>(1);
  const [targetNewYear, setTargetNewYear] = useState<string>('2027–2028');
  const [confirmTypedYear, setConfirmTypedYear] = useState<string>('');
  const [previewList, setPreviewList] = useState<any[]>([]);
  const [loadingPreview, setLoadingPreview] = useState<boolean>(false);
  const [startingNewYear, setStartingNewYear] = useState<boolean>(false);
  const [yearActionSuccess, setYearActionSuccess] = useState<string | null>(null);
  const [yearActionError, setYearActionError] = useState<string | null>(null);
  const [studentExceptions, setStudentExceptions] = useState<Record<string, { action: 'REPEAT' | 'MANUAL' | 'GRADUATE', manualGrade?: string }>>({});

  // Drilldown state for student learning review
  const [selectedStudentForReview, setSelectedStudentForReview] = useState<string | null>(null);

  // Pending activation requests state
  const [pendingRequests, setPendingRequests] = useState<OnboardingActivationRequest[]>([]);
  const [loadingRequests, setLoadingRequests] = useState<boolean>(false);
  const [processingRequestId, setProcessingRequestId] = useState<string | null>(null);
  const [requestActionSuccess, setRequestActionSuccess] = useState<string | null>(null);

  // Assignment form state
  const [studentIdInput, setStudentIdInput] = useState<string>('');
  const [selectedGrade, setSelectedGrade] = useState<string>('');
  const [isSubmitting, setIsSubmitting] = useState<boolean>(false);
  const [assignmentSuccess, setAssignmentSuccess] = useState<string | null>(null);
  const [assignmentError, setAssignmentError] = useState<string | null>(null);

  // Load pending activation requests
  const loadRequests = async (groupId?: string) => {
    setLoadingRequests(true);
    try {
      const res = await getPendingActivationRequests(groupId);
      if (res.success) {
        setPendingRequests(res.requests || []);
      }
    } catch (_) {
    } finally {
      setLoadingRequests(false);
    }
  };

  // Load authoritative class and roster
  const loadClassData = async () => {
    setLoading(true);
    setLoadError(null);
    try {
      const [{ data, error }, churchYearRes] = await Promise.all([
        getMyClass(),
        getCurrentChurchYear().catch(() => null)
      ]);

      if (error || !data) {
        setLoadError(error?.message || (isAr ? 'تعذر تحميل بيانات الفصل' : 'Failed to load class data'));
        return;
      }

      const info = data.classInfo as ServantClassInfo;
      setClassInfo(info);
      setRoster(data.roster || []);

      if (churchYearRes && churchYearRes.success) {
        setCurrentYear(churchYearRes.currentChurchYear || '2026–2027');
        setAllClassInstances(churchYearRes.classInstances || []);
        const matchingInst = churchYearRes.classInstances?.find(i => i.classGroupId === info.classGroupId);
        if (matchingInst?.code) {
          setJoinCode(matchingInst.code);
        } else if (info.classCode) {
          setJoinCode(info.classCode);
        }
      } else if (info.classCode) {
        setJoinCode(info.classCode);
        if (info.churchYear) setCurrentYear(info.churchYear);
      }

      // Set default grade if available
      const groupGrades = info?.classGroupId && CLASS_GROUPS[info.classGroupId as ClassGroupId]?.grades;
      if (groupGrades && groupGrades.length > 0 && !selectedGrade) {
        setSelectedGrade(groupGrades[0].code);
      } else if (info?.grades && info.grades.length > 0 && !selectedGrade) {
        setSelectedGrade(info.grades[0]);
      }

      await loadRequests(info?.classGroupId);
    } catch (err: any) {
      setLoadError(err?.message || (isAr ? 'حدث خطأ غير متوقع' : 'Unexpected error loading class'));
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadClassData();
  }, []);

  const handleRegenerateCode = async () => {
    if (!classInfo?.classGroupId) return;
    setRegeneratingCode(true);
    setCodeSuccessMessage(null);
    try {
      const res = await regenerateClassCode(classInfo.classGroupId);
      if (res.success && res.newCode) {
        setJoinCode(res.newCode);
        setCodeSuccessMessage(isAr ? 'تم إنشاء كود جديد بنجاح! تم إلغاء الكود القديم دون التأثير على الطلاب المقيدين.' : 'New join code generated! Old code is invalidated; enrolled students remain safe.');
      } else {
        setLoadError(res.error || 'Failed to regenerate join code');
      }
    } catch (err: any) {
      setLoadError(err?.message || 'Error regenerating code');
    } finally {
      setRegeneratingCode(false);
    }
  };

  const handleConfirmRemoveStudent = async () => {
    if (!studentToRemove || !classInfo?.classGroupId) return;
    setIsRemovingStudent(true);
    try {
      const res = await removeStudentFromClass(
        classInfo.classGroupId, 
        studentToRemove.id, 
        removalReason,
        studentToRemove.membershipId
      );
      if (res.success) {
        setRequestActionSuccess(isAr ? `تم إخراج الطالب "${studentToRemove.name}" من كشف هذا العام. السجلات التاريخية محفوظة.` : `Student "${studentToRemove.name}" removed from this year's roster. History preserved.`);
        setStudentToRemove(null);
        setRemovalReason('');
        await loadClassData();
      } else {
        setLoadError(res.error || 'Failed to remove student');
      }
    } catch (err: any) {
      setLoadError(err?.message || 'Error removing student');
    } finally {
      setIsRemovingStudent(false);
    }
  };

  const handleOpenNewYearModal = async () => {
    setShowAdminYearModal(true);
    setAdminYearStep(1);
    setYearActionSuccess(null);
    setYearActionError(null);
    setLoadingPreview(true);
    try {
      const res = await previewYearTransition();
      if (res.success) {
        if (res.nextYear) setTargetNewYear(res.nextYear);
        setPreviewList(res.previewList || []);
      }
    } catch (err: any) {
      setYearActionError(err?.message || 'Could not load promotion preview');
    } finally {
      setLoadingPreview(false);
    }
  };

  const handleConfirmStartNewYear = async () => {
    if (confirmTypedYear.trim() !== targetNewYear.trim()) {
      setYearActionError(isAr ? `يرجى كتابة العام الدراسي الجديد (${targetNewYear}) للتأكيد.` : `Please type "${targetNewYear}" exactly to confirm.`);
      return;
    }
    setStartingNewYear(true);
    setYearActionError(null);
    try {
      const res = await startNewChurchYear(targetNewYear.trim(), studentExceptions);
      if (res.success) {
        setYearActionSuccess(isAr ? `تم بدء العام الكنسي الجديد (${targetNewYear}) بنجاح وتسكين الفصول والترقيات!` : `Church year "${targetNewYear}" successfully started! Classes created & students promoted.`);
        setCurrentYear(targetNewYear.trim());
        setShowAdminYearModal(false);
        setConfirmTypedYear('');
        await loadClassData();
      } else {
        setYearActionError(res.error || 'Failed to start new church year');
      }
    } catch (err: any) {
      setYearActionError(err?.message || 'Error starting new church year');
    } finally {
      setStartingNewYear(false);
    }
  };

  const handleReviewRequest = async (requestId: string, action: 'APPROVE' | 'REJECT', customGrade?: string) => {
    setProcessingRequestId(requestId);
    setRequestActionSuccess(null);
    setAssignmentError(null);

    try {
      const res = await reviewActivationRequest({
        requestId,
        action,
        assignedGrade: customGrade,
        reviewNotes: action === 'APPROVE' ? 'Approved by class servant' : 'Dismissed by servant'
      });

      if (!res.success) {
        setAssignmentError(res.error || (isAr ? 'فشل معالجة الطلب' : 'Failed to process request'));
        return;
      }

      setRequestActionSuccess(
        action === 'APPROVE'
          ? (isAr ? 'تمت الموافقة على الطالب وتسكينه في كشف الفصل بنجاح!' : 'Student approved and enrolled into official roster successfully!')
          : (isAr ? 'تم رفض الطلب' : 'Request rejected')
      );

      // Refresh both pending requests and authoritative roster
      await loadClassData();
    } catch (err: any) {
      setAssignmentError(err?.message || 'Error processing request');
    } finally {
      setProcessingRequestId(null);
    }
  };

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
        selectedGrade,
        classInfo.classInstanceId
      );

      if (!success || error) {
        const rawErr = error?.message || '';
        let friendlyMsg = isAr ? 'فشل قيد وتسكين الطالب' : 'Failed to enroll student';

        if (rawErr.includes('UNAUTHORIZED_SERVANT') || rawErr.includes('Servant is not assigned')) {
          friendlyMsg = isAr
            ? 'ليس لديك الصلاحية: الخادم غير مسكن رسمياً على هذا الفصل في العام الكنسي الحالي.'
            : 'You are not assigned to this class instance in the active church year.';
        } else if (rawErr.includes('INCOMPATIBLE_GRADE') || rawErr.includes('Grade Incompatibility') || rawErr.includes('INVALID_GRADE')) {
          friendlyMsg = isAr 
            ? 'المرحلة الدراسية المختارة غير مطابقة لهذا الفصل الدراسي وفقاً للائحة الكنسية.' 
            : 'The selected grade is not compatible with this class group.';
        } else if (rawErr.includes('ALREADY_ENROLLED') || rawErr.includes('already has an active class membership')) {
          friendlyMsg = isAr
            ? 'الطالب مسجل بالفعل في كشف فصل نشط لهذا العام الكنسي.'
            : 'The student already has an active class membership in this church year.';
        } else if (rawErr.includes('NOT_A_STUDENT') || rawErr.includes('does not hold the student role')) {
          friendlyMsg = isAr
            ? 'المستخدم المحدد ليس في مرحلة طالب.'
            : 'The selected user does not hold the student role.';
        } else if (rawErr.includes('NO_ACTIVE_YEAR')) {
          friendlyMsg = isAr
            ? 'لا يوجد عام كنسي نشط ومفعل حالياً في قاعدة البيانات.'
            : 'No active church year configured in the database.';
        } else if (rawErr.includes('STUDENT_NOT_FOUND')) {
          friendlyMsg = isAr 
            ? `لم يتم العثور على طالب بالمعرّف "${trimmedId}". تأكد من صحة المعرّف أو السجل.` 
            : `Student with ID "${trimmedId}" was not found in church records.`;
        } else if (rawErr.includes('FORBIDDEN') || rawErr.includes('Unauthorized')) {
          friendlyMsg = isAr 
            ? 'ليس لديك الصلاحية لإدارة هذا الفصل أو تسكين طلاب به.' 
            : 'You are not authorized to enroll students in this class.';
        } else if (rawErr.includes('PERSISTENCE_FAILED')) {
          friendlyMsg = isAr 
            ? 'فشل حفظ التسكين في قاعدة البيانات. لم يتم التعديل.' 
            : 'Database persistence failed. Changes were not saved.';
        } else if (rawErr) {
          friendlyMsg = rawErr;
        }

        setAssignmentError(friendlyMsg);
        return;
      }

      // Success confirmed by authoritative RPC
      setAssignmentSuccess(
        isAr 
          ? `تم قيد وتسكين الطالب (${trimmedId}) رسمياً في كشف الفصل للعام الكنسي الحالي!`
          : `Student (${trimmedId}) successfully enrolled and persisted in active class roster!`
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
      <div className="bg-stone-900 border border-stone-800 rounded-2xl p-5 shadow-xl flex flex-col md:flex-row items-start md:items-center justify-between gap-4">
        <div className="flex items-start sm:items-center gap-3.5">
          <div className="w-12 h-12 rounded-xl bg-amber-500/10 border border-amber-500/20 flex items-center justify-center text-amber-400 shrink-0">
            <Users size={24} />
          </div>
          <div>
            <div className="flex items-center gap-2 flex-wrap">
              <h2 className="text-xl font-bold text-stone-100">
                {isAr ? 'إدارة الفصل وقائمة الطلاب' : 'Class Management & Roster'}
              </h2>
              <span className="text-[10px] uppercase font-bold tracking-wider px-2 py-0.5 rounded-full bg-emerald-500/10 text-emerald-400 border border-emerald-500/20 flex items-center gap-1">
                <ShieldCheck size={11} />
                {isAr ? 'موثّق' : 'Authoritative'}
              </span>
              <span className="text-[10px] font-bold px-2.5 py-0.5 rounded-full bg-amber-500/20 text-amber-300 border border-amber-500/30 flex items-center gap-1">
                <Calendar size={11} className="text-amber-400" />
                <span>{currentYear}</span>
              </span>
            </div>

            <div className="flex items-center gap-2 mt-1 flex-wrap text-xs text-stone-400">
              <span>
                {classInfo 
                  ? (isAr ? `فصلك: ${classInfo.classNameAr || classInfo.className}` : `Class: ${classInfo.className}`)
                  : (isAr ? 'جاري التحميل...' : 'Loading...')}
              </span>
              {classInfo?.servants && classInfo.servants.length > 0 && (
                <>
                  <span className="text-stone-600">•</span>
                  <span className="text-stone-300 flex items-center gap-1">
                    <span>👥 {isAr ? 'الخدام المعتمدون:' : 'Servants:'}</span>
                    <span className="font-semibold text-amber-200">{classInfo.servants.join(', ')}</span>
                  </span>
                </>
              )}
            </div>

            {joinCode && (
              <div className="flex items-center gap-2 mt-2">
                <span className="text-[11px] text-stone-400">{isAr ? 'كود انضمام الطلاب للعام الحالي:' : 'Current-Year Join Code:'}</span>
                <span className="font-mono font-black text-xs px-2.5 py-0.5 rounded-lg bg-stone-950 text-amber-400 border border-amber-500/40 tracking-wider">
                  {joinCode}
                </span>
                <button
                  type="button"
                  onClick={handleRegenerateCode}
                  disabled={regeneratingCode}
                  className="text-[11px] text-amber-400 hover:text-amber-300 flex items-center gap-1 font-semibold underline underline-offset-2 cursor-pointer ml-1"
                >
                  <Key size={11} className={regeneratingCode ? 'animate-spin' : ''} />
                  <span>{isAr ? 'تجديد الكود' : 'Regenerate'}</span>
                </button>
              </div>
            )}
          </div>
        </div>

        <div className="flex items-center gap-2 flex-wrap self-end md:self-center">
          {isAdmin && (
            <button
              onClick={handleOpenNewYearModal}
              className="px-3.5 py-2 rounded-xl bg-gradient-to-r from-amber-600 to-amber-700 hover:from-amber-500 hover:to-amber-600 text-white text-xs font-bold flex items-center gap-1.5 transition-all shadow-md cursor-pointer shrink-0"
            >
              <Sparkles size={13} />
              <span>{isAr ? 'بدء عام كنسي جديد' : 'Start New Church Year'}</span>
            </button>
          )}

          <button
            onClick={loadClassData}
            disabled={loading}
            className="px-3.5 py-2 rounded-xl bg-stone-800 hover:bg-stone-700 text-stone-300 text-xs font-semibold flex items-center gap-1.5 transition-colors border border-stone-700 cursor-pointer disabled:opacity-50 shrink-0"
          >
            <RefreshCw size={13} className={loading ? 'animate-spin' : ''} />
            <span>{isAr ? 'تحديث السجل' : 'Refresh Roster'}</span>
          </button>
        </div>
      </div>

      {codeSuccessMessage && (
        <div className="bg-amber-950/40 border border-amber-800/60 rounded-xl p-4 text-amber-200 text-xs flex items-center gap-2.5">
          <Key size={16} className="text-amber-400 shrink-0" />
          <span>{codeSuccessMessage}</span>
        </div>
      )}

      {yearActionSuccess && (
        <div className="bg-emerald-950/40 border border-emerald-800/60 rounded-xl p-4 text-emerald-200 text-xs flex items-center gap-2.5">
          <CheckCircle2 size={16} className="text-emerald-400 shrink-0" />
          <span>{yearActionSuccess}</span>
        </div>
      )}

      {loadError && (
        <div className="bg-rose-950/40 border border-rose-800/60 rounded-xl p-4 text-rose-200 text-xs flex items-center gap-2.5">
          <AlertCircle size={16} className="text-rose-400 shrink-0" />
          <span>{loadError}</span>
        </div>
      )}

      {requestActionSuccess && (
        <div className="bg-emerald-950/40 border border-emerald-800/60 rounded-xl p-4 text-emerald-200 text-xs flex items-center gap-2.5">
          <CheckCircle2 size={16} className="text-emerald-400 shrink-0" />
          <span>{requestActionSuccess}</span>
        </div>
      )}

      {/* Pending Account Activations & Roster Approvals Section */}
      <div className="bg-stone-900/90 border border-amber-500/30 rounded-2xl p-5 shadow-xl space-y-4">
        <div className="flex items-center justify-between pb-3 border-b border-stone-800">
          <div className="flex items-center gap-2.5">
            <div className="w-8 h-8 rounded-lg bg-amber-500/20 text-amber-400 flex items-center justify-center font-bold">
              <Clock size={16} />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h3 className="text-sm font-bold text-stone-100">
                  {isAr ? 'طلبات تفعيل الحسابات والتسكين بالكشف' : 'Pending Activation & Roster Requests'}
                </h3>
                {pendingRequests.length > 0 && (
                  <span className="px-2 py-0.5 rounded-full text-[10px] font-extrabold bg-amber-500 text-stone-950 animate-pulse">
                    {pendingRequests.length} {isAr ? 'جديد' : 'New'}
                  </span>
                )}
              </div>
              <p className="text-[11px] text-stone-400 mt-0.5">
                {isAr
                  ? 'طلبات الطلاب الجدد لاختيار الصف والانضمام إلى فصلك لاعتمادها يدوياً'
                  : 'Student requests awaiting your manual approval for class roster assignment'}
              </p>
            </div>
          </div>

          <button
            type="button"
            onClick={() => loadRequests(classInfo?.classGroupId)}
            disabled={loadingRequests}
            className="text-[11px] text-amber-400/90 hover:text-amber-300 flex items-center gap-1 font-semibold cursor-pointer"
          >
            <RefreshCw size={11} className={loadingRequests ? 'animate-spin' : ''} />
            <span>{isAr ? 'تحديث الطلبات' : 'Refresh'}</span>
          </button>
        </div>

        {loadingRequests ? (
          <div className="py-6 text-center text-xs text-stone-500 flex items-center justify-center gap-2">
            <RefreshCw size={14} className="animate-spin text-amber-500" />
            <span>{isAr ? 'جاري فحص الطلبات...' : 'Checking pending requests...'}</span>
          </div>
        ) : pendingRequests.length === 0 ? (
          <div className="py-5 text-center text-xs text-stone-500">
            {isAr
              ? 'لا توجد طلبات تفعيل أو تسكين معلقة لهذا الفصل حالياً. كل الطلاب مسكنون رسمياً.'
              : 'No pending onboarding or roster requests for this class. All students are approved.'}
          </div>
        ) : (
          <div className="divide-y divide-stone-800 space-y-3">
            {pendingRequests.map((req) => {
              const isProcessing = processingRequestId === req.id;
              return (
                <div 
                  key={req.id}
                  className="pt-3 first:pt-0 flex flex-col md:flex-row md:items-center justify-between gap-3 text-xs bg-stone-950/40 p-3 rounded-xl border border-stone-800/80"
                >
                  <div className="flex items-start gap-3">
                    <div className="w-10 h-10 rounded-full bg-amber-500/10 border border-amber-500/30 flex items-center justify-center text-amber-400 font-bold shrink-0">
                      {req.studentName.charAt(0) || 'S'}
                    </div>
                    <div className="space-y-1">
                      <div className="flex items-center gap-2">
                        <span className="font-bold text-stone-100 text-sm">{req.studentName}</span>
                        <span className="text-[10px] px-2 py-0.5 rounded-full bg-amber-500/20 text-amber-300 font-bold border border-amber-500/30">
                          {req.requestedGrade}
                        </span>
                      </div>
                      <div className="text-[11px] text-stone-400 flex items-center gap-2 flex-wrap">
                        <span>ID: <code className="text-stone-300">{req.studentId}</code></span>
                        {req.phone && <span>• 📞 {req.phone}</span>}
                        {req.email && <span>• ✉️ {req.email}</span>}
                        <span>• 🕒 {new Date(req.requestedAt).toLocaleDateString()}</span>
                      </div>
                      {req.notes && (
                        <div className="text-[11px] text-amber-200/80 bg-amber-950/30 p-2 rounded-lg border border-amber-900/40 italic">
                          "{req.notes}"
                        </div>
                      )}
                    </div>
                  </div>

                  {/* Actions */}
                  <div className="flex items-center gap-2 shrink-0 self-end md:self-center">
                    <button
                      type="button"
                      disabled={isProcessing}
                      onClick={() => handleReviewRequest(req.id, 'REJECT')}
                      className="px-3 py-1.5 rounded-lg border border-stone-700 hover:bg-stone-800 text-stone-400 hover:text-stone-200 text-xs font-semibold transition-colors cursor-pointer disabled:opacity-50"
                    >
                      {isAr ? 'رفض' : 'Reject'}
                    </button>
                    <button
                      type="button"
                      disabled={isProcessing}
                      onClick={() => handleReviewRequest(req.id, 'APPROVE', req.requestedGrade)}
                      className="px-4 py-1.5 rounded-lg bg-emerald-600 hover:bg-emerald-500 text-white text-xs font-bold transition-all shadow-sm flex items-center gap-1.5 cursor-pointer disabled:opacity-50"
                    >
                      {isProcessing ? (
                        <RefreshCw size={12} className="animate-spin" />
                      ) : (
                        <CheckCircle2 size={13} />
                      )}
                      <span>{isAr ? 'قبول وتسكين بالكشف' : 'Approve & Enroll'}</span>
                    </button>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>

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

                        {/* Authorized Servant/Admin Remove Student Button */}
                        <button
                          type="button"
                          onClick={() => {
                            setStudentToRemove(student);
                            setRemovalReason('');
                          }}
                          className="p-1.5 rounded-lg bg-stone-800 hover:bg-rose-950/60 hover:text-rose-400 text-stone-400 transition-colors border border-stone-700/80 cursor-pointer shrink-0"
                          title={isAr ? 'إلغاء قيد الطالب من كشف هذا العام' : 'Remove student from current-year class'}
                        >
                          <UserMinus size={13} />
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

      {/* Admin Church-Wide Class Instances & Servant Assignments Overview */}
      {isAdmin && allClassInstances.length > 0 && (
        <div className="bg-stone-900 border border-stone-800 rounded-2xl p-5 shadow-xl space-y-4">
          <div className="flex items-center justify-between pb-3 border-b border-stone-800">
            <div className="flex items-center gap-2">
              <Sparkles size={18} className="text-amber-400" />
              <h3 className="text-sm font-bold text-stone-100">
                {isAr ? `فصول العام الكنسي المعتمدة (${currentYear})` : `Church-Wide Class Instances (${currentYear})`}
              </h3>
            </div>
            <span className="text-[11px] px-2 py-0.5 rounded-full bg-amber-500/10 text-amber-300 font-bold border border-amber-500/20">
              {isAr ? 'إدارة المشرف العام' : 'Admin View'}
            </span>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">
            {allClassInstances.map((inst) => (
              <div 
                key={inst.id}
                className="p-3.5 rounded-xl bg-stone-950/60 border border-stone-800/80 space-y-2 text-xs"
              >
                <div className="flex items-center justify-between">
                  <span className="font-bold text-stone-100 text-sm">{isAr ? inst.nameAr : inst.nameEn}</span>
                  <span className="font-mono text-[10px] px-2 py-0.5 rounded bg-amber-500/10 text-amber-400 border border-amber-500/30">
                    {inst.code}
                  </span>
                </div>
                <div className="text-[11px] text-stone-400 flex items-center justify-between">
                  <span>{isAr ? 'الخدام المكلفون:' : 'Assigned Servants:'}</span>
                  <span className="font-medium text-stone-300">
                    {inst.servantIds?.length > 0 ? inst.servantIds.join(', ') : (isAr ? 'لم يُحدد' : 'None')}
                  </span>
                </div>
                <div className="text-[10px] text-stone-500">
                  ID: <code className="text-stone-400">{inst.id}</code>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Confirmation Modal: Remove Student from Current Year Class */}
      <AnimatePresence>
        {studentToRemove && (
          <div className="fixed inset-0 z-50 bg-black/80 backdrop-blur-xs flex items-center justify-center p-4">
            <motion.div
              initial={{ scale: 0.95, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              exit={{ scale: 0.95, opacity: 0 }}
              className="bg-stone-900 border border-stone-800 rounded-3xl p-6 max-w-md w-full shadow-2xl space-y-4 text-xs"
            >
              <div className="flex items-center gap-3 text-rose-400">
                <div className="w-10 h-10 rounded-full bg-rose-500/10 border border-rose-500/20 flex items-center justify-center">
                  <UserMinus size={20} />
                </div>
                <div>
                  <h3 className="font-bold text-base text-stone-100">
                    {isAr ? 'إلغاء قيد الطالب من الفصل' : 'Remove Student from Class'}
                  </h3>
                  <p className="text-[11px] text-stone-400">
                    {isAr ? `العام الكنسي: ${currentYear}` : `Church Year: ${currentYear}`}
                  </p>
                </div>
              </div>

              <div className="bg-stone-950/60 p-3.5 rounded-xl border border-stone-800 space-y-1.5 text-stone-300">
                <p>
                  <strong className="text-stone-100">{studentToRemove.name}</strong> ({studentToRemove.grade})
                </p>
                <p className="text-[11px] text-stone-400 leading-relaxed">
                  {isAr 
                    ? '⚠️ سيؤدي هذا الإجراء فقط إلى إنهاء قيد الطالب في فصل هذا العام. لن يتم حذف الحساب أو نتائج الاختبارات أو سجل التقدم أو علاقات أولياء الأمور.' 
                    : '⚠️ This will only end active membership for the current church year. The user account, progress, quiz history, and parent links will never be deleted.'}
                </p>
              </div>

              <div>
                <label className="block text-stone-300 font-medium mb-1">
                  {isAr ? 'سبب الإلغاء (اختياري):' : 'Reason for removal (optional):'}
                </label>
                <input
                  type="text"
                  value={removalReason}
                  onChange={(e) => setRemovalReason(e.target.value)}
                  placeholder={isAr ? 'مثال: انتقال لفصل آخر، تكرار...' : 'e.g. Transferred, moved to another group...'}
                  className="w-full bg-stone-950 border border-stone-800 focus:border-amber-500 rounded-xl px-3 py-2 text-stone-100 outline-none"
                />
              </div>

              <div className="flex items-center justify-end gap-2 pt-2">
                <button
                  type="button"
                  onClick={() => setStudentToRemove(null)}
                  disabled={isRemovingStudent}
                  className="px-4 py-2 rounded-xl border border-stone-700 text-stone-300 hover:bg-stone-800 font-semibold cursor-pointer"
                >
                  {isAr ? 'إلغاء' : 'Cancel'}
                </button>
                <button
                  type="button"
                  onClick={handleConfirmRemoveStudent}
                  disabled={isRemovingStudent}
                  className="px-4 py-2 rounded-xl bg-rose-600 hover:bg-rose-500 text-white font-bold flex items-center gap-1.5 transition-colors cursor-pointer"
                >
                  {isRemovingStudent ? (
                    <RefreshCw size={13} className="animate-spin" />
                  ) : (
                    <UserMinus size={13} />
                  )}
                  <span>{isAr ? 'تأكيد الإخراج من الفصل' : 'Confirm Removal'}</span>
                </button>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      {/* Admin Modal: Start New Church Year (2-Step Safety Execution) */}
      <AnimatePresence>
        {showAdminYearModal && (
          <div className="fixed inset-0 z-50 bg-black/85 backdrop-blur-xs flex items-center justify-center p-4 overflow-y-auto">
            <motion.div
              initial={{ scale: 0.95, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              exit={{ scale: 0.95, opacity: 0 }}
              className="bg-stone-900 border border-stone-800 rounded-3xl p-6 max-w-2xl w-full shadow-2xl space-y-4 text-xs my-8"
            >
              <div className="flex items-center justify-between pb-3 border-b border-stone-800">
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 rounded-xl bg-amber-500/10 border border-amber-500/30 flex items-center justify-center text-amber-400">
                    <Calendar size={20} />
                  </div>
                  <div>
                    <h3 className="font-bold text-base text-stone-100">
                      {isAr ? 'بدء عام كنسي جديد لمدارس الأحد' : 'Start New Church Year'}
                    </h3>
                    <p className="text-[11px] text-stone-400">
                      {isAr ? `العام الحالي: ${currentYear} ➔ العام الجديد: ${targetNewYear}` : `Current: ${currentYear} ➔ Target: ${targetNewYear}`}
                    </p>
                  </div>
                </div>
                <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-amber-500/20 text-amber-300">
                  {isAr ? `خطوة ${adminYearStep} من 2` : `Step ${adminYearStep} of 2`}
                </span>
              </div>

              {yearActionError && (
                <div className="bg-rose-950/40 border border-rose-800/60 rounded-xl p-3 text-rose-200 text-xs flex items-center gap-2">
                  <AlertCircle size={15} className="text-rose-400 shrink-0" />
                  <span>{yearActionError}</span>
                </div>
              )}

              {/* Step 1: Promotion Preview & Administrative Exceptions */}
              {adminYearStep === 1 && (
                <div className="space-y-4">
                  <div className="bg-amber-950/30 border border-amber-900/50 rounded-xl p-3.5 text-amber-200 text-xs space-y-1">
                    <div className="font-bold flex items-center gap-1.5">
                      <AlertTriangle size={14} className="text-amber-400" />
                      <span>{isAr ? 'تحذير أمان حاسم للعام الجديد' : 'Critical Church Year Rollover Safety'}</span>
                    </div>
                    <p className="text-[11px] text-amber-200/80 leading-relaxed">
                      {isAr 
                        ? 'العام السابق سيتحول تلقائياً إلى سجل تاريخي ولن يتم حذف أي كشف أو نتائج أو علاقات. سيتم إنشاء 6 فصول جديدة بأكواد انضمام جديدة وترقية الطلاب تلقائياً وفقاً للسلم الدراسي المعتمد.' 
                        : 'The previous year will be safely archived without deleting any past memberships, quizzes, progress, or parent links. Exactly 6 new class instances will be created with fresh join codes, and students will be promoted deterministically.'}
                    </p>
                  </div>

                  <div>
                    <label className="block text-stone-300 font-bold mb-1">
                      {isAr ? 'العام الكنسي المستهدف:' : 'Target Church Year:'}
                    </label>
                    <input
                      type="text"
                      value={targetNewYear}
                      onChange={(e) => setTargetNewYear(e.target.value)}
                      placeholder="e.g. 2027–2028"
                      className="w-full bg-stone-950 border border-stone-800 focus:border-amber-500 rounded-xl px-3.5 py-2 text-stone-100 font-bold"
                    />
                  </div>

                  <div>
                    <h4 className="font-bold text-stone-200 mb-2 flex items-center justify-between">
                      <span>{isAr ? 'معاينة ترقيات الطلاب والاستثناءات:' : 'Student Promotion Preview & Exceptions:'}</span>
                      <span className="text-[11px] text-stone-400">{previewList.length} {isAr ? 'طلاب' : 'students'}</span>
                    </h4>

                    {loadingPreview ? (
                      <div className="py-8 text-center text-stone-500 flex items-center justify-center gap-2">
                        <RefreshCw size={14} className="animate-spin text-amber-400" />
                        <span>{isAr ? 'جاري حساب الترقيات...' : 'Calculating promotions...'}</span>
                      </div>
                    ) : (
                      <div className="max-h-56 overflow-y-auto divide-y divide-stone-800 border border-stone-800 rounded-xl bg-stone-950/40 p-2">
                        {previewList.map((p) => {
                          const currentEx = studentExceptions[p.studentId]?.action || 'DEFAULT';
                          return (
                            <div key={p.studentId} className="py-2 px-1 flex flex-col sm:flex-row sm:items-center justify-between gap-2 text-[11px]">
                              <div>
                                <span className="font-bold text-stone-200">{p.name}</span>
                                <span className="text-stone-400 ml-2">
                                  {p.currentGrade} ➔ <strong className="text-amber-400">{p.projectedGrade}</strong>
                                </span>
                                {p.isGraduated && (
                                  <span className="ml-2 text-[10px] px-1.5 py-0.2 bg-purple-500/20 text-purple-300 rounded">
                                    {isAr ? 'تخرج' : 'Graduate'}
                                  </span>
                                )}
                              </div>
                              <div className="flex items-center gap-1.5 shrink-0">
                                <select
                                  value={currentEx}
                                  onChange={(e) => {
                                    const val = e.target.value;
                                    setStudentExceptions(prev => {
                                      const next = { ...prev };
                                      if (val === 'DEFAULT') delete next[p.studentId];
                                      else next[p.studentId] = { action: val as any };
                                      return next;
                                    });
                                  }}
                                  className="bg-stone-900 border border-stone-700 text-stone-200 rounded px-2 py-1 text-[10px] outline-none"
                                >
                                  <option value="DEFAULT">{isAr ? 'ترقية عادية' : 'Default Promotion'}</option>
                                  <option value="REPEAT">{isAr ? 'إعادة السنة (بقاء)' : 'Repeat Grade'}</option>
                                  <option value="GRADUATE">{isAr ? 'تخرج/مغادرة' : 'Graduate/Leave'}</option>
                                </select>
                              </div>
                            </div>
                          );
                        })}
                      </div>
                    )}
                  </div>

                  <div className="flex items-center justify-end gap-2 pt-2 border-t border-stone-800">
                    <button
                      type="button"
                      onClick={() => setShowAdminYearModal(false)}
                      className="px-4 py-2 rounded-xl border border-stone-700 text-stone-300 hover:bg-stone-800 font-semibold cursor-pointer"
                    >
                      {isAr ? 'إلغاء' : 'Cancel'}
                    </button>
                    <button
                      type="button"
                      onClick={() => setAdminYearStep(2)}
                      className="px-4 py-2 rounded-xl bg-amber-500 hover:bg-amber-400 text-stone-950 font-bold flex items-center gap-1.5 cursor-pointer shadow-md"
                    >
                      <span>{isAr ? 'متابعة إلى خطوة التأكيد' : 'Proceed to Confirmation'}</span>
                      <ChevronRight size={14} className={isAr ? 'rotate-180' : ''} />
                    </button>
                  </div>
                </div>
              )}

              {/* Step 2: Strict Typed Confirmation Flow */}
              {adminYearStep === 2 && (
                <div className="space-y-4">
                  <div className="bg-rose-950/40 border border-rose-800/60 rounded-xl p-4 text-rose-200 text-xs space-y-2">
                    <div className="font-bold text-sm flex items-center gap-2">
                      <AlertCircle size={16} className="text-rose-400" />
                      <span>{isAr ? 'تأكيد كتابي إلزامي لمنع التفعيل الخاطئ' : 'Strict Typed Confirmation Required'}</span>
                    </div>
                    <p className="text-[11px] leading-relaxed">
                      {isAr
                        ? `لتأكيد بدء العام الكنسي "${targetNewYear}"، يرجى كتابة اسم العام بالضبط في المربع أدناه. هذا الإجراء سينشئ فوراً الفصول الستة المعتمدة ويقوم بترحيل الطلاب.`
                        : `To confirm starting church year "${targetNewYear}", please type "${targetNewYear}" exactly in the box below. This will create the six authoritative class instances and execute student promotions.`}
                    </p>
                  </div>

                  <div>
                    <label className="block text-stone-300 font-bold mb-1.5">
                      {isAr ? `اكتب "${targetNewYear}" للتأكيد:` : `Type "${targetNewYear}" to confirm:`}
                    </label>
                    <input
                      type="text"
                      value={confirmTypedYear}
                      onChange={(e) => setConfirmTypedYear(e.target.value)}
                      placeholder={targetNewYear}
                      className="w-full bg-stone-950 border border-stone-800 focus:border-amber-500 rounded-xl px-3.5 py-2.5 text-stone-100 font-mono font-bold text-sm"
                    />
                  </div>

                  <div className="flex items-center justify-between pt-3 border-t border-stone-800">
                    <button
                      type="button"
                      onClick={() => setAdminYearStep(1)}
                      disabled={startingNewYear}
                      className="px-4 py-2 rounded-xl border border-stone-700 text-stone-300 hover:bg-stone-800 font-semibold cursor-pointer"
                    >
                      {isAr ? 'الرجوع للمعاينة' : 'Back to Preview'}
                    </button>
                    <button
                      type="button"
                      onClick={handleConfirmStartNewYear}
                      disabled={startingNewYear || confirmTypedYear.trim() !== targetNewYear.trim()}
                      className="px-5 py-2.5 rounded-xl bg-emerald-600 hover:bg-emerald-500 disabled:opacity-40 text-white font-bold flex items-center gap-2 transition-all shadow-md cursor-pointer"
                    >
                      {startingNewYear ? (
                        <>
                          <RefreshCw size={14} className="animate-spin" />
                          <span>{isAr ? 'جاري تدشين العام الجديد...' : 'Starting New Year...'}</span>
                        </>
                      ) : (
                        <>
                          <CheckCircle2 size={15} />
                          <span>{isAr ? 'تأكيد وبدء العام الكنسي الجديد' : 'Confirm & Start New Church Year'}</span>
                        </>
                      )}
                    </button>
                  </div>
                </div>
              )}
            </motion.div>
          </div>
        )}
      </AnimatePresence>
    </div>
  );
};
