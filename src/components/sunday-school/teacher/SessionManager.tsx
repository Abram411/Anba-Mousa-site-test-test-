import React, { useState } from 'react';
import { 
  Plus, 
  Calendar, 
  Users, 
  BookOpen, 
  Lock, 
  Globe, 
  CheckCircle, 
  ChevronRight,
  Sparkles,
  School
} from 'lucide-react';
import { ClassSession } from '../../../types';

interface SessionManagerProps {
  sessions: ClassSession[];
  activeSessionId: string;
  onSelectSession: (id: string) => void;
  onCreateSession: (data: Partial<ClassSession>) => void;
  onUpdateSession: (id: string, updates: Partial<ClassSession>) => void;
}

export const SessionManager: React.FC<SessionManagerProps> = ({
  sessions,
  activeSessionId,
  onSelectSession,
  onCreateSession,
  onUpdateSession,
}) => {
  const [showCreateModal, setShowCreateModal] = useState<boolean>(false);
  const [newTitle, setNewTitle] = useState<string>('');
  const [newTopic, setNewTopic] = useState<string>('');
  const [newGrade, setNewGrade] = useState<string>('4th Grade');
  const [newAgeGroup, setNewAgeGroup] = useState<string>('9-11 Years (Grades 4-5)');
  const [newDate, setNewDate] = useState<string>(new Date().toISOString().split('T')[0]);
  const [allowSearch, setAllowSearch] = useState<boolean>(false); // Strict closed source by default!

  const activeSession = sessions.find(s => s.id === activeSessionId) || sessions[0];

  const handleCreate = (e: React.FormEvent) => {
    e.preventDefault();
    if (!newTitle.trim()) return;

    onCreateSession({
      title: newTitle.trim(),
      topic: newTopic.trim() || newTitle.trim(),
      grade: newGrade,
      ageGroup: newAgeGroup,
      date: newDate,
      allowInternetSearch: allowSearch,
      status: 'DRAFT',
      teacherName: 'Servant Mina (خادم رابعة ابتدائي)',
      teacherId: 't-mina-1'
    });

    setNewTitle('');
    setNewTopic('');
    setShowCreateModal(false);
  };

  return (
    <div className="bg-stone-900 border border-stone-800 rounded-2xl p-5 shadow-lg">
      <div className="flex items-center justify-between gap-4 flex-wrap pb-4 border-b border-stone-800">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-2xl bg-amber-600/20 border border-amber-500/40 flex items-center justify-center text-amber-400">
            <School className="w-5 h-5" />
          </div>
          <div>
            <h2 className="text-base font-bold text-white">Sunday School Class Sessions</h2>
            <p className="text-xs text-stone-400">
              Each session represents a real Sunday morning lesson taught in church.
            </p>
          </div>
        </div>

        <button
          onClick={() => setShowCreateModal(true)}
          className="px-3.5 py-2 bg-amber-600 hover:bg-amber-500 text-white rounded-xl text-xs font-semibold flex items-center gap-1.5 shadow-md transition-all active:scale-95"
        >
          <Plus className="w-4 h-4" /> New Class Session
        </button>
      </div>

      {/* Session Selection Grid / Strip */}
      <div className="mt-4 grid grid-cols-1 md:grid-cols-2 gap-3">
        {sessions.map((session) => {
          const isSelected = session.id === activeSessionId;
          return (
            <div
              key={session.id}
              onClick={() => onSelectSession(session.id)}
              className={`p-4 rounded-xl border text-left cursor-pointer transition-all ${
                isSelected
                  ? 'bg-amber-950/40 border-amber-500/80 shadow-md ring-1 ring-amber-500/50'
                  : 'bg-stone-950/60 border-stone-800 hover:border-stone-700 hover:bg-stone-950'
              }`}
            >
              <div className="flex items-start justify-between gap-2">
                <div className="space-y-1">
                  <span className="text-xs font-mono text-stone-400 flex items-center gap-1">
                    <Calendar className="w-3 h-3 text-amber-500" /> {session.date}
                  </span>
                  <h3 className="text-sm font-bold text-stone-100">{session.title}</h3>
                  <p className="text-xs text-stone-400 line-clamp-1">{session.topic}</p>
                </div>

                <div className="flex flex-col items-end gap-1">
                  <span className={`text-[10px] px-2 py-0.5 rounded-full font-medium ${
                    session.status === 'PUBLISHED'
                      ? 'bg-emerald-950 text-emerald-300 border border-emerald-800/60'
                      : session.status === 'APPROVED'
                      ? 'bg-blue-950 text-blue-300 border border-blue-800/60'
                      : 'bg-amber-950 text-amber-300 border border-amber-800/60'
                  }`}>
                    {session.status}
                  </span>

                  {session.allowInternetSearch ? (
                    <span className="text-[10px] text-blue-400 flex items-center gap-0.5">
                      <Globe className="w-2.5 h-2.5" /> Search Enabled
                    </span>
                  ) : (
                    <span className="text-[10px] text-emerald-400 flex items-center gap-0.5">
                      <Lock className="w-2.5 h-2.5" /> Teacher Sources Only
                    </span>
                  )}
                </div>
              </div>

              <div className="mt-3 pt-2.5 border-t border-stone-800/80 flex items-center justify-between text-xs text-stone-400">
                <span className="flex items-center gap-1">
                  <Users className="w-3 h-3 text-stone-500" /> {session.grade}
                </span>
                <span className="text-[11px] text-amber-400 hover:underline flex items-center gap-0.5">
                  Manage Lesson <ChevronRight className="w-3 h-3" />
                </span>
              </div>
            </div>
          );
        })}
      </div>

      {/* Active Session Mode Controls */}
      {activeSession && (
        <div className="mt-4 p-3.5 bg-stone-950 rounded-xl border border-stone-800 flex items-center justify-between flex-wrap gap-3">
          <div className="flex items-center gap-3">
            <div className={`p-2 rounded-xl ${
              activeSession.allowInternetSearch 
                ? 'bg-blue-950 text-blue-400 border border-blue-800/50' 
                : 'bg-emerald-950 text-emerald-400 border border-emerald-800/50'
            }`}>
              {activeSession.allowInternetSearch ? <Globe className="w-4 h-4" /> : <Lock className="w-4 h-4" />}
            </div>
            <div>
              <div className="flex items-center gap-2">
                <span className="text-xs font-semibold text-stone-200">
                  Grounding Mode: {activeSession.allowInternetSearch ? 'Teacher Sources + Internet Search' : 'Strict Mode: Teacher Sources Only'}
                </span>
                <span className="text-[10px] px-2 py-0.5 rounded-full bg-stone-800 text-stone-300">
                  {activeSession.allowInternetSearch ? 'Search Audited' : 'Closed-Source Guarded'}
                </span>
              </div>
              <p className="text-[11px] text-stone-400">
                {activeSession.allowInternetSearch 
                  ? 'AI may consult verified Coptic sources with explicit citations.' 
                  : 'AI must strictly use ONLY sources provided by the teacher.'}
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2">
            <button
              onClick={() => onUpdateSession(activeSession.id, { allowInternetSearch: !activeSession.allowInternetSearch })}
              className={`px-3 py-1.5 rounded-xl border text-xs font-medium transition-colors ${
                activeSession.allowInternetSearch
                  ? 'bg-stone-800 border-stone-700 text-stone-300 hover:bg-stone-700'
                  : 'bg-blue-950/80 border-blue-800/80 text-blue-300 hover:bg-blue-900/80'
              }`}
            >
              {activeSession.allowInternetSearch ? 'Switch to Closed-Source Only' : 'Allow Internet Search'}
            </button>
          </div>
        </div>
      )}

      {/* Create Modal */}
      {showCreateModal && (
        <div className="fixed inset-0 z-50 bg-black/80 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-stone-900 border border-stone-800 rounded-2xl max-w-md w-full p-6 shadow-2xl">
            <h3 className="text-base font-bold text-white mb-1">Create Sunday School Session</h3>
            <p className="text-xs text-stone-400 mb-4">
              Create a container for the real class session taught in church.
            </p>

            <form onSubmit={handleCreate} className="space-y-4 text-xs">
              <div>
                <label className="block text-stone-300 font-semibold mb-1">Session / Feast Title</label>
                <input
                  type="text"
                  required
                  placeholder="e.g., Feast of the Holy Cross & Queen Helena"
                  value={newTitle}
                  onChange={(e) => setNewTitle(e.target.value)}
                  className="w-full bg-stone-950 border border-stone-800 rounded-xl px-3 py-2 text-stone-100 focus:outline-none focus:border-amber-500"
                />
              </div>

              <div>
                <label className="block text-stone-300 font-semibold mb-1">Topic / Spiritual Goal</label>
                <input
                  type="text"
                  placeholder="e.g., The Discovery of the Glorious Cross (عيد ظهور الصليب المقدس)"
                  value={newTopic}
                  onChange={(e) => setNewTopic(e.target.value)}
                  className="w-full bg-stone-950 border border-stone-800 rounded-xl px-3 py-2 text-stone-100 focus:outline-none focus:border-amber-500"
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-stone-300 font-semibold mb-1">Class Grade</label>
                  <select
                    value={newGrade}
                    onChange={(e) => setNewGrade(e.target.value)}
                    className="w-full bg-stone-950 border border-stone-800 rounded-xl px-3 py-2 text-stone-100 focus:outline-none focus:border-amber-500"
                  >
                    <option value="1st Grade">1st Grade (KG-1)</option>
                    <option value="2nd Grade">2nd Grade</option>
                    <option value="3rd Grade">3rd Grade</option>
                    <option value="4th Grade">4th Grade</option>
                    <option value="5th Grade">5th Grade</option>
                    <option value="Prep (6th-8th)">Prep (6th-8th)</option>
                  </select>
                </div>

                <div>
                  <label className="block text-stone-300 font-semibold mb-1">Date Taught</label>
                  <input
                    type="date"
                    value={newDate}
                    onChange={(e) => setNewDate(e.target.value)}
                    className="w-full bg-stone-950 border border-stone-800 rounded-xl px-3 py-2 text-stone-100 focus:outline-none focus:border-amber-500"
                  >
                  </input>
                </div>
              </div>

              {/* Closed Source Toggle */}
              <div className="p-3 bg-stone-950 rounded-xl border border-stone-800 flex items-center justify-between">
                <div className="space-y-0.5">
                  <span className="font-semibold text-stone-200 block">Strict Mode: Teacher Sources Only</span>
                  <span className="text-[11px] text-stone-400 block">
                    Disallows general web crawling; keeps AI grounded in provided materials.
                  </span>
                </div>
                <input
                  type="checkbox"
                  checked={!allowSearch}
                  onChange={(e) => setAllowSearch(!e.target.checked)}
                  className="w-4 h-4 accent-amber-600 rounded cursor-pointer"
                />
              </div>

              <div className="flex items-center justify-end gap-2 pt-2">
                <button
                  type="button"
                  onClick={() => setShowCreateModal(false)}
                  className="px-4 py-2 bg-stone-800 hover:bg-stone-700 text-stone-300 rounded-xl font-medium"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="px-4 py-2 bg-amber-600 hover:bg-amber-500 text-white rounded-xl font-semibold shadow-md"
                >
                  Create Session
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};
