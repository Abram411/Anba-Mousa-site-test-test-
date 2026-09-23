import React, { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { 
  Users, 
  Shield, 
  CheckCircle, 
  Clock, 
  Settings, 
  Bell, 
  BellRing,
  BellOff,
  BookOpen, 
  Calendar, 
  XCircle, 
  Sparkles,
  HeartHandshake,
  TrendingUp,
  QrCode,
  X
} from 'lucide-react';
import { useAuth } from '../../context/AuthContext';
import { updateSupabaseProfile, fetchLinkedChildrenFromSupabase } from '../../lib/supabaseDatabase';
import { mockChurchEventNotifications } from './parentData';
import { 
  getLinkedChildren, 
  unlinkChild, 
  setChildScreenTimeLimit, 
  sendParentBlessing,
  getRewardRequests,
  updateRewardRequestStatus
} from '../../lib/parentChildService';
import { AddChildModal } from './AddChildModal';
import { ChildProfile } from '../../types';
import { ChildrenLessonsProgress } from './ChildrenLessonsProgress';
import { ChurchEventNotifications } from './ChurchEventNotifications';
import { ParentSettings } from './ParentSettings';
import { WeeklyProgressView } from './WeeklyProgressView';

interface RewardRequest {
  id: string;
  childNameEn: string;
  childNameAr: string;
  rewardTitleEn: string;
  rewardTitleAr: string;
  pointsCost: number;
  icon: string;
  status: 'pending' | 'approved' | 'denied';
  requestedAt: string;
}

interface ParentDashboardProps {
  lang: 'en' | 'ar';
  onBackToApp?: () => void;
  onOpenTeacherStudio?: () => void;
  initialChildCode?: string;
}

export function ParentDashboard({ lang, onBackToApp, onOpenTeacherStudio, initialChildCode }: ParentDashboardProps) {
  const { userData, currentUser } = useAuth();
  const [activeTab, setActiveTab] = useState<'overview' | 'weekly' | 'events' | 'approvals' | 'settings'>('overview');
  const [addChildInitialTab, setAddChildInitialTab] = useState<'qr' | 'code' | 'link'>('qr');
  
  // Consistent parent key across all operations
  const parentKey = userData?.id || userData?.email || 'default';

  // Dynamic linked children from parentChildService
  const [linkedChildren, setLinkedChildren] = useState<ChildProfile[]>(() => {
    return getLinkedChildren(parentKey, userData);
  });
  const [isAddChildModalOpen, setIsAddChildModalOpen] = useState(Boolean(initialChildCode));
  const [selectedChildId, setSelectedChildId] = useState<string>(() => {
    const initialChildren = getLinkedChildren(parentKey, userData);
    return initialChildren[0]?.id || 'child-1';
  });

  const refreshChildren = () => {
    const updated = getLinkedChildren(parentKey, userData);
    setLinkedChildren(updated);
    if (updated.length > 0 && !updated.find(c => c.id === selectedChildId)) {
      setSelectedChildId(updated[0].id);
    }
  };

  useEffect(() => {
    refreshChildren();

    // Listen for cross-component linking events
    const handleChildrenUpdated = () => {
      refreshChildren();
    };
    window.addEventListener('church:children_updated', handleChildrenUpdated);
    window.addEventListener('church:parent_linked', handleChildrenUpdated);

    // Sync with Supabase user_relationships & profiles
    if (userData?.id) {
      fetchLinkedChildrenFromSupabase(userData.id).then((supabaseChildren) => {
        if (supabaseChildren && supabaseChildren.length > 0) {
          refreshChildren();
        }
      }).catch(() => {});
    }

    return () => {
      window.removeEventListener('church:children_updated', handleChildrenUpdated);
      window.removeEventListener('church:parent_linked', handleChildrenUpdated);
    };
  }, [parentKey]);

  // Firestore parental approval toggle
  const [requireApproval, setRequireApproval] = useState<boolean>(
    userData?.requireRewardApproval ?? true
  );

  // Real-time Push notification preferences
  const [pushNotificationsEnabled, setPushNotificationsEnabled] = useState<boolean>(() => {
    if (userData?.pushNotificationsEnabled !== undefined) return userData.pushNotificationsEnabled;
    const saved = localStorage.getItem('church_parent_push_enabled');
    return saved !== null ? saved === 'true' : true;
  });

  const [notifyLessonCompletion, setNotifyLessonCompletion] = useState<boolean>(() => {
    if (userData?.notifyLessonCompletion !== undefined) return userData.notifyLessonCompletion;
    const saved = localStorage.getItem('church_parent_notify_lessons');
    return saved !== null ? saved === 'true' : true;
  });

  const [notifyEventReminders, setNotifyEventReminders] = useState<boolean>(() => {
    if (userData?.notifyEventReminders !== undefined) return userData.notifyEventReminders;
    const saved = localStorage.getItem('church_parent_notify_events');
    return saved !== null ? saved === 'true' : true;
  });

  const [permissionStatus, setPermissionStatus] = useState<'granted' | 'denied' | 'default' | 'unsupported'>('default');

  // Interactive in-app push alert toast for live preview and real-time alerts
  const [activePushToast, setActivePushToast] = useState<{
    id: string;
    title: string;
    body: string;
    icon: string;
    badge: string;
    timestamp: string;
  } | null>(null);

  useEffect(() => {
    if (typeof window !== 'undefined' && 'Notification' in window) {
      setPermissionStatus(Notification.permission);
    } else {
      setPermissionStatus('unsupported');
    }
  }, []);

  // Auto-dismiss push toast after 5 seconds
  useEffect(() => {
    if (activePushToast) {
      const timer = setTimeout(() => {
        setActivePushToast(null);
      }, 5500);
      return () => clearTimeout(timer);
    }
  }, [activePushToast]);

  const toggleApproval = async () => {
    const newValue = !requireApproval;
    setRequireApproval(newValue);
    if (currentUser) {
      await updateSupabaseProfile(currentUser.uid, {
        require_reward_approval: newValue
      });
    }
  };

  const togglePushNotifications = async () => {
    const nextVal = !pushNotificationsEnabled;
    setPushNotificationsEnabled(nextVal);
    try {
      localStorage.setItem('church_parent_push_enabled', String(nextVal));
    } catch (e) {}

    // If enabling, request permission if available in browser
    if (nextVal && typeof window !== 'undefined' && 'Notification' in window) {
      if (Notification.permission === 'default') {
        try {
          const perm = await Notification.requestPermission();
          setPermissionStatus(perm);
        } catch (e) {
          console.warn("Notification request permission warning:", e);
        }
      }
    }

    if (currentUser) {
      await updateSupabaseProfile(currentUser.uid, {
        push_notifications_enabled: nextVal
      });
    }

    // Show temporary feedback toast
    setActivePushToast({
      id: 'toggle-' + Date.now(),
      title: nextVal 
        ? (lang === 'ar' ? 'تم تفعيل التنبيهات الفورية 🔔' : 'Real-Time Alerts Enabled 🔔')
        : (lang === 'ar' ? 'تم إيقاف التنبيهات الفورية 🔕' : 'Real-Time Alerts Disabled 🔕'),
      body: nextVal
        ? (lang === 'ar' ? 'ستصلك إشعارات فورية لتقارير إتمام الدروس وتذكيرات فعاليات الكنيسة.' : 'You will receive real-time alerts for lesson completions and church event reminders.')
        : (lang === 'ar' ? 'لن تستلم تنبيهات منبثقة فورية بعد الآن.' : 'Push notifications are now muted.'),
      icon: nextVal ? '🔔' : '🔕',
      badge: nextVal ? (lang === 'ar' ? 'نشط' : 'Active') : (lang === 'ar' ? 'متوقف' : 'Muted'),
      timestamp: lang === 'ar' ? 'الآن' : 'Just now'
    });
  };

  const toggleLessonCompletion = async () => {
    const nextVal = !notifyLessonCompletion;
    setNotifyLessonCompletion(nextVal);
    try {
      localStorage.setItem('church_parent_notify_lessons', String(nextVal));
    } catch (e) {}
    if (currentUser) {
      await updateSupabaseProfile(currentUser.uid, {
        notify_lesson_completion: nextVal
      });
    }
  };

  const toggleEventReminders = async () => {
    const nextVal = !notifyEventReminders;
    setNotifyEventReminders(nextVal);
    try {
      localStorage.setItem('church_parent_notify_events', String(nextVal));
    } catch (e) {}
    if (currentUser) {
      await updateSupabaseProfile(currentUser.uid, {
        notify_event_reminders: nextVal
      });
    }
  };

  const handleSendTestNotification = (type: 'lesson' | 'event') => {
    const isLesson = type === 'lesson';
    const title = isLesson
      ? (lang === 'ar' ? '🎉 إتمام درس جديد: مينا عماد' : '🎉 New Lesson Completed: Mina Emad')
      : (lang === 'ar' ? '⛪ تذكير كنسي: قداس عيد الصليب' : '⛪ Church Reminder: Feast of the Cross Liturgy');
    const body = isLesson
      ? (lang === 'ar' ? 'أتم مينا درس "الشهيد العظيم مارمينا العجائبي" بدرجة ١٠٠٪ في الاختبار وحفظ الآية (+١٥٠ نقطة).' : 'Mina completed "St. Mina the Wonder-Worker" with 100% quiz score and memorized the Scripture verse (+150 pts).')
      : (lang === 'ar' ? 'القداس الإلهي غداً الجمعة ٦:٣٠ ص بكنيسة القديس الأنبا موسى الأسود، يليه إفطار محبة.' : 'Divine Liturgy tomorrow Friday at 6:30 AM at St. Moses Church, followed by agape fellowship.');

    // Native browser notification if permitted
    if (typeof window !== 'undefined' && 'Notification' in window && Notification.permission === 'granted') {
      try {
        new Notification(title, {
          body,
          icon: 'https://api.dicebear.com/7.x/bottts/svg?seed=church_bell'
        });
      } catch (err) {
        console.warn('Native notification failed:', err);
      }
    }

    // In-app floating push alert toast
    setActivePushToast({
      id: 'test-' + Date.now(),
      title,
      body,
      icon: isLesson ? '📖' : '⛪',
      badge: isLesson ? (lang === 'ar' ? 'تقرير درس' : 'Lesson Report') : (lang === 'ar' ? 'تذكير كنسي' : 'Event Reminder'),
      timestamp: lang === 'ar' ? 'الآن' : 'Just now'
    });
  };

  // State for reward requests synced from parentChildService
  const [rewardRequests, setRewardRequests] = useState<RewardRequest[]>(() => {
    return getRewardRequests(userData?.id || userData?.email) as any;
  });

  const handleRewardAction = (id: string, newStatus: 'approved' | 'denied') => {
    updateRewardRequestStatus(id, newStatus);
    setRewardRequests(prev => prev.map(req => {
      if (req.id === id) {
        return { ...req, status: newStatus };
      }
      return req;
    }));

    setActivePushToast({
      id: 'reward-' + Date.now(),
      title: newStatus === 'approved' 
        ? (lang === 'ar' ? 'تم اعتماد طلب الهدية' : 'Reward Approved') 
        : (lang === 'ar' ? 'تم رفض طلب الهدية' : 'Reward Denied'),
      body: newStatus === 'approved'
        ? (lang === 'ar' ? 'تم إرسال الموافقة وتحديث رصيد الطفل لاستلام الهدية الأحد القادم' : 'Approval synced with child account for Sunday retrieval')
        : (lang === 'ar' ? 'تم رفض طلب استبدال الهدية' : 'Reward redemption denied'),
      icon: newStatus === 'approved' ? '🎁' : '🛡️',
      badge: lang === 'ar' ? 'موافقة الأهل' : 'Parent Approval',
      timestamp: lang === 'ar' ? 'الآن' : 'Just now'
    });
  };

  const handleUnlinkChild = (childId: string) => {
    unlinkChild(childId, userData?.email);
    refreshChildren();
    setActivePushToast({
      id: 'unlink-' + Date.now(),
      title: lang === 'ar' ? 'تم إلغاء ربط الحساب' : 'Child Unlinked',
      body: lang === 'ar' ? 'تم إزالة ملف الطفل من البوابة' : 'Child profile unlinked',
      icon: 'ℹ️',
      badge: lang === 'ar' ? 'إدارة الأبناء' : 'Family Manage',
      timestamp: lang === 'ar' ? 'الآن' : 'Just now'
    });
  };

  const handleSetScreenTimeLimit = (childId: string, limit: number) => {
    setChildScreenTimeLimit(childId, limit, userData?.email);
    refreshChildren();
    setActivePushToast({
      id: 'limit-' + Date.now(),
      title: lang === 'ar' ? 'تم تحديث حد المذاكرة' : 'Study Limit Updated',
      body: limit === 0 
        ? (lang === 'ar' ? 'تم ضبط وقت المذاكرة ليكون مفتوحاً' : 'Study limit set to unlimited')
        : (lang === 'ar' ? `تم ضبط الحد اليومي إلى ${limit} دقيقة وتطبيقه على جهاز الطفل` : `Daily study limit set to ${limit} mins`),
      icon: '⏱️',
      badge: lang === 'ar' ? 'تحكم أبوي' : 'Screen Time',
      timestamp: lang === 'ar' ? 'الآن' : 'Just now'
    });
  };

  const handleSendBlessing = (childId: string, message: string) => {
    sendParentBlessing(childId, message, userData?.email);
    refreshChildren();
    setActivePushToast({
      id: 'blessing-' + Date.now(),
      title: lang === 'ar' ? 'تم إرسال البركة بنجاح' : 'Blessing Sent',
      body: lang === 'ar' ? 'تم إرسال رسالة البركة والتشجيع إلى تطبيق طفلك' : "Your blessing note has been sent to your child's app",
      icon: '🕊️',
      badge: lang === 'ar' ? 'تشجيع أبوي' : 'Parent Blessing',
      timestamp: lang === 'ar' ? 'الآن' : 'Just now'
    });
  };

  const pendingRequests = rewardRequests.filter(r => r.status === 'pending');
  const unreadEventsCount = mockChurchEventNotifications.filter(e => !e.isRead).length;

  return (
    <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 w-full pb-28 pt-4 relative" dir={lang === 'ar' ? 'rtl' : 'ltr'}>
      {/* Floating Real-Time Push Notification Toast */}
      <AnimatePresence>
        {activePushToast && (
          <motion.div
            key={activePushToast.id}
            initial={{ opacity: 0, y: -40, scale: 0.95 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: -30, scale: 0.95 }}
            className="fixed top-5 left-1/2 -translate-x-1/2 z-50 w-[92%] max-w-lg bg-white/95 backdrop-blur-md rounded-2xl shadow-xl border-2 border-[var(--color-church-blue)]/20 p-4"
          >
            <div className="flex items-start gap-3">
              <div className="w-10 h-10 rounded-xl bg-blue-50 text-2xl flex items-center justify-center shrink-0 border border-blue-100 shadow-2xs">
                {activePushToast.icon}
              </div>
              <div className="flex-1 min-w-0">
                <div className="flex items-center justify-between gap-2">
                  <div className="flex items-center gap-2">
                    <h5 className="font-bold text-sm text-[var(--color-church-blue)] truncate">
                      {activePushToast.title}
                    </h5>
                    <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-[var(--color-church-cream)] text-[var(--color-church-gold-dark)] border border-[var(--color-church-gold)]/30">
                      {activePushToast.badge}
                    </span>
                  </div>
                  <button 
                    onClick={() => setActivePushToast(null)}
                    className="text-gray-400 hover:text-gray-600 p-1 rounded-lg transition-colors"
                  >
                    <X size={15} />
                  </button>
                </div>
                <p className="text-xs text-gray-600 mt-1 leading-relaxed">
                  {activePushToast.body}
                </p>
                <div className="flex items-center justify-between mt-2 pt-1 border-t border-gray-100 text-[10px] text-gray-400 font-medium">
                  <span className="flex items-center gap-1">
                    <BellRing size={11} className="text-[var(--color-church-gold)]" />
                    <span>{lang === 'ar' ? 'إشعار فوري حقيقي' : 'Real-time Push Notification'}</span>
                  </span>
                  <span>{activePushToast.timestamp}</span>
                </div>
              </div>
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Top Welcome Header */}
      <motion.div 
        initial={{ opacity: 0, y: -10 }}
        animate={{ opacity: 1, y: 0 }}
        className="bg-white rounded-3xl p-6 md:p-8 shadow-sm border border-[var(--color-church-cream-dark)] mb-6 flex flex-col md:flex-row items-start md:items-center justify-between gap-6"
      >
        <div className="flex items-center gap-4">
          <div className="w-16 h-16 rounded-2xl bg-[var(--color-church-cream)] border border-[var(--color-church-gold)]/20 p-2 flex items-center justify-center text-3xl shadow-xs">
            👨‍👩‍👧‍👦
          </div>
          <div>
            <div className="flex items-center gap-2">
              <h1 className="text-2xl md:text-3xl font-extrabold text-[var(--color-church-blue)]">
                {lang === 'ar' ? 'بوابة أولياء الأمور' : 'Parent Portal'}
              </h1>
              <span className="text-xs bg-blue-50 text-[var(--color-church-blue)] border border-blue-200 font-bold px-2.5 py-0.5 rounded-full">
                {lang === 'ar' ? 'حساب ولي أمر' : 'Parent Account'}
              </span>
            </div>
            <p className="text-sm text-gray-500 font-medium mt-1">
              {lang === 'ar' 
                ? `أهلاً بك يا ${userData?.fullName || 'أستاذ عماد'}، متابعة نمو أطفالك في مدارس الأحد والأنشطة الكنسية` 
                : `Welcome, ${userData?.fullName || 'Emad Makram'} — Track your children's Sunday School growth and liturgical life`}
            </p>
          </div>
        </div>

        {/* Quick Controls, Family Stats, Notification Toggle & Logout */}
        <div className="flex items-center flex-wrap gap-2.5 w-full md:w-auto justify-between md:justify-end">
          {onOpenTeacherStudio && (
            <button
              type="button"
              onClick={onOpenTeacherStudio}
              className="px-3 py-2 rounded-2xl bg-amber-50 hover:bg-amber-100 text-amber-900 border border-amber-200 text-xs font-bold transition-all flex items-center gap-1.5 shadow-2xs cursor-pointer"
            >
              <span>⛪</span>
              <span>{lang === 'ar' ? 'استوديو الخادم' : 'Servant Studio'}</span>
            </button>
          )}

          {onBackToApp && (
            <button
              type="button"
              onClick={onBackToApp}
              className="px-3 py-2 rounded-2xl bg-gray-100 hover:bg-gray-200 text-gray-700 text-xs font-bold transition-all cursor-pointer"
            >
              {lang === 'ar' ? 'تطبيق الكنيسة' : 'Church App'}
            </button>
          )}

          {/* Quick Notification Toggle Button */}
          <button
            type="button"
            onClick={togglePushNotifications}
            title={lang === 'ar' ? 'تبديل التنبيهات الفورية' : 'Toggle Real-Time Push Alerts'}
            className={`px-3 py-2 rounded-2xl border text-xs font-bold transition-all flex items-center gap-1.5 shadow-2xs ${
              pushNotificationsEnabled
                ? 'bg-blue-50 hover:bg-blue-100 text-[var(--color-church-blue)] border-blue-200'
                : 'bg-gray-50 hover:bg-gray-100 text-gray-500 border-gray-200'
            }`}
          >
            {pushNotificationsEnabled ? (
              <BellRing size={15} className="text-[var(--color-church-blue)]" />
            ) : (
              <BellOff size={15} className="text-gray-400" />
            )}
            <span>
              {pushNotificationsEnabled 
                ? (lang === 'ar' ? 'التنبيهات: مفعّلة' : 'Push: On') 
                : (lang === 'ar' ? 'التنبيهات: معطلة' : 'Push: Off')}
            </span>
          </button>

          {/* Quick Scan Child QR Button */}
          <button
            type="button"
            onClick={() => {
              setAddChildInitialTab('qr');
              setIsAddChildModalOpen(true);
            }}
            title={lang === 'ar' ? 'مسح رمز QR للطفل لربط حسابه فورياً' : 'Scan child QR code to link instantly'}
            className="px-3.5 py-2 rounded-2xl bg-[var(--color-church-blue)] hover:bg-blue-900 text-white text-xs font-bold transition-all flex items-center gap-1.5 shadow-2xs cursor-pointer"
          >
            <QrCode size={15} className="text-amber-300" />
            <span>{lang === 'ar' ? 'مسح كود QR' : 'Scan Child QR'}</span>
          </button>

          <div className="flex items-center gap-2 bg-gray-50 px-3.5 py-2 rounded-2xl border border-gray-100 text-xs font-semibold text-gray-600">
            <Users size={16} className="text-[var(--color-church-blue)]" />
            <span>
              {linkedChildren.length} {lang === 'ar' ? 'أطفال مسجلين' : 'children enrolled'}
            </span>
          </div>
        </div>
      </motion.div>

      {/* Main Navigation Tabs */}
      <div className="flex gap-2 sm:gap-4 mb-8 overflow-x-auto pb-1">
        {/* Tab 1: Lessons Progress */}
        <button 
          onClick={() => setActiveTab('overview')}
          className={`flex-1 min-w-[140px] py-3.5 px-3.5 rounded-2xl font-bold text-sm transition-all flex items-center justify-center gap-2 shadow-2xs ${
            activeTab === 'overview' 
              ? 'bg-[var(--color-church-blue)] text-white shadow-md' 
              : 'bg-white text-gray-600 hover:bg-gray-50 border border-[var(--color-church-cream-dark)]'
          }`}
        >
          <BookOpen size={18} className={activeTab === 'overview' ? 'text-[var(--color-church-gold)]' : 'text-gray-400'} />
          <span>{lang === 'ar' ? 'تقدم الدروس' : 'Lessons & Progress'}</span>
        </button>

        {/* Tab 2: Weekly Aggregated Progress */}
        <button 
          onClick={() => setActiveTab('weekly')}
          className={`flex-1 min-w-[140px] py-3.5 px-3.5 rounded-2xl font-bold text-sm transition-all flex items-center justify-center gap-2 shadow-2xs ${
            activeTab === 'weekly' 
              ? 'bg-[var(--color-church-blue)] text-white shadow-md' 
              : 'bg-white text-gray-600 hover:bg-gray-50 border border-[var(--color-church-cream-dark)]'
          }`}
        >
          <TrendingUp size={18} className={activeTab === 'weekly' ? 'text-[var(--color-church-gold)]' : 'text-gray-400'} />
          <span>{lang === 'ar' ? 'التقرير الأسبوعي' : 'Weekly Progress'}</span>
        </button>

        {/* Tab 3: Church Events Feed */}
        <button 
          onClick={() => setActiveTab('events')}
          className={`flex-1 min-w-[140px] py-3.5 px-3.5 rounded-2xl font-bold text-sm transition-all flex items-center justify-center gap-2 relative shadow-2xs ${
            activeTab === 'events' 
              ? 'bg-[var(--color-church-blue)] text-white shadow-md' 
              : 'bg-white text-gray-600 hover:bg-gray-50 border border-[var(--color-church-cream-dark)]'
          }`}
        >
          <Calendar size={18} className={activeTab === 'events' ? 'text-[var(--color-church-gold)]' : 'text-gray-400'} />
          <span>{lang === 'ar' ? 'فعاليات الكنيسة' : 'Church Events'}</span>
          {unreadEventsCount > 0 && (
            <span className="bg-[var(--color-church-burgundy)] text-white text-[11px] font-bold px-2 py-0.5 rounded-full shrink-0">
              {unreadEventsCount}
            </span>
          )}
        </button>

        {/* Tab 4: Reward Approvals */}
        <button 
          onClick={() => setActiveTab('approvals')}
          className={`flex-1 min-w-[140px] py-3.5 px-3.5 rounded-2xl font-bold text-sm transition-all flex items-center justify-center gap-2 relative shadow-2xs ${
            activeTab === 'approvals' 
              ? 'bg-[var(--color-church-blue)] text-white shadow-md' 
              : 'bg-white text-gray-600 hover:bg-gray-50 border border-[var(--color-church-cream-dark)]'
          }`}
        >
          <Shield size={18} className={activeTab === 'approvals' ? 'text-[var(--color-church-gold)]' : 'text-gray-400'} />
          <span>{lang === 'ar' ? 'موافقات المكافآت' : 'Reward Approvals'}</span>
          {pendingRequests.length > 0 && (
            <span className="bg-amber-500 text-white text-[11px] font-bold px-2 py-0.5 rounded-full shrink-0">
              {pendingRequests.length}
            </span>
          )}
        </button>

        {/* Tab 5: Settings & Notifications */}
        <button 
          id="parent-settings-tab-btn"
          onClick={() => setActiveTab('settings')}
          className={`flex-1 min-w-[140px] py-3.5 px-3.5 rounded-2xl font-bold text-sm transition-all flex items-center justify-center gap-2 relative shadow-2xs ${
            activeTab === 'settings' 
              ? 'bg-[var(--color-church-blue)] text-white shadow-md' 
              : 'bg-white text-gray-600 hover:bg-gray-50 border border-[var(--color-church-cream-dark)]'
          }`}
        >
          <Settings size={18} className={activeTab === 'settings' ? 'text-[var(--color-church-gold)]' : 'text-gray-400'} />
          <span>{lang === 'ar' ? 'الإعدادات والتنبيهات' : 'Settings & Alerts'}</span>
          {pushNotificationsEnabled && (
            <span className="w-2 h-2 rounded-full bg-emerald-500 shrink-0" title="Notifications active"></span>
          )}
        </button>
      </div>

      {/* Tab Content Rendering */}
      <AnimatePresence mode="wait">
        {activeTab === 'overview' && (
          <motion.div
            key="overview-tab"
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -10 }}
            transition={{ duration: 0.2 }}
          >
            <ChildrenLessonsProgress 
              childrenProfiles={linkedChildren}
              selectedChildId={selectedChildId}
              onSelectChild={setSelectedChildId}
              onOpenAddChildModal={() => {
                setAddChildInitialTab('code');
                setIsAddChildModalOpen(true);
              }}
              onOpenQrScanner={() => {
                setAddChildInitialTab('qr');
                setIsAddChildModalOpen(true);
              }}
              onUnlinkChild={handleUnlinkChild}
              onSetScreenTimeLimit={handleSetScreenTimeLimit}
              onSendBlessing={handleSendBlessing}
              lang={lang}
            />
          </motion.div>
        )}

        {activeTab === 'weekly' && (
          <motion.div
            key="weekly-tab"
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -10 }}
            transition={{ duration: 0.2 }}
          >
            <WeeklyProgressView 
              childrenProfiles={linkedChildren}
              lang={lang}
              onOpenAddChildModal={() => {
                setAddChildInitialTab('code');
                setIsAddChildModalOpen(true);
              }}
              onOpenQrScanner={() => {
                setAddChildInitialTab('qr');
                setIsAddChildModalOpen(true);
              }}
              onSendBlessing={handleSendBlessing}
            />
          </motion.div>
        )}

        {activeTab === 'events' && (
          <motion.div
            key="events-tab"
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -10 }}
            transition={{ duration: 0.2 }}
          >
            <ChurchEventNotifications 
              events={mockChurchEventNotifications}
              lang={lang}
            />
          </motion.div>
        )}

        {activeTab === 'approvals' && (
          <motion.div
            key="approvals-tab"
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -10 }}
            transition={{ duration: 0.2 }}
            className="space-y-6"
          >
            {/* Control & Toggle Banner */}
            <div className="bg-white rounded-3xl p-6 md:p-8 shadow-sm border border-[var(--color-church-cream-dark)]">
              <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 pb-6 border-b border-gray-100">
                <div className="flex items-center gap-3">
                  <div className="w-12 h-12 rounded-2xl bg-amber-50 text-amber-700 flex items-center justify-center shrink-0">
                    <Shield size={22} />
                  </div>
                  <div>
                    <h2 className="text-lg md:text-xl font-bold text-[var(--color-church-blue)]">
                      {lang === 'ar' ? 'نظام التحكم والموافقة الأبوية' : 'Parental Approval & Reward Safety'}
                    </h2>
                    <p className="text-xs text-gray-500 font-medium">
                      {lang === 'ar' 
                        ? 'عند التفعيل، لن يتمكن الطفل من استبدال نقاطه بهدايا إلا بعد موافقتك الصريحة' 
                        : 'When enabled, points can only be redeemed for gifts with your explicit confirmation'}
                    </p>
                  </div>
                </div>

                <div className="flex items-center gap-3 self-end sm:self-center">
                  <span className="text-xs font-bold text-gray-600">
                    {requireApproval 
                      ? (lang === 'ar' ? 'الموافقة مطلوبة دائماً' : 'Approval Required') 
                      : (lang === 'ar' ? 'استبدال مباشر بدون موافقة' : 'Instant Redeem')}
                  </span>
                  <label className="relative inline-flex items-center cursor-pointer">
                    <input 
                      type="checkbox" 
                      className="sr-only peer" 
                      checked={requireApproval}
                      onChange={toggleApproval}
                    />
                    <div className="w-12 h-6 bg-gray-200 peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-[var(--color-church-blue)]"></div>
                  </label>
                </div>
              </div>

              {/* Pending Requests Section */}
              <div className="pt-6">
                <h3 className="text-sm font-bold uppercase tracking-wider text-gray-400 mb-4 flex items-center gap-2">
                  <Clock size={16} />
                  {lang === 'ar' ? 'الطلبات المعلقة قيد انتظار قرارك' : 'Pending Requests Waiting for Decision'}
                </h3>

                {pendingRequests.length === 0 ? (
                  <div className="bg-gray-50 rounded-2xl p-8 text-center border border-gray-100 text-gray-500 font-medium text-sm">
                    {lang === 'ar' ? 'لا توجد طلبات مكافآت معلقة حالياً. أطفالك يبذلون جهداً رائعاً!' : 'No pending reward requests at this time. Keep encouraging your children!'}
                  </div>
                ) : (
                  <div className="space-y-3">
                    {pendingRequests.map(req => (
                      <div 
                        key={req.id}
                        className="bg-gray-50 rounded-2xl p-4 md:p-5 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 border border-gray-100"
                      >
                        <div className="flex items-center gap-4">
                          <div className="w-12 h-12 rounded-xl bg-white shadow-2xs flex items-center justify-center text-2xl shrink-0">
                            {req.icon}
                          </div>
                          <div>
                            <div className="flex items-center gap-2">
                              <h4 className="font-bold text-[var(--color-church-blue)] text-base">
                                {lang === 'ar' ? req.rewardTitleAr : req.rewardTitleEn}
                              </h4>
                              <span className="text-xs font-bold text-[var(--color-church-gold-dark)] bg-amber-50 px-2 py-0.5 rounded-md border border-amber-200">
                                {req.pointsCost} {lang === 'ar' ? 'نقطة' : 'pts'}
                              </span>
                            </div>
                            <p className="text-xs text-gray-500 font-medium mt-0.5">
                              {lang === 'ar' 
                                ? `طُلب بواسطة: ${req.childNameAr} • ${req.requestedAt}` 
                                : `Requested by: ${req.childNameEn} • ${req.requestedAt}`}
                            </p>
                          </div>
                        </div>

                        <div className="flex items-center gap-2 w-full sm:w-auto justify-end">
                          <button 
                            onClick={() => handleRewardAction(req.id, 'denied')}
                            className="flex-1 sm:flex-initial bg-white border border-gray-200 hover:bg-red-50 hover:text-red-700 hover:border-red-200 text-gray-600 font-bold px-4 py-2 rounded-xl transition-all text-xs flex items-center justify-center gap-1"
                          >
                            <XCircle size={15} />
                            <span>{lang === 'ar' ? 'رفض الطلب' : 'Deny'}</span>
                          </button>
                          <button 
                            onClick={() => handleRewardAction(req.id, 'approved')}
                            className="flex-1 sm:flex-initial bg-[var(--color-church-blue)] text-white hover:bg-blue-900 font-bold px-4 py-2 rounded-xl transition-all text-xs flex items-center justify-center gap-1 shadow-2xs"
                          >
                            <CheckCircle size={15} className="text-[var(--color-church-gold)]" />
                            <span>{lang === 'ar' ? 'موافقة وتسليم' : 'Approve & Redeem'}</span>
                          </button>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>

              {/* History of Decisions */}
              <div className="pt-8 border-t border-gray-100 mt-8">
                <h3 className="text-sm font-bold uppercase tracking-wider text-gray-400 mb-4 flex items-center gap-2">
                  <HeartHandshake size={16} />
                  {lang === 'ar' ? 'سجل المكافآت السابقة' : 'Past Rewards & Redemption History'}
                </h3>

                <div className="space-y-2.5">
                  {rewardRequests.filter(r => r.status !== 'pending').map(req => (
                    <div 
                      key={req.id}
                      className="flex items-center justify-between p-3.5 bg-white rounded-xl border border-gray-100 text-xs"
                    >
                      <div className="flex items-center gap-3">
                        <span className="text-xl">{req.icon}</span>
                        <div>
                          <p className="font-bold text-gray-800">
                            {lang === 'ar' ? req.rewardTitleAr : req.rewardTitleEn}
                          </p>
                          <p className="text-gray-400">
                            {lang === 'ar' ? req.childNameAr : req.childNameEn} • {req.requestedAt}
                          </p>
                        </div>
                      </div>

                      <span className={`font-bold px-2.5 py-1 rounded-full ${
                        req.status === 'approved' 
                          ? 'bg-emerald-50 text-emerald-700 border border-emerald-100' 
                          : 'bg-red-50 text-red-700 border border-red-100'
                      }`}>
                        {req.status === 'approved' 
                          ? (lang === 'ar' ? 'تمت الموافقة ✓' : 'Approved ✓') 
                          : (lang === 'ar' ? 'تم الرفض ✕' : 'Denied ✕')}
                      </span>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          </motion.div>
        )}

        {activeTab === 'settings' && (
          <motion.div
            key="settings-tab"
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -10 }}
            transition={{ duration: 0.2 }}
          >
            <ParentSettings 
              lang={lang}
              requireApproval={requireApproval}
              onToggleApproval={toggleApproval}
              pushNotificationsEnabled={pushNotificationsEnabled}
              onTogglePushNotifications={togglePushNotifications}
              notifyLessonCompletion={notifyLessonCompletion}
              onToggleLessonCompletion={toggleLessonCompletion}
              notifyEventReminders={notifyEventReminders}
              onToggleEventReminders={toggleEventReminders}
              onSendTestNotification={handleSendTestNotification}
              permissionStatus={permissionStatus}
            />
          </motion.div>
        )}
      </AnimatePresence>

      {/* Add / Link Child Modal */}
      <AddChildModal
        isOpen={isAddChildModalOpen}
        initialCode={initialChildCode}
        initialTab={addChildInitialTab}
        onClose={() => {
          setIsAddChildModalOpen(false);
          refreshChildren();
        }}
        onChildLinked={(newChild) => {
          setLinkedChildren(prev => {
            const filtered = prev.filter(c => c.id !== newChild.id && c.linkCode !== newChild.linkCode);
            return [newChild, ...filtered];
          });
          setSelectedChildId(newChild.id);
          refreshChildren();
          setActivePushToast({
            id: 'linked-' + Date.now(),
            title: lang === 'ar' ? 'تم ربط الطفل بنجاح' : 'Child Linked Successfully',
            body: lang === 'ar' ? `تم ربط حساب ${newChild.nameAr} بنجاح وتفعيل المزامنة المباشرة` : `${newChild.nameEn} is now linked and live synced`,
            icon: '👨‍👧',
            badge: lang === 'ar' ? 'ربط عائلي' : 'Family Linked',
            timestamp: lang === 'ar' ? 'الآن' : 'Just now'
          });
        }}
        parentEmail={userData?.email || userData?.parentEmail || 'parent@church.org'}
        parentId={parentKey}
        parentName={userData?.fullName || (lang === 'ar' ? 'ولي الأمر' : 'Parent Guardian')}
        existingChildren={linkedChildren}
        lang={lang}
      />
    </div>
  );
}
