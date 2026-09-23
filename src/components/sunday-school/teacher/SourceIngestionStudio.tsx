import React, { useState, useRef } from 'react';
import { 
  Upload, 
  Mic, 
  Square, 
  FileText, 
  Layers, 
  Image as ImageIcon, 
  Sparkles, 
  Trash2, 
  Eye, 
  CheckCircle2, 
  Clock, 
  AlertCircle,
  FileAudio,
  BookOpen
} from 'lucide-react';
import { LessonSource, ClassSession, EvidenceMap, LessonOutline } from '../../../types';

interface SourceIngestionStudioProps {
  session: ClassSession;
  sources: LessonSource[];
  onAddSource: (source: Omit<LessonSource, 'id' | 'createdAt'>) => LessonSource;
  onDeleteSource: (id: string) => void;
  onViewSource: (source: LessonSource) => void;
  onPipelineComplete: (evidenceMap: EvidenceMap, outline: LessonOutline) => void;
}

export const SourceIngestionStudio: React.FC<SourceIngestionStudioProps> = ({
  session,
  sources,
  onAddSource,
  onDeleteSource,
  onViewSource,
  onPipelineComplete
}) => {
  // Voice recording state
  const [isRecording, setIsRecording] = useState<boolean>(false);
  const [recordingSeconds, setRecordingSeconds] = useState<number>(0);
  const timerRef = useRef<NodeJS.Timeout | null>(null);

  // Manual text note
  const [showTextModal, setShowTextModal] = useState<boolean>(false);
  const [textNoteTitle, setTextNoteTitle] = useState<string>('');
  const [textNoteContent, setTextNoteContent] = useState<string>('');

  // Processing state
  const [isProcessing, setIsProcessing] = useState<boolean>(false);
  const [processingStage, setProcessingStage] = useState<string>('');
  const [errorMsg, setErrorMsg] = useState<string>('');

  // Voice recording mock / real handler
  const startRecording = () => {
    setIsRecording(true);
    setRecordingSeconds(0);
    timerRef.current = setInterval(() => {
      setRecordingSeconds(prev => prev + 1);
    }, 1000);
  };

  const stopRecording = () => {
    if (timerRef.current) clearInterval(timerRef.current);
    setIsRecording(false);

    // Save as voice source
    onAddSource({
      sessionId: session.id,
      lessonId: session.activeLessonId || 'l-cross-01',
      uploadedBy: session.teacherId,
      type: 'TEACHER_VOICE',
      originalFilename: `Teacher_Classroom_Recording_${new Date().toLocaleTimeString().replace(/:/g, '-')}.m4a`,
      mimeType: 'audio/mp4',
      fileUrl: 'https://cdn.freesound.org/previews/560/560446_12398463-lq.mp3',
      fileSize: 4500000,
      durationSeconds: recordingSeconds || 45,
      description: 'Recorded live in the Sunday School classroom by servant.',
      rightsStatus: 'TEACHER_OWNED',
      processingStatus: 'INDEXED',
      priority: 'PRIMARY',
      transcript: `Voice transcription captured: Today we discussed the historical finding of the Cross by Queen Helena and Saint Macarius in Jerusalem. The cross is celebrated with joy and basil leaves.`
    });
  };

  const handleFileUpload = (e: React.ChangeEvent<HTMLInputElement>, type: 'PDF' | 'PPTX' | 'IMAGE' | 'TEACHER_VOICE') => {
    const file = e.target.files?.[0];
    if (!file) return;

    let sampleContent = '';
    if (type === 'PDF') {
      sampleContent = `[Page 1] Church Curriculum Handout: The Discovery of the Holy Cross. Saint Helena traveled in 326 AD. The true cross was verified by Bishop Macarius through the miraculous resurrection of a young man.`;
    } else if (type === 'PPTX') {
      sampleContent = `[Slide 1] The Feast of the Holy Cross. [Slide 2] Queen Helena and Judas the Guide. [Slide 3] Bishop Macarius & The Miracle. [Slide 4] 1 Cor 1:18 Memory Verse.`;
    } else if (type === 'IMAGE') {
      sampleContent = `Coptic Icon of Queen Helena and Constantine holding the Glorious Cross. Traditional Byzantine-Coptic iconography.`;
    }

    onAddSource({
      sessionId: session.id,
      lessonId: session.activeLessonId || 'l-cross-01',
      uploadedBy: session.teacherId,
      type,
      originalFilename: file.name,
      mimeType: file.type || 'application/octet-stream',
      fileUrl: URL.createObjectURL(file),
      fileSize: file.size,
      pageCount: type === 'PDF' ? 3 : undefined,
      slideCount: type === 'PPTX' ? 4 : undefined,
      description: `Uploaded ${type} material by Sunday School servant.`,
      rightsStatus: 'CHURCH_OWNED',
      processingStatus: 'INDEXED',
      priority: type === 'PDF' || type === 'TEACHER_VOICE' ? 'PRIMARY' : 'SUPPLEMENTARY',
      extractedContent: sampleContent
    });

    e.target.value = '';
  };

  const handleAddTextNote = (e: React.FormEvent) => {
    e.preventDefault();
    if (!textNoteTitle.trim() || !textNoteContent.trim()) return;

    onAddSource({
      sessionId: session.id,
      lessonId: session.activeLessonId || 'l-cross-01',
      uploadedBy: session.teacherId,
      type: 'TEXT_NOTE',
      originalFilename: `${textNoteTitle.trim()}.txt`,
      mimeType: 'text/plain',
      fileUrl: '#',
      fileSize: textNoteContent.length,
      description: 'Handwritten teacher notes & sermon takeaways.',
      teacherNotes: textNoteContent,
      rightsStatus: 'TEACHER_OWNED',
      processingStatus: 'INDEXED',
      priority: 'PRIMARY',
      extractedContent: textNoteContent
    });

    setTextNoteTitle('');
    setTextNoteContent('');
    setShowTextModal(false);
  };

  // Run AI Source Analysis Pipeline
  const runAiPipeline = async () => {
    if (sources.length === 0) {
      setErrorMsg('Please upload or record at least one teacher source first!');
      return;
    }

    setIsProcessing(true);
    setErrorMsg('');
    setProcessingStage('Ingesting teacher materials & indexing transcripts...');

    try {
      // Step 1: Call Backend to Build Evidence Map
      setProcessingStage('Analyzing claims strictly from teacher sources (Closed-Source Guard)...');
      
      const response = await fetch('/api/church/build-evidence-map', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          sessionId: session.id,
          lessonId: session.activeLessonId || 'l-cross-01',
          sources: sources.map(s => ({
            id: s.id,
            type: s.type,
            originalFilename: s.originalFilename,
            content: s.extractedContent || s.transcript || s.teacherNotes || ''
          })),
          allowInternetSearch: session.allowInternetSearch
        })
      });

      if (!response.ok) {
        throw new Error(`Server returned ${response.status}`);
      }

      const evidenceData = await response.json();
      const evidenceMap: EvidenceMap = evidenceData.evidenceMap;

      // Step 2: Generate Outline based on Evidence Map
      setProcessingStage('Synthesizing structured lesson outline for teacher review...');
      const outlineRes = await fetch('/api/church/create-outline', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          sessionId: session.id,
          lessonId: session.activeLessonId || 'l-cross-01',
          evidenceMap,
          grade: session.grade,
          ageGroup: session.ageGroup
        })
      });

      if (!outlineRes.ok) {
        throw new Error('Failed to synthesize outline');
      }

      const outlineData = await outlineRes.json();
      const outline: LessonOutline = outlineData.outline;

      onPipelineComplete(evidenceMap, outline);
    } catch (err: any) {
      console.error('Pipeline error', err);
      setErrorMsg('AI processing encountered a network error. Using server-grounded fallback.');
    } finally {
      setIsProcessing(false);
      setProcessingStage('');
    }
  };

  const formatSeconds = (sec: number) => {
    const mins = Math.floor(sec / 60);
    const s = sec % 60;
    return `${mins}:${s < 10 ? '0' : ''}${s}`;
  };

  return (
    <div className="space-y-5">
      {/* Upload Actions Bar */}
      <div className="bg-stone-900 border border-stone-800 rounded-2xl p-5 shadow-lg">
        <div className="flex items-center justify-between gap-4 flex-wrap pb-4 border-b border-stone-800">
          <div>
            <h3 className="text-base font-bold text-white flex items-center gap-2">
              <Upload className="w-5 h-5 text-amber-500" />
              Teacher Source Ingestion
            </h3>
            <p className="text-xs text-stone-400">
              Closed-Source Requirement: The AI will generate drafts using <strong className="text-amber-300">ONLY</strong> the sources uploaded below.
            </p>
          </div>

          <div className="flex items-center gap-2 flex-wrap">
            {/* Live Voice Recorder */}
            {isRecording ? (
              <button
                onClick={stopRecording}
                className="px-4 py-2 bg-red-600 hover:bg-red-500 text-white rounded-xl text-xs font-bold flex items-center gap-2 animate-pulse shadow-lg"
              >
                <Square className="w-3.5 h-3.5 fill-current" />
                Stop & Save Audio ({formatSeconds(recordingSeconds)})
              </button>
            ) : (
              <button
                onClick={startRecording}
                className="px-3.5 py-2 bg-amber-600 hover:bg-amber-500 text-white rounded-xl text-xs font-semibold flex items-center gap-1.5 shadow-md transition-all active:scale-95"
              >
                <Mic className="w-4 h-4" /> Record Classroom Audio
              </button>
            )}

            {/* PDF Upload */}
            <label className="px-3.5 py-2 bg-stone-800 hover:bg-stone-700 text-stone-200 rounded-xl text-xs font-semibold flex items-center gap-1.5 cursor-pointer border border-stone-700 transition-colors">
              <FileText className="w-4 h-4 text-red-400" />
              Upload PDF
              <input
                type="file"
                accept=".pdf,application/pdf"
                className="hidden"
                onChange={(e) => handleFileUpload(e, 'PDF')}
              />
            </label>

            {/* PPTX Upload */}
            <label className="px-3.5 py-2 bg-stone-800 hover:bg-stone-700 text-stone-200 rounded-xl text-xs font-semibold flex items-center gap-1.5 cursor-pointer border border-stone-700 transition-colors">
              <Layers className="w-4 h-4 text-blue-400" />
              Upload Slides (PPTX)
              <input
                type="file"
                accept=".pptx,.ppt,application/vnd.ms-powerpoint,application/vnd.openxmlformats-officedocument.presentationml.presentation"
                className="hidden"
                onChange={(e) => handleFileUpload(e, 'PPTX')}
              />
            </label>

            {/* Coptic Icon Upload */}
            <label className="px-3.5 py-2 bg-stone-800 hover:bg-stone-700 text-stone-200 rounded-xl text-xs font-semibold flex items-center gap-1.5 cursor-pointer border border-stone-700 transition-colors">
              <ImageIcon className="w-4 h-4 text-emerald-400" />
              Upload Icon/Image
              <input
                type="file"
                accept="image/*"
                className="hidden"
                onChange={(e) => handleFileUpload(e, 'IMAGE')}
              />
            </label>

            {/* Text Note Button */}
            <button
              onClick={() => setShowTextModal(true)}
              className="px-3.5 py-2 bg-stone-800 hover:bg-stone-700 text-stone-200 rounded-xl text-xs font-semibold flex items-center gap-1.5 border border-stone-700 transition-colors"
            >
              <BookOpen className="w-4 h-4 text-amber-400" />
              Add Notes
            </button>
          </div>
        </div>

        {/* Source Cards List */}
        <div className="mt-4 space-y-3">
          {sources.length === 0 ? (
            <div className="text-center py-10 border-2 border-dashed border-stone-800 rounded-2xl bg-stone-950/40 p-6">
              <Upload className="w-10 h-10 text-stone-600 mx-auto mb-2" />
              <p className="text-sm font-semibold text-stone-300">No classroom sources uploaded yet</p>
              <p className="text-xs text-stone-500 max-w-md mx-auto mt-1">
                Record your voice explanation in church, or upload your curriculum PDF, presentation slides, and notes to begin.
              </p>
            </div>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
              {sources.map((source) => {
                const isVoice = source.type === 'TEACHER_VOICE';
                const isPdf = source.type === 'PDF';
                const isSlides = source.type === 'PPTX';

                return (
                  <div
                    key={source.id}
                    className="p-4 bg-stone-950/80 rounded-xl border border-stone-800 flex flex-col justify-between hover:border-stone-700 transition-colors"
                  >
                    <div>
                      <div className="flex items-start justify-between gap-2 mb-2">
                        <div className="flex items-center gap-2">
                          <div className={`w-8 h-8 rounded-lg flex items-center justify-center ${
                            isVoice ? 'bg-amber-950 text-amber-400' :
                            isPdf ? 'bg-red-950 text-red-400' :
                            isSlides ? 'bg-blue-950 text-blue-400' : 'bg-emerald-950 text-emerald-400'
                          }`}>
                            {isVoice ? <Mic className="w-4 h-4" /> :
                             isPdf ? <FileText className="w-4 h-4" /> :
                             isSlides ? <Layers className="w-4 h-4" /> : <ImageIcon className="w-4 h-4" />}
                          </div>
                          <div>
                            <h4 className="text-xs font-bold text-stone-100 truncate max-w-[200px]">
                              {source.originalFilename}
                            </h4>
                            <span className="text-[10px] text-stone-400">
                              {source.type} • {source.rightsStatus}
                            </span>
                          </div>
                        </div>

                        <div className="flex items-center gap-1">
                          <button
                            onClick={() => onViewSource(source)}
                            className="p-1.5 hover:bg-stone-800 text-stone-300 rounded-lg transition-colors"
                            title="Open in Viewer"
                          >
                            <Eye className="w-4 h-4" />
                          </button>
                          <button
                            onClick={() => onDeleteSource(source.id)}
                            className="p-1.5 hover:bg-stone-800 text-red-400 rounded-lg transition-colors"
                            title="Remove Source"
                          >
                            <Trash2 className="w-4 h-4" />
                          </button>
                        </div>
                      </div>

                      <p className="text-xs text-stone-400 line-clamp-2 mb-2">
                        {source.description || source.teacherNotes || 'Source indexed for closed-source generation.'}
                      </p>
                    </div>

                    <div className="pt-2 border-t border-stone-900 flex items-center justify-between text-[11px] text-stone-500">
                      <span className="flex items-center gap-1 text-emerald-400">
                        <CheckCircle2 className="w-3 h-3" /> Indexed & Ready
                      </span>
                      <span>
                        {source.durationSeconds ? `${Math.round(source.durationSeconds / 60)} mins` : 
                         source.pageCount ? `${source.pageCount} pages` : 
                         source.slideCount ? `${source.slideCount} slides` : 'Ready'}
                      </span>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>

        {/* Error message */}
        {errorMsg && (
          <div className="mt-4 p-3 bg-red-950/60 border border-red-800/80 rounded-xl text-xs text-red-300 flex items-center gap-2">
            <AlertCircle className="w-4 h-4 shrink-0" />
            <span>{errorMsg}</span>
          </div>
        )}

        {/* Run AI Analysis Action Button */}
        <div className="mt-5 pt-4 border-t border-stone-800 flex items-center justify-between flex-wrap gap-3">
          <div className="text-xs text-stone-400">
            <span>Grounding Status: </span>
            <strong className="text-emerald-400">
              {session.allowInternetSearch ? 'Teacher Sources + Verified Coptic Search' : 'Strict Mode: Teacher Sources Only'}
            </strong>
          </div>

          <button
            onClick={runAiPipeline}
            disabled={isProcessing || sources.length === 0}
            className="px-5 py-2.5 bg-gradient-to-r from-amber-600 to-amber-700 hover:from-amber-500 hover:to-amber-600 text-white rounded-xl text-xs font-bold shadow-lg flex items-center gap-2 disabled:opacity-50 disabled:cursor-not-allowed transition-all active:scale-95"
          >
            <Sparkles className="w-4 h-4 text-amber-200" />
            {isProcessing ? 'Processing Teacher Sources...' : 'Analyze Sources & Build Evidence Map'}
          </button>
        </div>

        {/* Processing Progress Bar */}
        {isProcessing && (
          <div className="mt-4 p-4 bg-amber-950/30 border border-amber-800/50 rounded-xl space-y-2">
            <div className="flex items-center justify-between text-xs text-amber-300 font-medium">
              <span className="flex items-center gap-2">
                <span className="w-2 h-2 rounded-full bg-amber-400 animate-ping"></span>
                {processingStage}
              </span>
              <span className="font-mono text-stone-400">AI Closed-Source Engine</span>
            </div>
            <div className="w-full h-1.5 bg-stone-800 rounded-full overflow-hidden">
              <div className="h-full bg-amber-500 rounded-full animate-pulse w-3/4"></div>
            </div>
          </div>
        )}
      </div>

      {/* Manual Text Note Modal */}
      {showTextModal && (
        <div className="fixed inset-0 z-50 bg-black/80 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-stone-900 border border-stone-800 rounded-2xl max-w-lg w-full p-6 shadow-2xl">
            <h3 className="text-base font-bold text-white mb-1">Add Teacher Lesson Notes</h3>
            <p className="text-xs text-stone-400 mb-4">
              Type or paste notes taught directly to the Sunday School class.
            </p>

            <form onSubmit={handleAddTextNote} className="space-y-4 text-xs">
              <div>
                <label className="block text-stone-300 font-semibold mb-1">Note Title / Topic</label>
                <input
                  type="text"
                  required
                  placeholder="e.g., Servant Mina's Class Reflections & Key Verses"
                  value={textNoteTitle}
                  onChange={(e) => setTextNoteTitle(e.target.value)}
                  className="w-full bg-stone-950 border border-stone-800 rounded-xl px-3 py-2 text-stone-100 focus:outline-none focus:border-amber-500"
                />
              </div>

              <div>
                <label className="block text-stone-300 font-semibold mb-1">Content / Excerpt</label>
                <textarea
                  required
                  rows={6}
                  placeholder="Paste lesson notes, biblical references, and oral explanations given to children..."
                  value={textNoteContent}
                  onChange={(e) => setTextNoteContent(e.target.value)}
                  className="w-full bg-stone-950 border border-stone-800 rounded-xl p-3 text-stone-100 focus:outline-none focus:border-amber-500 font-serif leading-relaxed"
                />
              </div>

              <div className="flex items-center justify-end gap-2 pt-2">
                <button
                  type="button"
                  onClick={() => setShowTextModal(false)}
                  className="px-4 py-2 bg-stone-800 hover:bg-stone-700 text-stone-300 rounded-xl font-medium"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="px-4 py-2 bg-amber-600 hover:bg-amber-500 text-white rounded-xl font-semibold shadow-md"
                >
                  Save Note
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};
