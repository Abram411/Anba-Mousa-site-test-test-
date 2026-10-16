import React from 'react';
import { Home, Trophy, MessageCircle, User, Sparkles, Users } from 'lucide-react';
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

  const navItems = [
    { id: 'home', label: lang === 'ar' ? 'الرئيسية' : 'Home', icon: Home },
    { id: 'lessons', label: lang === 'ar' ? 'الدروس' : 'Lessons', icon: Sparkles, hasBadge: hasNewLessons },
    { id: 'feed', label: lang === 'ar' ? 'المنشورات' : 'Feed', icon: MessageCircle },
    ...(isTeacher ? [{
      id: 'studio',
      label: lang === 'ar' ? 'الخادم' : 'Servant',
      icon: Users,
      highlight: true
    }] : []),
    ...(isParent && (!isTeacher || userRole === 'admin') ? [{
      id: 'family',
      label: lang === 'ar' ? 'الأهل' : 'Family',
      icon: Users,
      highlight: true
    }] : []),
    { id: 'points', label: lang === 'ar' ? 'الترتيب' : 'Ranking', icon: Trophy },
    { id: 'profile', label: lang === 'ar' ? 'حسابي' : 'Profile', icon: User },
  ];

  return (
    <nav className="fixed bottom-0 w-full bg-[var(--mousa-cream-surface)] dark:bg-[#1C1712] border-t-2 border-[var(--mousa-border-sand)] dark:border-[#3A3026] pb-safe shadow-[0_-4px_25px_-8px_rgba(40,30,20,0.15)] z-50 transition-colors">
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
                  ? 'text-[var(--mousa-teal-deep)] dark:text-[var(--mousa-gold-glow)] font-black' 
                  : item.highlight 
                    ? 'text-[var(--mousa-coral-dark)] dark:text-[var(--mousa-coral-glow)] hover:opacity-100 font-bold' 
                    : 'text-[var(--mousa-sand-500)] dark:text-[var(--mousa-sand-400)] hover:text-[var(--mousa-teal)] dark:hover:text-[#FAF5EB]'
              }`}
            >
              {isActive && (
                <>
                  {/* Glowing Moses Gold & Sunrise Coral Strip hovering over the open tab */}
                  <motion.div 
                    layoutId="bottom-nav-indicator"
                    className="absolute top-0 inset-x-2 sm:inset-x-3.5 h-[3.5px] bg-gradient-to-r from-[var(--mousa-gold)] via-[var(--mousa-coral-glow)] to-[var(--mousa-gold)] rounded-b-full shadow-[0_0_12px_rgba(198,139,35,0.85),0_2px_8px_rgba(217,93,57,0.5)] z-30 pointer-events-none"
                    transition={{ type: "spring", stiffness: 380, damping: 28 }}
                  />
                  {/* Subtle warm desert sunrise glow radiating down from the strip */}
                  <motion.div 
                    layoutId="bottom-nav-active-glow"
                    className="absolute top-0 inset-x-1 h-6 bg-gradient-to-b from-[var(--mousa-gold)]/20 via-[var(--mousa-coral)]/5 to-transparent rounded-t-lg pointer-events-none -z-0"
                    transition={{ type: "spring", stiffness: 380, damping: 28 }}
                  />
                </>
              )}
              
              <div className="relative">
                <motion.div 
                  animate={isActive ? { y: -2, scale: 1.1 } : { y: 0, scale: 1 }}
                  className={`p-1 sm:p-1.5 rounded-full transition-colors ${
                    isActive 
                      ? 'bg-[var(--mousa-gold)]/20 dark:bg-[var(--mousa-gold)]/25 text-[var(--mousa-teal-deep)] dark:text-[var(--mousa-gold-glow)]' 
                      : item.highlight 
                        ? 'bg-[var(--mousa-coral-soft)] dark:bg-[#2A1D17]' 
                        : ''
                  }`}
                >
                  <Icon 
                    size={20} 
                    strokeWidth={isActive ? 2.5 : 2} 
                    className={`sm:w-5 sm:h-5 ${
                      isActive 
                        ? 'text-[var(--mousa-teal-deep)] dark:text-[var(--mousa-gold-glow)]' 
                        : item.highlight 
                          ? 'text-[var(--mousa-coral)] dark:text-[var(--mousa-coral-glow)]' 
                          : ''
                    }`} 
                  />
                </motion.div>
                {item.hasBadge && (
                  <span className="absolute top-1 right-1 w-2 h-2 sm:w-2.5 sm:h-2.5 bg-[var(--mousa-coral)] rounded-full border-2 border-white dark:border-[#1C1712] shadow-xs" />
                )}
              </div>
              
              <motion.span 
                animate={isActive ? { y: 0, opacity: 1 } : { y: 1, opacity: 0.85 }}
                className={`text-[9px] sm:text-[10px] md:text-xs mt-0.5 font-bold tracking-tight truncate max-w-full ${
                  isActive 
                    ? 'text-[var(--mousa-teal-deep)] dark:text-[var(--mousa-gold-glow)]' 
                    : item.highlight 
                      ? 'text-[var(--mousa-coral-dark)] dark:text-[var(--mousa-coral-glow)] font-extrabold' 
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
