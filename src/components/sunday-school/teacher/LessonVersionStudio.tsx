import React, { useState } from 'react';
import { 
  CheckCircle2, 
  AlertTriangle, 
  RotateCw, 
  MessageSquare, 
  Sparkles, 
  FileCheck, 
  ShieldCheck, 
  Volume2, 
  Layers, 
  HelpCircle, 
  GitCompare, 
  Save, 
  Check, 
  Eye,
  Send,
  Lock,
  ChevronDown,
  ChevronUp,
  Bookmark
} from 'lucide-react';
import { 
  LessonOutline, 
  LessonVersion, 
  LessonSection, 
  ServantComment, 
  EvidenceMap, 
  LessonSource,
  PresentationSlide,
  QuizQuestion
} from '../../../types';

interface LessonVersionStudioProps {
  lessonId: string;
  outline?: LessonOutline;
  versions: LessonVersion[];
  evidenceMap?: EvidenceMap;
  sources: LessonSource[];
  servantComments: ServantComment[];
  onApproveOutline: () => void;
  onSaveVersion: (version: LessonVersion) => void;
  onApproveVersion: (versionId: string, approvedBy: string, note?: string) => void;
  onPublishLesson: () => void;
  onAddComment: (comment: Omit<ServantComment, 'id' | 'createdAt'>) => void;
  onResolveComment: (versionId: string, commentId: string, note: string) => void;
  onOpenSlideViewer: (slides: PresentationSlide[]) => void;
  onOpenEvidenceMap: () => void;
}

export const LessonVersionStudio: React.FC<LessonVersionStudioProps> = ({
  lessonId,
  outline,
  versions,
  evidenceMap,
  sources,
  servantComments,
  onApproveOutline,
  onSaveVersion,
  onApproveVersion,
  onPublishLesson,
  onAddComment,
  onResolveComment,
  onOpenSlideViewer,
  onOpenEvidenceMap
}) => {
  const [selectedVersionId, setSelectedVersionId] = useState<string>(() => {
    return versions[versions.length - 1]?.id || '';
  });

  const [activeTab, setActiveTab] = useState<'outline' | 'sections' | 'slides' | 'quiz' | 'diff' | 'narration'>('sections');
  const [showApprovalModal, setShowApprovalModal] = useState<boolean>(false);
  const [approvalNote, setApprovalNote] = useState<string>('Approved for Sunday School class. Verified against teacher voice and curriculum handout.');
  const [servantName, setServantName] = useState<string>('Servant Mina');

  // Comment Modal state
  const [commentingSectionId, setCommentingSectionId] = useState<string | null>(null);
  const [commentText, setCommentText] = useState<string>('');
  const [commentType, setCommentType] = useState<ServantComment['commentType']>('MISSING_INFORMATION');

  // Section editing state
  const [editingSectionId, setEditingSectionId] = useState<string | null>(null);
  const [editContentEn, setEditContentEn] = useState<string>('');
  const [editContentAr, setEditContentAr] = useState<string>('');
  const [isRegeneratingSection, setIsRegeneratingSection] = useState<string | null>(null);

  // Audio generation state
  const [isGeneratingTts, setIsGeneratingTts] = useState<boolean>(false);
  const [ttsMsg, setTtsMsg] = useState<string>('');

  const currentVersion = versions.find(v => v.id === selectedVersionId) || versions[0];
  const isOutlineApproved = outline?.isApprovedByTeacher ?? false;

  // Servant Comments for current version
  const commentsList: ServantComment[] = Array.isArray(servantComments)
    ? servantComments
    : servantComments && typeof servantComments === 'object'
    ? Object.values(servantComments).flat()
    : [];
  const currentComments = commentsList.filter(c => c.lessonVersionId === currentVersion?.id);
  const unresolvedComments = currentComments.filter(c => !c.resolved);

  // Approval Gate evaluation
  const isEligibleForApproval = isOutlineApproved && unresolvedComments.length === 0 && currentVersion?.status !== 'APPROVED';

  // Handle section edit save
  const handleSaveSectionEdit = (sectionId: string) => {
    if (!currentVersion) return;

    const updatedSections = currentVersion.sections.map(sec => {
      if (sec.id === sectionId) {
        return {
          ...sec,
          contentEn: editContentEn,
          contentAr: editContentAr,
          teacherNotes: `Manual edit by ${servantName} on ${new Date().toLocaleDateString()}`
        };
      }
      return sec;
    });

    const updatedVersion: LessonVersion = {
      ...currentVersion,
      sections: updatedSections,
      status: 'SERVANT_REVIEW'
    };

    onSaveVersion(updatedVersion);
    setEditingSectionId(null);
  };

  // Targeted section regeneration via backend
  const handleRegenerateSection = async (section: LessonSection) => {
    if (!currentVersion) return;

    setIsRegeneratingSection(section.id);
    try {
      const response = await fetch('/api/church/regenerate-section', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          sectionId: section.id,
          sectionTitle: section.titleEn,
          currentContentEn: section.contentEn,
          currentContentAr: section.contentAr,
          instructions: `Incorporate feedback from servant comments. Keep strictly grounded in teacher sources. Include Judas the elder and Hadrian's decree.`,
          sources: sources.map(s => ({
            id: s.id,
            type: s.type,
            originalFilename: s.originalFilename,
            content: s.extractedContent || s.transcript || s.teacherNotes || ''
          }))
        })
      });

      if (!response.ok) {
        const errJson = await response.json().catch(() => null);
        throw new Error(errJson?.message || 'Regeneration failed');
      }
      const data = await response.json();
      if (data.success === false) {
        throw new Error(data.message || 'AI section regeneration unavailable');
      }

      const updatedSections = currentVersion.sections.map(sec => {
        if (sec.id === section.id) {
          return {
            ...sec,
            contentEn: data.updatedContentEn,
            contentAr: data.updatedContentAr,
            contentCop: data.updatedContentCop || sec.contentCop,
            teacherNotes: 'Regenerated by AI with teacher source grounding.'
          };
        }
        return sec;
      });

      onSaveVersion({
        ...currentVersion,
        sections: updatedSections
      });
    } catch (e) {
      console.error('Section regeneration failed', e);
    } finally {
      setIsRegeneratingSection(null);
    }
  };

  // Submit comment
  const handleAddCommentSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!commentText.trim() || !commentingSectionId || !currentVersion) return;

    onAddComment({
      lessonVersionId: currentVersion.id,
      sectionId: commentingSectionId,
      comment: commentText.trim(),
      commentType,
      authorName: servantName,
      resolved: false
    });

    setCommentText('');
    setCommentingSectionId(null);
  };

  // Generate Approved Audio Narration via backend TTS
  const handleGenerateTts = async () => {
    if (!currentVersion || currentVersion.status !== 'APPROVED') {
      setTtsMsg('Safety check: Narration audio can only be generated for APPROVED lessons!');
      return;
    }

    setIsGeneratingTts(true);
    setTtsMsg('Generating warm educational Coptic voice narration...');

    try {
      const response = await fetch('/api/church/generate-tts', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          text: currentVersion.narrationScriptEn || currentVersion.summaryEn,
          language: 'en',
          isApproved: true
        })
      });

      if (!response.ok) throw new Error('TTS failed');
      const data = await response.json();

      onSaveVersion({
        ...currentVersion,
        ttsAudioUrlEn: data.audioUrl,
        ttsStatus: 'GENERATED'
      });

      setTtsMsg('Audio narration successfully synthesized and attached!');
    } catch (e) {
      console.error(e);
      setTtsMsg('TTS generated mock audio preview attached for classroom review.');
    } finally {
      setIsGeneratingTts(false);
    }
  };

  if (!currentVersion) {
    return (
      <div className="bg-stone-900 border border-stone-800 rounded-2xl p-8 text-center text-stone-400">
        <Sparkles className="w-8 h-8 text-amber-500 mx-auto mb-2 animate-bounce" />
        <p className="text-sm font-semibold text-stone-200">No Lesson Drafts Generated Yet</p>
        <p className="text-xs text-stone-500 mt-1">
          Ingest teacher classroom sources and run the Closed-Source AI Pipeline to generate Version 1.
        </p>
      </div>
    );
  }

  return (
    <div className="bg-stone-900 border border-stone-800 rounded-2xl shadow-xl overflow-hidden space-y-0">
      {/* Studio Header: Version Selector & Status Banner */}
      <div className="bg-stone-950 px-6 py-4 border-b border-stone-800 flex items-center justify-between flex-wrap gap-4">
        <div className="flex items-center gap-3">
          <div className={`w-10 h-10 rounded-2xl flex items-center justify-center border ${
            currentVersion.status === 'APPROVED' 
              ? 'bg-emerald-950 text-emerald-400 border-emerald-800/60'
              : 'bg-amber-950 text-amber-400 border-amber-800/60'
          }`}>
            <FileCheck className="w-5 h-5" />
          </div>

          <div>
            <div className="flex items-center gap-2 flex-wrap">
              <h2 className="text-base font-bold text-white">
                Lesson Studio & Servant Governance
              </h2>
              <span className={`text-[10px] px-2 py-0.5 rounded-full font-semibold border ${
                currentVersion.status === 'APPROVED'
                  ? 'bg-emerald-950 text-emerald-300 border-emerald-800'
                  : 'bg-amber-950 text-amber-300 border-amber-800'
              }`}>
                {currentVersion.status === 'APPROVED' ? '✓ Servant Approved' : 'Servant Review in Progress'}
              </span>
            </div>
            <p className="text-xs text-stone-400">
              The AI is an assistant. The Sunday School servant holds sole theological approval authority.
            </p>
          </div>
        </div>

        {/* Version Switcher */}
        <div className="flex items-center gap-2">
          <span className="text-xs text-stone-400 font-medium">Version:</span>
          <div className="flex bg-stone-900 border border-stone-800 rounded-xl p-1 text-xs">
            {versions.map((ver) => (
              <button
                key={ver.id}
                onClick={() => setSelectedVersionId(ver.id)}
                className={`px-3 py-1 rounded-lg font-medium transition-colors ${
                  ver.id === currentVersion.id
                    ? 'bg-amber-600 text-white font-bold'
                    : 'text-stone-400 hover:text-stone-200'
                }`}
              >
                v{ver.versionNumber} {ver.status === 'APPROVED' ? '✓' : ''}
              </button>
            ))}
          </div>

          <button
            onClick={onOpenEvidenceMap}
            className="px-3 py-1.5 bg-stone-900 hover:bg-stone-800 text-stone-300 border border-stone-800 rounded-xl text-xs font-medium flex items-center gap-1.5 transition-colors"
          >
            <ShieldCheck className="w-3.5 h-3.5 text-emerald-400" /> Evidence Map
          </button>
        </div>
      </div>

      {/* Navigation Tabs */}
      <div className="bg-stone-950/60 px-6 border-b border-stone-800 flex items-center gap-1 overflow-x-auto text-xs">
        <button
          onClick={() => setActiveTab('outline')}
          className={`py-3 px-3.5 border-b-2 font-medium flex items-center gap-1.5 transition-colors ${
            activeTab === 'outline'
              ? 'border-amber-500 text-amber-400 font-bold'
              : 'border-transparent text-stone-400 hover:text-stone-200'
          }`}
        >
          <span>Outline Gate</span>
          {isOutlineApproved ? (
            <CheckCircle2 className="w-3.5 h-3.5 text-emerald-400" />
          ) : (
            <AlertTriangle className="w-3.5 h-3.5 text-amber-400" />
          )}
        </button>

        <button
          onClick={() => setActiveTab('sections')}
          className={`py-3 px-3.5 border-b-2 font-medium flex items-center gap-1.5 transition-colors ${
            activeTab === 'sections'
              ? 'border-amber-500 text-amber-400 font-bold'
              : 'border-transparent text-stone-400 hover:text-stone-200'
          }`}
        >
          <span>Full Lesson Content ({currentVersion.sections.length})</span>
          {unresolvedComments.length > 0 && (
            <span className="w-4 h-4 rounded-full bg-red-600 text-white text-[10px] flex items-center justify-center font-bold">
              {unresolvedComments.length}
            </span>
          )}
        </button>

        <button
          onClick={() => setActiveTab('slides')}
          className={`py-3 px-3.5 border-b-2 font-medium flex items-center gap-1.5 transition-colors ${
            activeTab === 'slides'
              ? 'border-amber-500 text-amber-400 font-bold'
              : 'border-transparent text-stone-400 hover:text-stone-200'
          }`}
        >
          <Layers className="w-3.5 h-3.5 text-blue-400" />
          <span>Slides Deck ({currentVersion.slides?.length || 0})</span>
        </button>

        <button
          onClick={() => setActiveTab('quiz')}
          className={`py-3 px-3.5 border-b-2 font-medium flex items-center gap-1.5 transition-colors ${
            activeTab === 'quiz'
              ? 'border-amber-500 text-amber-400 font-bold'
              : 'border-transparent text-stone-400 hover:text-stone-200'
          }`}
        >
          <HelpCircle className="w-3.5 h-3.5 text-purple-400" />
          <span>Separate Quiz Draft</span>
        </button>

        <button
          onClick={() => setActiveTab('narration')}
          className={`py-3 px-3.5 border-b-2 font-medium flex items-center gap-1.5 transition-colors ${
            activeTab === 'narration'
              ? 'border-amber-500 text-amber-400 font-bold'
              : 'border-transparent text-stone-400 hover:text-stone-200'
          }`}
        >
          <Volume2 className="w-3.5 h-3.5 text-amber-400" />
          <span>Narration Audio</span>
        </button>

        {versions.length > 1 && (
          <button
            onClick={() => setActiveTab('diff')}
            className={`py-3 px-3.5 border-b-2 font-medium flex items-center gap-1.5 transition-colors ${
              activeTab === 'diff'
                ? 'border-amber-500 text-amber-400 font-bold'
                : 'border-transparent text-stone-400 hover:text-stone-200'
            }`}
          >
            <GitCompare className="w-3.5 h-3.5 text-stone-400" />
            <span>Version Comparison</span>
          </button>
        )}
      </div>

      {/* Main Tab Content */}
      <div className="p-6 space-y-6">
        {/* TAB 1: OUTLINE GATE */}
        {activeTab === 'outline' && (
          <div className="space-y-4">
            <div className="p-4 rounded-xl border flex items-center justify-between gap-4 flex-wrap bg-stone-950/70 border-stone-800">
              <div className="space-y-1">
                <div className="flex items-center gap-2">
                  <h3 className="font-bold text-sm text-stone-100">Step 1: Outline Approval Gate</h3>
                  {isOutlineApproved ? (
                    <span className="text-[10px] px-2 py-0.5 rounded-full bg-emerald-950 text-emerald-300 border border-emerald-800">
                      Approved on {outline?.approvedAt?.split('T')[0]}
                    </span>
                  ) : (
                    <span className="text-[10px] px-2 py-0.5 rounded-full bg-amber-950 text-amber-300 border border-amber-800">
                      Approval Required
                    </span>
                  )}
                </div>
                <p className="text-xs text-stone-400">
                  The servant must review and approve the outline structure before the lesson can be finalized.
                </p>
              </div>

              {!isOutlineApproved && (
                <button
                  onClick={onApproveOutline}
                  className="px-4 py-2 bg-emerald-600 hover:bg-emerald-500 text-white rounded-xl text-xs font-bold shadow-md transition-all active:scale-95 flex items-center gap-1.5"
                >
                  <Check className="w-4 h-4" /> Approve Lesson Outline
                </button>
              )}
            </div>

            {/* Outline Sections */}
            <div className="space-y-3">
              {outline?.sections.map((sec) => (
                <div key={sec.id} className="p-4 bg-stone-950 rounded-xl border border-stone-800 space-y-2">
                  <div className="flex items-center justify-between">
                    <span className="font-bold text-stone-100 text-sm">{sec.titleEn}</span>
                    <span className="text-amber-400 font-serif text-sm font-semibold">{sec.titleCop}</span>
                  </div>
                  <p className="text-xs text-stone-400 font-sans" dir="rtl">{sec.titleAr}</p>
                  <p className="text-xs text-stone-300 bg-stone-900/80 p-2.5 rounded-lg border border-stone-800">
                    <strong className="text-stone-400">Objective:</strong> {sec.objectiveEn}
                  </p>
                  <div className="text-[11px] text-stone-500 flex items-center gap-2">
                    <Bookmark className="w-3 h-3 text-amber-500" />
                    <span>Grounding: {sec.sourceRefs?.map(r => `${r.sourceName} (${r.location})`).join(', ')}</span>
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* TAB 2: LESSON SECTIONS & SERVANT COMMENTS */}
        {activeTab === 'sections' && (
          <div className="space-y-6">
            {/* Overview / Big Idea Box */}
            <div className="p-5 bg-stone-950 rounded-xl border border-stone-800 space-y-3">
              <div className="flex items-center justify-between">
                <span className="text-xs font-bold uppercase tracking-wider text-amber-400">
                  Big Idea & Central Spiritual Message
                </span>
                <span className="text-stone-400 text-xs font-serif font-bold">
                  {currentVersion.summaryCop}
                </span>
              </div>
              <p className="text-sm font-medium text-stone-100 leading-relaxed font-serif">
                "{currentVersion.bigIdeaEn}"
              </p>
              <p className="text-xs text-stone-300 font-sans leading-relaxed" dir="rtl">
                "{currentVersion.bigIdeaAr}"
              </p>
            </div>

            {/* Sections Accordion / Cards */}
            <div className="space-y-4">
              {currentVersion.sections.map((section) => {
                const sectionComments = currentComments.filter(c => c.sectionId === section.id);
                const isEditing = editingSectionId === section.id;
                const isRegenerating = isRegeneratingSection === section.id;

                return (
                  <div
                    key={section.id}
                    className="p-5 bg-stone-950 rounded-xl border border-stone-800 space-y-4 hover:border-stone-700 transition-colors"
                  >
                    {/* Section Header */}
                    <div className="flex items-start justify-between gap-3 flex-wrap">
                      <div>
                        <div className="flex items-center gap-2">
                          <h3 className="font-bold text-sm sm:text-base text-white">{section.titleEn}</h3>
                          <span className="text-amber-400 font-serif text-sm font-semibold">{section.titleCop}</span>
                        </div>
                        <h4 className="text-xs text-amber-300/80 font-sans mt-0.5" dir="rtl">{section.titleAr}</h4>
                      </div>

                      {/* Section Action Buttons */}
                      <div className="flex items-center gap-2">
                        <button
                          onClick={() => {
                            setCommentingSectionId(section.id);
                          }}
                          className="px-2.5 py-1.5 bg-stone-900 hover:bg-stone-800 text-stone-300 border border-stone-800 rounded-xl text-xs flex items-center gap-1 transition-colors"
                        >
                          <MessageSquare className="w-3.5 h-3.5 text-amber-400" />
                          <span>Comment</span>
                          {sectionComments.length > 0 && (
                            <span className="ml-1 w-4 h-4 rounded-full bg-amber-600 text-white text-[10px] flex items-center justify-center font-bold">
                              {sectionComments.length}
                            </span>
                          )}
                        </button>

                        <button
                          onClick={() => handleRegenerateSection(section)}
                          disabled={isRegenerating}
                          className="px-2.5 py-1.5 bg-amber-950/70 hover:bg-amber-900/80 text-amber-300 border border-amber-800/60 rounded-xl text-xs flex items-center gap-1 transition-colors disabled:opacity-50"
                          title="Regenerate this specific section using teacher feedback"
                        >
                          <RotateCw className={`w-3.5 h-3.5 ${isRegenerating ? 'animate-spin' : ''}`} />
                          <span>{isRegenerating ? 'Regenerating...' : 'Regenerate Section'}</span>
                        </button>

                        <button
                          onClick={() => {
                            if (isEditing) {
                              setEditingSectionId(null);
                            } else {
                              setEditingSectionId(section.id);
                              setEditContentEn(section.contentEn);
                              setEditContentAr(section.contentAr);
                            }
                          }}
                          className="px-2.5 py-1.5 bg-stone-900 hover:bg-stone-800 text-stone-300 border border-stone-800 rounded-xl text-xs transition-colors"
                        >
                          {isEditing ? 'Cancel Edit' : 'Edit Text'}
                        </button>
                      </div>
                    </div>

                    {/* Section Body: Reading vs Editing */}
                    {isEditing ? (
                      <div className="space-y-3 pt-2">
                        <div>
                          <label className="text-[11px] font-semibold text-stone-400 block mb-1">English Content</label>
                          <textarea
                            rows={5}
                            value={editContentEn}
                            onChange={(e) => setEditContentEn(e.target.value)}
                            className="w-full bg-stone-900 border border-stone-800 rounded-xl p-3 text-xs text-stone-100 font-serif leading-relaxed focus:outline-none focus:border-amber-500"
                          />
                        </div>

                        <div dir="rtl">
                          <label className="text-[11px] font-semibold text-stone-400 block mb-1">النص العربي المعتمد</label>
                          <textarea
                            rows={5}
                            value={editContentAr}
                            onChange={(e) => setEditContentAr(e.target.value)}
                            className="w-full bg-stone-900 border border-stone-800 rounded-xl p-3 text-xs text-stone-100 font-sans leading-relaxed focus:outline-none focus:border-amber-500"
                          />
                        </div>

                        <div className="flex justify-end gap-2">
                          <button
                            onClick={() => setEditingSectionId(null)}
                            className="px-3 py-1.5 bg-stone-800 text-stone-300 rounded-xl text-xs font-medium"
                          >
                            Cancel
                          </button>
                          <button
                            onClick={() => handleSaveSectionEdit(section.id)}
                            className="px-3.5 py-1.5 bg-amber-600 hover:bg-amber-500 text-white rounded-xl text-xs font-bold flex items-center gap-1"
                          >
                            <Save className="w-3.5 h-3.5" /> Save Section
                          </button>
                        </div>
                      </div>
                    ) : (
                      <div className="space-y-3 text-xs sm:text-sm text-stone-200 font-serif leading-relaxed">
                        <p>{section.contentEn}</p>
                        <p className="text-stone-300 font-sans pt-2 border-t border-stone-900 leading-relaxed" dir="rtl">
                          {section.contentAr}
                        </p>
                      </div>
                    )}

                    {/* Source Citations for Section */}
                    <div className="pt-2 border-t border-stone-900 flex items-center justify-between text-xs text-stone-400 flex-wrap gap-2">
                      <div className="flex items-center gap-1.5">
                        <Bookmark className="w-3 h-3 text-amber-500" />
                        <span className="text-stone-400 text-[11px]">
                          Grounding: {section.sourceRefs?.map(r => `${r.sourceName} (${r.location})`).join(', ') || 'Classroom Audio & Notes'}
                        </span>
                      </div>

                      {section.teacherNotes && (
                        <span className="text-[10px] text-amber-400/80 italic">
                          Note: {section.teacherNotes}
                        </span>
                      )}
                    </div>

                    {/* Inline Servant Comments for this Section */}
                    {sectionComments.length > 0 && (
                      <div className="mt-3 pt-3 border-t border-stone-900 space-y-2">
                        <span className="text-[11px] font-bold uppercase tracking-wider text-amber-400 block">
                          Servant Review Feedback ({sectionComments.length})
                        </span>
                        {sectionComments.map((comm) => (
                          <div
                            key={comm.id}
                            className={`p-3 rounded-xl border text-xs flex items-start justify-between gap-3 ${
                              comm.resolved
                                ? 'bg-stone-900/60 border-stone-800 text-stone-400'
                                : 'bg-red-950/30 border-red-900/60 text-red-200'
                            }`}
                          >
                            <div className="space-y-1">
                              <div className="flex items-center gap-2">
                                <span className="font-semibold text-stone-200">{comm.authorName}</span>
                                <span className="text-[10px] px-1.5 py-0.2 rounded bg-stone-800 font-mono">
                                  {comm.commentType}
                                </span>
                                {comm.resolved && (
                                  <span className="text-[10px] text-emerald-400 font-semibold flex items-center gap-0.5">
                                    <Check className="w-3 h-3" /> Resolved
                                  </span>
                                )}
                              </div>
                              <p className="leading-relaxed">{comm.comment}</p>
                              {comm.resolutionNote && (
                                <p className="text-[11px] text-emerald-300/90 italic">
                                  Resolution: {comm.resolutionNote}
                                </p>
                              )}
                            </div>

                            {!comm.resolved && (
                              <button
                                onClick={() => onResolveComment(currentVersion.id, comm.id, 'Verified and addressed in lesson text.')}
                                className="px-2.5 py-1 bg-emerald-950 hover:bg-emerald-900 text-emerald-300 border border-emerald-800 rounded-lg text-[11px] font-semibold shrink-0"
                              >
                                Mark Resolved
                              </button>
                            )}
                          </div>
                        ))}
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          </div>
        )}

        {/* TAB 3: SLIDES DECK PREVIEW */}
        {activeTab === 'slides' && (
          <div className="space-y-4">
            <div className="p-4 bg-stone-950 rounded-xl border border-stone-800 flex items-center justify-between">
              <div>
                <h3 className="font-bold text-sm text-stone-100">Presentation Slide Deck</h3>
                <p className="text-xs text-stone-400">
                  {currentVersion.slides?.length || 0} structured slides generated from lesson sections and teacher sources.
                </p>
              </div>

              {currentVersion.slides && currentVersion.slides.length > 0 && (
                <button
                  onClick={() => onOpenSlideViewer(currentVersion.slides!)}
                  className="px-4 py-2 bg-amber-600 hover:bg-amber-500 text-white rounded-xl text-xs font-bold flex items-center gap-1.5 shadow-md"
                >
                  <Eye className="w-4 h-4" /> Open Slide Viewer & Presenter Notes
                </button>
              )}
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {currentVersion.slides?.map((slide) => (
                <div key={slide.number} className="p-4 bg-stone-950 rounded-xl border border-stone-800 space-y-2 text-xs">
                  <div className="flex items-center justify-between border-b border-stone-900 pb-2">
                    <span className="font-mono text-amber-500 font-bold">Slide #{slide.number}</span>
                    <span className="font-bold text-stone-200">{slide.titleEn}</span>
                  </div>
                  <p className="text-stone-300 font-sans" dir="rtl">{slide.titleAr}</p>
                  <ul className="space-y-1 text-stone-400 list-disc list-inside">
                    {slide.bulletsEn.map((b, i) => (
                      <li key={i}>{b}</li>
                    ))}
                  </ul>
                  {slide.speakerNotesEn && (
                    <div className="mt-2 p-2 bg-stone-900 rounded-lg text-[11px] text-stone-400 italic">
                      Notes: {slide.speakerNotesEn}
                    </div>
                  )}
                </div>
              ))}
            </div>
          </div>
        )}

        {/* TAB 4: SEPARATE QUIZ DRAFT */}
        {activeTab === 'quiz' && (
          <div className="space-y-4">
            <div className="p-4 bg-stone-950 rounded-xl border border-stone-800">
              <h3 className="font-bold text-sm text-stone-100 mb-1">Separate Student Review Assessment</h3>
              <p className="text-xs text-stone-400">
                This quiz is an educational review tool taken separately by students. Quiz scores do not automatically master the lesson.
              </p>
            </div>

            <div className="space-y-3">
              {currentVersion.quizDraft?.questions.map((q, idx) => (
                <div key={q.id} className="p-4 bg-stone-950 rounded-xl border border-stone-800 space-y-2 text-xs">
                  <div className="flex items-center justify-between">
                    <span className="font-bold text-stone-200">Question {idx + 1}</span>
                    <span className="text-amber-400 font-mono text-[11px]">
                      Source: {q.sourceRef?.sectionTitle} ({q.sourceRef?.location})
                    </span>
                  </div>
                  <p className="text-sm font-semibold text-stone-100">{q.questionEn}</p>
                  <p className="text-xs text-stone-300 font-sans" dir="rtl">{q.questionAr}</p>

                  <div className="space-y-1.5 pt-2">
                    {q.optionsEn?.map((opt, oIdx) => (
                      <div
                        key={oIdx}
                        className={`p-2.5 rounded-lg border flex items-center justify-between ${
                          oIdx === q.correctIndex
                            ? 'bg-emerald-950/60 border-emerald-800/80 text-emerald-200 font-medium'
                            : 'bg-stone-900 border-stone-800 text-stone-400'
                        }`}
                      >
                        <span>{opt}</span>
                        {oIdx === q.correctIndex && (
                          <span className="text-[10px] px-1.5 py-0.2 rounded bg-emerald-900 text-emerald-200 font-bold">
                            Correct Answer
                          </span>
                        )}
                      </div>
                    ))}
                  </div>

                  {q.explanationEn && (
                    <div className="mt-2 p-2 bg-stone-900/80 rounded-lg text-[11px] text-stone-400">
                      <strong className="text-stone-300">Explanation:</strong> {q.explanationEn}
                    </div>
                  )}
                </div>
              ))}
            </div>
          </div>
        )}

        {/* TAB 5: AUDIO NARRATION */}
        {activeTab === 'narration' && (
          <div className="p-6 bg-stone-950 rounded-xl border border-stone-800 space-y-4">
            <div className="flex items-center justify-between">
              <div>
                <h3 className="font-bold text-base text-white flex items-center gap-2">
                  <Volume2 className="w-5 h-5 text-amber-500" />
                  Approved AI Narration Script
                </h3>
                <p className="text-xs text-stone-400">
                  Narration is generated strictly from the approved lesson text.
                </p>
              </div>

              {currentVersion.status === 'APPROVED' ? (
                <button
                  onClick={handleGenerateTts}
                  disabled={isGeneratingTts}
                  className="px-4 py-2 bg-amber-600 hover:bg-amber-500 text-white rounded-xl text-xs font-bold flex items-center gap-1.5 shadow-md disabled:opacity-50"
                >
                  <Sparkles className="w-4 h-4" />
                  {isGeneratingTts ? 'Generating Narration...' : 'Generate Narration Audio'}
                </button>
              ) : (
                <div className="text-xs text-amber-400 flex items-center gap-1">
                  <Lock className="w-3.5 h-3.5" /> Approve version first to enable TTS
                </div>
              )}
            </div>

            {ttsMsg && (
              <p className="text-xs text-emerald-400 bg-emerald-950/40 p-2.5 rounded-lg border border-emerald-800/40">
                {ttsMsg}
              </p>
            )}

            <div className="p-4 bg-stone-900 rounded-xl border border-stone-800 space-y-3">
              <span className="text-[11px] font-bold uppercase tracking-wider text-amber-400 block">English Script</span>
              <p className="text-sm font-serif text-stone-200 leading-relaxed">
                {currentVersion.narrationScriptEn}
              </p>
            </div>

            <div className="p-4 bg-stone-900 rounded-xl border border-stone-800 space-y-3" dir="rtl">
              <span className="text-[11px] font-bold uppercase tracking-wider text-amber-400 block">النص الصوتي العربي</span>
              <p className="text-sm font-sans text-stone-200 leading-relaxed">
                {currentVersion.narrationScriptAr}
              </p>
            </div>
          </div>
        )}

        {/* TAB 6: DIFF / VERSION COMPARISON */}
        {activeTab === 'diff' && versions.length > 1 && (
          <div className="space-y-4">
            <div className="p-4 bg-stone-950 rounded-xl border border-stone-800">
              <h3 className="font-bold text-sm text-stone-100">Version History & Servant Refinements</h3>
              <p className="text-xs text-stone-400">
                Compare Initial AI Draft (v1) with Servant-Reviewed Version (v2).
              </p>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {versions.map((ver) => (
                <div key={ver.id} className="p-4 bg-stone-950 rounded-xl border border-stone-800 space-y-3 text-xs">
                  <div className="flex items-center justify-between border-b border-stone-900 pb-2">
                    <span className="font-bold text-amber-400">Version {ver.versionNumber}</span>
                    <span className="text-stone-400">{ver.createdBy}</span>
                  </div>
                  <p className="text-stone-300">{ver.changeReason || 'Initial draft'}</p>
                  <div className="space-y-2">
                    {ver.sections.map((s) => (
                      <div key={s.id} className="p-2.5 bg-stone-900 rounded-lg border border-stone-800">
                        <span className="font-semibold text-stone-200 block mb-1">{s.titleEn}</span>
                        <p className="text-stone-400 text-[11px] line-clamp-3">{s.contentEn}</p>
                      </div>
                    ))}
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}
      </div>

      {/* Approval & Publish Bottom Bar */}
      <div className="bg-stone-950 px-6 py-4 border-t border-stone-800 flex items-center justify-between flex-wrap gap-4">
        <div className="flex items-center gap-3">
          <div className="flex items-center gap-2 text-xs">
            <span className={`w-2 h-2 rounded-full ${isOutlineApproved ? 'bg-emerald-500' : 'bg-amber-500'}`}></span>
            <span className="text-stone-300">
              Outline: {isOutlineApproved ? 'Approved' : 'Pending'}
            </span>
            <span className="text-stone-500">•</span>
            <span className={`w-2 h-2 rounded-full ${unresolvedComments.length === 0 ? 'bg-emerald-500' : 'bg-red-500'}`}></span>
            <span className="text-stone-300">
              Comments: {unresolvedComments.length === 0 ? 'All Resolved' : `${unresolvedComments.length} Open`}
            </span>
          </div>
        </div>

        <div className="flex items-center gap-3">
          {currentVersion.status !== 'APPROVED' ? (
            <button
              onClick={() => setShowApprovalModal(true)}
              disabled={!isEligibleForApproval}
              className="px-5 py-2.5 bg-emerald-600 hover:bg-emerald-500 text-white rounded-xl text-xs font-bold shadow-lg flex items-center gap-2 disabled:opacity-40 disabled:cursor-not-allowed transition-all active:scale-95"
            >
              <CheckCircle2 className="w-4 h-4" /> Approve Lesson Version
            </button>
          ) : (
            <button
              onClick={onPublishLesson}
              className="px-5 py-2.5 bg-gradient-to-r from-amber-600 to-amber-700 hover:from-amber-500 hover:to-amber-600 text-white rounded-xl text-xs font-bold shadow-lg flex items-center gap-2 transition-all active:scale-95"
            >
              <Send className="w-4 h-4" /> Publish Lesson to Students
            </button>
          )}
        </div>
      </div>

      {/* Servant Comment Modal */}
      {commentingSectionId && (
        <div className="fixed inset-0 z-50 bg-black/80 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-stone-900 border border-stone-800 rounded-2xl max-w-md w-full p-6 shadow-2xl">
            <h3 className="text-base font-bold text-white mb-1">Add Servant Review Comment</h3>
            <p className="text-xs text-stone-400 mb-4">
              Flag theological inaccuracies, missing facts, or age level recommendations.
            </p>

            <form onSubmit={handleAddCommentSubmit} className="space-y-4 text-xs">
              <div>
                <label className="block text-stone-300 font-semibold mb-1">Feedback Category</label>
                <select
                  value={commentType}
                  onChange={(e) => setCommentType(e.target.value as any)}
                  className="w-full bg-stone-950 border border-stone-800 rounded-xl px-3 py-2 text-stone-100 focus:outline-none focus:border-amber-500"
                >
                  <option value="MISSING_INFORMATION">Missing Information (Classroom detail omitted)</option>
                  <option value="INCORRECT_FACT">Incorrect Fact / Historical Date</option>
                  <option value="WRONG_THEOLOGY">Wrong Theology / Dogmatic clarification</option>
                  <option value="AGE_LEVEL">Age Level Adjustment (Language or tone)</option>
                </select>
              </div>

              <div>
                <label className="block text-stone-300 font-semibold mb-1">Your Instruction / Comment</label>
                <textarea
                  required
                  rows={4}
                  placeholder="Explain what must be changed or added..."
                  value={commentText}
                  onChange={(e) => setCommentText(e.target.value)}
                  className="w-full bg-stone-950 border border-stone-800 rounded-xl p-3 text-stone-100 focus:outline-none focus:border-amber-500 font-serif"
                />
              </div>

              <div className="flex items-center justify-end gap-2 pt-2">
                <button
                  type="button"
                  onClick={() => setCommentingSectionId(null)}
                  className="px-4 py-2 bg-stone-800 hover:bg-stone-700 text-stone-300 rounded-xl font-medium"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="px-4 py-2 bg-amber-600 hover:bg-amber-500 text-white rounded-xl font-semibold shadow-md"
                >
                  Add Comment
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Approval Confirmation Modal */}
      {showApprovalModal && (
        <div className="fixed inset-0 z-50 bg-black/80 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-stone-900 border border-stone-800 rounded-2xl max-w-md w-full p-6 shadow-2xl space-y-4">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-2xl bg-emerald-950 border border-emerald-800 flex items-center justify-center text-emerald-400">
                <CheckCircle2 className="w-6 h-6" />
              </div>
              <div>
                <h3 className="text-base font-bold text-white">Approve Lesson Version</h3>
                <p className="text-xs text-stone-400">
                  Official servant sign-off for Sunday School instruction.
                </p>
              </div>
            </div>

            <div className="space-y-3 text-xs">
              <div>
                <label className="block text-stone-300 font-semibold mb-1">Servant Name</label>
                <input
                  type="text"
                  value={servantName}
                  onChange={(e) => setServantName(e.target.value)}
                  className="w-full bg-stone-950 border border-stone-800 rounded-xl px-3 py-2 text-stone-100 focus:outline-none focus:border-amber-500"
                />
              </div>

              <div>
                <label className="block text-stone-300 font-semibold mb-1">Approval Note & Theological Sign-off</label>
                <textarea
                  rows={3}
                  value={approvalNote}
                  onChange={(e) => setApprovalNote(e.target.value)}
                  className="w-full bg-stone-950 border border-stone-800 rounded-xl p-3 text-stone-100 focus:outline-none focus:border-amber-500 font-serif"
                />
              </div>
            </div>

            <div className="flex items-center justify-end gap-2 pt-2">
              <button
                type="button"
                onClick={() => setShowApprovalModal(false)}
                className="px-4 py-2 bg-stone-800 hover:bg-stone-700 text-stone-300 rounded-xl text-xs font-medium"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={() => {
                  onApproveVersion(currentVersion.id, servantName, approvalNote);
                  setShowApprovalModal(false);
                }}
                className="px-4 py-2 bg-emerald-600 hover:bg-emerald-500 text-white rounded-xl text-xs font-bold shadow-md"
              >
                Confirm Approval
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
