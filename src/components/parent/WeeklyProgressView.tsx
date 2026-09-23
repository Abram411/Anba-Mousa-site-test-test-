import React, { useState, useMemo } from 'react';
import { motion } from 'motion/react';
import { 
  Award, 
  BookOpen, 
  Calendar, 
  TrendingUp, 
  Star, 
  CheckCircle2, 
  Clock, 
  Sparkles, 
  Share2, 
  Copy, 
  Check, 
  ChevronLeft, 
  ChevronRight, 
  Heart, 
  Flame, 
  ShieldCheck, 
  Users, 
  QrCode,
  Scroll,
  Plus
} from 'lucide-react';
import { ChildProfile, ChildLessonProgress } from '../../types';

interface WeeklyProgressViewProps {
  childrenProfiles: ChildProfile[];
  lang: 'en' | 'ar';
  onOpenAddChildModal?: () => void;
  onOpenQrScanner?: () => void;
  onSendBlessing?: (childId: string, message: string) => void;
}

export function WeeklyProgressView({
  childrenProfiles,
  lang,
  onOpenAddChildModal,
  onOpenQrScanner,
  onSendBlessing
}: WeeklyProgressViewProps) {
  const [weekOffset, setWeekOffset] = useState<number>(0); // 0 = current week, -1 = last week
  const [copiedReport, setCopiedReport] = useState(false);
  const [blessingChildId, setBlessingChildId] = useState<string | null>(null);
  const [blessingMessage, setBlessingMessage] = useState('');
  const [blessingSent, setBlessingSent] = useState(false);

  // Compute date range for selected week based on 2026-09-19 base time
  const weekInfo = useMemo(() => {
    // Current simulated baseline date
    const baseDate = new Date(2026, 8, 19); // 19 Sep 2026 (Saturday)
    // Shift by weekOffset * 7 days
    baseDate.setDate(baseDate.getDate() + weekOffset * 7);

    // Compute Sunday to Saturday of that week
    const currentDayOfWeek = baseDate.getDay(); // 0 is Sunday, 6 is Saturday
    const startOfWeek = new Date(baseDate);
    startOfWeek.setDate(baseDate.getDate() - currentDayOfWeek);

    const endOfWeek = new Date(startOfWeek);
    endOfWeek.setDate(startOfWeek.getDate() + 6);

    const formatOpts: Intl.DateTimeFormatOptions = { month: 'short', day: 'numeric' };
    const formatOptsAr: Intl.DateTimeFormatOptions = { month: 'long', day: 'numeric' };

    const startStrEn = startOfWeek.toLocaleDateString('en-US', formatOpts);
    const endStrEn = endOfWeek.toLocaleDateString('en-US', { ...formatOpts, year: 'numeric' });

    const startStrAr = startOfWeek.toLocaleDateString('ar-EG', formatOptsAr);
    const endStrAr = endOfWeek.toLocaleDateString('ar-EG', { ...formatOptsAr, year: 'numeric' });

    // Generate days of this week
    const days = [];
    const dayNamesEn = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
    const dayNamesAr = ['الأحد', 'الاثنين', 'الثلاثاء', 'الأربعاء', 'الخميس', 'الجمعة', 'السبت'];

    for (let i = 0; i < 7; i++) {
      const d = new Date(startOfWeek);
      d.setDate(startOfWeek.getDate() + i);
      const isoDate = d.toISOString().split('T')[0];
      days.push({
        dayNameEn: dayNamesEn[i],
        dayNameAr: dayNamesAr[i],
        dateStr: isoDate,
        dayNum: d.getDate()
      });
    }

    return {
      startStr: lang === 'ar' ? startStrAr : startStrEn,
      endStr: lang === 'ar' ? endStrAr : endStrEn,
      days,
      isCurrentWeek: weekOffset === 0
    };
  }, [weekOffset, lang]);

  // Aggregate weekly statistics for all linked children
  const aggregatedData = useMemo(() => {
    if (!childrenProfiles || childrenProfiles.length === 0) {
      return {
        totalPoints: 0,
        totalLessonsCompleted: 0,
        totalVersesMemorized: 0,
        totalStudyMinutes: 0,
        averageQuizScore: 0,
        dailyBreakdown: [],
        childrenWeeklyStats: []
      };
    }

    const dayDates = weekInfo.days.map(d => d.dateStr);

    // Filter or simulate lessons per child for this selected week
    const childrenWeeklyStats = childrenProfiles.map((child, idx) => {
      // Find lessons completed in this week's date range
      let weeklyLessons = (child.lessons || []).filter(l => {
        if (l.status !== 'completed') return false;
        if (!l.dateCompleted) return false;
        return dayDates.includes(l.dateCompleted);
      });

      // If simulated dates don't align with exact date range, provide deterministic realistic distribution for preview
      if (weeklyLessons.length === 0 && weekOffset === 0) {
        // Distribute completed lessons for current week view
        const childLessons = child.lessons || [];
        weeklyLessons = childLessons.slice(0, Math.min(childLessons.length, idx === 0 ? 2 : 1)).map((l, lIdx) => ({
          ...l,
          dateCompleted: weekInfo.days[lIdx === 0 ? 1 : 3]?.dateStr || weekInfo.days[0].dateStr
        }));
      }

      const weeklyPoints = weeklyLessons.reduce((sum, l) => sum + (l.pointsEarned || 150), 0) + 
        (weekOffset === 0 ? (idx === 0 ? 120 : 90) : 100); // Hymns & attendance bonus
      
      const weeklyLessonsCount = Math.max(weeklyLessons.length, weekOffset === 0 ? (idx === 0 ? 2 : 1) : 1);
      const weeklyVersesCount = Math.max(weeklyLessons.length, 1);
      const weeklyStudyMins = Math.round((child.screenTimeMinutes || 60) * (weekOffset === 0 ? 0.6 : 0.8));

      return {
        child,
        weeklyLessons,
        weeklyPoints,
        weeklyLessonsCount,
        weeklyVersesCount,
        weeklyStudyMins,
        attendance: '100% ' + (lang === 'ar' ? 'حضور ممتاز' : 'Perfect Attendance')
      };
    });

    const totalPoints = childrenWeeklyStats.reduce((acc, c) => acc + c.weeklyPoints, 0);
    const totalLessonsCompleted = childrenWeeklyStats.reduce((acc, c) => acc + c.weeklyLessonsCount, 0);
    const totalVersesMemorized = childrenWeeklyStats.reduce((acc, c) => acc + c.weeklyVersesCount, 0);
    const totalStudyMinutes = childrenWeeklyStats.reduce((acc, c) => acc + c.weeklyStudyMins, 0);
    const averageQuizScore = 96;

    // Daily breakdown for visual chart
    const dailyBreakdown = weekInfo.days.map((day, dIdx) => {
      // Points on this day across all kids
      let dayPoints = 0;
      let dayLessons = 0;

      // Realistic weekly curve (Sunday liturgy spike, mid-week study, Friday prep)
      if (dIdx === 0) { // Sunday
        dayPoints = Math.round(totalPoints * 0.32);
        dayLessons = Math.ceil(totalLessonsCompleted * 0.4);
      } else if (dIdx === 2) { // Tuesday
        dayPoints = Math.round(totalPoints * 0.22);
        dayLessons = Math.ceil(totalLessonsCompleted * 0.3);
      } else if (dIdx === 4) { // Thursday
        dayPoints = Math.round(totalPoints * 0.18);
        dayLessons = Math.floor(totalLessonsCompleted * 0.2);
      } else if (dIdx === 5) { // Friday
        dayPoints = Math.round(totalPoints * 0.20);
        dayLessons = Math.ceil(totalLessonsCompleted * 0.2);
      } else {
        dayPoints = Math.round(totalPoints * 0.08 / 3);
        dayLessons = 0;
      }

      return {
        dayName: lang === 'ar' ? day.dayNameAr : day.dayNameEn,
        dayNum: day.dayNum,
        points: dayPoints,
        lessons: dayLessons
      };
    });

    return {
      totalPoints,
      totalLessonsCompleted,
      totalVersesMemorized,
      totalStudyMinutes,
      averageQuizScore,
      dailyBreakdown,
      childrenWeeklyStats
    };
  }, [childrenProfiles, weekInfo, weekOffset, lang]);

  // Handle sharing weekly summary text
  const handleCopySummary = () => {
    const text = lang === 'ar'
      ? `🕊️ ملخص تقدم عائلتنا في مدارس الأحد (${weekInfo.startStr} - ${weekInfo.endStr}):\n` +
        `⭐ إجمالي النقاط المكتسبة: ${aggregatedData.totalPoints} نقطة\n` +
        `📖 الدروس الروحية المنجزة: ${aggregatedData.totalLessonsCompleted} درس\n` +
        `📜 آيات الإنجيل المحفوظة: ${aggregatedData.totalVersesMemorized} آية\n` +
        `الأبناء المشاركون: ${childrenProfiles.map(c => c.nameAr).join('، ')}\n` +
        `كنيسة القديس الأنبا موسى الأسود والشهيد مارمينا`
      : `🕊️ Sunday School Family Weekly Progress (${weekInfo.startStr} - ${weekInfo.endStr}):\n` +
        `⭐ Total Points Earned: ${aggregatedData.totalPoints} pts\n` +
        `📖 Completed Lessons: ${aggregatedData.totalLessonsCompleted}\n` +
        `📜 Verses Memorized: ${aggregatedData.totalVersesMemorized}\n` +
        `Children: ${childrenProfiles.map(c => c.nameEn).join(', ')}\n` +
        `St. Moses Coptic Sunday School`;

    try {
      navigator.clipboard.writeText(text);
      setCopiedReport(true);
      setTimeout(() => setCopiedReport(false), 2500);
    } catch (e) {}
  };

  const handleSendWeeklyBlessing = (childId: string) => {
    if (!blessingMessage.trim()) return;
    if (onSendBlessing) {
      onSendBlessing(childId, blessingMessage);
    }
    setBlessingSent(true);
    setTimeout(() => {
      setBlessingSent(false);
      setBlessingChildId(null);
      setBlessingMessage('');
    }, 2000);
  };

  // Find max daily points for bar chart scaling
  const maxDayPoints = Math.max(...aggregatedData.dailyBreakdown.map(d => d.points), 100);

  if (!childrenProfiles || childrenProfiles.length === 0) {
    return (
      <div className="bg-white rounded-3xl p-8 border border-[var(--color-church-cream-dark)] shadow-sm text-center space-y-4" dir={lang === 'ar' ? 'rtl' : 'ltr'}>
        <div className="w-16 h-16 rounded-2xl bg-amber-50 text-amber-600 flex items-center justify-center mx-auto">
          <Users size={32} />
        </div>
        <h3 className="text-lg font-bold text-gray-800">
          {lang === 'ar' ? 'لا يوجد أبناء مرتبطون بعد' : 'No Children Linked Yet'}
        </h3>
        <p className="text-sm text-gray-500 max-w-md mx-auto">
          {lang === 'ar' 
            ? 'اربط حساب ابنك لعرض ملخص التقدم الأسبوعي المجمع ومتابعة نقاطه ودروسه في مدارس الأحد.' 
            : 'Connect your child’s profile to view their aggregated weekly progress, points, and Sunday school lessons.'}
        </p>
        <div className="flex items-center justify-center gap-3 pt-2">
          {onOpenQrScanner && (
            <button
              onClick={onOpenQrScanner}
              className="px-4 py-2.5 rounded-xl bg-[var(--color-church-blue)] text-white font-bold text-xs flex items-center gap-2 shadow-sm cursor-pointer"
            >
              <QrCode size={16} />
              <span>{lang === 'ar' ? 'مسح رمز QR للطفل' : 'Scan Child QR'}</span>
            </button>
          )}
          {onOpenAddChildModal && (
            <button
              onClick={onOpenAddChildModal}
              className="px-4 py-2.5 rounded-xl bg-gray-100 hover:bg-gray-200 text-gray-700 font-bold text-xs flex items-center gap-2 cursor-pointer"
            >
              <Plus size={16} />
              <span>{lang === 'ar' ? 'إدخال الرمز السري' : 'Enter Secret Code'}</span>
            </button>
          )}
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6" dir={lang === 'ar' ? 'rtl' : 'ltr'}>
      {/* Header with Week Selector and Share Button */}
      <div className="bg-white p-4 sm:p-6 rounded-3xl border border-[var(--color-church-cream-dark)] shadow-sm flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <div className="flex items-center gap-2 text-[var(--color-church-blue)] mb-1">
            <Calendar size={18} />
            <span className="text-xs font-bold uppercase tracking-wider">
              {lang === 'ar' ? 'التقرير الأسبوعي المجمع للعائلة' : 'Family Aggregated Weekly Report'}
            </span>
          </div>
          <h2 className="text-xl sm:text-2xl font-black text-gray-900">
            {weekInfo.startStr} — {weekInfo.endStr}
          </h2>
          <p className="text-xs sm:text-sm text-gray-500 mt-0.5">
            {lang === 'ar' 
              ? `ملخص مجمع لنقاط ودروس جميع الأبناء المرتبطين (${childrenProfiles.length} أطفال)` 
              : `Aggregated points & lessons for all linked children (${childrenProfiles.length} children)`}
          </p>
        </div>

        {/* Controls: Prev/Next Week & Share */}
        <div className="flex items-center gap-2 flex-wrap sm:flex-nowrap">
          {/* Week Pagination */}
          <div className="flex items-center bg-gray-100 p-1 rounded-2xl border border-gray-200 text-xs font-bold">
            <button
              type="button"
              onClick={() => setWeekOffset(prev => prev - 1)}
              title={lang === 'ar' ? 'الأسبوع السابق' : 'Previous Week'}
              className="p-2 rounded-xl hover:bg-white text-gray-700 transition-colors cursor-pointer"
            >
              {lang === 'ar' ? <ChevronRight size={16} /> : <ChevronLeft size={16} />}
            </button>

            <span className="px-3 py-1 text-gray-800 shrink-0">
              {weekOffset === 0 
                ? (lang === 'ar' ? 'الأسبوع الحالي' : 'This Week') 
                : (lang === 'ar' ? `منذ ${Math.abs(weekOffset)} أسبوع` : `${Math.abs(weekOffset)}w ago`)}
            </span>

            <button
              type="button"
              onClick={() => setWeekOffset(prev => Math.min(0, prev + 1))}
              disabled={weekOffset === 0}
              title={lang === 'ar' ? 'الأسبوع التالي' : 'Next Week'}
              className={`p-2 rounded-xl transition-colors ${
                weekOffset === 0 ? 'text-gray-300 cursor-not-allowed' : 'hover:bg-white text-gray-700 cursor-pointer'
              }`}
            >
              {lang === 'ar' ? <ChevronLeft size={16} /> : <ChevronRight size={16} />}
            </button>
          </div>

          {/* Copy / Share Button */}
          <button
            type="button"
            onClick={handleCopySummary}
            className="px-3.5 py-2.5 rounded-2xl bg-blue-50 hover:bg-blue-100 text-[var(--color-church-blue)] font-bold text-xs flex items-center gap-1.5 transition-colors cursor-pointer border border-blue-200 shadow-2xs shrink-0"
          >
            {copiedReport ? <Check size={14} className="text-emerald-600" /> : <Copy size={14} />}
            <span>{copiedReport ? (lang === 'ar' ? 'تم نسخ التقرير!' : 'Report Copied!') : (lang === 'ar' ? 'مشاركة التقرير' : 'Share Report')}</span>
          </button>
        </div>
      </div>

      {/* Aggregate KPI Visual Metric Cards */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 sm:gap-4">
        {/* Metric 1: Total Points */}
        <motion.div 
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          className="bg-gradient-to-br from-amber-500 to-amber-600 text-white p-4 sm:p-5 rounded-3xl shadow-sm relative overflow-hidden"
        >
          <div className="absolute top-2 right-2 rtl:right-auto rtl:left-2 opacity-15 pointer-events-none">
            <Star size={70} />
          </div>
          <span className="text-[11px] uppercase font-bold tracking-wider text-amber-100 block">
            {lang === 'ar' ? 'إجمالي النقاط الأسبوعية' : 'Total Weekly Points'}
          </span>
          <div className="flex items-baseline gap-1.5 mt-2">
            <span className="text-2xl sm:text-3xl font-black font-mono">
              +{aggregatedData.totalPoints}
            </span>
            <span className="text-xs text-amber-200 font-bold">
              {lang === 'ar' ? 'نقطة' : 'pts'}
            </span>
          </div>
          <div className="flex items-center gap-1 text-[11px] text-amber-100 mt-2 font-medium">
            <TrendingUp size={13} />
            <span>{lang === 'ar' ? 'مجموع إنجاز جميع الأبناء' : 'Combined across all kids'}</span>
          </div>
        </motion.div>

        {/* Metric 2: Completed Lessons */}
        <motion.div 
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.05 }}
          className="bg-gradient-to-br from-[var(--color-church-blue)] to-blue-900 text-white p-4 sm:p-5 rounded-3xl shadow-sm relative overflow-hidden"
        >
          <div className="absolute top-2 right-2 rtl:right-auto rtl:left-2 opacity-15 pointer-events-none">
            <BookOpen size={70} />
          </div>
          <span className="text-[11px] uppercase font-bold tracking-wider text-blue-200 block">
            {lang === 'ar' ? 'الدروس المكتملة هذا الأسبوع' : 'Lessons Completed'}
          </span>
          <div className="flex items-baseline gap-1.5 mt-2">
            <span className="text-2xl sm:text-3xl font-black font-mono">
              {aggregatedData.totalLessonsCompleted}
            </span>
            <span className="text-xs text-blue-200 font-bold">
              {lang === 'ar' ? 'دروس' : 'lessons'}
            </span>
          </div>
          <div className="flex items-center gap-1 text-[11px] text-blue-200 mt-2 font-medium">
            <CheckCircle2 size={13} className="text-emerald-400" />
            <span>{lang === 'ar' ? 'مدارس الأحد + اختبارات' : 'Sunday school + quizzes'}</span>
          </div>
        </motion.div>

        {/* Metric 3: Scripture Verses Memorized */}
        <motion.div 
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.1 }}
          className="bg-gradient-to-br from-[var(--color-church-burgundy)] to-red-950 text-white p-4 sm:p-5 rounded-3xl shadow-sm relative overflow-hidden"
        >
          <div className="absolute top-2 right-2 rtl:right-auto rtl:left-2 opacity-15 pointer-events-none">
            <Scroll size={70} />
          </div>
          <span className="text-[11px] uppercase font-bold tracking-wider text-red-200 block">
            {lang === 'ar' ? 'آيات الإنجيل المحفوظة' : 'Verses Memorized'}
          </span>
          <div className="flex items-baseline gap-1.5 mt-2">
            <span className="text-2xl sm:text-3xl font-black font-mono">
              {aggregatedData.totalVersesMemorized}
            </span>
            <span className="text-xs text-red-200 font-bold">
              {lang === 'ar' ? 'آيات' : 'verses'}
            </span>
          </div>
          <div className="flex items-center gap-1 text-[11px] text-red-200 mt-2 font-medium">
            <Sparkles size={13} className="text-amber-300" />
            <span>{lang === 'ar' ? 'حفظ وإتقان بنسبة ١٠٠٪' : '100% memorization'}</span>
          </div>
        </motion.div>

        {/* Metric 4: Quiz & Study Time */}
        <motion.div 
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.15 }}
          className="bg-white border-2 border-emerald-200 text-emerald-950 p-4 sm:p-5 rounded-3xl shadow-sm relative overflow-hidden"
        >
          <span className="text-[11px] uppercase font-bold tracking-wider text-emerald-700 block">
            {lang === 'ar' ? 'متوسط درجات الاختبار' : 'Average Quiz Score'}
          </span>
          <div className="flex items-baseline gap-1.5 mt-2">
            <span className="text-2xl sm:text-3xl font-black font-mono text-emerald-800">
              {aggregatedData.averageQuizScore}%
            </span>
            <span className="text-xs text-emerald-600 font-bold">
              {lang === 'ar' ? 'ممتاز' : 'Excellent'}
            </span>
          </div>
          <div className="flex items-center gap-1 text-[11px] text-emerald-700 mt-2 font-medium">
            <Clock size={13} />
            <span>
              {aggregatedData.totalStudyMinutes} {lang === 'ar' ? 'دقيقة مذاكرة عائلية' : 'mins total study'}
            </span>
          </div>
        </motion.div>
      </div>

      {/* Daily Visual Activity Breakdown Bar Chart */}
      <div className="bg-white p-5 sm:p-6 rounded-3xl border border-[var(--color-church-cream-dark)] shadow-sm space-y-4">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
          <div>
            <h3 className="font-extrabold text-base sm:text-lg text-gray-900 flex items-center gap-2">
              <TrendingUp size={18} className="text-[var(--color-church-blue)]" />
              <span>{lang === 'ar' ? 'نشاط العائلة اليومي على مدار الأسبوع' : 'Daily Family Activity Throughout the Week'}</span>
            </h3>
            <p className="text-xs text-gray-500">
              {lang === 'ar' ? 'توزيع النقاط والدروس المنجزة لكل يوم' : 'Points earned and lessons completed per day'}
            </p>
          </div>
          <div className="flex items-center gap-4 text-xs font-semibold text-gray-600">
            <span className="flex items-center gap-1.5">
              <span className="w-3 h-3 rounded-full bg-[var(--color-church-blue)]" />
              <span>{lang === 'ar' ? 'نقاط مكتسبة' : 'Points'}</span>
            </span>
            <span className="flex items-center gap-1.5">
              <span className="w-3 h-3 rounded-full bg-amber-400" />
              <span>{lang === 'ar' ? 'درس مكتمل' : 'Lesson Done'}</span>
            </span>
          </div>
        </div>

        {/* Visual Bar Chart */}
        <div className="pt-6 pb-2 grid grid-cols-7 gap-2 sm:gap-4 items-end h-48 border-b border-gray-100">
          {aggregatedData.dailyBreakdown.map((day, idx) => {
            const heightPercent = Math.max(12, Math.round((day.points / maxDayPoints) * 100));
            const hasLesson = day.lessons > 0;

            return (
              <div key={idx} className="flex flex-col items-center h-full justify-end group relative">
                {/* Floating Tooltip */}
                <div className="absolute -top-10 bg-slate-900 text-white text-[10px] font-bold py-1 px-2 rounded-lg opacity-0 group-hover:opacity-100 transition-opacity pointer-events-none whitespace-nowrap z-10 shadow-md">
                  {day.points} {lang === 'ar' ? 'نقطة' : 'pts'} {hasLesson ? `• ${day.lessons} ${lang === 'ar' ? 'درس' : 'lesson'}` : ''}
                </div>

                {/* Lesson Indicator dot on top of bar */}
                {hasLesson && (
                  <div className="mb-1 w-2.5 h-2.5 rounded-full bg-amber-400 ring-2 ring-amber-100 shrink-0" />
                )}

                {/* Bar */}
                <div 
                  style={{ height: `${heightPercent}%` }}
                  className="w-full max-w-[40px] rounded-t-xl bg-gradient-to-t from-[var(--color-church-blue)] to-blue-500 hover:to-amber-500 transition-all shadow-2xs relative group-hover:scale-y-105 origin-bottom"
                >
                  <span className="text-[10px] font-mono font-extrabold text-white text-center block pt-1.5">
                    {day.points > 0 ? day.points : ''}
                  </span>
                </div>

                {/* Day Label */}
                <div className="mt-2 text-center">
                  <span className="block text-xs font-extrabold text-gray-700">
                    {day.dayName}
                  </span>
                  <span className="text-[10px] text-gray-400 font-medium">
                    {day.dayNum}
                  </span>
                </div>
              </div>
            );
          })}
        </div>
      </div>

      {/* Per-Child Weekly Breakdown Section */}
      <div className="space-y-4">
        <div className="flex items-center justify-between">
          <div>
            <h3 className="text-lg font-black text-gray-900 flex items-center gap-2">
              <Users size={20} className="text-[var(--color-church-blue)]" />
              <span>{lang === 'ar' ? 'تفاصيل إنجاز كل طفل هذا الأسبوع' : 'Individual Child Breakdown This Week'}</span>
            </h3>
            <p className="text-xs text-gray-500">
              {lang === 'ar' ? 'مقارنة مساهمة كل طفل في إجمالي تقدم العائلة' : 'Detailed performance and lessons completed by each child'}
            </p>
          </div>

          <div className="flex items-center gap-2">
            {onOpenQrScanner && (
              <button
                type="button"
                onClick={onOpenQrScanner}
                className="px-3 py-1.5 rounded-xl bg-white hover:bg-gray-50 border border-gray-200 text-xs font-bold text-gray-700 flex items-center gap-1.5 transition-colors cursor-pointer shadow-2xs"
              >
                <QrCode size={14} className="text-[var(--color-church-blue)]" />
                <span>{lang === 'ar' ? 'مسح كود QR' : 'Scan QR'}</span>
              </button>
            )}
          </div>
        </div>

        {/* Children Cards Grid */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {aggregatedData.childrenWeeklyStats.map((stat, idx) => {
            const { child, weeklyPoints, weeklyLessonsCount, weeklyVersesCount, weeklyLessons, weeklyStudyMins } = stat;
            const pointsShare = aggregatedData.totalPoints > 0 
              ? Math.round((weeklyPoints / aggregatedData.totalPoints) * 100) 
              : 50;

            const isBlessingOpen = blessingChildId === child.id;

            return (
              <div 
                key={child.id}
                className="bg-white rounded-3xl p-5 border border-[var(--color-church-cream-dark)] shadow-sm hover:shadow-md transition-all space-y-4"
              >
                {/* Child Header Card */}
                <div className="flex items-start justify-between gap-3">
                  <div className="flex items-center gap-3">
                    <img 
                      src={child.avatarUrl} 
                      alt={child.nameEn} 
                      className="w-13 h-13 rounded-2xl object-cover border-2 border-white shadow-sm bg-blue-50"
                    />
                    <div>
                      <div className="flex items-center gap-1.5">
                        <h4 className="font-black text-base text-gray-900">
                          {lang === 'ar' ? child.nameAr : child.nameEn}
                        </h4>
                        <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-blue-50 text-[var(--color-church-blue)] border border-blue-100">
                          {lang === 'ar' ? child.gradeAr : child.gradeEn}
                        </span>
                      </div>
                      <p className="text-xs text-gray-500 mt-0.5 flex items-center gap-1">
                        <ShieldCheck size={13} className="text-emerald-600" />
                        <span>{stat.attendance}</span>
                      </p>
                    </div>
                  </div>

                  <div className="text-end">
                    <span className="text-xs font-bold text-amber-700 block">
                      +{weeklyPoints} {lang === 'ar' ? 'نقطة' : 'pts'}
                    </span>
                    <span className="text-[10px] text-gray-400 font-semibold">
                      {pointsShare}% {lang === 'ar' ? 'من مجموع الأسرة' : 'of family total'}
                    </span>
                  </div>
                </div>

                {/* Progress Bar of Family Share */}
                <div>
                  <div className="flex justify-between text-[11px] font-semibold text-gray-500 mb-1">
                    <span>{lang === 'ar' ? 'حصة المشاركة الأسبوعية' : 'Weekly Share'}</span>
                    <span className="font-mono text-gray-700">{pointsShare}%</span>
                  </div>
                  <div className="w-full bg-gray-100 h-2.5 rounded-full overflow-hidden">
                    <div 
                      style={{ width: `${pointsShare}%` }} 
                      className="h-full bg-gradient-to-r from-[var(--color-church-blue)] to-amber-500 rounded-full"
                    />
                  </div>
                </div>

                {/* Quick Child Metrics row */}
                <div className="grid grid-cols-3 gap-2 bg-gray-50 p-2.5 rounded-2xl text-center text-xs">
                  <div>
                    <span className="text-[10px] text-gray-400 block font-bold">
                      {lang === 'ar' ? 'دروس منجزة' : 'Lessons'}
                    </span>
                    <span className="font-black text-gray-800 text-sm">
                      {weeklyLessonsCount}
                    </span>
                  </div>
                  <div className="border-x border-gray-200">
                    <span className="text-[10px] text-gray-400 block font-bold">
                      {lang === 'ar' ? 'آيات حفظت' : 'Verses'}
                    </span>
                    <span className="font-black text-gray-800 text-sm">
                      {weeklyVersesCount}
                    </span>
                  </div>
                  <div>
                    <span className="text-[10px] text-gray-400 block font-bold">
                      {lang === 'ar' ? 'وقت المذاكرة' : 'Study Time'}
                    </span>
                    <span className="font-black text-gray-800 text-sm">
                      {weeklyStudyMins}m
                    </span>
                  </div>
                </div>

                {/* Lessons Completed This Week snippet */}
                <div className="space-y-2">
                  <span className="text-xs font-bold text-gray-700 block">
                    {lang === 'ar' ? 'أبرز دروس هذا الأسبوع:' : 'Lessons Completed This Week:'}
                  </span>
                  {weeklyLessons.length > 0 ? (
                    weeklyLessons.map((l, lIdx) => (
                      <div key={lIdx} className="bg-emerald-50/70 border border-emerald-200/70 rounded-xl p-2.5 flex items-center justify-between text-xs">
                        <div className="flex items-center gap-2">
                          <CheckCircle2 size={15} className="text-emerald-600 shrink-0" />
                          <span className="font-bold text-emerald-950 truncate max-w-[200px] sm:max-w-xs">
                            {lang === 'ar' ? l.lessonTitleAr : l.lessonTitleEn}
                          </span>
                        </div>
                        <span className="font-bold text-emerald-800 font-mono shrink-0">
                          +{l.pointsEarned || 150} pts
                        </span>
                      </div>
                    ))
                  ) : (
                    <div className="bg-blue-50/60 border border-blue-100 rounded-xl p-2.5 flex items-center justify-between text-xs text-blue-900">
                      <span>{lang === 'ar' ? 'قصة الشهيد مارمينا + الألحان القبطية' : 'St. Mina the Wonder-Worker + Hymns'}</span>
                      <span className="font-bold text-blue-800">100% Quiz</span>
                    </div>
                  )}
                </div>

                {/* Encouragement / Blessing Action */}
                <div className="pt-1 border-t border-gray-100">
                  {isBlessingOpen ? (
                    <div className="space-y-2">
                      <input
                        type="text"
                        value={blessingMessage}
                        onChange={(e) => setBlessingMessage(e.target.value)}
                        placeholder={lang === 'ar' ? 'اكتب كلمة تشجيع وبركة لابنك...' : 'Write an encouraging blessing note...'}
                        className="w-full text-xs bg-gray-50 border border-gray-200 rounded-xl p-2.5 outline-none focus:border-[var(--color-church-blue)] focus:bg-white transition-all"
                        autoFocus
                      />
                      <div className="flex items-center justify-end gap-2">
                        <button
                          type="button"
                          onClick={() => setBlessingChildId(null)}
                          className="px-3 py-1.5 rounded-lg text-xs font-semibold text-gray-500 hover:bg-gray-100"
                        >
                          {lang === 'ar' ? 'إلغاء' : 'Cancel'}
                        </button>
                        <button
                          type="button"
                          onClick={() => handleSendWeeklyBlessing(child.id)}
                          className="px-3.5 py-1.5 rounded-lg bg-[var(--color-church-blue)] text-white text-xs font-bold hover:bg-blue-900 transition-colors shadow-2xs"
                        >
                          {blessingSent ? (lang === 'ar' ? 'تم الإرسال ✓' : 'Sent ✓') : (lang === 'ar' ? 'إرسال التشجيع' : 'Send Note')}
                        </button>
                      </div>
                    </div>
                  ) : (
                    <button
                      type="button"
                      onClick={() => {
                        setBlessingChildId(child.id);
                        setBlessingMessage(lang === 'ar' ? `فخور بيك جداً يا ${child.nameAr}، ربنا يبارك حفظك ويفرح قلبك! 🕊️` : `So proud of your progress ${child.nameEn}! May God bless you! 🕊️`);
                      }}
                      className="w-full py-2 px-3 rounded-xl bg-gray-50 hover:bg-amber-50 text-gray-700 hover:text-amber-900 border border-gray-200 hover:border-amber-200 text-xs font-bold flex items-center justify-center gap-1.5 transition-colors cursor-pointer"
                    >
                      <Heart size={14} className="text-amber-600" />
                      <span>{lang === 'ar' ? 'إرسال كلمة تشجيع وبركة أسبوعية' : 'Send Weekly Encouragement Blessing'}</span>
                    </button>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      </div>

      {/* Spiritual Milestones & Church Attendance Summary */}
      <div className="bg-gradient-to-br from-blue-50/60 to-amber-50/40 border border-blue-100/80 rounded-3xl p-5 sm:p-6 space-y-3">
        <div className="flex items-center gap-2 text-[var(--color-church-blue)]">
          <Sparkles size={18} />
          <h4 className="font-extrabold text-sm sm:text-base text-gray-900">
            {lang === 'ar' ? 'حصاد الثمار الروحية لهذا الأسبوع' : 'Spiritual Fruits & Highlights This Week'}
          </h4>
        </div>
        <p className="text-xs text-gray-600 leading-relaxed">
          {lang === 'ar'
            ? 'بنعمة ربنا، أظهر جميع الأبناء التزاماً رائعاً في حضور القداس الإلهي وحفظ الآيات المقررة، مع مشاركة فعالة في ترتيل ألحان مدارس الأحد.'
            : 'By God’s grace, all children demonstrated excellent commitment attending Sunday Liturgy, memorizing scripture verses, and practicing Sunday school hymns.'}
        </p>

        <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 pt-1">
          <div className="bg-white p-3 rounded-2xl border border-blue-100 flex items-center gap-2.5 shadow-2xs">
            <div className="w-8 h-8 rounded-xl bg-amber-100 text-amber-700 flex items-center justify-center shrink-0">
              <Scroll size={16} />
            </div>
            <div>
              <span className="text-[10px] font-bold text-gray-400 block">
                {lang === 'ar' ? 'آية الأسبوع المحفوظة' : 'Memory Verse'}
              </span>
              <span className="text-xs font-extrabold text-gray-800">
                {lang === 'ar' ? '«أَسْتَطِيعُ كُلَّ شَيْءٍ فِي الْمَسِيحِ»' : 'Philippians 4:13'}
              </span>
            </div>
          </div>

          <div className="bg-white p-3 rounded-2xl border border-blue-100 flex items-center gap-2.5 shadow-2xs">
            <div className="w-8 h-8 rounded-xl bg-blue-100 text-[var(--color-church-blue)] flex items-center justify-center shrink-0">
              <BookOpen size={16} />
            </div>
            <div>
              <span className="text-[10px] font-bold text-gray-400 block">
                {lang === 'ar' ? 'ألحان قبطية متقنة' : 'Chanted Hymns'}
              </span>
              <span className="text-xs font-extrabold text-gray-800">
                {lang === 'ar' ? 'لحن جولجوثا والذكصولوجيات' : 'Golgotha & Doxologies'}
              </span>
            </div>
          </div>

          <div className="bg-white p-3 rounded-2xl border border-blue-100 flex items-center gap-2.5 shadow-2xs">
            <div className="w-8 h-8 rounded-xl bg-emerald-100 text-emerald-700 flex items-center justify-center shrink-0">
              <ShieldCheck size={16} />
            </div>
            <div>
              <span className="text-[10px] font-bold text-gray-400 block">
                {lang === 'ar' ? 'نسبة حضور مدارس الأحد' : 'Attendance Rate'}
              </span>
              <span className="text-xs font-extrabold text-emerald-800">
                100% {lang === 'ar' ? 'منتظم' : 'Perfect'}
              </span>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
