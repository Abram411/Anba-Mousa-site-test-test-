import React, { useState, useRef, useEffect } from 'react';
import { 
  Play, 
  Pause, 
  RotateCcw, 
  Volume2, 
  Sparkles, 
  CheckCircle2, 
  Mic, 
  Square, 
  Music, 
  Sliders, 
  Repeat, 
  BookOpen, 
  ChevronRight, 
  Award, 
  ExternalLink 
} from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';
import { COPTIC_HYMNS_COLLECTION, CopticHymnItem, HymnLyricLine } from '../../data/hymnsData';
import { useAuth } from '../../context/AuthContext';
import { awardPoints } from '../../lib/pointsService';
import { Language } from '../../types';

export function HymnsSchoolTab({ lang }: { lang: Language }) {
  const { userData, updateUserData } = useAuth();
  const [selectedHymn, setSelectedHymn] = useState<CopticHymnItem>(COPTIC_HYMNS_COLLECTION[0]);
  const [isPlaying, setIsPlaying] = useState(false);
  const [playbackSpeed, setPlaybackSpeed] = useState<number>(1.0);
  const [isLooping, setIsLooping] = useState(false);
  const [activeLineId, setActiveLineId] = useState<number>(1);
  const [currentTime, setCurrentTime] = useState(0);
  const [duration, setDuration] = useState(0);
  const [seasonFilter, setSeasonFilter] = useState<string>('all');
  
  // Practice voice recording
  const [isRecordingPractice, setIsRecordingPractice] = useState(false);
  const [recordedAudioUrl, setRecordedAudioUrl] = useState<string | null>(null);
  const [masteredHymns, setMasteredHymns] = useState<Record<string, boolean>>({});

  const audioRef = useRef<HTMLAudioElement | null>(null);
  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const audioChunksRef = useRef<Blob[]>([]);

  useEffect(() => {
    if (typeof window !== 'undefined') {
      const saved = localStorage.getItem('church_mastered_hymns');
      if (saved) {
        try {
          setMasteredHymns(JSON.parse(saved));
        } catch (e) {}
      }
    }
  }, []);

  // Update audio speed whenever playbackSpeed changes
  useEffect(() => {
    if (audioRef.current) {
      audioRef.current.playbackRate = playbackSpeed;
    }
  }, [playbackSpeed]);

  const togglePlay = () => {
    if (!audioRef.current) return;
    if (isPlaying) {
      audioRef.current.pause();
      setIsPlaying(false);
    } else {
      audioRef.current.play().catch(e => {
        console.warn("Audio play prevented:", e);
      });
      setIsPlaying(true);
    }
  };

  const handleTimeUpdate = () => {
    if (!audioRef.current) return;
    const cur = audioRef.current.currentTime;
    setCurrentTime(cur);

    // Sync active line
    const lines = selectedHymn.lines;
    for (let i = lines.length - 1; i >= 0; i--) {
      if (cur >= (lines[i].startTimeSec || 0)) {
        setActiveLineId(lines[i].id);
        break;
      }
    }
  };

  const handleLoadedMetadata = () => {
    if (audioRef.current) {
      setDuration(audioRef.current.duration || selectedHymn.durationSec);
    }
  };

  const handleSeek = (e: React.ChangeEvent<HTMLInputElement>) => {
    const target = parseFloat(e.target.value);
    setCurrentTime(target);
    if (audioRef.current) {
      audioRef.current.currentTime = target;
    }
  };

  const switchHymn = (hymn: CopticHymnItem) => {
    if (isPlaying && audioRef.current) {
      audioRef.current.pause();
    }
    setIsPlaying(false);
    setSelectedHymn(hymn);
    setActiveLineId(1);
    setCurrentTime(0);
    setRecordedAudioUrl(null);
  };

  // Voice recording alongside the hymn
  const startPracticeRecording = async () => {
    try {
      setRecordedAudioUrl(null);
      audioChunksRef.current = [];
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      const recorder = new MediaRecorder(stream);
      mediaRecorderRef.current = recorder;

      recorder.ondataavailable = (ev) => {
        if (ev.data.size > 0) audioChunksRef.current.push(ev.data);
      };

      recorder.onstop = () => {
        const blob = new Blob(audioChunksRef.current, { type: 'audio/webm' });
        const url = URL.createObjectURL(blob);
        setRecordedAudioUrl(url);
        stream.getTracks().forEach(t => t.stop());
      };

      recorder.start();
      setIsRecordingPractice(true);
    } catch (err) {
      console.warn("Could not start microphone for hymn practice:", err);
    }
  };

  const stopPracticeRecording = () => {
    if (mediaRecorderRef.current && isRecordingPractice) {
      mediaRecorderRef.current.stop();
      setIsRecordingPractice(false);
    }
  };

  const markAsMastered = (hymnId: string) => {
    const updated = { ...masteredHymns, [hymnId]: true };
    setMasteredHymns(updated);
    if (typeof window !== 'undefined') {
      localStorage.setItem('church_mastered_hymns', JSON.stringify(updated));
    }
    if (userData) {
      const u = awardPoints(userData.id, 75, `حفظ لحن شماسي (${selectedHymn.titleAr})`);
      updateUserData(u);
    }
  };

  const filteredHymns = COPTIC_HYMNS_COLLECTION.filter(h => {
    if (seasonFilter === 'all') return true;
    return h.occasionTag === seasonFilter;
  });

  const formatSec = (sec: number) => {
    const m = Math.floor(sec / 60);
    const s = Math.floor(sec % 60);
    return `${m}:${s < 10 ? '0' : ''}${s}`;
  };

  return (
    <motion.div
      initial={{ opacity: 0, y: 15 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, y: -15 }}
      transition={{ duration: 0.3 }}
      className="pb-28 pt-6 px-4 w-full max-w-7xl mx-auto space-y-6"
    >
      {/* Header Banner */}
      <div className="bg-linear-to-r from-[#0B2E5C] via-[#1E3A8A] to-[#8B1E2E] text-white rounded-3xl p-6 sm:p-8 shadow-xl relative overflow-hidden">
        <div className="absolute left-0 top-0 opacity-10 pointer-events-none transform -translate-x-6 -translate-y-6">
          <Music size={220} />
        </div>

        <div className="relative z-10">
          <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-amber-400/20 border border-amber-300/40 text-amber-200 text-xs font-bold mb-3">
            <Sparkles size={14} className="text-amber-300" />
            <span>{lang === 'ar' ? 'مدرسة الشمامسة والألحان القبطية الأرثوذكسية' : 'Coptic Deacon & Hymns School'}</span>
          </div>

          <h1 className="text-2xl sm:text-4xl font-extrabold text-amber-300 mb-2">
            {lang === 'ar' ? 'مدرسة الألحان الكنسية' : 'Coptic Hymns School'}
          </h1>
          <p className="text-xs sm:text-base text-gray-200 leading-relaxed max-w-2xl font-medium">
            {lang === 'ar'
              ? 'تعلّم ألحان وتسابيح الكنيسة القبطية الأصيلة بـ ٣ لغات (قبطي، معرب، عربي)، مع التحكم في سرعة الصوت وتدريب الهزات وتسجيل صوتك للتقييم.'
              : 'Master ancient Coptic hymns with 3-way synchronized lyrics, melodic hazat guidance, adjustable playback speed, and voice rehearsal.'}
          </p>
        </div>
      </div>

      {/* Season Filter Buttons */}
      <div className="flex flex-wrap items-center gap-2">
        <span className="text-xs font-bold text-gray-500 dark:text-gray-400">{lang === 'ar' ? 'المناسبة الطقسية:' : 'Liturgical Season:'}</span>
        {[
          { id: 'all', labelAr: 'كل الألحان', labelEn: 'All' },
          { id: 'annual', labelAr: 'سنوي وللقداس', labelEn: 'Annual' },
          { id: 'kiahk', labelAr: 'كيهك وتسابيح', labelEn: 'Kiahk' },
          { id: 'lent', labelAr: 'الصوم الكبير', labelEn: 'Great Lent' },
          { id: 'pascha', labelAr: 'أسبوع الآلام', labelEn: 'Pascha' },
        ].map(s => (
          <button
            key={s.id}
            onClick={() => setSeasonFilter(s.id)}
            className={`px-3 py-1.5 rounded-xl text-xs font-bold transition-all cursor-pointer ${
              seasonFilter === s.id
                ? 'bg-amber-600 text-white shadow-xs'
                : 'bg-white dark:bg-slate-800 text-gray-700 dark:text-gray-300 border border-gray-200 dark:border-slate-700 hover:bg-gray-50'
            }`}
          >
            {lang === 'ar' ? s.labelAr : s.labelEn}
          </button>
        ))}
      </div>

      {/* Main Grid: Hymn Library List + Master Player */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
        {/* Left Column: Hymn Selector List */}
        <div className="lg:col-span-4 space-y-3">
          <h3 className="text-sm font-bold uppercase tracking-wider text-gray-500 dark:text-gray-400 px-1">
            {lang === 'ar' ? 'قائمة الألحان المتاحة' : 'Available Hymns'} ({filteredHymns.length})
          </h3>
          <div className="space-y-2 max-h-[600px] overflow-y-auto pr-1">
            {filteredHymns.map(hymn => {
              const isSelected = hymn.id === selectedHymn.id;
              const isMastered = masteredHymns[hymn.id];

              return (
                <button
                  key={hymn.id}
                  onClick={() => switchHymn(hymn)}
                  className={`w-full text-start p-4 rounded-2xl border transition-all flex items-center justify-between gap-3 cursor-pointer ${
                    isSelected
                      ? 'bg-amber-500/10 border-amber-500 shadow-xs'
                      : 'bg-white dark:bg-slate-900 border-gray-200/70 dark:border-slate-800 hover:border-amber-300'
                  }`}
                >
                  <div className="flex-1">
                    <div className="flex items-center gap-1.5 mb-1">
                      <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-amber-100 dark:bg-amber-950 text-amber-900 dark:text-amber-300">
                        {hymn.seasonAr}
                      </span>
                      {isMastered && (
                        <span className="text-[10px] font-bold text-emerald-600 flex items-center gap-0.5">
                          ✓ {lang === 'ar' ? 'تم الحفظ' : 'Mastered'}
                        </span>
                      )}
                    </div>
                    <h4 className="font-bold text-sm text-[var(--color-church-blue)] dark:text-amber-200">
                      {lang === 'ar' ? hymn.titleAr : hymn.titleEn}
                    </h4>
                    <p className="text-[11px] text-gray-500 font-mono mt-0.5">{hymn.titleCoptic}</p>
                  </div>
                  <ChevronRight size={18} className={isSelected ? 'text-amber-600' : 'text-gray-400'} />
                </button>
              );
            })}
          </div>
        </div>

        {/* Right Column: Audio Player & 3-Way Lyrics Guide */}
        <div className="lg:col-span-8 space-y-5">
          {/* Active Hymn Player Card */}
          <div className="bg-white dark:bg-slate-900 rounded-3xl p-6 border border-amber-200/80 dark:border-slate-800 shadow-md">
            {/* Top Bar of Active Hymn */}
            <div className="flex flex-wrap items-center justify-between gap-3 mb-4 pb-4 border-b border-gray-100 dark:border-slate-800">
              <div>
                <span className="text-xs font-bold text-amber-600 dark:text-amber-400 block mb-0.5">
                  {selectedHymn.seasonAr}
                </span>
                <h2 className="text-xl sm:text-2xl font-extrabold text-[var(--color-church-blue)] dark:text-amber-100">
                  {lang === 'ar' ? selectedHymn.titleAr : selectedHymn.titleEn}
                </h2>
                <p className="text-xs font-mono text-gray-500 mt-0.5">{selectedHymn.titleCoptic}</p>
              </div>

              {/* Mastered Button */}
              <button
                onClick={() => markAsMastered(selectedHymn.id)}
                className={`flex items-center gap-1.5 px-3.5 py-1.5 rounded-xl font-bold text-xs transition-all cursor-pointer ${
                  masteredHymns[selectedHymn.id]
                    ? 'bg-emerald-100 dark:bg-emerald-950 text-emerald-800 dark:text-emerald-300 border border-emerald-300'
                    : 'bg-amber-600 hover:bg-amber-700 text-white shadow-xs'
                }`}
              >
                <CheckCircle2 size={16} />
                <span>
                  {masteredHymns[selectedHymn.id]
                    ? (lang === 'ar' ? 'حفظت اللحن بنجاح ✓' : 'Hymn Mastered ✓')
                    : (lang === 'ar' ? 'تسجيل حفظ اللحن (+٧٥ نقطة)' : 'Mark as Mastered (+75 Pts)')}
                </span>
              </button>
            </div>

            {/* Audio Element */}
            <audio
              ref={audioRef}
              src={selectedHymn.audioUrl}
              onTimeUpdate={handleTimeUpdate}
              onLoadedMetadata={handleLoadedMetadata}
              onEnded={() => {
                if (isLooping && audioRef.current) {
                  audioRef.current.currentTime = 0;
                  audioRef.current.play();
                } else {
                  setIsPlaying(false);
                }
              }}
            />

            {/* Audio Scrubber */}
            <div className="space-y-1 mb-4">
              <input
                type="range"
                min={0}
                max={duration || selectedHymn.durationSec}
                step={0.5}
                value={currentTime}
                onChange={handleSeek}
                className="w-full accent-amber-600 h-2 bg-gray-200 dark:bg-slate-700 rounded-lg cursor-pointer"
              />
              <div className="flex justify-between text-xs text-gray-400 font-mono">
                <span>{formatSec(currentTime)}</span>
                <span>{formatSec(duration || selectedHymn.durationSec)}</span>
              </div>
            </div>

            {/* Playback Controls & Speed Selector */}
            <div className="flex flex-wrap items-center justify-between gap-3 pt-2">
              <div className="flex items-center gap-3">
                {/* Play / Pause button */}
                <button
                  onClick={togglePlay}
                  className="flex items-center justify-center w-12 h-12 rounded-full bg-[var(--color-church-burgundy)] hover:bg-[#6e1623] text-white shadow-md transition-transform transform active:scale-95 cursor-pointer"
                >
                  {isPlaying ? <Pause size={22} /> : <Play size={22} className="translate-x-0.5" />}
                </button>

                {/* Reset to beginning */}
                <button
                  onClick={() => {
                    if (audioRef.current) audioRef.current.currentTime = 0;
                    setCurrentTime(0);
                  }}
                  className="p-2 rounded-xl text-gray-500 hover:text-gray-900 hover:bg-gray-100 dark:hover:bg-slate-800 transition-colors"
                  title="إعادة من البداية"
                >
                  <RotateCcw size={18} />
                </button>

                {/* Repeat / Loop toggle */}
                <button
                  onClick={() => setIsLooping(!isLooping)}
                  className={`p-2 rounded-xl transition-colors ${
                    isLooping 
                      ? 'bg-amber-100 dark:bg-amber-950 text-amber-700 dark:text-amber-300 font-bold' 
                      : 'text-gray-400 hover:bg-gray-100 dark:hover:bg-slate-800'
                  }`}
                  title="تكرار اللحن للتدريب المستمر"
                >
                  <Repeat size={18} />
                </button>
              </div>

              {/* Speed Controls: 0.75x (Slow for hazat), 1x, 1.25x */}
              <div className="flex items-center gap-1 bg-gray-100 dark:bg-slate-800 p-1 rounded-xl">
                <span className="text-[11px] font-bold text-gray-400 px-2">{lang === 'ar' ? 'سرعة الهزات:' : 'Speed:'}</span>
                {[0.75, 1.0, 1.25].map(speed => (
                  <button
                    key={speed}
                    onClick={() => setPlaybackSpeed(speed)}
                    className={`px-2.5 py-1 rounded-lg text-xs font-bold transition-all ${
                      playbackSpeed === speed
                        ? 'bg-white dark:bg-slate-700 text-amber-700 dark:text-amber-300 shadow-xs'
                        : 'text-gray-500 hover:text-gray-800'
                    }`}
                  >
                    {speed}x {speed === 0.75 && (lang === 'ar' ? '(تعليمي)' : '(Slow)')}
                  </button>
                ))}
              </div>
            </div>

            {/* Hazat Guide Explanation Banner */}
            <div className="mt-4 p-3 rounded-2xl bg-amber-50/70 dark:bg-slate-800/80 border border-amber-200/50 dark:border-slate-700 text-xs text-amber-950 dark:text-amber-200 flex items-start gap-2">
              <Sliders size={16} className="text-amber-600 shrink-0 mt-0.5" />
              <div>
                <strong className="block mb-0.5">{lang === 'ar' ? 'دليل الهزات والوقفات النغمية:' : 'Melodic Hazat Guide:'}</strong>
                <span>{lang === 'ar' ? selectedHymn.hazatExplanationAr : selectedHymn.hazatExplanationEn}</span>
              </div>
            </div>
          </div>

          {/* 3-Way Synchronized Lyrics View */}
          <div className="bg-white dark:bg-slate-900 rounded-3xl p-6 border border-amber-200/80 dark:border-slate-800 shadow-sm space-y-4">
            <h3 className="text-base font-bold text-[var(--color-church-blue)] dark:text-amber-200 flex items-center gap-2">
              <BookOpen size={18} className="text-amber-600" />
              <span>{lang === 'ar' ? 'كلمات اللحن باللغة القبطية والمعرب والتفسير العربي' : '3-Way Synchronized Lyrics'}</span>
            </h3>

            <div className="space-y-3">
              {selectedHymn.lines.map(line => {
                const isActive = activeLineId === line.id;

                return (
                  <div
                    key={line.id}
                    className={`p-4 rounded-2xl border transition-all ${
                      isActive
                        ? 'bg-amber-500/10 border-amber-500 ring-1 ring-amber-400/40 shadow-xs'
                        : 'bg-gray-50/80 dark:bg-slate-800/50 border-gray-200/60 dark:border-slate-700/60'
                    }`}
                  >
                    {/* Coptic Script */}
                    <div className="text-start mb-2">
                      <span className="text-[10px] font-bold uppercase tracking-wider text-amber-700 dark:text-amber-400 block mb-0.5">
                        {lang === 'ar' ? 'بالقبطي الأثري:' : 'Coptic Script:'}
                      </span>
                      <p className="text-base sm:text-lg font-serif font-bold text-amber-950 dark:text-amber-100 leading-relaxed">
                        {line.coptic}
                      </p>
                    </div>

                    {/* Arabized Pronunciation */}
                    <div className="text-start mb-2 pb-2 border-b border-gray-200/50 dark:border-slate-700/50">
                      <span className="text-[10px] font-bold uppercase tracking-wider text-blue-700 dark:text-blue-400 block mb-0.5">
                        {lang === 'ar' ? 'المعرب (النطق باللفظ):' : 'Pronunciation:'}
                      </span>
                      <p className="text-sm sm:text-base font-bold text-[var(--color-church-blue)] dark:text-blue-200 leading-relaxed">
                        {line.arabized}
                      </p>
                    </div>

                    {/* Arabic Meaning */}
                    <div className="flex flex-wrap items-center justify-between gap-2 text-xs">
                      <div>
                        <span className="text-[10px] font-bold text-gray-400 block mb-0.5">
                          {lang === 'ar' ? 'المعنى بالعربي:' : 'Arabic Meaning:'}
                        </span>
                        <p className="font-semibold text-gray-700 dark:text-gray-300">
                          {line.arabic}
                        </p>
                      </div>

                      {line.hazatNotes && (
                        <span className="px-2.5 py-1 rounded-lg bg-amber-100 dark:bg-amber-950 text-amber-900 dark:text-amber-300 font-bold text-[11px] border border-amber-200 dark:border-amber-800">
                          {line.hazatNotes}
                        </span>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
          </div>

          {/* Voice Rehearsal Recorder */}
          <div className="bg-linear-to-r from-amber-500/10 via-[var(--color-church-gold)]/5 to-amber-500/10 dark:bg-slate-900 rounded-3xl p-5 border border-amber-300/60 dark:border-slate-800">
            <h4 className="font-bold text-sm text-amber-950 dark:text-amber-200 flex items-center gap-2 mb-2">
              <Mic size={16} className="text-amber-600" />
              <span>{lang === 'ar' ? 'تدريب الشماس: سجل صوتك واستمع لأدائك' : 'Deacon Practice: Record & Listen to Your Voice'}</span>
            </h4>
            <p className="text-xs text-gray-600 dark:text-gray-400 mb-3">
              {lang === 'ar' ? 'شغّل اللحن وردد معه ثم استمع لتسجيلك لتقارن نغماتك وهزاتك مع المرتل.' : 'Chant alongside the cantor, then replay your voice to verify your pitch and rhythm.'}
            </p>

            <div className="flex flex-wrap items-center gap-3">
              {isRecordingPractice ? (
                <button
                  onClick={stopPracticeRecording}
                  className="flex items-center gap-2 px-4 py-2 rounded-xl bg-red-600 text-white font-bold text-xs shadow-md animate-pulse cursor-pointer"
                >
                  <Square size={16} />
                  <span>{lang === 'ar' ? 'إيقاف التسجيل' : 'Stop Recording'}</span>
                </button>
              ) : (
                <button
                  onClick={startPracticeRecording}
                  className="flex items-center gap-2 px-4 py-2 rounded-xl bg-[var(--color-church-burgundy)] hover:bg-[#6e1623] text-white font-bold text-xs shadow-md cursor-pointer"
                >
                  <Mic size={16} />
                  <span>{lang === 'ar' ? 'ابدأ تسجيل صوتي للتدريب' : 'Start Recording Voice'}</span>
                </button>
              )}

              {recordedAudioUrl && (
                <div className="flex items-center gap-2">
                  <audio controls src={recordedAudioUrl} className="h-9 w-60 sm:w-72" />
                  <span className="text-xs font-bold text-emerald-600 dark:text-emerald-400">
                    ✓ {lang === 'ar' ? 'تم حفظ التسجيل' : 'Recorded'}
                  </span>
                </div>
              )}
            </div>
          </div>
        </div>
      </div>
    </motion.div>
  );
}
