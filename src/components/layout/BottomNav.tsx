import React from 'react';
import { Home, Star, MessageCircle, User, Sparkles, Users } from 'lucide-react';
import { motion } from 'motion/react';
import { playSound } from '../../utils/audio';
import { mockLessons } from '../../data';
import { useLessons } from '../../context/LessonsContext';
import { Language } from '../../types';

interface BottomNavProps {
  activeTab: string;
  setActiveTab: (tab: string) => void;
  lang: Language;
  userRole?: string;
}

export function BottomNav({ activeTab, setActiveTab, lang, userRole }: BottomNavProps) {
  const { lessons } = useLessons();

  const currentLessons = lessons || mockLessons;
  const hasNewLessons = currentLessons.some(l => l.status === 'published' && !l.isCompleted);

  const isTeacher = userRole === 'teacher' || userRole === 'admin';
  const isParent = userRole === 'parent' || userRole === 'admin';

  const isCoptic = lang === 'copt' || lang === 'cop';

  const navItems = [
    { id: 'home', label: isCoptic ? 'Ⲡⲓⲏⲓ' : lang === 'ar' ? 'الرئيسية' : 'Home', icon: Home },
    { id: 'lessons', label: isCoptic ? 'Ⲛⲓⲥⲃⲱ' : lang === 'ar' ? 'الدروس' : 'Lessons', icon: Sparkles, hasBadge: hasNewLessons },
    { id: 'feed', label: isCoptic ? 'Ϯⲕⲟⲓⲛⲱⲛⲓⲁ' : lang === 'ar' ? 'المنشورات' : 'Feed', icon: MessageCircle },
    ...(isTeacher ? [{
      id: 'studio',
      label: isCoptic ? 'Ⲡⲓⲇⲓⲁⲕⲟⲛⲟⲥ' : lang === 'ar' ? 'الخادم' : 'Servant',
      icon: Users,
      highlight: true
    }] : []),
    ...(isParent && (!isTeacher || userRole === 'admin') ? [{
      id: 'family',
      label: isCoptic ? 'Ⲛⲓⲓⲟϯ' : lang === 'ar' ? 'الأهل' : 'Family',
      icon: Users,
      highlight: true
    }] : []),
    { id: 'points', label: isCoptic ? 'Ⲛⲓⲧⲁⲓⲟ' : lang === 'ar' ? 'النقاط' : 'Points', icon: Star },
    { id: 'profile', label: isCoptic ? 'Ⲡⲁⲣⲁⲛ' : lang === 'ar' ? 'حسابي' : 'Profile', icon: User },
  ];

  return (
    <nav className="fixed bottom-0 w-full bg-white dark:bg-slate-900 border-t border-[var(--color-church-cream-dark)] dark:border-slate-800 pb-safe shadow-[0_-4px_20px_-10px_rgba(0,0,0,0.1)] z-50">
      <div className="flex justify-around items-center h-16 sm:h-20 max-w-lg md:max-w-4xl lg:max-w-6xl mx-auto px-0.5 sm:px-4 md:px-6 relative overflow-x-auto scrollbar-none">
        {navItems.map((item) => {
          const Icon = item.icon;
          const isActive = activeTab === item.id;
          return (
            <button
              key={item.id}
              onClick={() => { playSound('click'); setActiveTab(item.id); }}
              className={`flex flex-col items-center justify-center flex-1 min-w-[48px] h-full relative z-10 transition-colors cursor-pointer px-0.5 ${
                isActive 
                  ? 'text-[var(--color-church-blue)] dark:text-amber-300' 
                  : item.highlight 
                    ? 'text-amber-700 dark:text-amber-400 hover:text-amber-900' 
                    : 'text-gray-400 dark:text-gray-500 hover:text-gray-600 dark:hover:text-gray-300'
              }`}
            >
              {isActive && (
                <>
                  {/* Glowing Yellow Strip hovering over the open tab only */}
                  <motion.div 
                    layoutId="bottom-nav-indicator"
                    className="absolute top-0 inset-x-2 sm:inset-x-3.5 h-[3.5px] bg-gradient-to-r from-amber-400 via-amber-300 to-amber-400 rounded-b-full shadow-[0_0_12px_rgba(245,158,11,0.95),0_2px_8px_rgba(245,158,11,0.7)] z-30 pointer-events-none"
                    transition={{ type: "spring", stiffness: 380, damping: 28 }}
                  />
                  {/* Subtle warm golden ambient glow radiating down from the strip on the open tab */}
                  <motion.div 
                    layoutId="bottom-nav-active-glow"
                    className="absolute top-0 inset-x-1 h-6 bg-gradient-to-b from-amber-400/20 via-amber-300/5 to-transparent rounded-t-lg pointer-events-none -z-0"
                    transition={{ type: "spring", stiffness: 380, damping: 28 }}
                  />
                </>
              )}
              
              <div className="relative">
                <motion.div 
                  animate={isActive ? { y: -2, scale: 1.1 } : { y: 0, scale: 1 }}
                  className={`p-1 sm:p-1.5 rounded-full ${
                    isActive 
                      ? 'bg-amber-100/60 dark:bg-amber-950/60' 
                      : item.highlight 
                        ? 'bg-amber-50/80 dark:bg-slate-800' 
                        : ''
                  }`}
                >
                  <Icon 
                    size={20} 
                    strokeWidth={isActive ? 2.5 : 2} 
                    className={`sm:w-5 sm:h-5 ${
                      isActive 
                        ? 'text-[var(--color-church-blue)] dark:text-amber-300' 
                        : item.highlight 
                          ? 'text-amber-600 dark:text-amber-400' 
                          : ''
                    }`} 
                  />
                </motion.div>
                {item.hasBadge && (
                  <span className="absolute top-1 right-1 w-2 h-2 sm:w-2.5 sm:h-2.5 bg-red-500 rounded-full border-2 border-white dark:border-slate-900 shadow-xs" />
                )}
              </div>
              
              <motion.span 
                animate={isActive ? { y: 0, opacity: 1 } : { y: 1, opacity: 0.85 }}
                className={`text-[9px] sm:text-[10px] md:text-xs mt-0.5 font-bold tracking-tight truncate max-w-full ${
                  isActive 
                    ? 'text-[var(--color-church-blue)] dark:text-amber-300' 
                    : item.highlight 
                      ? 'text-amber-700 dark:text-amber-400 font-extrabold' 
                      : ''
                }`}
              >
                {item.label}
              </motion.span>
            </button>
          );
        })}
      </div>
    </nav>
  );
}

