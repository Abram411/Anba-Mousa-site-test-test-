import React, { useState, useRef, useEffect } from 'react';
import { Bell, Globe, Cross, X, Sun, Moon, Calendar, Music, BookOpen, Check, Palette, ShieldCheck } from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';
import { PWAInstallButton } from './PWAInstallButton';
import { useTheme } from '../../context/ThemeContext';
import { Language } from '../../types';
import { LANGUAGE_OPTIONS } from '../../lib/i18n';
import { t } from '../../localization/i18n';

interface TopBarProps {
  lang: Language;
  setLang: (l: Language) => void;
  onHomeClick?: () => void;
  onNavigate?: (tab: string) => void;
  activeTab?: string;
}

export function TopBar({ 
  lang, 
  setLang,
  onHomeClick,
  onNavigate,
  activeTab
}: TopBarProps) {
  const [showNotifs, setShowNotifs] = useState(false);
  const [showLangMenu, setShowLangMenu] = useState(false);
  const langMenuRef = useRef<HTMLDivElement>(null);
  const { theme, toggleTheme } = useTheme();

  // Close menus when clicking outside
  useEffect(() => {
    function handleClickOutside(e: MouseEvent) {
      if (langMenuRef.current && !langMenuRef.current.contains(e.target as Node)) {
        setShowLangMenu(false);
      }
    }
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  const churchNameDisplay = lang === 'copt' 
    ? 'Ϯⲉⲕⲕⲗⲏⲥⲓⲁ Ⲙⲱⲩⲥⲏⲥ' 
    : lang === 'ar' 
      ? 'كنيسة الأنبا موسى' 
      : 'St. Musa Church';

  return (
    <div className="bg-[var(--color-church-burgundy)] text-white shadow-md sticky top-0 z-50 md:rounded-b-none border-b border-white/10">
      <div className="max-w-7xl mx-auto flex justify-between items-center p-2.5 sm:p-4 px-2 sm:px-4 gap-2">
        
        {/* Church Brand */}
        <div 
          onClick={onHomeClick}
          className="flex items-center gap-2 font-bold text-base sm:text-lg cursor-pointer shrink-0 hover:opacity-90 transition-opacity"
        >
          <Cross size={22} fill="currentColor" className="text-[var(--color-church-gold)] shrink-0" />
          <span className="hidden xs:inline">{churchNameDisplay}</span>
          <span className="xs:hidden">{lang === 'copt' ? 'Ⲙⲱⲩⲥⲏⲥ' : lang === 'ar' ? 'الأنبا موسى' : 'St. Musa'}</span>
        </div>

        {/* Center Quick Navigation (Calendar, Hymns School, Agpeya, Design System) - Desktop View */}
        {onNavigate && (
          <div className="hidden md:flex items-center gap-1.5 bg-black/25 p-1 rounded-2xl border border-white/10 shadow-xs">
            <button
              onClick={() => onNavigate('calendar')}
              className={`flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-bold transition-all cursor-pointer ${
                activeTab === 'calendar'
                  ? 'bg-[var(--color-church-gold)] text-[var(--color-church-blue)] shadow-xs font-black'
                  : 'text-white/85 hover:text-white hover:bg-white/10'
              }`}
            >
              <Calendar size={15} />
              <span>{lang === 'copt' || lang === 'cop' ? 'Ⲡⲓⲥⲩⲛⲁⲝⲁⲣⲓⲟⲛ' : lang === 'ar' ? 'التقويم والسنكسار' : 'Coptic Calendar'}</span>
            </button>

            <button
              onClick={() => onNavigate('hymns')}
              className={`flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-bold transition-all cursor-pointer ${
                activeTab === 'hymns'
                  ? 'bg-[var(--color-church-gold)] text-[var(--color-church-blue)] shadow-xs font-black'
                  : 'text-white/85 hover:text-white hover:bg-white/10'
              }`}
            >
              <Music size={15} />
              <span>{lang === 'copt' || lang === 'cop' ? 'Ⲛⲓϩⲱⲥ' : lang === 'ar' ? 'مدرسة الألحان' : 'Hymns School'}</span>
            </button>

            <button
              onClick={() => onNavigate('agpeya')}
              className={`flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-bold transition-all cursor-pointer ${
                activeTab === 'agpeya'
                  ? 'bg-[var(--color-church-gold)] text-[var(--color-church-blue)] shadow-xs font-black'
                  : 'text-white/85 hover:text-white hover:bg-white/10'
              }`}
            >
              <BookOpen size={15} />
              <span>{lang === 'copt' || lang === 'cop' ? 'Ϯⲁϫⲡⲓⲁ' : lang === 'ar' ? 'صلوات الأجبية' : 'Daily Agpeya'}</span>
            </button>

            <button
              onClick={() => onNavigate('designSystem')}
              className={`flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-bold transition-all cursor-pointer ${
                activeTab === 'designSystem'
                  ? 'bg-[var(--color-church-gold)] text-[var(--color-church-blue)] shadow-xs font-black'
                  : 'text-white/85 hover:text-white hover:bg-white/10'
              }`}
              title="Design System & Typography Laboratory"
            >
              <Palette size={15} />
              <span>{lang === 'copt' || lang === 'cop' ? 'Ⲡⲓⲥⲙⲟⲧ' : lang === 'ar' ? 'نظام التصميم' : 'Design System'}</span>
            </button>

            <button
              onClick={() => onNavigate('localizationQa')}
              className={`flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-bold transition-all cursor-pointer ${
                activeTab === 'localizationQa'
                  ? 'bg-[var(--color-church-gold)] text-[var(--color-church-blue)] shadow-xs font-black'
                  : 'text-white/85 hover:text-white hover:bg-white/10'
              }`}
              title="Bohairic Coptic Localization QA & Review Dashboard"
            >
              <ShieldCheck size={15} />
              <span>{lang === 'copt' || lang === 'cop' ? 'Ⲡⲓϫⲱⲕ' : lang === 'ar' ? 'جودة الترجمة' : 'Coptic QA'}</span>
            </button>
          </div>
        )}

        {/* Right Controls: Theme Toggle, Language, Notifications, PWA */}
        <div className="flex gap-1.5 sm:gap-2.5 items-center">
          {/* Dark / Light Church Aesthetic Toggle */}
          <button
            onClick={toggleTheme}
            aria-label="Toggle Theme"
            title={theme === 'dark' ? (lang === 'copt' || lang === 'cop' ? 'Ⲡⲓⲟⲩⲱⲓⲛⲓ' : lang === 'ar' ? 'الوضع النهاري الكنسي' : 'Light Church Theme') : (lang === 'copt' || lang === 'cop' ? 'Ⲡⲓⲉ̀ϫⲱⲣϩ' : lang === 'ar' ? 'الوضع الليلي الهادئ' : 'Dark Church Theme')}
            className="p-2 rounded-xl bg-white/15 hover:bg-white/25 text-amber-300 hover:text-amber-200 transition-colors cursor-pointer"
          >
            {theme === 'dark' ? <Sun size={17} /> : <Moon size={17} />}
          </button>

          <PWAInstallButton />
          
          {/* Language Switcher Popover with Arabic, English, and Bohairic Church Coptic */}
          <div className="relative" ref={langMenuRef}>
            <button 
              onClick={() => setShowLangMenu(!showLangMenu)} 
              className="flex items-center gap-1.5 text-xs sm:text-sm bg-white/20 hover:bg-white/30 px-2.5 sm:px-3 py-1.5 rounded-xl font-bold transition-all cursor-pointer border border-white/15 shadow-xs"
              title="Language / Ϯⲁⲥⲡⲓ / اللغة"
            >
              <Globe size={15} className="text-[var(--color-church-gold-light)]" /> 
              <span className="tracking-wide">
                {lang === 'copt' || lang === 'cop' ? '☥ Ⲙⲉⲑⲣⲉⲙⲛ̀ⲭⲏⲙⲓ' : lang === 'ar' ? '🇪🇬 عربي' : '🌐 English'}
              </span>
            </button>

            <AnimatePresence>
              {showLangMenu && (
                <motion.div
                  initial={{ opacity: 0, y: -8, scale: 0.96 }}
                  animate={{ opacity: 1, y: 0, scale: 1 }}
                  exit={{ opacity: 0, y: -8, scale: 0.96 }}
                  transition={{ duration: 0.15 }}
                  className={`absolute ${lang === 'ar' ? 'left-0' : 'right-0'} mt-2 w-72 bg-white dark:bg-[#28211C] rounded-2xl shadow-2xl border border-[var(--border-stone)] p-2 z-50 text-[var(--text-ink)] overflow-hidden`}
                >
                  <div className="px-3 py-2 border-b border-[var(--border-stone)]/50">
                    <p className="text-[11px] font-extrabold text-[var(--brand-burgundy)] dark:text-[var(--brand-gold)] uppercase tracking-wider flex items-center gap-1.5">
                      <Globe size={12} />
                      <span>{lang === 'copt' || lang === 'cop' ? 'Ⲥⲱⲧⲡ ⲛ̀ϯⲁⲥⲡⲓ' : lang === 'ar' ? 'اختر لغة الكنيسة' : 'Select Liturgical Language'}</span>
                    </p>
                  </div>

                  <div className="py-1 space-y-1">
                    {LANGUAGE_OPTIONS.map((opt) => {
                      const isSelected = lang === opt.code || (opt.code === 'cop' && lang === 'copt');
                      return (
                        <button
                          key={opt.code}
                          onClick={() => {
                            setLang(opt.code);
                            setShowLangMenu(false);
                          }}
                          className={`w-full flex items-center justify-between px-3 py-2 rounded-xl text-xs transition-all cursor-pointer text-start ${
                            isSelected
                              ? 'bg-[var(--brand-burgundy)] text-white font-bold shadow-xs'
                              : 'hover:bg-[var(--surface-elevated)] text-[var(--text-ink)]'
                          }`}
                        >
                          <div className="flex items-center gap-2.5">
                            <span className="text-base">{opt.flagSymbol}</span>
                            <div>
                              <p className="font-bold text-xs">{opt.label}</p>
                              <p className={`text-[10px] ${isSelected ? 'text-white/80' : 'text-[var(--color-neutral)]'}`}>
                                {opt.churchDialect}
                              </p>
                            </div>
                          </div>
                          {isSelected && (
                            <Check size={14} className="text-[var(--brand-gold)] shrink-0 font-black" />
                          )}
                        </button>
                      );
                    })}
                  </div>
                </motion.div>
              )}
            </AnimatePresence>
          </div>

          {/* Notifications */}
          <div className="relative">
            <button 
              onClick={() => setShowNotifs(!showNotifs)} 
              className="relative p-1.5 hover:text-[var(--color-church-gold)] transition-colors cursor-pointer"
            >
              <Bell size={20} />
              <span className="absolute top-0.5 right-0.5 bg-[var(--color-church-gold)] text-[var(--color-church-blue)] text-[10px] font-bold w-4 h-4 rounded-full flex items-center justify-center">2</span>
            </button>

            <AnimatePresence>
              {showNotifs && (
                <motion.div 
                  initial={{ opacity: 0, y: -10, scale: 0.95 }}
                  animate={{ opacity: 1, y: 0, scale: 1 }}
                  exit={{ opacity: 0, y: -10, scale: 0.95 }}
                  transition={{ type: 'spring', bounce: 0.4 }}
                  className={`absolute ${lang === 'ar' ? 'left-0 origin-top-left' : 'right-0 origin-top-right'} mt-3 w-72 bg-white dark:bg-slate-900 rounded-3xl shadow-2xl border border-[var(--color-church-cream-dark)] dark:border-slate-800 p-2 text-gray-800 dark:text-gray-100 z-50 overflow-hidden text-start`}
                >
                  <div className="p-3 border-b border-gray-100 dark:border-slate-800 font-bold text-sm text-[var(--color-church-blue)] dark:text-amber-200 flex justify-between items-center">
                    <span>{lang === 'copt' ? 'Ⲛⲓⲧⲁⲙⲟ ⲛ̀ⲧⲉ ϯⲉⲕⲕⲗⲏⲥⲓⲁ' : lang === 'ar' ? 'الإشعارات الكنسية' : 'Church Notifications'}</span>
                    <button onClick={() => setShowNotifs(false)} className="text-gray-400 hover:text-[var(--color-church-burgundy)] bg-gray-50 dark:bg-slate-800 rounded-full p-1 cursor-pointer"><X size={14} /></button>
                  </div>
                  <div className="p-3 text-xs border-b border-gray-50 dark:border-slate-800 flex gap-3 items-center hover:bg-gray-50 dark:hover:bg-slate-800 transition-colors cursor-pointer">
                    <div className="bg-yellow-100 dark:bg-yellow-950 p-2 rounded-full text-yellow-600 text-lg shrink-0">⭐</div>
                    <div>
                      <p className="font-bold text-[var(--color-church-blue)] dark:text-amber-200">
                        {lang === 'copt' ? 'Ⲟⲩⲕⲗⲟⲙ ⲙ̀ⲃⲉⲣⲓ!' : lang === 'ar' ? 'وسام جديد متاح!' : 'Badge Unlocked!'}
                      </p>
                      <p className="text-gray-500 dark:text-gray-400">
                        {lang === 'copt' ? 'Ⲡⲓⲡⲓⲥⲧⲟⲥ ϧⲉⲛ ⲡⲓⲛⲁϩϯ' : lang === 'ar' ? 'باحث مخلص في الإيمان' : 'Faithful Seeker in Faith'}
                      </p>
                    </div>
                  </div>
                  <div className="p-3 text-xs flex gap-3 items-center hover:bg-gray-50 dark:hover:bg-slate-800 transition-colors cursor-pointer">
                    <div className="bg-blue-100 dark:bg-blue-950 p-2 rounded-full text-blue-600 text-lg shrink-0">📖</div>
                    <div>
                      <p className="font-bold text-[var(--color-church-blue)] dark:text-amber-200">
                        {lang === 'copt' ? 'Ⲟⲩⲥⲃⲱ ⲙ̀ⲃⲉⲣⲓ ⲛ̀ⲧⲉ ϯⲕⲩⲣⲓⲁⲕⲏ' : lang === 'ar' ? 'درس جديد لمدارس الأحد' : 'New Sunday School Lesson'}
                      </p>
                      <p className="text-gray-500 dark:text-gray-400">
                        {lang === 'copt' ? 'Ⲫⲁⲅⲓⲟⲥ Ⲙⲏⲛⲁ ⲡⲓⲑⲁⲩⲙⲁⲧⲟⲩⲣⲅⲟⲥ' : lang === 'ar' ? 'قصة القديس مارمينا العجائبي' : 'St. Mina Wonderworker'}
                      </p>
                    </div>
                  </div>
                </motion.div>
              )}
            </AnimatePresence>
          </div>
        </div>
      </div>

      {/* Mobile Top Bar Quick Sub-row for Calendar, Hymns, Agpeya */}
      {onNavigate && (
        <div className="md:hidden flex items-center justify-around px-2 py-1.5 bg-black/20 border-t border-white/10 text-xs font-bold overflow-x-auto scrollbar-none">
          <button
            onClick={() => onNavigate('calendar')}
            className={`flex items-center gap-1.5 px-3 py-1 rounded-xl transition-all cursor-pointer shrink-0 ${
              activeTab === 'calendar'
                ? 'bg-[var(--color-church-gold)] text-[var(--color-church-blue)] shadow-xs font-black'
                : 'text-white/80 hover:text-white'
            }`}
          >
            <Calendar size={13} />
            <span>{lang === 'copt' ? 'Ⲡⲓⲥⲩⲛⲁⲝⲁⲣⲓⲟⲛ' : lang === 'ar' ? 'التقويم والسنكسار' : 'Calendar'}</span>
          </button>

          <button
            onClick={() => onNavigate('hymns')}
            className={`flex items-center gap-1.5 px-3 py-1 rounded-xl transition-all cursor-pointer shrink-0 ${
              activeTab === 'hymns'
                ? 'bg-[var(--color-church-gold)] text-[var(--color-church-blue)] shadow-xs font-black'
                : 'text-white/80 hover:text-white'
            }`}
          >
            <Music size={13} />
            <span>{lang === 'copt' ? 'Ⲛⲓϩⲱⲥ' : lang === 'ar' ? 'الألحان' : 'Hymns'}</span>
          </button>

          <button
            onClick={() => onNavigate('agpeya')}
            className={`flex items-center gap-1.5 px-3 py-1 rounded-xl transition-all cursor-pointer shrink-0 ${
              activeTab === 'agpeya'
                ? 'bg-[var(--color-church-gold)] text-[var(--color-church-blue)] shadow-xs font-black'
                : 'text-white/80 hover:text-white'
            }`}
          >
            <BookOpen size={13} />
            <span>{lang === 'copt' ? 'Ϯⲁϫⲡⲓⲁ' : lang === 'ar' ? 'الأجبية' : 'Agpeya'}</span>
          </button>
        </div>
      )}
    </div>
  );
}
