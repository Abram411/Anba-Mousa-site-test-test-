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
      <div className="flex bg-white rounded-2xl p-1 shadow-sm border border-[var(--color-church-cream-dark)] relative z-10 text-sm max-w-md mx-auto">
        <button 
          onClick={() => setView('path')}
          className={`flex-1 py-3 rounded-xl font-bold transition-colors z-10 ${view === 'path' ? 'text-white' : 'text-gray-500 hover:text-gray-700'}`}
        >
          {lang === 'copt' ? 'Ⲡⲁⲙⲱⲓⲧ' : lang === 'ar' ? 'طريقي' : 'Path'}
        </button>
        <button 
          onClick={() => setView('leaderboard')}
          className={`flex-1 py-3 rounded-xl font-bold transition-colors z-10 ${view === 'leaderboard' ? 'text-white' : 'text-gray-500 hover:text-gray-700'}`}
        >
          {lang === 'copt' ? 'Ⲡⲓⲧⲁⲝⲓⲥ' : lang === 'ar' ? 'الترتيب' : 'Rank'}
        </button>
        <button 
          onClick={() => setView('bank')}
          className={`flex-1 py-3 rounded-xl font-bold transition-colors z-10 ${view === 'bank' ? 'text-white' : 'text-gray-500 hover:text-gray-700'}`}
        >
          {lang === 'copt' ? 'Ⲡⲓⲧⲣⲁⲡⲉⲍⲁ' : lang === 'ar' ? 'البنك' : 'Bank'}
        </button>
        
        {/* Animated Background pill */}
        <motion.div 
          className="absolute top-1 bottom-1 w-[calc(33.33%-4px)] bg-[var(--color-church-burgundy)] rounded-xl"
          animate={{ x: view === 'path' ? 0 : view === 'leaderboard' ? '100%' : '200%' }}
          transition={{ type: "spring", stiffness: 300, damping: 25 }}
        />
      </div>

      {/* Header Stats */}
      <motion.div 
        initial={{ scale: 0.8, opacity: 0 }}
        animate={{ scale: 1, opacity: 1 }}
        transition={{ type: "spring", bounce: 0.5 }}
        className="text-center space-y-2"
      >
        <div className="inline-flex items-center justify-center w-20 h-20 bg-[var(--color-church-burgundy)] rounded-full text-white shadow-lg shadow-[var(--color-church-burgundy)]/30 mb-2">
          <Star size={40} fill="currentColor" />
        </div>
        <h1 className="text-4xl font-bold text-[var(--color-church-blue)] md:text-5xl">{userData.points}</h1>
        <p className="text-gray-500 font-bold uppercase tracking-widest text-sm md:text-base">
          {lang === 'copt' ? 'Ⲡⲓⲧⲏⲣϥ ⲛ̀ⲧⲉ ⲛⲓⲧⲁⲓⲟ' : lang === 'ar' ? 'إجمالي النقاط' : 'Total Points'}
        </p>
      </motion.div>

      <AnimatePresence mode="wait">
        {view === 'path' ? (
          <motion.div 
            key="path"
            initial={{ x: -50, opacity: 0 }}
            animate={{ x: 0, opacity: 1 }}
            exit={{ x: -50, opacity: 0 }}
            className="bg-white rounded-3xl p-6 md:p-8 shadow-sm border border-[var(--color-church-cream-dark)] relative md:max-w-4xl md:mx-auto"
          >
            <h2 className="text-xl font-bold text-[var(--color-church-blue)] mb-6 flex items-center gap-2 md:text-2xl">
              <Trophy size={24} className="text-[var(--color-church-gold)] md:w-8 md:h-8" />
              {isCop ? 'Ⲛⲁⲭⲗⲟⲙ' : lang === 'ar' ? 'أوسمتي' : 'My Badges'}
            </h2>
            
            <div className="space-y-6 relative before:absolute before:inset-0 before:ml-7 before:-translate-x-px md:before:mx-auto md:before:translate-x-0 before:h-full before:w-1 before:bg-[var(--color-church-cream-dark)]">
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
                      whileHover={isUnlocked ? { scale: 1.2, rotate: 10 } : {}}
                      className={`flex items-center justify-center w-14 h-14 md:w-16 md:h-16 rounded-full border-4 border-white shrink-0 md:order-1 md:group-odd:-translate-x-1/2 md:group-even:translate-x-1/2 shadow-sm z-10 ${
                      isUnlocked 
                        ? 'bg-[var(--color-church-blue)] text-[var(--color-church-gold)]' 
                        : 'bg-gray-100 text-gray-400'
                    }`}>
                      {isUnlocked ? <Medal size={24} className="md:w-8 md:h-8" /> : <Lock size={24} className="md:w-8 md:h-8" />}
                    </motion.div>
                    
                    {/* Content Card */}
                    <div className={`w-[calc(100%-4rem)] md:w-[calc(50%-3rem)] p-4 md:p-6 rounded-2xl border ${
                      isUnlocked 
                        ? 'bg-[var(--color-church-cream)] border-[var(--color-church-gold)]/30' 
                        : 'bg-gray-50 border-transparent opacity-70'
                    }`}>
                      <h3 className={`font-bold md:text-lg ${isUnlocked ? 'text-[var(--color-church-blue)]' : 'text-gray-500'}`}>
                        {badge.title}
                      </h3>
                      <p className="text-sm md:text-base text-gray-500 font-medium">{badge.pointsThreshold} pts</p>
                      {badge.unlockedAt && (
                        <p className="text-xs md:text-sm text-[var(--color-church-gold)] mt-2 font-bold">
                          {isCop ? 'Ⲁⲩⲟⲩⲱⲛ ϧⲉⲛ' : lang === 'ar' ? 'تم الفتح في' : 'Unlocked'} {new Date(badge.unlockedAt).toLocaleDateString()}
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
            className="bg-white rounded-3xl p-6 md:p-8 shadow-sm border border-[var(--color-church-cream-dark)] space-y-6 md:max-w-4xl md:mx-auto"
          >
             <div className="flex justify-between items-end mb-2">
               <h2 className="text-xl font-bold text-[var(--color-church-blue)] flex items-center gap-2 md:text-2xl">
                 <Users size={24} className="text-[var(--color-church-gold)] md:w-8 md:h-8" />
                 {isCop ? 'Ⲛⲓⲅⲉⲛⲛⲉⲟⲥ ⲛ̀ϯⲉⲃⲇⲟⲙⲁⲥ' : lang === 'ar' ? 'أبطال الأسبوع' : 'Weekly Heroes'}
               </h2>
               <p className="text-xs md:text-sm font-bold text-gray-400 bg-gray-100 px-3 py-1 rounded-full">Ages 8-10</p>
             </div>
             
             <div className="space-y-3">
                {leaderboardList.map((entry, idx) => (
                   <motion.div 
                     key={entry.id || entry.studentId}
                     initial={{ opacity: 0, x: 20 }}
                     animate={{ opacity: 1, x: 0 }}
                     transition={{ delay: idx * 0.05, type: 'spring' }}
                     className={`flex items-center gap-4 p-3 md:p-4 rounded-2xl ${entry.studentId === userData.id ? 'bg-[var(--color-church-cream)] border-2 border-[var(--color-church-gold)]/60 shadow-sm' : 'hover:bg-gray-50 border border-transparent'}`}
                   >
                     <div className="font-bold text-lg md:text-xl text-gray-400 w-8 text-center">
                       {entry.rank === 1 ? '🥇' : entry.rank === 2 ? '🥈' : entry.rank === 3 ? '🥉' : `#${entry.rank}`}
                     </div>
                     <img src={entry.avatarUrl} alt={entry.studentName} className="w-12 h-12 md:w-16 md:h-16 rounded-full border-2 border-white shadow-sm object-cover" />
                     <div className="flex-1">
                        <div className="flex items-center gap-2">
                          <h4 className="font-bold text-[var(--color-church-blue)] md:text-lg">
                            {entry.studentId === userData.id ? (isCop ? 'Ⲛ̀ⲑⲟⲕ' : lang === 'ar' ? 'أنت' : 'You') : entry.studentName}
                          </h4>
                          {entry.studentId === userData.id && (
                            <span className="text-[10px] bg-[var(--color-church-gold)] text-[var(--color-church-blue)] font-bold px-2 py-0.5 rounded-full">
                              {isCop ? 'Ⲛ̀ⲑⲟⲕ' : lang === 'ar' ? 'أنت' : 'You'}
                            </span>
                          )}
                        </div>
                        {idx > 0 && <span className="text-[10px] md:text-xs text-green-500 font-bold flex items-center"><ChevronUp size={12}/> {isCop ? 'Ⲉϥⲓ̀ ⲉ̀ⲡϣⲱⲓ' : lang === 'ar' ? 'صاعد' : 'Rising'}</span>}
                     </div>
                     <div className="text-right pr-2">
                        <p className="font-bold text-xl md:text-2xl text-[var(--color-church-burgundy)]">{entry.pointsThisWeek}</p>
                        <p className="text-[10px] md:text-xs font-bold text-gray-400 uppercase">Pts</p>
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
             <div className="bg-gradient-to-br from-[var(--color-church-blue)] to-blue-900 rounded-3xl p-6 md:p-8 shadow-sm border border-[var(--color-church-cream-dark)] text-white relative h-fit">
                <div className="flex items-center gap-3 mb-4 text-[var(--color-church-gold)]">
                   <Landmark size={28} className="md:w-10 md:h-10" />
                   <h2 className="text-xl md:text-2xl font-bold">{isCop ? 'Ⲡⲓⲧⲣⲁⲡⲉⲍⲁ ⲛ̀ⲧⲉ ⲛⲓⲧⲁⲓⲟ' : lang === 'ar' ? 'بنك النقاط' : 'Points Bank'}</h2>
                </div>
                <p className="text-sm md:text-base text-blue-200 mb-6">{isCop ? 'Ϣⲉⲃⲓⲱ ⲛ̀ⲛⲉⲕⲧⲁⲓⲟ ⲉ̀ϩⲁⲛⲇⲱⲣⲟⲛ ⲛ̀ⲧⲁⲫⲙⲏⲓ ⲉ̀ⲃⲟⲗ ϧⲉⲛ ϯⲉⲕⲕⲗⲏⲥⲓⲁ.' : lang === 'ar' ? 'استخدم نقاطك للحصول على هدايا حقيقية من الكنيسة.' : 'Redeem your points for real rewards at church.'}</p>
                <div className="flex flex-col gap-3">
                   {REWARD_PRODUCTS.slice(0,2).map(prod => (
                     <button key={prod.id} onClick={() => setShowStore(true)} className="bg-white/10 hover:bg-white/20 px-4 py-3 md:px-5 md:py-4 rounded-xl flex justify-between font-bold items-center transition-colors md:text-lg">
                        <span>{prod.icon} {lang === 'ar' ? prod.titleAr : prod.title}</span>
                        <span className="flex items-center gap-2 bg-white/10 px-2 py-1 rounded text-sm">{prod.cost} pts <ChevronUp className={lang === 'ar' ? 'rotate-180' : 'rotate-90'} size={18}/></span>
                     </button>
                   ))}
                   <button onClick={() => setShowStore(true)} className="bg-[var(--color-church-gold)] text-[var(--color-church-blue)] hover:bg-[var(--color-church-gold-light)] px-4 py-3 md:px-5 md:py-4 rounded-xl font-bold shadow-md text-center mt-4 flex items-center justify-center gap-2 md:text-lg">
                      <Gift size={20} className="md:w-6 md:h-6" />
                      {isCop ? 'Ⲟⲩⲱⲛ ⲙ̀ⲡⲓⲙⲁⲛ̀ϣⲱⲡ ⲛ̀ⲧⲉ ⲛⲓⲧⲁⲓⲟ' : lang === 'ar' ? 'عرض متجر الهدايا' : 'Open Reward Store'}
                   </button>
                </div>
             </div>

             <div className="space-y-6 md:space-y-8">
               {/* All Time Best */}
               <div className="bg-white rounded-3xl p-6 md:p-8 shadow-sm border border-[var(--color-church-cream-dark)]">
                  <div className="flex items-center gap-3 mb-6">
                     <History size={24} className="text-[var(--color-church-blue)] md:w-8 md:h-8" />
                     <h2 className="text-xl md:text-2xl font-bold text-[var(--color-church-blue)]">{isCop ? 'Ⲡⲓⲛⲓϣϯ ⲛ̀ⲥⲏⲟⲩ ⲛⲓⲃⲉⲛ' : lang === 'ar' ? 'الأفضل على الإطلاق' : 'All-Time Best'}</h2>
                  </div>
                  <div className="grid grid-cols-2 gap-4">
                     <div className="bg-gray-50 p-4 md:p-6 rounded-2xl text-center">
                       <p className="text-3xl md:text-4xl font-bold text-[var(--color-church-burgundy)] mb-2">{userData.longestStreak}</p>
                       <p className="text-xs md:text-sm text-gray-500 font-bold uppercase">{isCop ? 'Ⲡⲓϩⲟⲩⲟ̀ ⲛ̀ⲉϩⲟⲟⲩ' : lang === 'ar' ? 'أطول سلسلة' : 'Longest Streak'}</p>
                     </div>
                     <div className="bg-gray-50 p-4 md:p-6 rounded-2xl text-center">
                       <p className="text-3xl md:text-4xl font-bold text-[var(--color-church-burgundy)] mb-2">45</p>
                       <p className="text-xs md:text-sm text-gray-500 font-bold uppercase">{isCop ? 'Ⲛⲓⲥⲃⲱ ⲉⲧϫⲏⲕ' : lang === 'ar' ? 'دروس مكتملة' : 'Lessons Done'}</p>
                     </div>
                  </div>
               </div>

               {/* Purchase History */}
               {purchases.length > 0 && (
                 <div className="bg-white rounded-3xl p-6 md:p-8 shadow-sm border border-[var(--color-church-cream-dark)]">
                    <h3 className="font-bold text-[var(--color-church-blue)] md:text-xl mb-4">{isCop ? 'Ⲛⲁϣⲱⲡ' : lang === 'ar' ? 'مشترياتي' : 'My Purchases'}</h3>
                    <div className="space-y-3">
                      {purchases.map((p, i) => (
                         <div key={i} className="flex justify-between items-center p-3 md:p-4 bg-gray-50 rounded-xl">
                            <div>
                               <p className="font-bold text-sm md:text-base text-gray-700">{p.itemName}</p>
                               <p className="text-xs md:text-sm text-gray-500">{new Date(p.createdAt).toLocaleDateString()}</p>
                            </div>
                            <span className="font-bold md:text-lg text-[var(--color-church-burgundy)]">-{p.cost} pts</span>
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
           <div className="fixed inset-0 z-[60] flex items-center justify-center p-4 bg-black/50 backdrop-blur-sm">
             <motion.div 
               initial={{ opacity: 0, scale: 0.9, y: 20 }}
               animate={{ opacity: 1, scale: 1, y: 0 }}
               exit={{ opacity: 0, scale: 0.9, y: 20 }}
               className="bg-white w-full max-w-lg md:max-w-2xl max-h-[80vh] overflow-y-auto rounded-3xl p-6 md:p-8 shadow-2xl relative"
             >
               <button onClick={() => setShowStore(false)} className="absolute top-4 right-4 text-gray-400 hover:text-gray-600 bg-gray-100 p-2 rounded-full">
                 <X size={20} />
               </button>
               <h2 className="text-2xl md:text-3xl font-bold text-[var(--color-church-blue)] mb-2 flex items-center gap-2">
                 <Gift size={24} className="text-[var(--color-church-gold)] md:w-8 md:h-8" />
                 {isCop ? 'Ⲡⲓⲙⲁⲛ̀ϣⲱⲡ ⲛ̀ⲧⲉ ⲛⲓⲧⲁⲓⲟ' : lang === 'ar' ? 'متجر الهدايا' : 'Reward Store'}
               </h2>
               <p className="text-gray-500 text-sm md:text-base mb-6 font-bold">
                 {isCop ? `Ⲡⲉⲕⲧⲁⲓⲟ ⲧⲛⲟⲩ: ${userData.points} ⲧⲁⲓⲟ` : lang === 'ar' ? `رصيدك الحالي: ${userData.points} نقطة` : `Your balance: ${userData.points} pts`}
               </p>

               <div className="grid grid-cols-2 md:grid-cols-3 gap-4">
                  {REWARD_PRODUCTS.map(prod => (
                    <div key={prod.id} className="border-2 border-gray-100 rounded-2xl p-4 text-center hover:border-[var(--color-church-gold)] transition-colors flex flex-col justify-between">
                       <div className="text-4xl md:text-5xl mb-3">{prod.icon}</div>
                       <h3 className="font-bold text-sm md:text-base text-[var(--color-church-blue)] mb-4">{lang === 'ar' ? prod.titleAr : prod.title}</h3>
                       <button 
                         onClick={() => setConfirmPurchaseItem({ id: prod.id, cost: prod.cost, name: lang === 'ar' ? prod.titleAr : prod.title })}
                         disabled={userData.points < prod.cost}
                         className={`w-full font-bold py-2 md:py-3 rounded-xl transition-colors mt-auto cursor-pointer ${
                           userData.points >= prod.cost 
                             ? 'bg-[var(--color-church-burgundy)] text-white hover:bg-red-800' 
                             : 'bg-gray-100 text-gray-400 cursor-not-allowed'
                         }`}
                       >
                         {prod.cost} pts
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
              className="bg-white rounded-3xl p-6 max-w-sm w-full shadow-2xl border border-[var(--color-church-cream-dark)] text-center space-y-4"
            >
              <div className="w-16 h-16 bg-amber-50 text-amber-600 rounded-full flex items-center justify-center mx-auto text-2xl">
                🎁
              </div>
              <h3 className="text-xl font-bold text-[var(--color-church-blue)]">
                {isCop ? 'Ⲧⲁϫⲣⲟ ⲙ̀ⲡⲓⲧⲱⲃϩ ⲛ̀ⲧⲁⲓⲟ' : lang === 'ar' ? 'تأكيد طلب الهدية' : 'Confirm Reward Request'}
              </h3>
              <p className="text-sm text-gray-600">
                {isCop
                  ? `Ⲭⲟⲩⲱϣ ⲉ̀ϣⲉⲃⲓⲱ ${confirmPurchaseItem.cost} ⲧⲁⲓⲟ ⲉ̀ "${confirmPurchaseItem.name}";`
                  : lang === 'ar' 
                  ? `هل ترغب في استبدال ${confirmPurchaseItem.cost} نقطة بـ "${confirmPurchaseItem.name}"؟` 
                  : `Redeem ${confirmPurchaseItem.cost} points for "${confirmPurchaseItem.name}"?`}
              </p>
              <div className="flex gap-3 pt-2">
                <button
                  onClick={() => setConfirmPurchaseItem(null)}
                  className="flex-1 py-2.5 rounded-xl border border-gray-200 text-gray-600 font-bold hover:bg-gray-50 transition-colors cursor-pointer"
                >
                  {isCop ? 'Ⲭⲱ ⲉ̀ⲃⲟⲗ' : lang === 'ar' ? 'إلغاء' : 'Cancel'}
                </button>
                <button
                  onClick={executePurchase}
                  className="flex-1 py-2.5 rounded-xl bg-[var(--color-church-burgundy)] text-white font-bold hover:bg-red-800 transition-colors cursor-pointer"
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
