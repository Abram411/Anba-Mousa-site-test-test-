import React, { useState, useRef, useEffect } from 'react';
import { Settings, LogOut, Shield, Info, Edit3, ArrowLeft, Save, HelpCircle, FileText, Camera, Moon, Sun, Award, BookOpen, Heart, Flame, CheckCircle2, AlertCircle, Loader2, Mail, Phone, GraduationCap, X, Clock, QrCode, Copy, Check, HeartHandshake, Link as LinkIcon, Users, Sparkles, KeyRound, Share2, ShieldCheck, Upload, UserCheck, Palette } from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';
import { useAuth } from '../../context/AuthContext';
import { useTheme } from '../../context/ThemeContext';
import { updateSupabaseProfile, uploadAvatarToSupabase } from '../../lib/supabaseDatabase';
import { syncStudentSessionToParent, getShareableChildLink, getWhatsAppShareUrl, getOrCreateChildLinkCode } from '../../lib/parentChildService';
import { ChildQrCodeModal } from '../common/ChildQrCodeModal';
import { COPTIC_AVATARS, DEFAULT_STUDENT_AVATAR } from '../../data/copticAvatars';
import { Language } from '../../types';

type ProfileScreen = 'main' | 'edit' | 'settings' | 'parental' | 'help' | 'parental_dashboard';

export function ProfileTab({ 
  onLogout, 
  onOpenTeacherStudio,
  onOpenParentPortal,
  onNavigate,
  lang 
}: { 
  onLogout: () => void;
  onOpenTeacherStudio?: () => void;
  onOpenParentPortal?: () => void;
  onNavigate?: (tab: string) => void;
  lang: Language;
}) {
  const { userData, updateUserProfile } = useAuth();
  const { theme, toggleTheme, isDark } = useTheme();
  const [screen, setScreen] = useState<ProfileScreen>('main');
  const [userName, setUserName] = useState(userData?.fullName || '');
  const [avatar, setAvatar] = useState(userData?.avatarUrl || DEFAULT_STUDENT_AVATAR);
  const [email, setEmail] = useState(userData?.parentEmail || userData?.email || '');
  const [phone, setPhone] = useState(userData?.phone || '');
  const [grade, setGrade] = useState(userData?.grade || '');
  const [parentPinInput, setParentPinInput] = useState('');
  const [newParentPin, setNewParentPin] = useState('');
  const [showLogoutModal, setShowLogoutModal] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [isUploadingAvatar, setIsUploadingAvatar] = useState(false);
  const [validationErrors, setValidationErrors] = useState<{ userName?: string; email?: string; phone?: string; grade?: string }>({});
  const [toast, setToast] = useState<{ show: boolean; type: 'success' | 'error'; message: string } | null>(null);
  const [copiedLinkCode, setCopiedLinkCode] = useState(false);
  const [copiedDirectLink, setCopiedDirectLink] = useState(false);
  const [showQrModal, setShowQrModal] = useState(false);
  const [manualParentEmail, setManualParentEmail] = useState('');
  const [isLinkingParent, setIsLinkingParent] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const isStudent = !userData?.role || userData?.role === 'student';
  const isParent = userData?.role === 'parent';
  const isTeacher = userData?.role === 'teacher';

  // Only students have unique child codes for parents to link them
  const studentLinkCode = isStudent ? getOrCreateChildLinkCode(userData) : '';

  const handleCopyLinkCode = () => {
    try {
      navigator.clipboard.writeText(studentLinkCode);
      setCopiedLinkCode(true);
      showToast('success', lang === 'ar' ? 'تم نسخ الرمز السري بنجاح! شاركه مع والدك فقط.' : 'Secret code copied! Share only with your parent.');
      setTimeout(() => setCopiedLinkCode(false), 2500);
    } catch (e) {
      showToast('success', studentLinkCode);
    }
  };

  const handleCopyDirectLink = () => {
    try {
      const shareUrl = getShareableChildLink(studentLinkCode);
      navigator.clipboard.writeText(shareUrl);
      setCopiedDirectLink(true);
      showToast('success', lang === 'ar' ? 'تم نسخ رابط الربط المباشر بنجاح! أرسله لوالديك.' : 'Direct invite link copied! Send it to your parent.');
      setTimeout(() => setCopiedDirectLink(false), 2500);
    } catch (e) {
      showToast('error', 'Could not copy link');
    }
  };

  const handleShareWhatsApp = () => {
    try {
      const url = getWhatsAppShareUrl(studentLinkCode, userData?.fullName || 'Child', lang);
      window.open(url, '_blank');
    } catch (e) {
      handleCopyDirectLink();
    }
  };

  const handleLinkParent = async () => {
    if (!manualParentEmail.trim() || !manualParentEmail.includes('@')) {
      showToast('error', lang === 'ar' ? 'يرجى إدخال بريد إلكتروني صالح لولي الأمر' : 'Please enter a valid parent email');
      return;
    }
    setIsLinkingParent(true);
    try {
      await updateUserProfile({
        parentEmail: manualParentEmail.trim(),
        parentId: 'parent-' + manualParentEmail.replace(/[^a-zA-Z0-9]/g, ''),
        parentName: lang === 'ar' ? 'ولي الأمر' : 'Parent / Guardian',
        isLinkedToParent: true
      });
      syncStudentSessionToParent({
        ...userData!,
        parentEmail: manualParentEmail.trim(),
        isLinkedToParent: true
      });
      showToast('success', lang === 'ar' ? 'تم ربط الحساب بولي الأمر بنجاح!' : 'Linked with parent successfully!');
      setManualParentEmail('');
    } catch (e) {
      showToast('error', lang === 'ar' ? 'حدث خطأ أثناء ربط الحساب' : 'Error linking parent');
    } finally {
      setIsLinkingParent(false);
    }
  };

  const handleOpenEdit = () => {
    if (userData) {
      setUserName(userData.fullName || '');
      setAvatar(userData.avatarUrl || DEFAULT_STUDENT_AVATAR);
      setEmail(isStudent ? (userData.parentEmail || '') : (userData.email || ''));
      setPhone(userData.phone || '');
      setGrade(userData.grade || '');
      setValidationErrors({});
    }
    setScreen('edit');
  };

  // Only initialize form fields when user ID changes (e.g. switching accounts)
  // NEVER overwrite form fields while the user is actively editing (screen === 'edit')
  const prevUserIdRef = useRef<string | null>(null);
  useEffect(() => {
    if (userData && screen !== 'edit' && prevUserIdRef.current !== userData.id) {
      prevUserIdRef.current = userData.id;
      setUserName(userData.fullName || '');
      setAvatar(userData.avatarUrl || DEFAULT_STUDENT_AVATAR);
      setEmail(isStudent ? (userData.parentEmail || '') : (userData.email || ''));
      setPhone(userData.phone || '');
      setGrade(userData.grade || '');
    }
  }, [userData?.id, screen, isStudent]);

  if (!userData) return null;

  const showToast = (type: 'success' | 'error', message: string) => {
    setToast({ show: true, type, message });
    setTimeout(() => {
      setToast(null);
    }, 4000);
  };

  const validateForm = () => {
    const errors: { userName?: string; email?: string; phone?: string; grade?: string } = {};

    if (!userName.trim() || userName.trim().length < 2) {
      errors.userName = lang === 'ar' ? 'الاسم يجب أن يحتوي على حرفين على الأقل' : 'Full Name must be at least 2 characters';
    }

    const emailPattern = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    // For parents and teachers, email is required. For students, it's optional guardian contact
    if (!isStudent) {
      if (!email.trim()) {
        errors.email = lang === 'ar' ? 'البريد الإلكتروني مطلوب' : 'Email address is required';
      } else if (!emailPattern.test(email.trim())) {
        errors.email = lang === 'ar' ? 'يرجى إدخال بريد إلكتروني صالح (مثال: name@example.com)' : 'Please enter a valid email address';
      }
    } else if (email.trim() && !emailPattern.test(email.trim())) {
      errors.email = lang === 'ar' ? 'يرجى إدخال بريد إلكتروني صالح (مثال: name@example.com)' : 'Please enter a valid email address';
    }

    if (phone.trim() && !/^[0-9+() -]{7,20}$/.test(phone.trim())) {
      errors.phone = lang === 'ar' ? 'رقم الهاتف غير صالح (٧ أرقام على الأقل)' : 'Please enter a valid phone number (at least 7 digits)';
    }

    setValidationErrors(errors);
    return Object.keys(errors).length === 0;
  };

  const handleUpdateProfile = async () => {
    if (!validateForm()) {
      showToast('error', lang === 'ar' ? 'يرجى مراجعة وتصحيح البيانات غير المكتملة' : 'Please fix the errors in your details before saving');
      return;
    }

    setIsSaving(true);
    try {
      const updates = {
        fullName: userName.trim(),
        avatarUrl: avatar,
        parentEmail: isStudent ? email.trim() : undefined,
        email: !isStudent ? email.trim() : (userData.email || undefined),
        phone: phone.trim(),
        grade: grade.trim()
      };

      const result = await updateUserProfile(updates);

      if (result.success) {
        showToast('success', lang === 'ar' ? 'تم حفظ التعديلات بنجاح في قاعدة البيانات! ✝️' : 'Profile successfully saved to the database! ✝️');
        setTimeout(() => {
          setScreen('main');
        }, 1000);
      } else {
        showToast('error', result.error || (lang === 'ar' ? 'فشل حفظ التعديلات' : 'Failed to save changes'));
      }
    } catch (err: any) {
      console.error(err);
      showToast('error', err?.message || (lang === 'ar' ? 'حدث خطأ أثناء الحفظ' : 'An error occurred while saving'));
    } finally {
      setIsSaving(false);
    }
  };

  const handleFileUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    // Check size limit (max 8MB)
    if (file.size > 8 * 1024 * 1024) {
      showToast('error', lang === 'ar' ? 'حجم الصورة كبير جداً، الحد الأقصى ٨ ميجابايت' : 'Image is too large (max 8MB)');
      return;
    }

    setIsUploadingAvatar(true);
    try {
      const res = await uploadAvatarToSupabase(userData.id, file);
      if (res.success && res.url) {
        setAvatar(res.url);
        showToast('success', lang === 'ar' ? 'تم تجهيز ورفع صورة البروفايل بنجاح! 📸' : 'Avatar uploaded successfully! 📸');
      } else {
        // Fallback to local canvas compression
        const reader = new FileReader();
        reader.onloadend = () => {
          if (reader.result) {
            setAvatar(reader.result as string);
            showToast('success', lang === 'ar' ? 'تم اختيار صورة البروفايل بنجاح! 📸' : 'Avatar selected successfully! 📸');
          }
        };
        reader.readAsDataURL(file);
      }
    } catch (err) {
      console.warn('Avatar upload error fallback:', err);
    } finally {
      setIsUploadingAvatar(false);
    }
  };

  const handleParentUnlock = () => {
    if (!userData.parentPin) {
       // If no PIN set, they can set one
       if (parentPinInput.length === 4) {
          updateUserProfile({ parentPin: parentPinInput });
          setScreen('parental_dashboard');
       }
    } else if (parentPinInput === userData.parentPin) {
       setScreen('parental_dashboard');
    } else {
       alert(lang === 'ar' ? 'كلمة السر خاطئة' : 'Incorrect PIN');
    }
    setParentPinInput('');
  };

  const formatScreenTime = (seconds: number) => {
    const hrs = Math.floor(seconds / 3600);
    const mins = Math.floor((seconds % 3600) / 60);
    if (hrs > 0) return `${hrs}h ${mins}m`;
    return `${mins}m`;
  };

  const Header = ({ title, onBack }: { title: string, onBack: () => void }) => (
    <div className="flex items-center gap-4 mb-6">
      <button onClick={onBack} className="p-2 bg-white rounded-full shadow-sm text-[var(--color-church-blue)] hover:bg-gray-50">
        <ArrowLeft size={20} className={lang === 'ar' ? 'rotate-180' : ''} />
      </button>
      <h1 className="text-xl font-bold text-[var(--color-church-blue)]">{title}</h1>
    </div>
  );

  return (
    <div className="pb-24 pt-6 px-4 w-full max-w-7xl mx-auto h-full relative overflow-hidden">
      {/* Dynamic Toast Feedback Notification */}
      <AnimatePresence>
        {toast && (
          <motion.div
            initial={{ opacity: 0, y: -25, scale: 0.95 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: -25, scale: 0.95 }}
            className={`fixed top-5 left-1/2 -translate-x-1/2 z-[100] max-w-md w-[92%] px-4 py-3.5 rounded-2xl shadow-2xl flex items-center gap-3 border ${
              toast.type === 'success'
                ? 'bg-emerald-900 text-white border-emerald-700 shadow-emerald-950/40'
                : 'bg-red-900 text-white border-red-700 shadow-red-950/40'
            }`}
          >
            {toast.type === 'success' ? (
              <CheckCircle2 size={22} className="text-emerald-300 shrink-0" />
            ) : (
              <AlertCircle size={22} className="text-red-300 shrink-0" />
            )}
            <p className="text-sm font-bold flex-1 leading-snug">{toast.message}</p>
            <button 
              onClick={() => setToast(null)} 
              className="text-white/70 hover:text-white p-1 rounded-lg hover:bg-white/10 transition-colors"
            >
              <X size={18} />
            </button>
          </motion.div>
        )}
      </AnimatePresence>

      <AnimatePresence mode="wait">
        {screen === 'main' && (
          <motion.div key="main" initial={{ x: -50, opacity: 0 }} animate={{ x: 0, opacity: 1 }} exit={{ x: -50, opacity: 0 }} className="space-y-6">
            <h1 className="text-2xl font-bold text-[var(--color-church-blue)] mb-6 md:text-3xl">{lang === 'ar' ? 'حسابي' : 'Profile'}</h1>
            
            <div className="md:grid md:grid-cols-[1.5fr_1fr] md:gap-8 space-y-6 md:space-y-0">
              <div className="space-y-6">
                <div className="bg-white rounded-3xl p-6 shadow-sm border border-[var(--color-church-cream-dark)] text-center relative">
                  <button onClick={handleOpenEdit} className={`absolute top-4 ${lang === 'ar' ? 'left-4' : 'right-4'} text-gray-400 hover:text-[var(--color-church-blue)] p-2 rounded-xl hover:bg-blue-50 transition-colors cursor-pointer`} title={lang === 'ar' ? 'تعديل الملف الشخصي' : 'Edit Profile'}>
                    <Edit3 size={20} />
                  </button>
                  <img src={userData.avatarUrl} alt="Avatar" className="w-24 h-24 md:w-32 md:h-32 mx-auto rounded-full border-4 border-[var(--color-church-cream)] bg-gray-50 mb-4 shadow-sm object-cover" />
                  <h2 className="text-xl md:text-2xl font-bold text-[var(--color-church-blue)]">{userData.fullName}</h2>
                  <p className="text-gray-500 font-medium md:text-lg">{lang === 'ar' ? 'مدارس الأحد' : 'Sunday School'}</p>
                  
                  <div className="flex justify-center gap-6 md:gap-12 mt-6 pt-6 border-t border-gray-100">
                    <div>
                      <p className="text-2xl md:text-3xl font-bold text-[var(--color-church-blue)]">{userData.points}</p>
                      <p className="text-xs md:text-sm text-gray-400 font-bold uppercase tracking-wider">{lang === 'ar' ? 'نقاط' : 'Points'}</p>
                    </div>
                    <div>
                      <p className="text-2xl md:text-3xl font-bold text-[var(--color-church-blue)]">{userData.currentStreak}</p>
                      <p className="text-xs md:text-sm text-gray-400 font-bold uppercase tracking-wider">{lang === 'ar' ? 'متتالي' : 'Streak'}</p>
                    </div>
                    <div>
                      <p className="text-2xl md:text-3xl font-bold text-[var(--color-church-blue)]">{userData.longestStreak}</p>
                      <p className="text-xs md:text-sm text-gray-400 font-bold uppercase tracking-wider">{lang === 'ar' ? 'الأفضل' : 'Best'}</p>
                    </div>
                  </div>

                  {/* Active Screen / Study Time */}
                  <div className="mt-4 pt-3.5 border-t border-gray-100 flex items-center justify-between text-xs text-gray-500 font-medium px-1">
                    <span className="flex items-center gap-1.5 text-gray-600 font-bold">
                      <Clock size={15} className="text-[var(--color-church-blue)] animate-pulse" />
                      {lang === 'ar' ? 'وقت التعلم النشط اليوم' : 'Active Learning Time Today'}
                    </span>
                    <span className="font-bold text-xs md:text-sm text-[var(--color-church-blue)] bg-[var(--color-church-cream)]/70 px-3 py-1 rounded-full border border-[var(--color-church-cream-dark)]">
                      {formatScreenTime(userData.screenTimeSeconds || 0)}
                    </span>
                  </div>
                </div>

                {/* Achievement Badges Section */}
                <div className="bg-white rounded-3xl p-6 shadow-sm border border-[var(--color-church-cream-dark)]">
                  <h3 className="font-bold text-lg md:text-xl text-[var(--color-church-blue)] mb-4 flex items-center gap-2">
                    <Award size={20} className="text-[var(--color-church-gold)]" />
                    {lang === 'ar' ? 'الأوسمة والإنجازات' : 'Achievements'}
                  </h3>
                  <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-2 gap-4">
                    {[
                      {
                        id: 'early_bird',
                        title: { en: 'Early Bird', ar: 'مبكر' },
                        description: { en: 'Completed a morning lesson', ar: 'أنهى درس الصباح' },
                        icon: Sun,
                        color: 'text-amber-500',
                        bg: 'bg-amber-100',
                        border: 'border-amber-200',
                        isUnlocked: userData.points > 0, // Unlocks after any activity
                      },
                      {
                        id: 'studious',
                        title: { en: 'Studious', ar: 'مجتهد' },
                        description: { en: 'Reached 300 points', ar: 'الوصول لـ ٣٠٠ نقطة' },
                        icon: BookOpen,
                        color: 'text-[var(--color-church-blue)]',
                        bg: 'bg-blue-50',
                        border: 'border-blue-200',
                        isUnlocked: userData.points >= 300,
                      },
                      {
                        id: 'community_helper',
                        title: { en: 'Community Helper', ar: 'مساعد المجتمع' },
                        description: { en: 'Shared 5 replies in feed', ar: 'شارك ٥ تعليقات' },
                        icon: Heart,
                        color: 'text-[var(--color-church-burgundy)]',
                        bg: 'bg-red-50',
                        border: 'border-red-200',
                        isUnlocked: false,
                      },
                      {
                        id: 'consistent',
                        title: { en: 'Consistent', ar: 'مستمر' },
                        description: { en: '3-day streak', ar: '٣ أيام متتالية' },
                        icon: Flame,
                        color: 'text-[var(--color-church-gold)]',
                        bg: 'bg-amber-50',
                        border: 'border-amber-200',
                        isUnlocked: userData.longestStreak >= 3,
                      }
                    ].map(badge => (
                      <div 
                        key={badge.id} 
                        className={`flex items-center gap-3 p-3 md:p-4 rounded-2xl border ${badge.isUnlocked ? `${badge.bg} ${badge.border}` : 'bg-gray-50 border-gray-100 opacity-60'} transition-all`}
                      >
                        <div className={`w-12 h-12 md:w-14 md:h-14 rounded-xl flex items-center justify-center shrink-0 ${badge.isUnlocked ? 'bg-white shadow-sm' : 'bg-gray-200'}`}>
                          <badge.icon size={24} className={badge.isUnlocked ? badge.color : 'text-gray-400'} />
                        </div>
                        <div>
                          <p className={`font-bold text-sm md:text-base ${badge.isUnlocked ? badge.color : 'text-gray-600'}`}>
                            {badge.title[lang]}
                          </p>
                          <p className="text-xs md:text-sm text-gray-500 mt-0.5 font-medium leading-tight">{badge.description[lang]}</p>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              </div>

              {/* Role-Specific Connection Card */}
              {isStudent && (
                <div className="bg-white rounded-3xl p-5 md:p-6 shadow-sm border border-[var(--color-church-cream-dark)] space-y-4">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2.5">
                      <div className="w-10 h-10 rounded-2xl bg-blue-50 text-[var(--color-church-blue)] flex items-center justify-center font-bold">
                        <HeartHandshake size={22} />
                      </div>
                      <div>
                        <h3 className="font-bold text-gray-900 text-sm md:text-base">
                          {lang === 'ar' ? 'ربط الحساب بولي الأمر والمزامنة' : 'Parent Link & Live Sync'}
                        </h3>
                        <p className="text-xs text-gray-500">
                          {userData.isLinkedToParent || userData.parentEmail
                            ? (lang === 'ar' ? `مرتبط بحساب: ${userData.parentName || userData.parentEmail}` : `Linked with: ${userData.parentName || userData.parentEmail}`)
                            : (lang === 'ar' ? 'شارك رمزك مع ولي أمرك لربط الحساب' : 'Share code with your parent to link')}
                        </p>
                      </div>
                    </div>

                    {userData.isLinkedToParent || userData.parentEmail ? (
                      <span className="inline-flex items-center gap-1 text-xs font-bold px-2.5 py-1 rounded-full bg-emerald-50 text-emerald-700 border border-emerald-200">
                        <CheckCircle2 size={13} />
                        {lang === 'ar' ? 'متصل' : 'Linked'}
                      </span>
                    ) : (
                      <span className="text-xs font-bold px-2.5 py-1 rounded-full bg-amber-50 text-amber-700 border border-amber-200">
                        {lang === 'ar' ? 'غير مرتبط' : 'Not Linked'}
                      </span>
                    )}
                  </div>

                  {/* Parent blessing card if exists */}
                  {userData.parentBlessingMessage && (
                    <div className="bg-gradient-to-r from-amber-50 to-orange-50/50 border border-amber-200/80 rounded-2xl p-3.5 flex items-start gap-3">
                      <span className="text-2xl">🕊️</span>
                      <div className="flex-1">
                        <div className="flex items-center justify-between">
                          <span className="text-xs font-bold text-amber-900 flex items-center gap-1">
                            <Sparkles size={12} className="text-amber-600" />
                            {lang === 'ar' ? 'بركة وتشجيع من ولي الأمر' : 'Parent Blessing & Encouragement'}
                          </span>
                          <span className="text-[10px] text-amber-700 font-semibold">{lang === 'ar' ? 'اليوم' : 'Today'}</span>
                        </div>
                        <p className="text-xs text-amber-950 mt-1 font-medium italic">
                          "{userData.parentBlessingMessage}"
                        </p>
                      </div>
                    </div>
                  )}

                  {/* Child Secret Code & Direct Link Section */}
                  <div className="bg-gradient-to-br from-gray-50 to-blue-50/30 rounded-2xl p-4 border border-blue-100/80 space-y-3.5">
                    {/* Security Notice */}
                    <div className="flex items-start gap-2.5 text-xs text-blue-950 bg-white p-2.5 rounded-xl border border-blue-100 shadow-2xs">
                      <ShieldCheck size={18} className="text-[var(--color-church-blue)] shrink-0 mt-0.5" />
                      <span className="leading-relaxed">
                        {lang === 'ar'
                          ? '🔒 هذا الرمز السري خاص بحساب الطفل فقط، يتيح لولي الأمر ربطه ومتابعة تقدمه في مدارس الأحد.'
                          : '🔒 This secret code is specific to your child account so your parent can link and follow your progress.'}
                      </span>
                    </div>

                    {/* Secret Code Display & Buttons */}
                    <div className="flex flex-col sm:flex-row items-center justify-between gap-3 bg-white p-3 rounded-xl border border-gray-200">
                      <div className="flex items-center gap-2.5 w-full sm:w-auto">
                        <div className="w-10 h-10 rounded-xl bg-blue-50 text-[var(--color-church-blue)] flex items-center justify-center shrink-0">
                          <KeyRound size={20} />
                        </div>
                        <div>
                          <span className="text-[10px] font-bold text-gray-500 uppercase tracking-wider block">
                            {lang === 'ar' ? 'الرمز السري الخاص بالطفل' : 'Child Unique Secret Code'}
                          </span>
                          <span className="font-mono font-black text-lg text-[var(--color-church-blue)] tracking-wider">
                            {studentLinkCode}
                          </span>
                        </div>
                      </div>

                      <div className="flex items-center gap-2 w-full sm:w-auto">
                        <button
                          type="button"
                          onClick={() => setShowQrModal(true)}
                          className="flex-1 sm:flex-initial px-3 py-2 rounded-xl bg-[var(--color-church-blue)] hover:bg-blue-900 text-white font-bold text-xs flex items-center justify-center gap-1.5 transition-colors cursor-pointer shadow-2xs"
                        >
                          <QrCode size={14} className="text-amber-300" />
                          <span>{lang === 'ar' ? 'عرض رمز QR' : 'Show QR Code'}</span>
                        </button>

                        <button
                          type="button"
                          onClick={handleCopyLinkCode}
                          className="flex-1 sm:flex-initial px-3 py-2 rounded-xl bg-gray-50 hover:bg-gray-100 border border-gray-200 text-gray-700 font-bold text-xs flex items-center justify-center gap-1.5 transition-colors cursor-pointer"
                        >
                          {copiedLinkCode ? <Check size={14} className="text-emerald-600" /> : <Copy size={14} />}
                          <span>{copiedLinkCode ? (lang === 'ar' ? 'تم نسخ الرمز!' : 'Copied!') : (lang === 'ar' ? 'نسخ الرمز' : 'Copy Code')}</span>
                        </button>
                      </div>
                    </div>

                    {/* Direct Link Share Actions */}
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 pt-1">
                      <button
                        type="button"
                        onClick={handleCopyDirectLink}
                        className="px-3.5 py-2.5 rounded-xl bg-white hover:bg-gray-50 border border-blue-200 text-[var(--color-church-blue)] font-bold text-xs flex items-center justify-center gap-1.5 transition-colors cursor-pointer shadow-2xs"
                      >
                        {copiedDirectLink ? <Check size={14} className="text-emerald-600" /> : <LinkIcon size={14} />}
                        <span>{copiedDirectLink ? (lang === 'ar' ? 'تم نسخ الرابط!' : 'Link Copied!') : (lang === 'ar' ? 'نسخ رابط الربط المباشر' : 'Copy Direct Link')}</span>
                      </button>

                      <button
                        type="button"
                        onClick={handleShareWhatsApp}
                        className="px-3.5 py-2.5 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white font-bold text-xs flex items-center justify-center gap-1.5 transition-colors cursor-pointer shadow-2xs"
                      >
                        <Share2 size={14} />
                        <span>{lang === 'ar' ? 'إرسال لوالديك عبر واتساب 💬' : 'Send to Parent via WhatsApp 💬'}</span>
                      </button>
                    </div>
                  </div>

                  {/* If not linked yet, allow quick linking via parent email */}
                  {(!userData.isLinkedToParent && !userData.parentEmail) && (
                    <div className="pt-1">
                      <div className="flex gap-2">
                        <input
                          type="email"
                          value={manualParentEmail}
                          onChange={(e) => setManualParentEmail(e.target.value)}
                          placeholder={lang === 'ar' ? 'أدخل إيميل ولي الأمر للربط...' : 'Enter parent email to link...'}
                          className="flex-1 bg-gray-50 border border-gray-200 rounded-xl px-3 py-2 text-xs font-semibold outline-none focus:border-[var(--color-church-blue)]"
                        />
                        <button
                          onClick={handleLinkParent}
                          disabled={isLinkingParent}
                          className="px-4 py-2 rounded-xl bg-[var(--color-church-blue)] text-white text-xs font-bold hover:bg-blue-800 disabled:opacity-50 flex items-center gap-1.5 transition-all shadow-2xs shrink-0"
                        >
                          {isLinkingParent ? <Loader2 size={13} className="animate-spin" /> : <LinkIcon size={13} />}
                          <span>{lang === 'ar' ? 'ربط الآن' : 'Link Now'}</span>
                        </button>
                      </div>
                    </div>
                  )}
                </div>
              )}

              {/* For Parents: Family Hub Card */}
              {isParent && (
                <div className="bg-white rounded-3xl p-5 md:p-6 shadow-sm border border-[var(--color-church-cream-dark)] space-y-4">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-3">
                      <div className="w-12 h-12 rounded-2xl bg-amber-50 text-amber-700 flex items-center justify-center font-bold">
                        <Users size={24} />
                      </div>
                      <div>
                        <h3 className="font-bold text-gray-900 text-base">
                          {lang === 'ar' ? 'بوابة ولي الأمر ومتابعة الأبناء' : 'Parent Family Portal'}
                        </h3>
                        <p className="text-xs text-gray-500">
                          {lang === 'ar' ? 'متابعة حفظ الألحان والآيات والدروس لجميع أبنائك' : 'Monitor lessons, hymns and verses for all your children'}
                        </p>
                      </div>
                    </div>
                    <span className="px-3 py-1 bg-amber-100/60 text-amber-800 rounded-full text-xs font-bold">
                      {lang === 'ar' ? 'حساب ولي أمر' : 'Parent Account'}
                    </span>
                  </div>

                  <div className="bg-gradient-to-r from-amber-50/50 to-orange-50/30 rounded-2xl p-4 border border-amber-200/60 flex flex-col sm:flex-row items-center justify-between gap-3">
                    <div className="text-xs text-gray-700 leading-relaxed">
                      {lang === 'ar' 
                        ? 'بصفتك ولي أمر، لا تحتاج إلى رمز طفل خاص بك؛ بدلاً من ذلك يمكنك إضافة أبنائك باستخدام الرمز السري أو QR الخاص بكل طفل.'
                        : 'As a parent, you manage and link children rather than having a child code yourself.'}
                    </div>
                    {onOpenParentPortal && (
                      <button
                        onClick={onOpenParentPortal}
                        className="w-full sm:w-auto px-5 py-2.5 rounded-xl bg-[var(--color-church-burgundy)] hover:bg-red-950 text-white font-bold text-xs flex items-center justify-center gap-2 shadow-sm transition-all cursor-pointer shrink-0"
                      >
                        <Users size={15} />
                        <span>{lang === 'ar' ? 'فتح لوحة متابعة الأبناء' : 'Open Parent Dashboard'}</span>
                      </button>
                    )}
                  </div>
                </div>
              )}

              {/* For Teachers: Servant Studio Card */}
              {isTeacher && (
                <div className="bg-white rounded-3xl p-5 md:p-6 shadow-sm border border-[var(--color-church-cream-dark)] space-y-4">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-3">
                      <div className="w-12 h-12 rounded-2xl bg-blue-50 text-[var(--color-church-blue)] flex items-center justify-center font-bold">
                        <GraduationCap size={24} />
                      </div>
                      <div>
                        <h3 className="font-bold text-gray-900 text-base">
                          {lang === 'ar' ? 'استوديو خادم مدارس الأحد' : 'Sunday School Servant Studio'}
                        </h3>
                        <p className="text-xs text-gray-500">
                          {lang === 'ar' ? 'تحضير الدروس، متابعة الحضور والغياب، وإدارة الفصل' : 'Prepare lessons, take attendance, and track classes'}
                        </p>
                      </div>
                    </div>
                    <span className="px-3 py-1 bg-blue-100/60 text-blue-800 rounded-full text-xs font-bold">
                      {lang === 'ar' ? 'خادم مدارس الأحد' : 'Servant / Teacher'}
                    </span>
                  </div>

                  {onOpenTeacherStudio && (
                    <button
                      onClick={onOpenTeacherStudio}
                      className="w-full py-3 rounded-xl bg-[var(--color-church-blue)] hover:bg-blue-900 text-white font-bold text-xs flex items-center justify-center gap-2 shadow-sm transition-all cursor-pointer"
                    >
                      <GraduationCap size={16} />
                      <span>{lang === 'ar' ? 'فتح استوديو الخادم' : 'Open Servant Studio'}</span>
                    </button>
                  )}
                </div>
              )}

              <div>
                <div className="bg-white rounded-3xl shadow-sm border border-[var(--color-church-cream-dark)] overflow-hidden">
                  {/* Servant Studio (for teachers) */}
                  {(userData.role === 'teacher' || onOpenTeacherStudio) && (
                    <button 
                      onClick={onOpenTeacherStudio} 
                      className="w-full p-4 md:p-5 border-b border-gray-100 flex items-center gap-3 text-amber-900 bg-amber-50/50 hover:bg-amber-100/60 transition-colors text-left cursor-pointer"
                    >
                      <span className="text-xl">⛪</span>
                      <div className="flex-1">
                        <span className="font-bold block md:text-lg">{lang === 'ar' ? 'استوديو الخادم ومدارس الأحد' : 'Sunday School Servant Studio'}</span>
                        <span className="text-xs text-amber-700">{lang === 'ar' ? 'تحضير الدروس بالذكاء الاصطناعي وتعديل الاختبارات' : 'AI lesson creator, quiz editor & moderation'}</span>
                      </div>
                      <span className="text-xs font-bold px-2 py-1 rounded-md bg-amber-200/80 text-amber-900">
                        {lang === 'ar' ? 'فتح' : 'Open'}
                      </span>
                    </button>
                  )}

                  {/* Parent Portal (for parents or teachers who have children) */}
                  {(userData.role === 'parent' || userData.role === 'teacher' || onOpenParentPortal) && (
                    <button 
                      onClick={onOpenParentPortal} 
                      className="w-full p-4 md:p-5 border-b border-gray-100 flex items-center gap-3 text-emerald-900 bg-emerald-50/40 hover:bg-emerald-100/60 transition-colors text-left cursor-pointer"
                    >
                      <span className="text-xl">👨‍👩‍👧</span>
                      <div className="flex-1">
                        <span className="font-bold block md:text-lg">{lang === 'ar' ? 'بوابة ولي الأمر ومتابعة الأبناء' : 'Parent Portal & Child Monitoring'}</span>
                        <span className="text-xs text-emerald-700">{lang === 'ar' ? 'متابعة وقت الشاشة، إتمام الدروس وموافقة الجوائز' : 'Screen time, lesson completions & reward approvals'}</span>
                      </div>
                      <span className="text-xs font-bold px-2 py-1 rounded-md bg-emerald-200/80 text-emerald-900">
                        {lang === 'ar' ? 'فتح' : 'Open'}
                      </span>
                    </button>
                  )}

                  <button onClick={() => setScreen('settings')} className="w-full p-4 md:p-5 border-b border-gray-100 flex items-center gap-3 text-gray-700 hover:bg-gray-50 transition-colors text-left">
                    <Settings size={20} className="text-[var(--color-church-blue)] md:w-6 md:h-6" />
                    <span className="font-bold flex-1 md:text-lg">{lang === 'ar' ? 'الإعدادات والمظهر' : 'Settings & Theme'}</span>
                    <span className="text-xs md:text-sm px-2.5 py-1 rounded-full font-bold bg-[var(--color-church-cream)] text-[var(--color-church-blue)] flex items-center gap-1">
                      {isDark ? <><Moon size={12} className="fill-current" /> {lang === 'ar' ? 'ليلي' : 'Dark'}</> : <><Sun size={12} /> {lang === 'ar' ? 'نهاري' : 'Light'}</>}
                    </span>
                  </button>
                  <button onClick={() => setScreen('parental')} className="w-full p-4 md:p-5 border-b border-gray-100 flex items-center gap-3 text-gray-700 hover:bg-gray-50 transition-colors text-left">
                    <Shield size={20} className="text-[var(--color-church-blue)] md:w-6 md:h-6" />
                    <span className="font-bold flex-1 md:text-lg">{lang === 'ar' ? 'تحكم الآباء (رمز PIN)' : 'Parental Controls (PIN)'}</span>
                  </button>
                  {onNavigate && (
                    <>
                      <button 
                        onClick={() => onNavigate('designSystem')} 
                        className="w-full p-4 md:p-5 border-b border-gray-100 flex items-center gap-3 text-amber-900 bg-amber-50/40 hover:bg-amber-100/50 transition-colors text-left cursor-pointer"
                      >
                        <Palette size={20} className="text-[var(--brand-burgundy)] md:w-6 md:h-6" />
                        <div className="flex-1">
                          <span className="font-bold block md:text-lg">
                            {lang === 'copt' || lang === 'cop' ? 'Ⲡⲓⲥⲩⲥⲧⲏⲙⲁ ⲛ̀ⲧⲉ ⲡⲓⲥⲙⲟⲧ' : lang === 'ar' ? 'نظام التصميم الكنسي والخطوط' : 'Coptic Design System & Typography'}
                          </span>
                          <span className="text-xs text-[var(--color-neutral)]">
                            {lang === 'ar' ? 'ألوان الكنيسة، الخطوط القبطية والعربية ومحرك القراءة' : 'Ecclesiastical palette, dual Coptic fonts & trilingual reader'}
                          </span>
                        </div>
                        <span className="text-xs font-bold px-2 py-1 rounded-md bg-[var(--brand-burgundy)] text-white">
                          v2.0
                        </span>
                      </button>

                      <button 
                        onClick={() => onNavigate('localizationQa')} 
                        className="w-full p-4 md:p-5 border-b border-gray-100 flex items-center gap-3 text-stone-800 hover:bg-gray-50 transition-colors text-left cursor-pointer"
                      >
                        <ShieldCheck size={20} className="text-[var(--brand-gold-dark)] md:w-6 md:h-6" />
                        <div className="flex-1">
                          <span className="font-bold block md:text-lg">
                            {lang === 'copt' || lang === 'cop' ? 'Ⲡⲓϫⲱⲕ ⲛ̀ϯⲁⲥⲡⲓ ⲛ̀ⲣⲉⲙⲛ̀ⲭⲏⲙⲓ' : lang === 'ar' ? 'فحص جودة الترجمة القبطية' : 'Bohairic Localization QA & Registry'}
                          </span>
                          <span className="text-xs text-[var(--color-neutral)]">
                            {lang === 'ar' ? 'سجل المصطلحات الكنسية واعتماد النصوص القبطية' : 'Terminology glossary & liturgical verification'}
                          </span>
                        </div>
                      </button>

                      <button 
                        onClick={() => onNavigate('brandGuidelines')} 
                        className="w-full p-4 md:p-5 border-b border-gray-100 flex items-center gap-3 text-stone-800 hover:bg-gray-50 transition-colors text-left cursor-pointer"
                      >
                        <BookOpen size={20} className="text-[var(--brand-blue)] md:w-6 md:h-6" />
                        <div className="flex-1">
                          <span className="font-bold block md:text-lg">
                            {lang === 'copt' || lang === 'cop' ? 'Ⲛⲓⲕⲁⲛⲱⲛ ⲛ̀ⲧⲉ ⲡⲓⲥⲙⲟⲧ' : lang === 'ar' ? 'دليل الهوية البصرية الكنسية' : 'Brand & Identity Manual'}
                          </span>
                          <span className="text-xs text-[var(--color-neutral)]">
                            {lang === 'ar' ? 'رموز الصليب، أصول الألوان والمواسم الطقسية' : 'Cross iconography, liturgical symbolism & seasons'}
                          </span>
                        </div>
                      </button>
                    </>
                  )}

                  <button onClick={() => setScreen('help')} className="w-full p-4 md:p-5 border-b border-gray-100 flex items-center gap-3 text-gray-700 hover:bg-gray-50 transition-colors text-left">
                    <Info size={20} className="text-[var(--color-church-blue)] md:w-6 md:h-6" />
                    <span className="font-bold flex-1 md:text-lg">{lang === 'ar' ? 'المساعدة والخصوصية' : 'Help & Privacy'}</span>
                  </button>
                  <button 
                    onClick={() => setShowLogoutModal(true)} 
                    className="w-full p-4 md:p-5 flex items-center gap-3 text-[var(--color-church-burgundy)] hover:bg-red-50 transition-colors text-left"
                  >
                    <LogOut size={20} className="md:w-6 md:h-6" />
                    <span className="font-bold flex-1 md:text-lg">{lang === 'ar' ? 'تسجيل الخروج' : 'Log Out'}</span>
                  </button>
                </div>
              </div>
            </div>
          </motion.div>
        )}

        {screen === 'edit' && (
          <motion.div key="edit" initial={{ x: 50, opacity: 0 }} animate={{ x: 0, opacity: 1 }} exit={{ x: 50, opacity: 0 }} className="space-y-6">
            <Header title={lang === 'ar' ? 'تعديل بيانات الحساب' : 'Edit Account Profile'} onBack={() => setScreen('main')} />
            <div className="bg-white rounded-3xl p-6 md:p-8 shadow-sm border border-[var(--color-church-cream-dark)] space-y-6">
               <div className="text-center">
                 <div className="relative inline-block">
                    <img 
                      src={avatar} 
                      alt="Avatar" 
                      className="w-24 h-24 md:w-28 md:h-28 rounded-full border-4 border-[var(--color-church-gold)] bg-amber-50 shadow-md object-cover" 
                    />
                    <button 
                      type="button"
                      disabled={isUploadingAvatar}
                      onClick={() => fileInputRef.current?.click()} 
                      className="absolute bottom-0 right-0 bg-[var(--color-church-blue)] text-white p-2.5 rounded-full shadow-lg hover:bg-blue-800 transition-all active:scale-95 disabled:opacity-60 cursor-pointer"
                      title={lang === 'ar' ? 'تحميل صورة من جهازك' : 'Upload photo from your device'}
                    >
                       {isUploadingAvatar ? <Loader2 size={16} className="animate-spin" /> : <Camera size={16} />}
                    </button>
                    <input 
                      type="file" 
                      ref={fileInputRef} 
                      onChange={handleFileUpload} 
                      accept="image/*" 
                      className="hidden" 
                    />
                 </div>

                 {isUploadingAvatar && (
                   <p className="text-xs text-[var(--color-church-blue)] font-bold mt-2 flex items-center justify-center gap-1.5 animate-pulse">
                     <Loader2 size={13} className="animate-spin" />
                     {lang === 'ar' ? 'جارٍ معالجة ورفع الصورة بجودة فائقة...' : 'Processing and uploading high-res avatar...'}
                   </p>
                 )}
                 
                 {/* Coptic Orthodox Avatars Gallery */}
                 <div className="mt-5">
                    <div className="flex items-center justify-between mb-2.5 px-2">
                      <p className="text-xs md:text-sm font-bold text-gray-700 flex items-center gap-1.5">
                        <Sparkles size={14} className="text-[var(--color-church-gold)]" />
                        {lang === 'ar' ? 'صور ورموز قبطية لمدارس الأحد:' : 'Coptic Sunday School Avatars:'}
                      </p>
                      <button
                        type="button"
                        onClick={() => fileInputRef.current?.click()}
                        className="text-xs text-[var(--color-church-blue)] font-bold hover:underline flex items-center gap-1"
                      >
                        <Upload size={12} />
                        {lang === 'ar' ? 'أو ارفع صورتك الخاصة' : 'Or upload custom'}
                      </button>
                    </div>

                    <div className="grid grid-cols-4 sm:grid-cols-5 md:grid-cols-6 gap-2.5 max-w-xl mx-auto p-3 bg-[var(--color-church-cream)]/40 rounded-2xl border border-[var(--color-church-cream-dark)]">
                       {COPTIC_AVATARS.map((preset) => (
                          <button 
                            key={preset.id} 
                            type="button"
                            onClick={() => setAvatar(preset.svgDataUri)} 
                            className={`group relative flex flex-col items-center gap-1 p-1.5 rounded-xl border-2 transition-all cursor-pointer ${
                              avatar === preset.svgDataUri 
                                ? 'border-[var(--color-church-blue)] bg-white shadow-sm scale-105 ring-2 ring-blue-200' 
                                : 'border-transparent bg-white/60 hover:bg-white hover:border-gray-200 hover:scale-102'
                            }`}
                            title={lang === 'ar' ? preset.nameAr : preset.nameEn}
                          >
                             <div className="w-12 h-12 md:w-14 md:h-14 rounded-full overflow-hidden shadow-2xs">
                               <img src={preset.svgDataUri} alt={lang === 'ar' ? preset.nameAr : preset.nameEn} className="w-full h-full object-cover" />
                             </div>
                             <span className="text-[10px] font-bold text-gray-700 truncate max-w-[64px] text-center leading-tight">
                               {lang === 'ar' ? preset.nameAr : preset.nameEn}
                             </span>
                             {avatar === preset.svgDataUri && (
                               <div className="absolute -top-1 -right-1 w-4 h-4 rounded-full bg-[var(--color-church-blue)] text-white flex items-center justify-center text-[10px]">
                                 <Check size={10} strokeWidth={3} />
                               </div>
                             )}
                          </button>
                       ))}
                    </div>
                 </div>
               </div>

               <div className="space-y-4 pt-2">
                 {/* Full Name */}
                 <div>
                    <label className="text-xs md:text-sm font-bold text-gray-600 mb-1.5 flex items-center justify-between">
                      <span>{lang === 'ar' ? 'الاسم بالكامل *' : 'Full Name *'}</span>
                      {validationErrors.userName && (
                        <span className="text-xs text-red-600 font-medium flex items-center gap-1">
                          <AlertCircle size={12} /> {validationErrors.userName}
                        </span>
                      )}
                    </label>
                    <input 
                      type="text" 
                      value={userName} 
                      onChange={e => {
                        setUserName(e.target.value);
                        if (validationErrors.userName) setValidationErrors(prev => ({ ...prev, userName: undefined }));
                      }} 
                      placeholder={lang === 'ar' ? 'أدخل اسمك بالكامل' : 'Enter your full name'}
                      className={`w-full bg-gray-50 border-2 rounded-xl px-4 py-3 outline-none font-bold text-gray-700 transition-colors ${
                        validationErrors.userName ? 'border-red-400 bg-red-50/40 focus:border-red-500' : 'border-gray-100 focus:border-[var(--color-church-blue)]'
                      }`} 
                    />
                 </div>

                 {/* Guardian / User Email */}
                 <div>
                    <label className="text-xs md:text-sm font-bold text-gray-600 mb-1.5 flex items-center justify-between">
                      <span className="flex items-center gap-1.5">
                        <Mail size={14} className="text-[var(--color-church-blue)]" />
                        {isStudent 
                          ? (lang === 'ar' ? 'إيميل ولي الأمر (اختياري)' : 'Guardian Email (Optional)') 
                          : (lang === 'ar' ? 'البريد الإلكتروني *' : 'Email Address *')}
                      </span>
                      {validationErrors.email && (
                        <span className="text-xs text-red-600 font-medium flex items-center gap-1">
                          <AlertCircle size={12} /> {validationErrors.email}
                        </span>
                      )}
                    </label>
                    <input 
                      type="email" 
                      value={email} 
                      onChange={e => {
                        setEmail(e.target.value);
                        if (validationErrors.email) setValidationErrors(prev => ({ ...prev, email: undefined }));
                      }} 
                      placeholder="parent.guardian@church.org"
                      className={`w-full bg-gray-50 border-2 rounded-xl px-4 py-3 outline-none font-bold text-gray-700 transition-colors ${
                        validationErrors.email ? 'border-red-400 bg-red-50/40 focus:border-red-500' : 'border-gray-100 focus:border-[var(--color-church-blue)]'
                      }`} 
                    />
                 </div>

                 {/* Phone Number */}
                 <div>
                    <label className="text-xs md:text-sm font-bold text-gray-600 mb-1.5 flex items-center justify-between">
                      <span className="flex items-center gap-1.5">
                        <Phone size={14} className="text-[var(--color-church-blue)]" />
                        {lang === 'ar' ? 'رقم الهاتف للتواصل' : 'Contact Phone Number'}
                      </span>
                      {validationErrors.phone && (
                        <span className="text-xs text-red-600 font-medium flex items-center gap-1">
                          <AlertCircle size={12} /> {validationErrors.phone}
                        </span>
                      )}
                    </label>
                    <input 
                      type="tel" 
                      value={phone} 
                      onChange={e => {
                        setPhone(e.target.value);
                        if (validationErrors.phone) setValidationErrors(prev => ({ ...prev, phone: undefined }));
                      }} 
                      placeholder="+20 100 123 4567"
                      className={`w-full bg-gray-50 border-2 rounded-xl px-4 py-3 outline-none font-bold text-gray-700 transition-colors ${
                        validationErrors.phone ? 'border-red-400 bg-red-50/40 focus:border-red-500' : 'border-gray-100 focus:border-[var(--color-church-blue)]'
                      }`} 
                    />
                 </div>

                 {/* Grade / Sunday School Group */}
                 <div>
                    <label className="text-xs md:text-sm font-bold text-gray-600 mb-1.5 flex items-center gap-1.5">
                      <GraduationCap size={14} className="text-[var(--color-church-blue)]" />
                      {lang === 'ar' ? 'مرحلة مدارس الأحد' : 'Sunday School Grade / Class'}
                    </label>
                    <input 
                      type="text" 
                      value={grade} 
                      onChange={e => setGrade(e.target.value)} 
                      placeholder={lang === 'ar' ? 'مثال: ابتدائي - مرحلة ثالثة' : 'e.g. Primary - Grade 3'}
                      className="w-full bg-gray-50 border-2 border-gray-100 focus:border-[var(--color-church-blue)] rounded-xl px-4 py-3 outline-none font-bold text-gray-700"
                    />
                 </div>
               </div>

               <div className="pt-2">
                 <button 
                   onClick={handleUpdateProfile} 
                   disabled={isSaving}
                   className="w-full bg-[var(--color-church-blue)] text-white font-bold py-4 rounded-xl flex justify-center items-center gap-2 shadow-md hover:bg-blue-900 active:scale-[0.99] transition-all disabled:opacity-60 disabled:cursor-not-allowed"
                 >
                   {isSaving ? (
                     <>
                       <Loader2 size={20} className="animate-spin" />
                       <span>{lang === 'ar' ? 'جارٍ حفظ البيانات في قاعدة البيانات...' : 'Saving to Database...'}</span>
                     </>
                   ) : (
                     <>
                       <Save size={20} />
                       <span>{lang === 'ar' ? 'حفظ وتحديث الحساب' : 'Save Changes'}</span>
                     </>
                   )}
                 </button>
               </div>
            </div>
          </motion.div>
        )}

        {screen === 'settings' && (
          <motion.div key="settings" initial={{ x: 50, opacity: 0 }} animate={{ x: 0, opacity: 1 }} exit={{ x: 50, opacity: 0 }} className="space-y-6">
            <Header title={lang === 'ar' ? 'الإعدادات' : 'Settings'} onBack={() => setScreen('main')} />
            <div className="bg-white rounded-3xl p-6 shadow-sm border border-[var(--color-church-cream-dark)] space-y-6">
               {/* Dark Theme Sanctuary Mode Toggle */}
               <div className="flex items-center justify-between p-4 bg-[var(--color-church-cream)]/60 rounded-2xl border border-[var(--color-church-cream-dark)]">
                 <div className="flex items-center gap-3">
                   <div className="w-10 h-10 rounded-xl bg-[var(--color-church-gold)]/20 text-[var(--color-church-gold)] flex items-center justify-center">
                     {isDark ? <Moon size={22} className="fill-current" /> : <Sun size={22} />}
                   </div>
                   <div>
                     <p className="font-bold text-[var(--color-church-blue)] text-base">
                       {lang === 'ar' ? 'الوضع الليلي للكنيسة' : 'Dark Church Mode'}
                     </p>
                     <p className="text-xs text-gray-500 font-medium">
                       {lang === 'ar' ? 'إضاءة خافتة مريحة للعين أثناء القداس والصلوات' : 'Low-light sanctuary colors for liturgies & evening study'}
                     </p>
                   </div>
                 </div>
                 <button
                   type="button"
                   onClick={toggleTheme}
                   className={`relative inline-flex h-8 w-14 shrink-0 cursor-pointer rounded-full border-2 border-transparent transition-colors duration-200 ease-in-out focus:outline-none ${
                     isDark ? 'bg-[var(--color-church-gold)]' : 'bg-gray-300'
                   }`}
                   role="switch"
                   aria-checked={isDark}
                 >
                   <span
                     className={`pointer-events-none inline-block h-7 w-7 transform rounded-full bg-white shadow-md ring-0 transition duration-200 ease-in-out flex items-center justify-center ${
                       isDark ? (lang === 'ar' ? '-translate-x-6' : 'translate-x-6') : 'translate-x-0'
                     }`}
                   >
                     {isDark ? (
                       <Moon size={14} className="text-gray-800 fill-current" />
                     ) : (
                       <Sun size={14} className="text-amber-500" />
                     )}
                   </span>
                 </button>
               </div>

               <div className="flex items-center justify-between pt-2">
                 <span className="font-bold text-gray-700">{lang === 'ar' ? 'تأثيرات صوتية' : 'Sound Effects'}</span>
                 <input type="checkbox" defaultChecked className="w-6 h-6 accent-[var(--color-church-blue)]" />
               </div>
               <div className="flex items-center justify-between">
                 <span className="font-bold text-gray-700">{lang === 'ar' ? 'إشعارات يومية' : 'Daily Notifications'}</span>
                 <input type="checkbox" defaultChecked className="w-6 h-6 accent-[var(--color-church-blue)]" />
               </div>
            </div>
          </motion.div>
        )}

        {screen === 'parental' && (
          <motion.div key="parental" initial={{ x: 50, opacity: 0 }} animate={{ x: 0, opacity: 1 }} exit={{ x: 50, opacity: 0 }} className="space-y-6">
            <Header title={lang === 'ar' ? 'تحكم الآباء' : 'Parental Controls'} onBack={() => setScreen('main')} />
            <div className="bg-white rounded-3xl p-6 shadow-sm border border-[var(--color-church-cream-dark)] space-y-4 text-center">
               <Shield size={48} className="text-[var(--color-church-gold)] mx-auto mb-4" />
               <p className="text-sm font-bold text-gray-600 mb-4">
                 {!userData.parentPin 
                   ? (lang === 'ar' ? 'لم تقم بتعيين كلمة سر بعد. أدخل ٤ أرقام لإنشاء واحدة:' : 'No PIN set yet. Enter 4 digits to create one:')
                   : (lang === 'ar' ? 'أدخل كلمة سر الأب/الأم للوصول:' : 'Enter Parent PIN to access:')}
               </p>
               <input 
                 type="password" 
                 value={parentPinInput}
                 onChange={(e) => setParentPinInput(e.target.value)}
                 placeholder="****" 
                 className="w-full bg-gray-50 border-2 border-gray-100 rounded-xl px-4 py-3 outline-none font-bold text-center tracking-widest text-2xl" 
                 maxLength={4} 
               />
               <button onClick={handleParentUnlock} className="w-full bg-[var(--color-church-burgundy)] text-white font-bold py-3 rounded-xl shadow-md mt-4 hover:bg-red-800 transition-colors">
                 {lang === 'ar' ? 'دخول' : 'Enter'}
               </button>
            </div>
          </motion.div>
        )}

        {screen === 'parental_dashboard' && (
          <motion.div key="parental_dashboard" initial={{ x: 50, opacity: 0 }} animate={{ x: 0, opacity: 1 }} exit={{ x: 50, opacity: 0 }} className="space-y-6">
            <Header title={lang === 'ar' ? 'لوحة تحكم الآباء' : 'Parental Dashboard'} onBack={() => setScreen('main')} />
            <div className="bg-white rounded-3xl p-6 shadow-sm border border-[var(--color-church-cream-dark)] space-y-6">
               <div className="p-4 bg-blue-50 rounded-2xl border border-blue-100">
                  <h3 className="font-bold text-[var(--color-church-blue)] mb-2">{lang === 'ar' ? 'وقت الشاشة الإجمالي' : 'Total Screen Time'}</h3>
                  <p className="text-3xl font-bold text-[var(--color-church-burgundy)]">
                    {formatScreenTime(userData.screenTimeSeconds || 0)}
                  </p>
                  <p className="text-xs text-gray-500 mt-2 font-bold">{lang === 'ar' ? 'الوقت الذي قضاه الطفل في التطبيق' : 'Time your child spent learning on the app.'}</p>
               </div>

               <div>
                 <h3 className="font-bold text-gray-700 mb-3">{lang === 'ar' ? 'تغيير كلمة السر' : 'Change Parent PIN'}</h3>
                 <div className="flex gap-2">
                    <input 
                      type="password" 
                      value={newParentPin}
                      onChange={(e) => setNewParentPin(e.target.value)}
                      placeholder={lang === 'ar' ? 'كلمة السر الجديدة' : 'New PIN (4 digits)'}
                      className="flex-1 bg-gray-50 border-2 border-gray-100 rounded-xl px-4 py-2 outline-none font-bold text-center tracking-widest" 
                      maxLength={4} 
                    />
                    <button 
                      onClick={() => {
                        if (newParentPin.length === 4) {
                           updateUserProfile({ parentPin: newParentPin });
                           alert(lang === 'ar' ? 'تم تحديث كلمة السر' : 'PIN updated successfully');
                           setNewParentPin('');
                        }
                      }}
                      className="bg-[var(--color-church-blue)] text-white font-bold px-4 py-2 rounded-xl shadow-sm"
                    >
                      {lang === 'ar' ? 'حفظ' : 'Save'}
                    </button>
                 </div>
               </div>
            </div>
          </motion.div>
        )}

        {screen === 'help' && (
          <motion.div key="help" initial={{ x: 50, opacity: 0 }} animate={{ x: 0, opacity: 1 }} exit={{ x: 50, opacity: 0 }} className="space-y-6">
            <Header title={lang === 'ar' ? 'المساعدة والخصوصية' : 'Help & Privacy'} onBack={() => setScreen('main')} />
            <div className="bg-white rounded-3xl p-2 shadow-sm border border-[var(--color-church-cream-dark)] space-y-2">
               <button className="w-full p-4 flex items-center gap-3 text-gray-700 hover:bg-gray-50 rounded-2xl text-left">
                  <HelpCircle size={20} className="text-[var(--color-church-blue)]" />
                  <span className="font-bold flex-1">{lang === 'ar' ? 'الأسئلة الشائعة' : 'FAQ'}</span>
               </button>
               <button className="w-full p-4 flex items-center gap-3 text-gray-700 hover:bg-gray-50 rounded-2xl text-left">
                  <FileText size={20} className="text-[var(--color-church-blue)]" />
                  <span className="font-bold flex-1">{lang === 'ar' ? 'سياسة الخصوصية' : 'Privacy Policy'}</span>
               </button>
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* In-App Safe Logout Confirmation Dialog (Zero iframe confirm() crashes) */}
      <AnimatePresence>
        {showLogoutModal && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50 backdrop-blur-xs">
            <motion.div
              initial={{ opacity: 0, scale: 0.9, y: 20 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.9, y: 20 }}
              className="bg-white dark:bg-slate-900 rounded-3xl p-6 max-w-sm w-full shadow-2xl border border-[var(--color-church-cream-dark)] text-center space-y-4"
            >
              <div className="w-14 h-14 mx-auto rounded-full bg-red-100 dark:bg-red-950/40 text-red-600 dark:text-red-400 flex items-center justify-center">
                <LogOut size={28} />
              </div>
              <h3 className="text-xl font-bold text-gray-900 dark:text-white">
                {lang === 'ar' ? 'تسجيل الخروج' : 'Log Out'}
              </h3>
              <p className="text-sm text-gray-500 dark:text-gray-400 leading-relaxed">
                {lang === 'ar'
                  ? 'هل تريد بالتأكيد تسجيل الخروج من حسابك في تطبيق كنيسة القديس موسى؟'
                  : 'Are you sure you want to log out of your St. Musa Church account?'}
              </p>
              <div className="flex gap-3 pt-2">
                <button
                  onClick={() => setShowLogoutModal(false)}
                  className="flex-1 py-3 px-4 rounded-2xl border border-gray-200 dark:border-slate-700 font-bold text-sm text-gray-700 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-slate-800 transition-colors"
                >
                  {lang === 'ar' ? 'إلغاء' : 'Cancel'}
                </button>
                <button
                  onClick={() => {
                    setShowLogoutModal(false);
                    onLogout();
                  }}
                  className="flex-1 py-3 px-4 rounded-2xl bg-red-600 hover:bg-red-700 text-white font-bold text-sm transition-colors shadow-sm"
                >
                  {lang === 'ar' ? 'نعم، خروج' : 'Yes, Log Out'}
                </button>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      {/* Child QR Code Modal */}
      <ChildQrCodeModal
        isOpen={showQrModal}
        onClose={() => setShowQrModal(false)}
        childName={userData.fullName || 'Student'}
        linkCode={studentLinkCode}
        lang={lang}
      />
    </div>
  );
}
