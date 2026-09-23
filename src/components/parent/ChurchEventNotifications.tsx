import React, { useState } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { 
  Bell, 
  Calendar, 
  Clock, 
  MapPin, 
  Check, 
  Star, 
  Users, 
  Cross, 
  Bus, 
  Music, 
  CheckCheck,
  CalendarPlus,
  Share2,
  Info
} from 'lucide-react';
import { ChurchEventNotification } from '../../types';

interface ChurchEventNotificationsProps {
  events: ChurchEventNotification[];
  lang: 'en' | 'ar';
}

export function ChurchEventNotifications({ events: initialEvents, lang }: ChurchEventNotificationsProps) {
  const [eventsList, setEventsList] = useState<ChurchEventNotification[]>(initialEvents);
  const [selectedFilter, setSelectedFilter] = useState<'all' | 'liturgy' | 'sunday_school' | 'family' | 'hymn'>('all');
  const [copiedId, setCopiedId] = useState<string | null>(null);
  const [calendarAddedId, setCalendarAddedId] = useState<string | null>(null);

  // Toggle Read Status
  const toggleReadStatus = (id: string) => {
    setEventsList(prev => prev.map(ev => {
      if (ev.id === id) {
        return { ...ev, isRead: !ev.isRead };
      }
      return ev;
    }));
  };

  // Mark all as read
  const markAllAsRead = () => {
    setEventsList(prev => prev.map(ev => ({ ...ev, isRead: true })));
  };

  // Toggle RSVP
  const toggleRsvp = (id: string) => {
    setEventsList(prev => prev.map(ev => {
      if (ev.id === id) {
        const newRsvp = !ev.isRsvp;
        const count = ev.rsvpCount ?? 0;
        return {
          ...ev,
          isRsvp: newRsvp,
          rsvpCount: newRsvp ? count + 1 : Math.max(0, count - 1)
        };
      }
      return ev;
    }));
  };

  // Toggle reminder
  const toggleReminder = (id: string) => {
    setEventsList(prev => prev.map(ev => {
      if (ev.id === id) {
        return { ...ev, hasReminder: !ev.hasReminder };
      }
      return ev;
    }));
  };

  // Helper to open Google Calendar or download ICS
  const handleAddToCalendar = (event: ChurchEventNotification) => {
    const title = lang === 'ar' ? event.titleAr : event.titleEn;
    const details = lang === 'ar' ? event.descriptionAr : event.descriptionEn;
    const location = lang === 'ar' ? event.locationAr : event.locationEn;
    
    // Create Google Calendar URL
    const startDate = event.date.replace(/-/g, '') + 'T070000Z';
    const endDate = event.date.replace(/-/g, '') + 'T100000Z';
    const googleCalUrl = `https://calendar.google.com/calendar/render?action=TEMPLATE&text=${encodeURIComponent(title)}&dates=${startDate}/${endDate}&details=${encodeURIComponent(details)}&location=${encodeURIComponent(location)}`;
    
    window.open(googleCalUrl, '_blank');
    setCalendarAddedId(event.id);
    setTimeout(() => setCalendarAddedId(null), 3000);
  };

  // Share or copy event details
  const handleShare = (event: ChurchEventNotification) => {
    const text = `${lang === 'ar' ? event.titleAr : event.titleEn}\n📅 ${event.date} (${lang === 'ar' ? event.timeAr : event.timeEn})\n📍 ${lang === 'ar' ? event.locationAr : event.locationEn}`;
    if (navigator.clipboard) {
      navigator.clipboard.writeText(text);
      setCopiedId(event.id);
      setTimeout(() => setCopiedId(null), 2500);
    }
  };

  // Filter
  const filteredEvents = eventsList.filter(ev => {
    if (selectedFilter === 'all') return true;
    return ev.category === selectedFilter;
  });

  const unreadCount = eventsList.filter(ev => !ev.isRead).length;

  const categoryIcons: Record<string, React.ElementType> = {
    liturgy: Cross,
    sunday_school: Bus,
    family: Users,
    hymn: Music
  };

  return (
    <div className="space-y-6" dir={lang === 'ar' ? 'rtl' : 'ltr'}>
      {/* Header and Controls */}
      <div className="flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-4 bg-white p-5 rounded-3xl border border-[var(--color-church-cream-dark)] shadow-sm">
        <div>
          <div className="flex items-center gap-2">
            <div className="w-10 h-10 rounded-xl bg-amber-50 text-[var(--color-church-gold-dark)] flex items-center justify-center">
              <Bell size={20} />
            </div>
            <div>
              <h2 className="text-lg md:text-xl font-bold text-[var(--color-church-blue)]">
                {lang === 'ar' ? 'إشعارات الكنيسة وفعاليات الأسرة' : 'Church Events & Parish Family Feed'}
              </h2>
              <p className="text-xs text-gray-500 font-medium">
                {lang === 'ar' 
                  ? 'مواعيد القداسات، رحلات مدارس الأحد، واجتماعات أولياء الأمور' 
                  : 'Liturgies, Sunday School retreats, and parent-servant meetings'}
              </p>
            </div>
          </div>
        </div>

        <div className="flex items-center gap-2 self-end sm:self-center">
          {unreadCount > 0 && (
            <button
              onClick={markAllAsRead}
              className="inline-flex items-center gap-1.5 text-xs font-bold text-[var(--color-church-blue)] hover:text-blue-900 bg-blue-50 px-3 py-2 rounded-xl transition-colors"
            >
              <CheckCheck size={15} />
              <span>{lang === 'ar' ? 'تحديد الكل كمقروء' : 'Mark all as read'}</span>
            </button>
          )}

          <div className="text-xs font-bold px-3 py-2 bg-gray-100 text-gray-600 rounded-xl">
            {unreadCount > 0 ? (
              <span className="text-[var(--color-church-burgundy)]">
                {unreadCount} {lang === 'ar' ? 'جديد' : 'unread'}
              </span>
            ) : (
              <span className="text-emerald-700">
                {lang === 'ar' ? 'جميعها مقروءة' : 'All caught up'}
              </span>
            )}
          </div>
        </div>
      </div>

      {/* Filter Chips */}
      <div className="flex items-center gap-2 overflow-x-auto pb-1">
        <button
          onClick={() => setSelectedFilter('all')}
          className={`px-4 py-2 rounded-xl text-xs sm:text-sm font-bold transition-all shrink-0 ${
            selectedFilter === 'all'
              ? 'bg-[var(--color-church-blue)] text-white shadow-sm'
              : 'bg-white text-gray-600 hover:bg-gray-100 border border-gray-200'
          }`}
        >
          {lang === 'ar' ? 'جميع الفعاليات' : 'All Events'} ({eventsList.length})
        </button>

        <button
          onClick={() => setSelectedFilter('liturgy')}
          className={`px-4 py-2 rounded-xl text-xs sm:text-sm font-bold transition-all shrink-0 flex items-center gap-1.5 ${
            selectedFilter === 'liturgy'
              ? 'bg-[var(--color-church-blue)] text-white shadow-sm'
              : 'bg-white text-gray-600 hover:bg-gray-100 border border-gray-200'
          }`}
        >
          <Cross size={14} />
          {lang === 'ar' ? 'القداسات والأعياد' : 'Liturgies & Feasts'}
        </button>

        <button
          onClick={() => setSelectedFilter('sunday_school')}
          className={`px-4 py-2 rounded-xl text-xs sm:text-sm font-bold transition-all shrink-0 flex items-center gap-1.5 ${
            selectedFilter === 'sunday_school'
              ? 'bg-[var(--color-church-blue)] text-white shadow-sm'
              : 'bg-white text-gray-600 hover:bg-gray-100 border border-gray-200'
          }`}
        >
          <Bus size={14} />
          {lang === 'ar' ? 'مدارس الأحد والرحلات' : 'Sunday School & Trips'}
        </button>

        <button
          onClick={() => setSelectedFilter('family')}
          className={`px-4 py-2 rounded-xl text-xs sm:text-sm font-bold transition-all shrink-0 flex items-center gap-1.5 ${
            selectedFilter === 'family'
              ? 'bg-[var(--color-church-blue)] text-white shadow-sm'
              : 'bg-white text-gray-600 hover:bg-gray-100 border border-gray-200'
          }`}
        >
          <Users size={14} />
          {lang === 'ar' ? 'أولياء الأمور' : 'Parents & Families'}
        </button>

        <button
          onClick={() => setSelectedFilter('hymn')}
          className={`px-4 py-2 rounded-xl text-xs sm:text-sm font-bold transition-all shrink-0 flex items-center gap-1.5 ${
            selectedFilter === 'hymn'
              ? 'bg-[var(--color-church-blue)] text-white shadow-sm'
              : 'bg-white text-gray-600 hover:bg-gray-100 border border-gray-200'
          }`}
        >
          <Music size={14} />
          {lang === 'ar' ? 'المهرجانات والألحان' : 'Hymns & Festivals'}
        </button>
      </div>

      {/* Events List */}
      <div className="space-y-4">
        {filteredEvents.length === 0 ? (
          <div className="bg-white rounded-3xl p-10 text-center border border-gray-100 text-gray-400 font-medium">
            {lang === 'ar' ? 'لا توجد إشعارات في هذا التصنيف حالياً.' : 'No notifications in this category at the moment.'}
          </div>
        ) : (
          filteredEvents.map(event => {
            const Icon = categoryIcons[event.category] || Calendar;
            const isUnread = !event.isRead;

            return (
              <motion.div
                key={event.id}
                layout
                className={`bg-white rounded-3xl p-5 md:p-6 border transition-all duration-200 shadow-sm relative overflow-hidden ${
                  isUnread 
                    ? 'border-amber-300 ring-1 ring-amber-300/50 bg-gradient-to-br from-white via-amber-50/20 to-white' 
                    : 'border-[var(--color-church-cream-dark)] hover:border-gray-300'
                }`}
              >
                {/* Unread indicator ribbon */}
                {isUnread && (
                  <div className={`absolute top-0 ${lang === 'ar' ? 'left-0 rounded-br-xl' : 'right-0 rounded-bl-xl'} bg-[var(--color-church-gold)] text-[var(--color-church-blue)] text-[10px] font-extrabold px-3 py-1 uppercase tracking-wider`}>
                    {lang === 'ar' ? 'جديد' : 'NEW'}
                  </div>
                )}

                <div className="flex flex-col md:flex-row md:items-start justify-between gap-4">
                  {/* Icon & Details */}
                  <div className="flex items-start gap-4 flex-1">
                    <div className={`w-12 h-12 rounded-2xl flex items-center justify-center shrink-0 mt-0.5 ${
                      event.priority === 'feast' 
                        ? 'bg-amber-100 text-amber-900 border border-amber-300' 
                        : event.priority === 'high' 
                          ? 'bg-red-50 text-[var(--color-church-burgundy)] border border-red-200' 
                          : 'bg-blue-50 text-[var(--color-church-blue)] border border-blue-100'
                    }`}>
                      <Icon size={22} />
                    </div>

                    <div className="space-y-1.5 flex-1 min-w-0">
                      <div className="flex items-center gap-2 flex-wrap">
                        {event.priority === 'feast' && (
                          <span className="text-[11px] font-bold bg-amber-500 text-white px-2.5 py-0.5 rounded-full flex items-center gap-1 shadow-2xs">
                            <Star size={11} className="fill-current" />
                            {lang === 'ar' ? 'عيد كنسي سيدي' : 'Major Feast'}
                          </span>
                        )}
                        {event.priority === 'high' && (
                          <span className="text-[11px] font-bold bg-red-100 text-red-800 px-2.5 py-0.5 rounded-full">
                            {lang === 'ar' ? 'هام لجميع الأسر' : 'High Priority'}
                          </span>
                        )}
                        <span className="text-xs text-gray-400 font-medium">
                          {event.date}
                        </span>
                      </div>

                      <h3 className="text-base md:text-lg font-bold text-[var(--color-church-blue)] leading-snug">
                        {lang === 'ar' ? event.titleAr : event.titleEn}
                      </h3>

                      <p className="text-xs md:text-sm text-gray-600 leading-relaxed pt-1">
                        {lang === 'ar' ? event.descriptionAr : event.descriptionEn}
                      </p>

                      {/* Location & Time Tags */}
                      <div className="flex flex-wrap items-center gap-3 pt-2 text-xs font-semibold text-gray-500">
                        <span className="flex items-center gap-1 text-[var(--color-church-burgundy)]">
                          <Clock size={14} />
                          {lang === 'ar' ? event.timeAr : event.timeEn}
                        </span>
                        <span>•</span>
                        <span className="flex items-center gap-1 text-gray-700">
                          <MapPin size={14} className="text-[var(--color-church-gold)]" />
                          {lang === 'ar' ? event.locationAr : event.locationEn}
                        </span>
                        {event.rsvpCount !== undefined && event.rsvpCount > 0 && (
                          <>
                            <span>•</span>
                            <span className="text-blue-700 font-bold flex items-center gap-1">
                              <Users size={13} />
                              {lang === 'ar' ? `${event.rsvpCount} أسرة مسجلة` : `${event.rsvpCount} families attending`}
                            </span>
                          </>
                        )}
                      </div>
                    </div>
                  </div>

                  {/* Actions Column */}
                  <div className="flex flex-wrap md:flex-col items-center md:items-end justify-between md:justify-start gap-2 pt-3 md:pt-0 border-t md:border-t-0 border-gray-100 shrink-0">
                    {/* RSVP Toggle Button */}
                    <button
                      onClick={() => toggleRsvp(event.id)}
                      className={`px-4 py-2 rounded-xl text-xs font-bold transition-all flex items-center gap-1.5 ${
                        event.isRsvp
                          ? 'bg-emerald-600 text-white shadow-sm hover:bg-emerald-700'
                          : 'bg-gray-100 hover:bg-gray-200 text-gray-700'
                      }`}
                    >
                      <Check size={14} />
                      <span>
                        {event.isRsvp 
                          ? (lang === 'ar' ? 'تم تأكيد الحضور ✓' : 'Attending ✓') 
                          : (lang === 'ar' ? 'تأكيد الحضور مع الأسرة' : 'RSVP with Family')}
                      </span>
                    </button>

                    {/* Secondary Utility Actions */}
                    <div className="flex items-center gap-1.5">
                      <button
                        onClick={() => handleAddToCalendar(event)}
                        title={lang === 'ar' ? 'إضافة إلى مفكرة الهاتف أو Google Calendar' : 'Add to Calendar'}
                        className="p-2 text-gray-500 hover:text-[var(--color-church-blue)] hover:bg-blue-50 rounded-xl transition-colors relative"
                      >
                        <CalendarPlus size={16} />
                        {calendarAddedId === event.id && (
                          <span className="absolute -top-7 left-1/2 -translate-x-1/2 text-[10px] bg-gray-900 text-white px-2 py-0.5 rounded-md whitespace-nowrap z-20">
                            {lang === 'ar' ? 'تم الفتح' : 'Opened'}
                          </span>
                        )}
                      </button>

                      <button
                        onClick={() => handleShare(event)}
                        title={lang === 'ar' ? 'مشاركة تفاصيل الفعالية' : 'Share event'}
                        className="p-2 text-gray-500 hover:text-[var(--color-church-blue)] hover:bg-blue-50 rounded-xl transition-colors relative"
                      >
                        <Share2 size={16} />
                        {copiedId === event.id && (
                          <span className="absolute -top-7 left-1/2 -translate-x-1/2 text-[10px] bg-gray-900 text-white px-2 py-0.5 rounded-md whitespace-nowrap z-20">
                            {lang === 'ar' ? 'تم النسخ' : 'Copied'}
                          </span>
                        )}
                      </button>

                      <button
                        onClick={() => toggleReadStatus(event.id)}
                        className={`text-xs font-bold px-2.5 py-1.5 rounded-xl transition-colors ${
                          isUnread 
                            ? 'text-[var(--color-church-blue)] bg-blue-50 hover:bg-blue-100' 
                            : 'text-gray-400 hover:text-gray-600 hover:bg-gray-100'
                        }`}
                      >
                        {isUnread 
                          ? (lang === 'ar' ? 'تحديد كمقروء' : 'Mark read') 
                          : (lang === 'ar' ? 'غير مقروء' : 'Mark unread')}
                      </button>
                    </div>
                  </div>
                </div>
              </motion.div>
            );
          })
        )}
      </div>
    </div>
  );
}
