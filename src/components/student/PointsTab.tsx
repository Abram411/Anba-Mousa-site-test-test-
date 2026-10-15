import React, { useState, useEffect } from 'react';
import { Star, Medal, Lock, Trophy, Users, ChevronUp, History, Landmark, Gift, X, CheckCircle2, AlertCircle } from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';
import { mockBadges } from '../../data';
import { useAuth } from '../../context/AuthContext';
import { supabase } from '../../lib/supabase';
import { submitRewardRequest } from '../../lib/supabaseDatabase';
import { addRewardRequest } from '../../lib/parentChildService';
import { getLeaderboard, getSavedPurchases, saveRewardPurchaseLocal } from '../../lib/pointsService';
import { LeaderboardEntry, Language } from '../../types';

const REWARD_PRODUCTS = [
  { id: '1', title: 'Small Saint Picture', titleAr: 'صورة قديس صغيرة', titleCopt: 'Ⲟⲩϩⲩⲕⲱⲛ ⲛ̀ⲧⲉ ⲟⲩⲁⲅⲓⲟⲥ', cost: 50, icon: '🖼️' },
  { id: '2', title: 'Wooden Icon', titleAr: 'أيقونة خشبية', titleCopt: 'Ⲟⲩⲉⲓⲕⲱⲛ ⲛ̀ϣⲉ', cost: 100, icon: '🪵' },
  { id: '3', title: 'Church Notebook', titleAr: 'كشكول الكنيسة', titleCopt: 'Ⲡⲓϫⲱⲙ ⲛ̀ⲧⲉ ϯⲉⲕⲕⲗⲏⲥⲓⲁ', cost: 150, icon: '📓' },
  { id: '4', title: 'Cross Necklace', titleAr: 'صليب الكنيسة', titleCopt: 'Ⲡⲓⲥⲧⲁⲩⲣⲟⲥ ⲛ̀ⲧⲉ ⲡⲓⲙⲟⲧ', cost: 200, icon: '✝️' },
];

export function PointsTab({ lang }: { lang: Language }) {
  const { userData, addPoints } = useAuth();
  const [view, setView] = useState<'path' | 'leaderboard' | 'bank'>('path');
  const [showStore, setShowStore] = useState(false);
  const [leaderboardList, setLeaderboardList] = useState<LeaderboardEntry[]>(() => getLeaderboard(userData));
  const [purchases, setPurchases] = useState<any[]>(() => userData ? getSavedPurchases(userData.id) : []);
  const [confirmPurchaseItem, setConfirmPurchaseItem] = useState<{ id: string; name: string; cost: number } | null>(null);
  const [feedbackToast, setFeedbackToast] = useState<{ type: 'success' | 'error'; message: string } | null>(null);

  const showNotification = (type: 'success' | 'error', message: string) => {
    setFeedbackToast({ type, message });
    setTimeout(() => {
      setFeedbackToast(null);
    }, 4000);
  };

  useEffect(() => {
    setLeaderboardList(getLeaderboard(userData));
    const handleUpdate = () => {
      setLeaderboardList(getLeaderboard(userData));
    };
    window.addEventListener('church_leaderboard_updated', handleUpdate);
    return () => window.removeEventListener('church_leaderboard_updated', handleUpdate);
  }, [userData]);

  useEffect(() => {
    if (!userData) return;
    const local = getSavedPurchases(userData.id);
    if (local && local.length > 0) {
      setPurchases(local);
    }

    if (view === 'bank' && supabase) {
       const fetchPurchases = async () => {
          try {
            const { data } = await supabase
              .from('reward_requests')
              .select('*')
              .eq('student_id', userData.id)
              .order('created_at', { ascending: false });

            if (data && data.length > 0) {
              const formatted = data.map(d => ({
                userId: d.student_id,
                rewardId: d.reward_id,
                itemName: lang === 'ar' ? (d.reward_name_ar || d.reward_name_en) : (d.reward_name_en || d.reward_name_ar),
                cost: d.cost_points,
                createdAt: d.created_at
              }));
              setPurchases(formatted);
            }
          } catch (e) {
            console.warn('Could not load purchases from Supabase:', e);
          }
       };
       fetchPurchases();
    }
  }, [userData?.id, view, lang]);

  const isCop = lang === 'copt' || lang === 'cop';

  const executePurchase = async () => {
    if (!userData || !confirmPurchaseItem) return;
    const { id: rewardId, cost, name } = confirmPurchaseItem;
    
    if (userData.points < cost) {
       showNotification('error', isCop ? 'Ⲙ̀ⲙⲟⲛ ⲧⲁⲓⲟ ⲣⲱϣⲓ ⲉ̀ⲡⲁⲓⲧⲁⲓⲟ!' : lang === 'ar' ? 'رصيد نقاطك غير كافٍ لإتمام هذا الطلب!' : 'Not enough points for this reward!');
       setConfirmPurchaseItem(null);
       return;
    }

    try {
       await addPoints(-cost);

       const newPurchase = {
          userId: userData.id,
          rewardId,
          itemName: name,
          cost,
          createdAt: new Date().toISOString()
       };

       saveRewardPurchaseLocal(userData.id, newPurchase);
       setPurchases(prev => [newPurchase, ...prev]);

       try {
         await submitRewardRequest(userData.id, rewardId, name, name, cost);
       } catch (e) {}

       try {
         addRewardRequest({
           childId: userData.id,
           childNameEn: userData.fullName || 'Student',
           childNameAr: userData.fullName || 'تلميذ',
           rewardTitleEn: name,
           rewardTitleAr: name,
           pointsCost: cost,
           icon: '🎁',
           parentId: userData.parentId
         });
       } catch (e) {}

       setConfirmPurchaseItem(null);
       setShowStore(false);
       showNotification('success', isCop ? 'Ⲁⲩⲧⲱⲃϩ ⲉ̀ⲡⲓⲇⲱⲣⲟⲛ ϧⲉⲛ ⲟⲩϩⲓⲣⲏⲛⲏ! Ϭⲓ ⲡⲉⲕⲧⲁⲓⲟ ⲉ̀ⲃⲟⲗ ϩⲓⲧⲉⲛ ⲡⲓⲇⲓⲁⲕⲟⲛ ⲛ̀ϯⲕⲩⲣⲓⲁⲕⲏ.' : lang === 'ar' ? 'تم تقديم طلب الهدية بنجاح! يمكنك استلامها من خادم الفصل يوم الأحد.' : 'Request submitted successfully! Claim your reward from your servant on Sunday.');
    } catch(err: any) {
       console.error(err);
       showNotification('error', isCop ? 'Ⲟⲩⲡⲁⲣⲁⲡⲧⲱⲙⲁ ⲁϥϣⲱⲡⲓ' : lang === 'ar' ? 'حدث خطأ أثناء إتمام الطلب' : 'Error during purchase.');
       setConfirmPurchaseItem(null);
    }
  };

  if (!userData) return null;

  return (
    <div className="pb-24 pt-6 px-4 w-full max-w-7xl mx-auto space-y-8 overflow-hidden">
      {/* View Toggle */}
      <div className="flex bg-[var(--mousa-cream-surface)] dark:bg-[#1C1712] rounded-2xl p-1 shadow-xs border-2 border-[var(--mousa-border-sand)] relative z-10 text-xs sm:text-sm max-w-md mx-auto">
        <button 
          onClick={() => setView('path')}
          className={`flex-1 py-2.5 sm:py-3 rounded-xl font-black transition-all z-10 cursor-pointer ${view === 'path' ? 'bg-[var(--mousa-teal)] text-white shadow-xs' : 'text-[var(--mousa-sand-500)] hover:text-[var(--mousa-teal)]'}`}
        >
          {lang === 'copt' ? 'Ⲡⲁⲙⲱⲓⲧ' : lang === 'ar' ? 'طريقي في البرية' : 'My Trail'}
        </button>
        <button 
          onClick={() => setView('leaderboard')}
          className={`flex-1 py-2.5 sm:py-3 rounded-xl font-black transition-all z-10 cursor-pointer ${view === 'leaderboard' ? 'bg-[var(--mousa-teal)] text-white shadow-xs' : 'text-[var(--mousa-sand-500)] hover:text-[var(--mousa-teal)]'}`}
        >
          {lang === 'copt' ? 'Ⲡⲓⲧⲁⲝⲓⲥ' : lang === 'ar' ? 'قافلة النور' : 'Caravan Rank'}
        </button>
        <button 
          onClick={() => setView('bank')}
          className={`flex-1 py-2.5 sm:py-3 rounded-xl font-black transition-all z-10 cursor-pointer ${view === 'bank' ? 'bg-[var(--mousa-teal)] text-white shadow-xs' : 'text-[var(--mousa-sand-500)] hover:text-[var(--mousa-teal)]'}`}
        >
          {lang === 'copt' ? 'Ⲡⲓⲧⲣⲁⲡⲉⲍⲁ' : lang === 'ar' ? 'خزينة البركة' : 'Treasury'}
        </button>
      </div>

      {/* Header Stats */}
      <motion.div 
        initial={{ scale: 0.8, opacity: 0 }}
        animate={{ scale: 1, opacity: 1 }}
        transition={{ type: "spring", bounce: 0.5 }}
        className="text-center space-y-2"
      >
        <div className="inline-flex items-center justify-center w-20 h-20 bg-gradient-to-tr from-[var(--mousa-gold)] to-[var(--mousa-coral)] rounded-3xl text-white shadow-lg shadow-[var(--mousa-gold)]/30 mb-2 border-2 border-white/20">
          <Star size={38} fill="currentColor" className="text-[var(--mousa-gold-glow)]" />
        </div>
        <h1 className="text-4xl font-black text-[var(--mousa-teal-deep)] dark:text-[#FAF5EB] md:text-5xl">{userData.points}</h1>
        <p className="text-[var(--mousa-sand-500)] dark:text-[var(--mousa-sand-400)] font-black uppercase tracking-widest text-xs sm:text-sm">
          {lang === 'copt' ? 'Ⲡⲓⲧⲏⲣϥ ⲛ̀ⲧⲉ ⲛⲓⲧⲁⲓⲟ' : lang === 'ar' ? 'إجمالي نقاط البركة في مسيرة الأنبا موسى' : 'Total Blessing Points'}
        </p>
      </motion.div>

      <AnimatePresence mode="wait">
        {view === 'path' ? (
          <motion.div 
            key="path"
            initial={{ x: -50, opacity: 0 }}
            animate={{ x: 0, opacity: 1 }}
            exit={{ x: -50, opacity: 0 }}
            className="bg-[var(--mousa-cream-surface)] dark:bg-[#1E1914] rounded-3xl p-6 md:p-8 shadow-xs border-2 border-[var(--mousa-border-sand)] relative md:max-w-4xl md:mx-auto"
          >
            <h2 className="text-xl font-black text-[var(--mousa-teal-deep)] dark:text-[#FAF5EB] mb-6 flex items-center gap-2 md:text-2xl">
              <Trophy size={24} className="text-[var(--mousa-gold)] md:w-8 md:h-8" />
              {isCop ? 'Ⲛⲁⲭⲗⲟⲙ' : lang === 'ar' ? 'أوسمة طريق الأنبا موسى' : 'My Journey Badges'}
            </h2>
            
            <div className="space-y-6 relative before:absolute before:inset-0 before:ml-7 before:-translate-x-px md:before:mx-auto md:before:translate-x-0 before:h-full before:w-1 before:bg-[var(--mousa-border-sand)]">
              {mockBadges.map((badge, index) => {
                const isUnlocked = userData.points >= badge.pointsThreshold;
                
                return (
                  <motion.div 
                    initial={{ opacity: 0, y: 20 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ delay: index * 0.1 }}
                    key={badge.id} 
                    className="relative flex items-center justify-between md:justify-normal md:odd:flex-row-reverse group is-active"
                  >
                    {/* Icon Marker */}
                    <motion.div 
                      whileHover={isUnlocked ? { scale: 1.15, rotate: 6 } : {}}
                      className={`flex items-center justify-center w-14 h-14 md:w-16 md:h-16 rounded-2xl border-2 border-white dark:border-[#1E1914] shrink-0 md:order-1 md:group-odd:-translate-x-1/2 md:group-even:translate-x-1/2 shadow-xs z-10 transition-transform ${
                      isUnlocked 
                        ? 'bg-[var(--mousa-gold)] text-white ring-2 ring-[var(--mousa-gold-light)]' 
                        : 'bg-[var(--mousa-sand-100)] dark:bg-stone-800 text-stone-400'
                    }`}>
                      {isUnlocked ? <Medal size={24} className="md:w-8 md:h-8 drop-shadow-xs" /> : <Lock size={24} className="md:w-8 md:h-8" />}
                    </motion.div>
                    
                    {/* Content Card */}
                    <div className={`w-[calc(100%-4.5rem)] md:w-[calc(50%-3rem)] p-4 md:p-6 rounded-2xl border-2 transition-all ${
                      isUnlocked 
                        ? 'bg-gradient-to-br from-[#FFFDF9] via-[#FAF5EB] to-[#F7EFE1] dark:from-[#251E17] dark:to-[#2B2218] border-[var(--mousa-gold)]/60 shadow-xs' 
                        : 'bg-stone-50/70 dark:bg-stone-900/40 border-stone-200 dark:border-stone-800 opacity-60'
                    }`}>
                      <h3 className={`font-black md:text-lg ${isUnlocked ? 'text-[var(--mousa-teal-deep)] dark:text-[#FAF5EB]' : 'text-stone-500'}`}>
                        {badge.title}
                      </h3>
                      <p className="text-xs md:text-sm text-[var(--mousa-sand-600)] dark:text-[var(--mousa-sand-400)] font-bold">
                        +{badge.pointsThreshold} {lang === 'copt' ? 'ⲧⲁⲓⲟ' : lang === 'ar' ? 'نقطة بركة' : 'pts'}
                      </p>
                      {badge.unlockedAt && (
                        <p className="text-xs md:text-sm text-[var(--mousa-coral-dark)] dark:text-[var(--mousa-coral-glow)] mt-2 font-black flex items-center gap-1">
                          <span>★</span>
                          <span>{isCop ? 'Ⲁⲩⲟⲩⲱⲛ ϧⲉⲛ' : lang === 'ar' ? 'وسام مفتوح' : 'Unlocked'}</span>
                        </p>
                      )}
                    </div>
                  </motion.div>
                );
              })}
            </div>
          </motion.div>
        ) : view === 'leaderboard' ? (
          <motion.div 
            key="leaderboard"
            initial={{ x: 50, opacity: 0 }}
            animate={{ x: 0, opacity: 1 }}
            exit={{ x: 50, opacity: 0 }}
            className="bg-[var(--mousa-cream-surface)] dark:bg-[#1E1914] rounded-3xl p-6 md:p-8 shadow-xs border-2 border-[var(--mousa-border-sand)] space-y-6 md:max-w-4xl md:mx-auto"
          >
             <div className="flex justify-between items-end mb-2">
               <h2 className="text-xl font-black text-[var(--mousa-teal-deep)] dark:text-[#FAF5EB] flex items-center gap-2 md:text-2xl">
                 <Users size={24} className="text-[var(--mousa-gold)] md:w-8 md:h-8" />
                 {isCop ? 'Ⲛⲓⲅⲉⲛⲛⲉⲟⲥ ⲛ̀ϯⲉⲃⲇⲟⲙⲁⲥ' : lang === 'ar' ? 'فرسان قافلة النور' : 'Caravan Companions'}
               </h2>
               <p className="text-xs md:text-sm font-bold text-[var(--mousa-sand-500)] bg-[var(--mousa-sand-100)] dark:bg-stone-800 px-3 py-1 rounded-full border border-[var(--mousa-border-sand)]">Ages 8-10</p>
             </div>
             
             <div className="space-y-3">
                {leaderboardList.map((entry, idx) => (
                   <motion.div 
                     key={entry.id || entry.studentId}
                     initial={{ opacity: 0, x: 20 }}
                     animate={{ opacity: 1, x: 0 }}
                     transition={{ delay: idx * 0.05, type: 'spring' }}
                     className={`flex items-center gap-4 p-3 md:p-4 rounded-2xl border-2 transition-all ${entry.studentId === userData.id ? 'bg-[#FAF3E5] dark:bg-[#2F241A] border-[var(--mousa-gold)] shadow-xs' : 'hover:bg-[var(--mousa-sand-50)] dark:hover:bg-stone-900 border-transparent'}`}
                   >
                     <div className="font-black text-lg md:text-xl text-[var(--mousa-sand-500)] w-8 text-center">
                       {entry.rank === 1 ? '🥇' : entry.rank === 2 ? '🥈' : entry.rank === 3 ? '🥉' : `#${entry.rank}`}
                     </div>
                     <img src={entry.avatarUrl} alt={entry.studentName} className="w-12 h-12 md:w-16 md:h-16 rounded-full border-2 border-[var(--mousa-gold)] shadow-xs object-cover" />
                     <div className="flex-1">
                        <div className="flex items-center gap-2">
                          <h4 className="font-extrabold text-[var(--mousa-teal-deep)] dark:text-[#FAF5EB] md:text-lg">
                            {entry.studentId === userData.id ? (isCop ? 'Ⲛ̀ⲑⲟⲕ' : lang === 'ar' ? 'أنت' : 'You') : entry.studentName}
                          </h4>
                          {entry.studentId === userData.id && (
                            <span className="text-[10px] bg-[var(--mousa-gold)] text-[var(--mousa-teal-deep)] font-black px-2 py-0.5 rounded-full">
                              {isCop ? 'Ⲛ̀ⲑⲟⲕ' : lang === 'ar' ? 'أنت' : 'You'}
                            </span>
                          )}
                        </div>
                        {idx > 0 && <span className="text-[10px] md:text-xs text-[var(--mousa-teal)] dark:text-[var(--mousa-teal-glow)] font-bold flex items-center"><ChevronUp size={12}/> {isCop ? 'Ⲉϥⲓ̀ ⲉ̀ⲡϣⲱⲓ' : lang === 'ar' ? 'صاعد' : 'Rising'}</span>}
                     </div>
                     <div className="text-right pr-2">
                        <p className="font-black text-xl md:text-2xl text-[var(--mousa-coral-dark)] dark:text-[var(--mousa-coral-glow)]">{entry.pointsThisWeek}</p>
                        <p className="text-[10px] md:text-xs font-bold text-[var(--mousa-sand-500)] uppercase">Pts</p>
                     </div>
                   </motion.div>
                ))}
             </div>
             
             <div className="mt-6 text-center bg-blue-50 text-[var(--color-church-blue)] p-4 md:p-6 rounded-xl md:text-lg">
               <p className="font-bold">{isCop ? 'Ⲁⲣⲓϩⲟⲧⲡ! Ϫⲱⲕ ⲛ̀ⲛⲓⲥⲃⲱ ⲉ̀ⲓ̀ ⲉ̀ⲧⲡⲉ ϧⲉⲛ ⲡⲓⲧⲁⲝⲓⲥ.' : lang === 'ar' ? 'عاش! استمر عشان تطلع في الترتيب.' : 'Keep going! Complete lessons to climb the board.'}</p>
             </div>
          </motion.div>
        ) : (
          <motion.div 
            key="bank"
            initial={{ x: 50, opacity: 0 }}
            animate={{ x: 0, opacity: 1 }}
            exit={{ x: 50, opacity: 0 }}
            className="md:grid md:grid-cols-2 md:gap-8 space-y-6 md:space-y-0"
          >
             {/* Points Bank */}
             <div className="bg-gradient-to-br from-[var(--mousa-teal-deep)] via-[#144E5B] to-[#103D46] rounded-3xl p-6 md:p-8 shadow-xs border-2 border-[var(--mousa-gold)]/40 text-white relative h-fit">
                <div className="flex items-center gap-3 mb-4 text-[var(--mousa-gold-glow)]">
                   <Landmark size={28} className="md:w-10 md:h-10 text-[var(--mousa-gold-glow)]" />
                   <h2 className="text-xl md:text-2xl font-black">{isCop ? 'Ⲡⲓⲧⲣⲁⲡⲉⲍⲁ ⲛ̀ⲧⲉ ⲛⲓⲧⲁⲓⲟ' : lang === 'ar' ? 'خزينة بركة الأنبا موسى' : 'Points Treasury'}</h2>
                </div>
                <p className="text-sm md:text-base text-stone-200 mb-6">{isCop ? 'Ϣⲉⲃⲓⲱ ⲛ̀ⲛⲉⲕⲧⲁⲓⲟ ⲉ̀ϩⲁⲛⲇⲱⲣⲟⲛ ⲛ̀ⲧⲁⲫⲙⲏⲓ ⲉ̀ⲃⲟⲗ ϧⲉⲛ ϯⲉⲕⲕⲗⲏⲥⲓⲁ.' : lang === 'ar' ? 'استخدم نقاطك للحصول على هدايا وأيقونات وبركات حقيقية من الكنيسة.' : 'Redeem your points for real gifts and icons at church.'}</p>
                <div className="flex flex-col gap-3">
                   {REWARD_PRODUCTS.slice(0,2).map(prod => (
                     <button key={prod.id} onClick={() => setShowStore(true)} className="bg-white/10 hover:bg-white/20 px-4 py-3 md:px-5 md:py-4 rounded-xl flex justify-between font-bold items-center transition-colors md:text-lg cursor-pointer border border-white/10">
                        <span>{prod.icon} {lang === 'ar' ? prod.titleAr : prod.title}</span>
                        <span className="flex items-center gap-2 bg-white/20 px-2.5 py-1 rounded-lg text-sm font-black">+{prod.cost} pts <ChevronUp className={lang === 'ar' ? 'rotate-180' : 'rotate-90'} size={18}/></span>
                     </button>
                   ))}
                   <button onClick={() => setShowStore(true)} className="bg-gradient-to-r from-[var(--mousa-gold)] to-[var(--mousa-coral)] text-white hover:brightness-105 px-4 py-3 md:px-5 md:py-4 rounded-xl font-black shadow-xs text-center mt-4 flex items-center justify-center gap-2 md:text-lg cursor-pointer">
                      <Gift size={20} className="md:w-6 md:h-6" />
                      {isCop ? 'Ⲟⲩⲱⲛ ⲙ̀ⲡⲓⲙⲁⲛ̀ϣⲱⲡ ⲛ̀ⲧⲉ ⲛⲓⲧⲁⲓⲟ' : lang === 'ar' ? 'عرض متجر البركات والهدايا' : 'Open Reward Treasury'}
                   </button>
                </div>
             </div>

             <div className="space-y-6 md:space-y-8">
               {/* All Time Best */}
               <div className="bg-[var(--mousa-cream-surface)] dark:bg-[#1E1914] rounded-3xl p-6 md:p-8 shadow-xs border-2 border-[var(--mousa-border-sand)]">
                  <div className="flex items-center gap-3 mb-6">
                     <History size={24} className="text-[var(--mousa-teal)] dark:text-[var(--mousa-gold-glow)] md:w-8 md:h-8" />
                     <h2 className="text-xl md:text-2xl font-black text-[var(--mousa-teal-deep)] dark:text-[#FAF5EB]">{isCop ? 'Ⲡⲓⲛⲓϣϯ ⲛ̀ⲥⲏⲟⲩ ⲛⲓⲃⲉⲛ' : lang === 'ar' ? 'سجل الإنجاز والمسيرة' : 'All-Time Record'}</h2>
                  </div>
                  <div className="grid grid-cols-2 gap-4">
                     <div className="bg-[var(--mousa-sand-50)] dark:bg-stone-900/60 p-4 md:p-6 rounded-2xl text-center border border-[var(--mousa-border-sand)]">
                       <p className="text-3xl md:text-4xl font-black text-[var(--mousa-coral-dark)] dark:text-[var(--mousa-coral-glow)] mb-2">{userData.longestStreak}</p>
                       <p className="text-xs md:text-sm text-[var(--mousa-sand-600)] dark:text-[var(--mousa-sand-400)] font-black uppercase">{isCop ? 'Ⲡⲓϩⲟⲩⲟ̀ ⲛ̀ⲉϩⲟⲟⲩ' : lang === 'ar' ? 'أطول سلسلة أيام' : 'Longest Streak'}</p>
                     </div>
                     <div className="bg-[var(--mousa-sand-50)] dark:bg-stone-900/60 p-4 md:p-6 rounded-2xl text-center border border-[var(--mousa-border-sand)]">
                       <p className="text-3xl md:text-4xl font-black text-[var(--mousa-gold)] dark:text-[var(--mousa-gold-light)] mb-2">45</p>
                       <p className="text-xs md:text-sm text-[var(--mousa-sand-600)] dark:text-[var(--mousa-sand-400)] font-black uppercase">{isCop ? 'Ⲛⲓⲥⲃⲱ ⲉⲧϫⲏⲕ' : lang === 'ar' ? 'محطات مكتملة' : 'Milestones Done'}</p>
                     </div>
                  </div>
               </div>

               {/* Purchase History */}
               {purchases.length > 0 && (
                 <div className="bg-[var(--mousa-cream-surface)] dark:bg-[#1E1914] rounded-3xl p-6 md:p-8 shadow-xs border-2 border-[var(--mousa-border-sand)]">
                    <h3 className="font-black text-[var(--mousa-teal-deep)] dark:text-[#FAF5EB] md:text-xl mb-4">{isCop ? 'Ⲛⲁϣⲱⲡ' : lang === 'ar' ? 'طلبات البركات السابقة' : 'Redemption History'}</h3>
                    <div className="space-y-3">
                      {purchases.map((p, i) => (
                         <div key={i} className="flex justify-between items-center p-3 md:p-4 bg-[var(--mousa-sand-50)] dark:bg-stone-900/60 rounded-xl border border-[var(--mousa-border-sand)]">
                            <div>
                               <p className="font-bold text-sm md:text-base text-[var(--mousa-teal-deep)] dark:text-[#FAF5EB]">{p.itemName}</p>
                               <p className="text-xs text-[var(--mousa-sand-500)]">{new Date(p.createdAt).toLocaleDateString()}</p>
                            </div>
                            <span className="font-black md:text-lg text-[var(--mousa-coral-dark)] dark:text-[var(--mousa-coral-glow)]">-{p.cost} pts</span>
                         </div>
                      ))}
                    </div>
                 </div>
               )}
             </div>
          </motion.div>
        )}
      </AnimatePresence>

      <AnimatePresence>
        {showStore && (
           <div className="fixed inset-0 z-[60] flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm">
             <motion.div 
               initial={{ opacity: 0, scale: 0.9, y: 20 }}
               animate={{ opacity: 1, scale: 1, y: 0 }}
               exit={{ opacity: 0, scale: 0.9, y: 20 }}
               className="bg-[var(--mousa-cream-surface)] dark:bg-[#1E1914] w-full max-w-lg md:max-w-2xl max-h-[80vh] overflow-y-auto rounded-3xl p-6 md:p-8 shadow-2xl relative border-2 border-[var(--mousa-border-sand)]"
             >
               <button onClick={() => setShowStore(false)} className="absolute top-4 right-4 text-[var(--mousa-sand-500)] hover:text-[var(--mousa-coral)] bg-[var(--mousa-sand-100)] p-2 rounded-full cursor-pointer">
                 <X size={20} />
               </button>
               <h2 className="text-2xl md:text-3xl font-black text-[var(--mousa-teal-deep)] dark:text-[#FAF5EB] mb-2 flex items-center gap-2">
                 <Gift size={24} className="text-[var(--mousa-gold)] md:w-8 md:h-8" />
                 {isCop ? 'Ⲡⲓⲙⲁⲛ̀ϣⲱⲡ ⲛ̀ⲧⲉ ⲛⲓⲧⲁⲓⲟ' : lang === 'ar' ? 'متجر بركات الأنبا موسى' : 'Blessing Store'}
               </h2>
               <p className="text-[var(--mousa-sand-600)] dark:text-[var(--mousa-sand-400)] text-sm md:text-base mb-6 font-bold">
                 {isCop ? `Ⲡⲉⲕⲧⲁⲓⲟ ⲧⲛⲟⲩ: ${userData.points} ⲧⲁⲓⲟ` : lang === 'ar' ? `رصيدك الحالي: ${userData.points} نقطة بركة` : `Your balance: ${userData.points} pts`}
               </p>

               <div className="grid grid-cols-2 md:grid-cols-3 gap-4">
                   {REWARD_PRODUCTS.map(prod => (
                    <div key={prod.id} className="border-2 border-[var(--mousa-border-sand)] rounded-2xl p-4 text-center hover:border-[var(--mousa-gold)] transition-colors flex flex-col justify-between bg-[var(--mousa-cream-surface)] dark:bg-[#251E17]">
                       <div className="text-4xl md:text-5xl mb-3">{prod.icon}</div>
                       <h3 className="font-bold text-sm md:text-base text-[var(--mousa-teal-deep)] dark:text-[#FAF5EB] mb-4">{lang === 'ar' ? prod.titleAr : prod.title}</h3>
                       <button 
                         onClick={() => setConfirmPurchaseItem({ id: prod.id, cost: prod.cost, name: lang === 'ar' ? prod.titleAr : prod.title })}
                         disabled={userData.points < prod.cost}
                         className={`w-full font-bold py-2 md:py-3 rounded-xl transition-all mt-auto cursor-pointer shadow-xs ${
                           userData.points >= prod.cost 
                             ? 'bg-[var(--mousa-teal)] text-white hover:bg-[var(--mousa-teal-deep)]' 
                             : 'bg-stone-100 text-stone-400 dark:bg-stone-800 dark:text-stone-600 cursor-not-allowed'
                         }`}
                       >
                         {prod.cost} {lang === 'copt' ? 'ⲧⲁⲓⲟ' : lang === 'ar' ? 'نقطة بركة' : 'pts'}
                       </button>
                    </div>
                  ))}
               </div>
             </motion.div>
           </div>
        )}
      </AnimatePresence>

      {/* Confirmation Modal */}
      <AnimatePresence>
        {confirmPurchaseItem && (
          <div className="fixed inset-0 z-[70] flex items-center justify-center p-4 bg-black/60 backdrop-blur-xs">
            <motion.div
              initial={{ scale: 0.9, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              exit={{ scale: 0.9, opacity: 0 }}
              className="bg-[var(--mousa-cream-surface)] dark:bg-[#1E1914] rounded-3xl p-6 max-w-sm w-full shadow-2xl border-2 border-[var(--mousa-border-sand)] text-center space-y-4"
            >
              <div className="w-16 h-16 bg-[var(--mousa-gold-soft)] text-[var(--mousa-gold-dark)] rounded-full flex items-center justify-center mx-auto text-2xl border border-[var(--mousa-gold)]/30">
                🎁
              </div>
              <h3 className="text-xl font-bold text-[var(--mousa-teal-deep)] dark:text-[#FAF5EB]">
                {isCop ? 'Ⲧⲁϫⲣⲟ ⲙ̀ⲡⲓⲧⲱⲃϩ ⲛ̀ⲧⲁⲓⲟ' : lang === 'ar' ? 'تأكيد طلب الهدية' : 'Confirm Reward Request'}
              </h3>
              <p className="text-sm text-[var(--mousa-sand-600)] dark:text-[var(--mousa-sand-400)]">
                {isCop
                  ? `Ⲭⲟⲩⲱϣ ⲉ̀ϣⲉⲃⲓⲱ ${confirmPurchaseItem.cost} ⲧⲁⲓⲟ ⲉ̀ "${confirmPurchaseItem.name}";`
                  : lang === 'ar' 
                  ? `هل ترغب في استبدال ${confirmPurchaseItem.cost} نقطة بـ "${confirmPurchaseItem.name}"؟` 
                  : `Redeem ${confirmPurchaseItem.cost} points for "${confirmPurchaseItem.name}"?`}
              </p>
              <div className="flex gap-3 pt-2">
                <button
                  onClick={() => setConfirmPurchaseItem(null)}
                  className="flex-1 py-2.5 rounded-xl border-2 border-[var(--mousa-border-sand)] text-[var(--mousa-sand-600)] font-bold hover:bg-[var(--mousa-sand-100)] transition-colors cursor-pointer"
                >
                  {isCop ? 'Ⲭⲱ ⲉ̀ⲃⲟⲗ' : lang === 'ar' ? 'إلغاء' : 'Cancel'}
                </button>
                <button
                  onClick={executePurchase}
                  className="flex-1 py-2.5 rounded-xl bg-[var(--mousa-teal)] text-white font-bold hover:bg-[var(--mousa-teal-deep)] transition-colors cursor-pointer shadow-xs"
                >
                  {isCop ? 'Ⲧⲁϫⲣⲟ' : lang === 'ar' ? 'تأكيد الطلب' : 'Confirm'}
                </button>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      {/* In-App Toast Notification */}
      <AnimatePresence>
        {feedbackToast && (
          <motion.div
            initial={{ opacity: 0, y: -40, scale: 0.95 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: -20, scale: 0.95 }}
            className={`fixed top-4 left-1/2 -translate-x-1/2 z-[80] flex items-center gap-3 px-5 py-3 rounded-2xl shadow-xl max-w-md w-[90%] text-sm font-bold ${
              feedbackToast.type === 'success'
                ? 'bg-emerald-600 text-white'
                : 'bg-red-600 text-white'
            }`}
          >
            {feedbackToast.type === 'success' ? (
              <CheckCircle2 size={20} className="shrink-0 text-emerald-200" />
            ) : (
              <AlertCircle size={20} className="shrink-0 text-red-200" />
            )}
            <span className="flex-1 text-xs md:text-sm">{feedbackToast.message}</span>
            <button onClick={() => setFeedbackToast(null)} className="opacity-80 hover:opacity-100 cursor-pointer">
              <X size={16} />
            </button>
          </motion.div>
        )}
      </AnimatePresence>
      
    </div>
  );
}
