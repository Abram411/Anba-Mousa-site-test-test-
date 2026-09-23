import React, { useState } from 'react';
import { Columns, AlignJustify, Type, Volume2, Bookmark, Check } from 'lucide-react';
import { CopticCard } from './CopticCard';
import { CopticBadge } from './CopticBadge';
import { CopticButton } from './CopticButton';

export interface TrilingualVerse {
  id: string;
  coptic: string;
  arabic: string;
  english: string;
  rubricEn?: string;
  rubricAr?: string;
  rubricCop?: string;
  audioTimestamp?: number;
}

export interface TrilingualReaderProps {
  titleEn: string;
  titleAr: string;
  titleCop: string;
  verses: TrilingualVerse[];
  currentAudioTime?: number;
  onPlayVerse?: (verse: TrilingualVerse) => void;
  showSacredFontDefault?: boolean;
}

export const TrilingualReader: React.FC<TrilingualReaderProps> = ({
  titleEn,
  titleAr,
  titleCop,
  verses,
  currentAudioTime = 0,
  onPlayVerse,
  showSacredFontDefault = true
}) => {
  const [layoutMode, setLayoutMode] = useState<'stacked' | 'parallel'>('stacked');
  const [useSacredFont, setUseSacredFont] = useState(showSacredFontDefault);
  const [fontSizeLevel, setFontSizeLevel] = useState<number>(1); // 0 = standard, 1 = medium, 2 = large

  const fontSizes = [
    { coptic: 'text-base sm:text-lg', arabic: 'text-sm sm:text-base', english: 'text-xs sm:text-sm' },
    { coptic: 'text-lg sm:text-xl', arabic: 'text-base sm:text-lg', english: 'text-sm sm:text-base' },
    { coptic: 'text-xl sm:text-2xl', arabic: 'text-lg sm:text-xl', english: 'text-base sm:text-lg' }
  ];

  const currentSize = fontSizes[fontSizeLevel];

  return (
    <div className="space-y-4">
      {/* Reader Controls Toolbar */}
      <div className="flex flex-wrap items-center justify-between gap-2 p-3 bg-[var(--surface-elevated)] border border-[var(--border-stone)] rounded-2xl">
        <div className="flex items-center gap-2">
          <CopticBadge variant="burgundy">Trilingual Reader</CopticBadge>
          <CopticBadge variant="gold">Bohairic Standard</CopticBadge>
        </div>

        <div className="flex items-center gap-1.5 flex-wrap">
          {/* Layout Toggle */}
          <div className="flex items-center bg-[var(--surface-card)] rounded-xl border border-[var(--border-stone)] p-0.5">
            <button
              onClick={() => setLayoutMode('stacked')}
              className={`p-1.5 rounded-lg text-xs font-bold transition-all cursor-pointer ${
                layoutMode === 'stacked'
                  ? 'bg-[var(--brand-burgundy)] text-white shadow-xs'
                  : 'text-[var(--text-ink)] hover:bg-[var(--surface-elevated)]'
              }`}
              title="Stacked View (Sequential)"
            >
              <AlignJustify size={15} />
            </button>
            <button
              onClick={() => setLayoutMode('parallel')}
              className={`p-1.5 rounded-lg text-xs font-bold transition-all cursor-pointer ${
                layoutMode === 'parallel'
                  ? 'bg-[var(--brand-burgundy)] text-white shadow-xs'
                  : 'text-[var(--text-ink)] hover:bg-[var(--surface-elevated)]'
              }`}
              title="Parallel View (Columns)"
            >
              <Columns size={15} />
            </button>
          </div>

          {/* Coptic Font Role Switcher: UI vs Sacred */}
          <button
            onClick={() => setUseSacredFont(!useSacredFont)}
            className={`flex items-center gap-1 text-xs px-2.5 py-1.5 rounded-xl border font-bold transition-all cursor-pointer ${
              useSacredFont
                ? 'bg-[var(--brand-gold)] text-white border-[var(--brand-gold-dark)] shadow-xs'
                : 'bg-[var(--surface-card)] text-[var(--text-ink)] border-[var(--border-stone)] hover:bg-[var(--surface-elevated)]'
            }`}
            title="Toggle Coptic Typography: Sacred Ecclesiastical vs Modern UI"
          >
            <Type size={14} />
            <span>{useSacredFont ? 'Sacred Font' : 'UI Font'}</span>
          </button>

          {/* Font Sizing Controls */}
          <div className="flex items-center bg-[var(--surface-card)] rounded-xl border border-[var(--border-stone)] p-0.5 text-xs font-bold">
            <button
              onClick={() => setFontSizeLevel(Math.max(0, fontSizeLevel - 1))}
              disabled={fontSizeLevel === 0}
              className="px-2 py-1 hover:bg-[var(--surface-elevated)] disabled:opacity-30 rounded-md cursor-pointer"
            >
              A-
            </button>
            <span className="px-1 text-[11px] text-[var(--color-neutral)]">Size</span>
            <button
              onClick={() => setFontSizeLevel(Math.min(2, fontSizeLevel + 1))}
              disabled={fontSizeLevel === 2}
              className="px-2 py-1 hover:bg-[var(--surface-elevated)] disabled:opacity-30 rounded-md cursor-pointer"
            >
              A+
            </button>
          </div>
        </div>
      </div>

      {/* Title Header */}
      <CopticCard variant="sacred" padding="sm" className="text-center">
        <h3 className={`text-xl font-bold text-[var(--brand-burgundy)] dark:text-[var(--brand-gold)] ${useSacredFont ? 'coptic-sacred' : 'coptic-ui'}`} dir="ltr">
          {titleCop}
        </h3>
        <p className="text-base font-bold text-[var(--text-ink)] arabic-ui mt-1" dir="rtl">
          {titleAr}
        </p>
        <p className="text-xs font-semibold text-[var(--color-neutral)] english-ui" dir="ltr">
          {titleEn}
        </p>
      </CopticCard>

      {/* Verses Container */}
      <div className="space-y-3">
        {verses.map((verse, index) => (
          <CopticCard
            key={verse.id || index}
            variant="default"
            padding="sm"
            className="hover:border-[var(--brand-gold)] transition-colors"
          >
            {layoutMode === 'stacked' ? (
              // STACKED TRILINGUAL FLOW
              <div className="space-y-2.5">
                {/* Verse Index & Audio Trigger */}
                <div className="flex items-center justify-between pb-1.5 border-b border-[var(--border-stone)]/50">
                  <span className="text-[11px] font-black text-[var(--brand-burgundy)] bg-[var(--surface-elevated)] px-2 py-0.5 rounded-md">
                    § {index + 1}
                  </span>
                  {onPlayVerse && (
                    <button
                      onClick={() => onPlayVerse(verse)}
                      className="text-xs text-[var(--brand-blue)] hover:text-[var(--brand-burgundy)] flex items-center gap-1 font-bold cursor-pointer"
                    >
                      <Volume2 size={14} />
                      <span>Ⲥⲱⲧⲉⲙ / Listen</span>
                    </button>
                  )}
                </div>

                {/* 1. Bohairic Coptic (Primary Sacred Text) */}
                <div
                  dir="ltr"
                  className={`text-[var(--brand-burgundy)] dark:text-[var(--brand-gold)] font-bold ${
                    useSacredFont ? 'coptic-sacred' : 'coptic-ui'
                  } ${currentSize.coptic}`}
                >
                  {verse.coptic}
                </div>

                {/* 2. Arabic Liturgical Translation */}
                <div
                  dir="rtl"
                  className={`text-[var(--text-ink)] font-semibold arabic-sacred ${currentSize.arabic}`}
                >
                  {verse.arabic}
                </div>

                {/* 3. English Liturgical Translation */}
                <div
                  dir="ltr"
                  className={`text-[var(--color-neutral)] english-ui font-medium ${currentSize.english}`}
                >
                  {verse.english}
                </div>
              </div>
            ) : (
              // PARALLEL COLUMNS FLOW
              <div className="grid grid-cols-1 md:grid-cols-3 gap-3 divide-y md:divide-y-0 md:divide-x md:divide-[var(--border-stone)]/60">
                {/* Coptic Column */}
                <div dir="ltr" className="pt-2 md:pt-0 pr-2">
                  <span className="text-[10px] font-black uppercase text-[var(--brand-gold-dark)] block mb-1">
                    Ϯⲁⲥⲡⲓ ⲛ̀ⲣⲉⲙⲛ̀ⲭⲏⲙⲓ
                  </span>
                  <div
                    className={`text-[var(--brand-burgundy)] dark:text-[var(--brand-gold)] font-bold ${
                      useSacredFont ? 'coptic-sacred' : 'coptic-ui'
                    } ${currentSize.coptic}`}
                  >
                    {verse.coptic}
                  </div>
                </div>

                {/* Arabic Column */}
                <div dir="rtl" className="pt-2 md:pt-0 px-0 md:px-2">
                  <span className="text-[10px] font-black uppercase text-[var(--brand-blue)] block mb-1">
                    الترجمة الكنسية
                  </span>
                  <div className={`text-[var(--text-ink)] font-semibold arabic-sacred ${currentSize.arabic}`}>
                    {verse.arabic}
                  </div>
                </div>

                {/* English Column */}
                <div dir="ltr" className="pt-2 md:pt-0 pl-0 md:pl-2">
                  <span className="text-[10px] font-black uppercase text-[var(--color-neutral)] block mb-1">
                    English Liturgical
                  </span>
                  <div className={`text-[var(--text-ink)] english-ui font-medium ${currentSize.english}`}>
                    {verse.english}
                  </div>
                </div>
              </div>
            )}
          </CopticCard>
        ))}
      </div>
    </div>
  );
};
