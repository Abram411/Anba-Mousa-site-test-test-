import React, { useState, useRef } from 'react';
import { 
  Mic, 
  FileText, 
  Wand2, 
  Upload, 
  Users, 
  ShieldAlert, 
  CheckCircle2, 
  ArrowLeft, 
  Edit3, 
  Eye, 
  Plus, 
  Trash2, 
  RotateCcw,
  Sparkles,
  ExternalLink,
  ShieldCheck,
  Globe,
  Award,
  BookOpen,
  School
} from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';
import { useAuth } from '../../context/AuthContext';
import { useLessons } from '../../context/LessonsContext';
import { Lesson, QuizQuestion, LessonSource, PresentationSlide } from '../../types';
import { LessonEditModal } from './LessonEditModal';
import { AttendanceVisitationTracker } from './AttendanceVisitationTracker';
import { UserCheck } from 'lucide-react';

import { SessionManager } from '../sunday-school/teacher/SessionManager';
import { SourceIngestionStudio } from '../sunday-school/teacher/SourceIngestionStudio';
import { LessonVersionStudio } from '../sunday-school/teacher/LessonVersionStudio';
import { TeacherMasteryReview } from '../sunday-school/teacher/TeacherMasteryReview';
import { EvidenceCoverageModal } from '../sunday-school/evidence/EvidenceCoverageModal';
import { PdfDocumentViewer } from '../sunday-school/viewers/PdfDocumentViewer';
import { SlideDeckViewer } from '../sunday-school/viewers/SlideDeckViewer';

interface TeacherDashboardProps {
  onBackToApp?: () => void;
  onOpenParentPortal?: () => void;
  onPreviewLesson?: (lessonId: string) => void;
  lang?: 'en' | 'ar';
}

export function TeacherDashboard({ 
  onBackToApp, 
  onOpenParentPortal,
  onPreviewLesson,
  lang = 'en' 
}: TeacherDashboardProps) {
  const { userData } = useAuth();
  const { 
    lessons, 
    addLesson, 
    updateLesson, 
    deleteLesson, 
    togglePublish,
    classSessions,
    lessonSources,
    evidenceMaps,
    lessonOutlines,
    lessonVersions,
    servantComments,
    studentProgress,
    quizAttempts,
    studentMasteries,
    addClassSession,
    updateClassSession,
    addLessonSource,
    deleteLessonSource,
    saveEvidenceMap,
    saveLessonOutline,
    approveLessonOutline,
    saveLessonVersion,
    approveLessonVersion,
    publishLessonVersion,
    addServantComment,
    resolveServantComment,
    updateStudentMastery
  } = useLessons();

  const [activeTab, setActiveTab] = useState<'attendance' | 'sundaySchool' | 'mastery' | 'ai' | 'lessons' | 'moderation'>('sundaySchool');
  const [selectedSessionId, setSelectedSessionId] = useState<string>(() => classSessions[0]?.id || 'cs-2026-09-27');
  
  // Active session and lesson resolution
  const activeSession = classSessions.find(s => s.id === selectedSessionId) || classSessions[0];
  const activeLessonId = activeSession?.activeLessonId || 'l-cross-01';
  const activeLesson = lessons.find(l => l.id === activeLessonId) || lessons[0];

  // Domain records for active lesson
  const activeSources = lessonSources.filter(s => s.sessionId === activeSession?.id || s.lessonId === activeLessonId);
  const activeEvidenceMap = evidenceMaps[activeLessonId];
  const activeOutline = lessonOutlines[activeLessonId];
  const activeVersions = lessonVersions[activeLessonId] || [];

  // Viewer Modals
  const [viewingSource, setViewingSource] = useState<LessonSource | null>(null);
  const [viewingSlides, setViewingSlides] = useState<PresentationSlide[] | null>(null);
  const [showEvidenceModal, setShowEvidenceModal] = useState<boolean>(false);

  const [isRecording, setIsRecording] = useState(false);
  const [aiStatus, setAiStatus] = useState<'idle' | 'recording' | 'processing' | 'done' | 'error'>('idle');
  const [generatedData, setGeneratedData] = useState<any>(null);
  
  // Lesson editing state
  const [editingLesson, setEditingLesson] = useState<Lesson | null>(null);

  // Moderation state
  const [flaggedPosts, setFlaggedPosts] = useState<Array<{ id: string; author: string; content: string; flagReason: string }>>([
    {
      id: 'flag-1',
      author: 'George N.',
      content: 'Can someone share their homework answers before Sunday service?',
      flagReason: lang === 'ar' ? 'طلب إجابات الواجب' : 'Requesting homework answers'
    }
  ]);
  
  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const audioChunksRef = useRef<Blob[]>([]);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const startRecording = async () => {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      const mediaRecorder = new MediaRecorder(stream);
      mediaRecorderRef.current = mediaRecorder;
      audioChunksRef.current = [];

      mediaRecorder.ondataavailable = (event) => {
        if (event.data.size > 0) {
          audioChunksRef.current.push(event.data);
        }
      };

      mediaRecorder.onstop = async () => {
        const audioBlob = new Blob(audioChunksRef.current, { type: 'audio/webm' });
        await processAudio(audioBlob);
      };

      mediaRecorder.start();
      setAiStatus('recording');
      setIsRecording(true);
    } catch (err) {
      console.warn("Could not access microphone:", err);
      setAiStatus('error');
    }
  };

  const stopRecording = () => {
    if (mediaRecorderRef.current && isRecording) {
      mediaRecorderRef.current.stop();
      setIsRecording(false);
      setAiStatus('processing');
      mediaRecorderRef.current.stream.getTracks().forEach(track => track.stop());
    }
  };

  const handleRecord = () => {
    if (aiStatus === 'idle' || aiStatus === 'error' || aiStatus === 'done') {
      startRecording();
    } else if (aiStatus === 'recording') {
      stopRecording();
    }
  };

  const handleFileUpload = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (file) {
      setAiStatus('processing');
      await processAudio(file);
    }
  };

  const processAudio = async (fileOrBlob: Blob | File) => {
    try {
      const formData = new FormData();
      formData.append('audio', fileOrBlob, 'recording.webm');

      const response = await fetch('/api/generate-lesson', {
        method: 'POST',
        body: formData,
      });

      if (!response.ok) throw new Error("Failed to process audio");
      const data = await response.json();
      setGeneratedData(data.result);
      setAiStatus('done');
    } catch (err) {
      console.warn("Audio generation warning:", err);
      setAiStatus('error');
    }
  };

  const handlePublishGeneratedLesson = () => {
    if (!generatedData) return;
    
    // Transform AI quiz into standard QuizQuestion structure
    const formattedQuiz: QuizQuestion[] = (generatedData.quiz || []).map((q: any) => ({
      question: q.question,
      options: q.options || ['True', 'False'],
      correctIndex: q.correctIndex ?? 0,
      type: 'multiple_choice'
    }));

    addLesson({
      title: generatedData.title || (lang === 'ar' ? 'درس جديد' : 'New Sunday School Lesson'),
      summary: generatedData.summary || '',
      status: 'published',
      date: new Date().toISOString().split('T')[0],
      pointsAvailable: 150,
      quiz: formattedQuiz.length > 0 ? formattedQuiz : undefined
    });

    alert(lang === 'ar' ? 'تم اعتماد الدرس ونشره بنجاح للطلاب!' : 'Lesson approved and published to students!');
    setGeneratedData(null);
    setAiStatus('idle');
    setActiveTab('lessons');
  };

  return (
    <div className="pb-28 pt-4 px-4 max-w-5xl mx-auto space-y-6" dir={lang === 'ar' ? 'rtl' : 'ltr'}>
      {/* Top Header with Back to Church App & Logout Button */}
      <div className="bg-white dark:bg-slate-900 rounded-3xl p-5 md:p-6 shadow-sm border border-[var(--color-church-cream-dark)] dark:border-slate-800 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
        <div className="flex items-center gap-3.5">
          {onBackToApp && (
            <button
              onClick={onBackToApp}
              className="p-2.5 rounded-2xl bg-[var(--color-church-cream)] hover:bg-[var(--color-church-cream-dark)] text-[var(--color-church-blue)] transition-colors flex items-center justify-center shrink-0"
              title={lang === 'ar' ? 'العودة للتطبيق الرئيسي' : 'Return to Main App'}
            >
              <ArrowLeft size={20} className={lang === 'ar' ? 'rotate-180' : ''} />
            </button>
          )}
          <div>
            <div className="flex items-center gap-2">
              <h1 className="text-xl md:text-2xl font-extrabold text-[var(--color-church-blue)] dark:text-white">
                {lang === 'ar' ? 'استوديو الخادم ومدارس الأحد' : 'Teacher & Servant Studio'}
              </h1>
              <span className="text-[11px] px-2.5 py-0.5 rounded-full font-bold bg-amber-50 dark:bg-amber-950/40 text-amber-700 dark:text-amber-300 border border-amber-200">
                {lang === 'ar' ? 'صلاحيات المعلم' : 'Teacher Access'}
              </span>
            </div>
            <p className="text-xs md:text-sm text-gray-500 mt-0.5">
              {lang === 'ar' 
                ? `مرحباً ${userData?.fullName || 'بالخادم'} • إعداد الدروس بالذكاء الاصطناعي وإدارة الطلاب` 
                : `Welcome, ${userData?.fullName || 'Servant'} • AI Curriculum Studio & Class Moderation`}
            </p>
          </div>
        </div>

        {/* Action Controls: Dual-Role Switcher to Parent Portal & Logout */}
        <div className="flex items-center gap-2 w-full sm:w-auto justify-end flex-wrap">
          {onOpenParentPortal && (
            <button
              onClick={onOpenParentPortal}
              className="px-3.5 py-2 rounded-2xl bg-blue-50 dark:bg-blue-950/40 hover:bg-blue-100 text-[var(--color-church-blue)] dark:text-blue-300 text-xs font-bold transition-colors flex items-center gap-1.5 border border-blue-200/80 cursor-pointer shadow-2xs"
            >
              <span>👨‍👩‍👧</span>
              <span>{lang === 'ar' ? 'بوابة ولي الأمر (أولادي)' : 'Parent Portal (My Kids)'}</span>
            </button>
          )}

          {onBackToApp && (
            <button
              onClick={onBackToApp}
              className="px-3.5 py-2 rounded-2xl bg-gray-100 hover:bg-gray-200 dark:bg-slate-800 text-gray-700 dark:text-gray-200 text-xs font-bold transition-colors cursor-pointer"
            >
              {lang === 'ar' ? 'عرض كطالب' : 'Student View'}
            </button>
          )}
        </div>
      </div>

      {/* Navigation tabs within Teacher Studio */}
      <div className="flex bg-gray-100 dark:bg-slate-800 p-1.5 rounded-2xl max-w-4xl mx-auto shadow-2xs overflow-x-auto">
        <button 
          onClick={() => setActiveTab('sundaySchool')}
          className={`flex-1 min-w-[140px] py-2.5 font-bold text-xs sm:text-sm rounded-xl transition-all flex items-center justify-center gap-1.5 cursor-pointer ${
            activeTab === 'sundaySchool' 
              ? 'bg-amber-600 text-white shadow-md font-extrabold' 
              : 'text-gray-600 hover:text-gray-900 dark:text-gray-300 dark:hover:text-white'
          }`}
        >
          <School size={16} />
          <span>{lang === 'ar' ? 'استوديو مدارس الأحد' : 'Sunday School Studio'}</span>
        </button>
        <button 
          onClick={() => setActiveTab('mastery')}
          className={`flex-1 min-w-[130px] py-2.5 font-bold text-xs sm:text-sm rounded-xl transition-all flex items-center justify-center gap-1.5 cursor-pointer ${
            activeTab === 'mastery' 
              ? 'bg-white dark:bg-slate-900 text-[var(--color-church-blue)] dark:text-amber-300 shadow-xs' 
              : 'text-gray-500 hover:text-gray-800 dark:hover:text-gray-200'
          }`}
        >
          <Award size={16} className="text-amber-500" />
          <span>{lang === 'ar' ? 'تقييم وإتقان الطلاب' : 'Student Mastery'}</span>
        </button>
        <button 
          onClick={() => setActiveTab('attendance')}
          className={`flex-1 min-w-[120px] py-2.5 font-bold text-xs sm:text-sm rounded-xl transition-all flex items-center justify-center gap-1.5 cursor-pointer ${
            activeTab === 'attendance' 
              ? 'bg-white dark:bg-slate-900 text-[var(--color-church-blue)] dark:text-amber-300 shadow-xs' 
              : 'text-gray-500 hover:text-gray-800 dark:hover:text-gray-200'
          }`}
        >
          <UserCheck size={16} className="text-emerald-600" />
          <span>{lang === 'ar' ? 'الافتقاد والحضور' : 'Attendance & Visits'}</span>
        </button>
        <button 
          onClick={() => setActiveTab('lessons')}
          className={`flex-1 min-w-[110px] py-2.5 font-bold text-xs sm:text-sm rounded-xl transition-all flex items-center justify-center gap-1.5 cursor-pointer ${
            activeTab === 'lessons' 
              ? 'bg-white dark:bg-slate-900 text-[var(--color-church-blue)] dark:text-amber-300 shadow-xs' 
              : 'text-gray-500 hover:text-gray-800 dark:hover:text-gray-200'
          }`}
        >
          <FileText size={16} />
          <span>{lang === 'ar' ? `الدروس (${lessons.length})` : `Lessons (${lessons.length})`}</span>
        </button>
        <button 
          onClick={() => setActiveTab('moderation')}
          className={`flex-1 min-w-[110px] py-2.5 font-bold text-xs sm:text-sm rounded-xl transition-all flex items-center justify-center gap-1.5 cursor-pointer ${
            activeTab === 'moderation' 
              ? 'bg-white dark:bg-slate-900 text-[var(--color-church-blue)] dark:text-amber-300 shadow-xs' 
              : 'text-gray-500 hover:text-gray-800 dark:hover:text-gray-200'
          }`}
        >
          <ShieldAlert size={16} />
          <span>{lang === 'ar' ? 'الرقابة والإشراف' : 'Moderation'}</span>
        </button>
      </div>

      {/* Tab: Full Sunday School Studio */}
      {activeTab === 'sundaySchool' && (
        <div className="space-y-6">
          {/* Class Session Manager */}
          <SessionManager
            sessions={classSessions}
            activeSessionId={selectedSessionId}
            onSelectSession={(id) => setSelectedSessionId(id)}
            onCreateSession={(data) => addClassSession(data as any)}
            onUpdateSession={(id, data) => updateClassSession(id, data)}
          />

          {/* Teacher Source Ingestion Studio */}
          <SourceIngestionStudio
            session={activeSession}
            sources={activeSources}
            onAddSource={addLessonSource}
            onDeleteSource={deleteLessonSource}
            onViewSource={(src) => setViewingSource(src)}
            onPipelineComplete={(eMap, outline) => {
              saveEvidenceMap(activeLessonId, eMap);
              saveLessonOutline(activeLessonId, outline);
            }}
          />

          {/* Lesson Version & Servant Governance Studio */}
          <LessonVersionStudio
            lessonId={activeLessonId}
            outline={activeOutline}
            versions={activeVersions}
            evidenceMap={activeEvidenceMap}
            sources={activeSources}
            servantComments={servantComments}
            onApproveOutline={() => approveLessonOutline(activeLessonId)}
            onSaveVersion={saveLessonVersion}
            onApproveVersion={(verId, servant, note) => approveLessonVersion(activeLessonId, verId, servant, note)}
            onPublishLesson={() => {
              const latestApproved = activeVersions.find(v => v.status === 'APPROVED') || activeVersions[activeVersions.length - 1];
              if (latestApproved) {
                publishLessonVersion(activeLessonId, latestApproved.id);
                alert(lang === 'ar' ? 'تم نشر الدرس بنجاح لجميع طلاب مدارس الأحد!' : 'Lesson officially published to Sunday School students!');
              }
            }}
            onAddComment={addServantComment}
            onResolveComment={resolveServantComment}
            onOpenSlideViewer={(slides) => setViewingSlides(slides)}
            onOpenEvidenceMap={() => setShowEvidenceModal(true)}
          />
        </div>
      )}

      {/* Tab: Student Mastery Evaluation */}
      {activeTab === 'mastery' && (
        <TeacherMasteryReview
          lessonId={activeLessonId}
          lessonTitle={activeLesson?.title || 'Feast of the Holy Cross'}
          contentProgress={studentProgress}
          quizAttempts={quizAttempts}
          masteries={studentMasteries}
          onUpdateMastery={updateStudentMastery}
        />
      )}

      {/* Tab 0: Attendance & Visitation Tracker */}
      {activeTab === 'attendance' && (
        <AttendanceVisitationTracker lang={lang} />
      )}

      {/* Tab 1: AI Assistant & Lesson Generator */}
      {activeTab === 'ai' && (
        <div className="space-y-6">
          <div className="bg-white dark:bg-slate-900 p-6 md:p-8 rounded-3xl shadow-sm border border-[var(--color-church-cream-dark)] dark:border-slate-800 text-center space-y-4">
            <div className="w-14 h-14 rounded-2xl bg-amber-50 dark:bg-amber-950/40 text-[var(--color-church-gold)] flex items-center justify-center mx-auto shadow-2xs">
              <Sparkles size={28} />
            </div>
            <h2 className="text-xl font-bold text-[var(--color-church-blue)] dark:text-white">
              {lang === 'ar' ? 'تحضير درس جديد بصوتك مع Gemini AI' : 'Create & Generate Lesson with Gemini AI'}
            </h2>
            <p className="text-gray-500 dark:text-gray-400 text-xs sm:text-sm max-w-xl mx-auto leading-relaxed">
              {lang === 'ar' 
                ? 'سجل صوتك وأنت تشرح الدرس باللهجة المصرية أو الإنجليزية، أو ارفع ملف تسجيل صوتي. يقوم الذكاء الاصطناعي بتلخيص القصة وإعداد أسئلة الاختبار التفاعلية تلقائياً.' 
                : 'Record yourself teaching the lesson in Egyptian Arabic or English, or upload an audio file. Gemini AI will transcribe, extract the spiritual summary, and generate interactive quizzes.'}
            </p>
            
            <div className="flex justify-center items-center gap-4 pt-4">
              <motion.button 
                whileHover={{ scale: 1.05 }}
                whileTap={{ scale: 0.95 }}
                onClick={handleRecord}
                className={`w-32 h-32 rounded-3xl flex flex-col items-center justify-center gap-2 transition-all cursor-pointer shadow-sm ${
                  aiStatus === 'recording' 
                    ? 'bg-red-50 text-red-500 border-2 border-red-500 animate-pulse' 
                    : 'bg-[var(--color-church-cream)] dark:bg-slate-800 text-[var(--color-church-blue)] dark:text-white hover:bg-[var(--color-church-cream-dark)]'
                }`}
              >
                <Mic size={32} />
                <span className="font-bold text-xs sm:text-sm">
                  {aiStatus === 'recording' ? (lang === 'ar' ? 'إيقاف التسجيل' : 'Stop') : (lang === 'ar' ? 'ابدأ التسجيل' : 'Record Voice')}
                </span>
              </motion.button>
              
              <input 
                type="file" 
                accept="audio/*" 
                className="hidden" 
                ref={fileInputRef} 
                onChange={handleFileUpload} 
              />
              <motion.button 
                whileHover={{ scale: 1.05 }}
                whileTap={{ scale: 0.95 }}
                onClick={() => fileInputRef.current?.click()}
                className="w-32 h-32 rounded-3xl flex flex-col items-center justify-center gap-2 bg-gray-50 dark:bg-slate-800 text-gray-500 dark:text-gray-400 border-2 border-dashed border-gray-200 dark:border-slate-700 hover:border-[var(--color-church-gold)] hover:text-[var(--color-church-gold)] transition-colors cursor-pointer"
              >
                <Upload size={32} />
                <span className="font-bold text-xs sm:text-sm">{lang === 'ar' ? 'رفع ملف صوتي' : 'Upload Audio'}</span>
              </motion.button>
            </div>
          </div>

          {aiStatus === 'error' && (
             <div className="bg-red-50 dark:bg-red-950/30 p-5 rounded-2xl border border-red-200 text-center text-red-600 dark:text-red-400 font-bold text-xs sm:text-sm">
                {lang === 'ar' ? 'حدث خطأ أثناء معالجة الصوت بالذكاء الاصطناعي. يرجى المحاولة مرة أخرى.' : 'Failed to process audio with Gemini AI. Please try again.'}
             </div>
          )}

          {aiStatus === 'processing' && (
            <motion.div initial={{ opacity: 0, y: 15 }} animate={{ opacity: 1, y: 0 }} className="bg-white dark:bg-slate-900 p-8 rounded-3xl shadow-sm border border-blue-200 dark:border-blue-900 flex flex-col items-center justify-center space-y-3">
              <div className="animate-spin text-[var(--color-church-gold)]">
                <Wand2 size={36} />
              </div>
              <p className="font-bold text-[var(--color-church-blue)] dark:text-white text-sm">
                {lang === 'ar' ? 'جاري تفريغ الصوت وصياغة الأسئلة بواسطة Gemini...' : 'Gemini is transcribing audio and generating lesson draft...'}
              </p>
            </motion.div>
          )}

          {/* AI Review & Approval Panel */}
          {aiStatus === 'done' && generatedData && (
            <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} className="bg-white dark:bg-slate-900 p-6 rounded-3xl shadow-sm border border-emerald-200 dark:border-emerald-800 space-y-6">
              <div className="flex items-center justify-between pb-3 border-b border-gray-100 dark:border-slate-800">
                <div className="flex items-center gap-2 text-emerald-600 dark:text-emerald-400 font-bold">
                  <CheckCircle2 size={22} />
                  <h3>{lang === 'ar' ? 'تم إنشاء مسودة الدرس بنجاح • مراجعة المعلم' : 'Draft Generated Successfully • Review & Approve'}</h3>
                </div>
                <span className="text-xs px-2.5 py-1 rounded-full bg-emerald-100 dark:bg-emerald-950 text-emerald-800 dark:text-emerald-200 font-bold">
                  {lang === 'ar' ? 'جاهز للاعتماد' : 'Ready for Approval'}
                </span>
              </div>
              
              <div className="space-y-4">
                <div>
                  <label className="text-xs font-bold uppercase text-gray-500">{lang === 'ar' ? 'عنوان الدرس المقترح' : 'Suggested Title'}</label>
                  <input 
                    type="text" 
                    className="w-full font-bold text-lg text-[var(--color-church-blue)] dark:text-white border-b border-gray-200 dark:border-slate-700 focus:border-[var(--color-church-gold)] outline-none py-1.5 bg-transparent" 
                    value={generatedData.title || ''} 
                    onChange={(e) => setGeneratedData({ ...generatedData, title: e.target.value })}
                  />
                </div>
                <div>
                  <label className="text-xs font-bold uppercase text-gray-500">{lang === 'ar' ? 'ملخص المحتوى' : 'AI Summary'}</label>
                  <textarea 
                    className="w-full text-gray-800 dark:text-gray-200 border border-gray-200 dark:border-slate-700 rounded-xl p-3 focus:border-[var(--color-church-gold)] outline-none resize-none h-28 text-xs sm:text-sm bg-gray-50 dark:bg-slate-800/40" 
                    value={generatedData.summary || ''} 
                    onChange={(e) => setGeneratedData({ ...generatedData, summary: e.target.value })}
                  />
                </div>
                <div className="bg-[var(--color-church-cream)] dark:bg-slate-800/60 p-5 rounded-2xl border border-[var(--color-church-gold)]/20">
                  <h4 className="font-bold text-[var(--color-church-blue)] dark:text-white mb-3 flex items-center gap-2 text-sm">
                    <FileText size={18}/> 
                    <span>{lang === 'ar' ? `الأسئلة المولدة (${generatedData.quiz?.length || 0})` : `Generated Quizzes (${generatedData.quiz?.length || 0})`}</span>
                  </h4>
                  <ul className="text-xs sm:text-sm text-gray-700 dark:text-gray-300 space-y-2.5">
                     {generatedData.quiz?.map((q: any, i: number) => (
                       <li key={i} className="p-3 bg-white dark:bg-slate-900 rounded-xl border border-gray-100 dark:border-slate-800">
                         <strong>{i+1}. {q.question}</strong>
                         <p className="text-xs text-gray-500 dark:text-gray-400 mt-1">
                           {lang === 'ar' ? 'الخيارات: ' : 'Options: '}
                           {Array.isArray(q.options) ? q.options.join(', ') : 'True / False'}
                         </p>
                       </li>
                     ))}
                  </ul>
                </div>
              </div>
              
              <div className="flex gap-3 pt-3 border-t border-gray-100 dark:border-slate-800">
                <button 
                  onClick={handlePublishGeneratedLesson}
                  className="flex-1 bg-[var(--color-church-blue)] hover:bg-blue-900 text-white font-bold py-3 rounded-xl shadow-md transition-all flex items-center justify-center gap-2 cursor-pointer text-xs sm:text-sm"
                >
                  <CheckCircle2 size={16} />
                  <span>{lang === 'ar' ? 'اعتماد ونشر لصفوف مدارس الأحد' : 'Approve & Publish to Students'}</span>
                </button>
                <button 
                  className="px-5 bg-gray-100 hover:bg-gray-200 dark:bg-slate-800 text-gray-700 dark:text-gray-300 font-bold py-3 rounded-xl transition-colors cursor-pointer text-xs sm:text-sm" 
                  onClick={() => {
                    setAiStatus('idle');
                    setGeneratedData(null);
                  }}
                >
                  {lang === 'ar' ? 'تجاهل المسودة' : 'Discard Draft'}
                </button>
              </div>
            </motion.div>
          )}
        </div>
      )}

      {/* Tab 2: Full Lessons Management */}
      {activeTab === 'lessons' && (
        <div className="space-y-4">
          <div className="flex items-center justify-between pb-2">
            <div>
              <h2 className="text-lg font-bold text-[var(--color-church-blue)] dark:text-white">
                {lang === 'ar' ? 'قائمة دروس مدارس الأحد' : 'Class Curriculum Lessons'}
              </h2>
              <p className="text-xs text-gray-500">
                {lang === 'ar' ? 'يمكنك تعديل أي درس، مراجعة الأسئلة، أو تبديل حالة النشر' : 'Edit lesson texts, adjust quizzes, and toggle published status'}
              </p>
            </div>
            <button
              onClick={() => setActiveTab('ai')}
              className="px-3.5 py-2 rounded-xl bg-[var(--color-church-gold)] text-[var(--color-church-blue)] font-bold text-xs flex items-center gap-1.5 shadow-2xs hover:bg-[var(--color-church-gold-light)] transition-colors cursor-pointer"
            >
              <Plus size={15} />
              <span>{lang === 'ar' ? 'درس جديد' : 'New Lesson'}</span>
            </button>
          </div>

          <div className="space-y-3">
            {lessons.map(lesson => (
              <div 
                key={lesson.id} 
                className="bg-white dark:bg-slate-900 rounded-2xl p-5 shadow-2xs border border-[var(--color-church-cream-dark)] dark:border-slate-800 flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 transition-all"
              >
                <div className="space-y-1 max-w-xl">
                  <div className="flex items-center gap-2">
                    <h3 className="font-bold text-base text-[var(--color-church-blue)] dark:text-white">{lesson.title}</h3>
                    <button
                      onClick={() => togglePublish(lesson.id)}
                      className={`text-[10px] px-2 py-0.5 rounded-full font-bold cursor-pointer transition-colors ${
                        lesson.status === 'published' 
                          ? 'bg-emerald-100 text-emerald-800 dark:bg-emerald-950 dark:text-emerald-200' 
                          : 'bg-amber-100 text-amber-800 dark:bg-amber-950 dark:text-amber-200'
                      }`}
                      title={lang === 'ar' ? 'اضغط لتبديل حالة النشر' : 'Click to toggle publish status'}
                    >
                      {lesson.status === 'published' 
                        ? (lang === 'ar' ? 'منشور ✅' : 'Published') 
                        : (lang === 'ar' ? 'مسودة 📝' : 'Draft')}
                    </button>
                  </div>
                  <p className="text-xs text-gray-500 line-clamp-2 leading-relaxed">{lesson.summary}</p>
                  <p className="text-[11px] text-gray-400">
                    {lesson.date} • {lesson.pointsAvailable || 150} pts • {lesson.quiz?.length || 0} questions
                  </p>
                </div>

                <div className="flex items-center gap-2 self-end sm:self-center">
                  <button 
                    onClick={() => setEditingLesson(lesson)}
                    className="text-xs font-bold text-[var(--color-church-blue)] dark:text-blue-300 bg-blue-50 dark:bg-slate-800 hover:bg-blue-100 px-3 py-2 rounded-xl flex items-center gap-1.5 transition-colors cursor-pointer"
                  >
                    <Edit3 size={14} />
                    <span>{lang === 'ar' ? 'تعديل الدرس' : 'Edit'}</span>
                  </button>

                  {onPreviewLesson && (
                    <button 
                      onClick={() => onPreviewLesson(lesson.id)}
                      className="text-xs font-bold text-gray-600 dark:text-gray-300 bg-gray-100 dark:bg-slate-800 hover:bg-gray-200 px-3 py-2 rounded-xl flex items-center gap-1 transition-colors cursor-pointer"
                      title={lang === 'ar' ? 'معاينة تجربة الطالب' : 'Preview as Student'}
                    >
                      <Eye size={14} />
                      <span>{lang === 'ar' ? 'معاينة' : 'Preview'}</span>
                    </button>
                  )}

                  <button 
                    onClick={() => {
                      if (confirm(lang === 'ar' ? 'هل تريد حذف هذا الدرس؟' : 'Delete this lesson?')) {
                        deleteLesson(lesson.id);
                      }
                    }}
                    className="text-xs text-red-500 hover:text-red-700 hover:bg-red-50 p-2 rounded-xl transition-colors cursor-pointer"
                    title={lang === 'ar' ? 'حذف الدرس' : 'Delete Lesson'}
                  >
                    <Trash2 size={16} />
                  </button>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Tab 3: Moderation Queue */}
      {activeTab === 'moderation' && (
        <div className="space-y-4">
          <div className="bg-white dark:bg-slate-900 rounded-3xl p-6 shadow-sm border border-[var(--color-church-cream-dark)] dark:border-slate-800 space-y-4">
            <div className="flex items-center justify-between pb-3 border-b border-gray-100 dark:border-slate-800">
              <div className="flex items-center gap-2.5">
                <ShieldCheck size={24} className="text-emerald-600" />
                <h3 className="font-bold text-base text-[var(--color-church-blue)] dark:text-white">
                  {lang === 'ar' ? 'طابور الرقابة وإشراف الخادم' : 'Community Moderation Queue'}
                </h3>
              </div>
              <span className="text-xs font-bold px-2.5 py-0.5 rounded-full bg-blue-100 text-[var(--color-church-blue)]">
                {flaggedPosts.length} {lang === 'ar' ? 'منشورات للمراجعة' : 'to review'}
              </span>
            </div>

            {flaggedPosts.length === 0 ? (
              <div className="text-center py-10 space-y-2">
                <ShieldAlert size={40} className="text-gray-300 mx-auto" />
                <p className="font-bold text-gray-700 dark:text-gray-300 text-sm">
                  {lang === 'ar' ? 'لا توجد منشورات مخالفة معلقة' : 'No pending posts to review. Great job!'}
                </p>
                <p className="text-xs text-gray-400">
                  {lang === 'ar' ? 'جميع مشاركات الطلاب ملتزمة بالآداب الكنسية' : 'All student community discussions are clean and polite.'}
                </p>
              </div>
            ) : (
              <div className="space-y-3">
                {flaggedPosts.map((item) => (
                  <div key={item.id} className="p-4 rounded-2xl bg-amber-50/60 dark:bg-slate-800 border border-amber-200 dark:border-slate-700 space-y-2">
                    <div className="flex items-center justify-between">
                      <span className="font-bold text-xs text-gray-900 dark:text-white">{item.author}</span>
                      <span className="text-[10px] bg-red-100 text-red-700 px-2 py-0.5 rounded-full font-semibold">{item.flagReason}</span>
                    </div>
                    <p className="text-xs text-gray-700 dark:text-gray-300 italic">"{item.content}"</p>
                    <div className="flex gap-2 pt-2 justify-end">
                      <button 
                        onClick={() => setFlaggedPosts(prev => prev.filter(f => f.id !== item.id))}
                        className="text-xs px-3 py-1.5 rounded-lg bg-emerald-600 text-white font-bold hover:bg-emerald-700 cursor-pointer"
                      >
                        {lang === 'ar' ? 'موافقة ونشر' : 'Approve'}
                      </button>
                      <button 
                        onClick={() => setFlaggedPosts(prev => prev.filter(f => f.id !== item.id))}
                        className="text-xs px-3 py-1.5 rounded-lg bg-red-100 text-red-700 font-bold hover:bg-red-200 cursor-pointer"
                      >
                        {lang === 'ar' ? 'حذف المنشور' : 'Remove'}
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      )}

      {/* Lesson Edit Modal */}
      {editingLesson && (
        <LessonEditModal
          lesson={editingLesson}
          isOpen={Boolean(editingLesson)}
          onClose={() => setEditingLesson(null)}
          onSave={(updates) => updateLesson(editingLesson.id, updates)}
          lang={lang}
        />
      )}

      {/* Built-in PDF Document Viewer Modal */}
      {viewingSource && viewingSource.type === 'PDF' && (
        <div className="fixed inset-0 z-50 bg-black/85 backdrop-blur-md p-4 sm:p-8 flex items-center justify-center">
          <div className="w-full max-w-4xl">
            <PdfDocumentViewer
              source={viewingSource}
              onClose={() => setViewingSource(null)}
            />
          </div>
        </div>
      )}

      {/* Built-in PPTX Slide Deck Viewer Modal */}
      {(viewingSlides || (viewingSource && viewingSource.type === 'PPTX')) && (
        <div className="fixed inset-0 z-50 bg-black/90 backdrop-blur-md p-4 sm:p-8 flex items-center justify-center">
          <div className="w-full max-w-5xl">
            <SlideDeckViewer
              slides={viewingSlides || activeVersions[0]?.slides || []}
              source={viewingSource || undefined}
              onClose={() => {
                setViewingSlides(null);
                setViewingSource(null);
              }}
            />
          </div>
        </div>
      )}

      {/* Evidence Coverage & Grounding Modal */}
      {showEvidenceModal && (
        <EvidenceCoverageModal
          evidenceMap={activeEvidenceMap}
          sources={activeSources}
          allowInternetSearch={activeSession?.allowInternetSearch ?? false}
          onClose={() => setShowEvidenceModal(false)}
          onOpenSourceViewer={(src) => {
            setShowEvidenceModal(false);
            setViewingSource(src);
          }}
        />
      )}
    </div>
  );
}
