import React from 'react';
import { Cross, BookOpen, Heart, Shield, Sparkles, CheckCircle2 } from 'lucide-react';
import { Language } from '../../types';
import { CopticCard } from './CopticCard';
import { CopticBadge } from './CopticBadge';

interface BrandGuidelinesPageProps {
  lang: Language;
}

export const BrandGuidelinesPage: React.FC<BrandGuidelinesPageProps> = ({ lang }) => {
  return (
    <div className="max-w-5xl mx-auto px-4 py-6 space-y-6">
      {/* Brand Header */}
      <div className="bg-[var(--brand-burgundy)] text-white p-6 rounded-3xl shadow-md border border-[var(--brand-burgundy-dark)]">
        <div className="flex items-center gap-3 mb-2">
          <div className="w-12 h-12 rounded-2xl bg-white/10 flex items-center justify-center border border-white/20">
            <Cross size={26} className="text-[var(--brand-gold)]" />
          </div>
          <div>
            <h1 className="text-2xl sm:text-3xl font-black">
              Coptic Orthodox Brand & Visual Identity
            </h1>
            <p className="text-xs uppercase tracking-widest text-[var(--brand-gold)] font-bold">
              Official Style & Engineering Standard
            </p>
          </div>
        </div>
        <p className="text-sm text-white/85 max-w-2xl mt-2 leading-relaxed">
          The visual identity of St. Moses Coptic Orthodox Church reflects two millennia of unbroken apostolic tradition, reverent liturgical worship, warm pastoral hospitality, and modern educational excellence.
        </p>
      </div>

      {/* Brand Pillars */}
      <div>
        <h2 className="text-lg font-bold text-[var(--brand-burgundy)] dark:text-[var(--brand-gold)] mb-3">
          1. Core Brand Attributes
        </h2>
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
          {[
            {
              title: 'Coptic Orthodox & Apostolic',
              desc: 'Grounded in Alexandria, St. Mark the Evangelist, the Desert Fathers, and the ecumenical councils.',
              icon: <Cross className="text-[var(--brand-burgundy)] dark:text-[var(--brand-gold)]" size={20} />
            },
            {
              title: 'Reverent & Timeless',
              desc: 'Avoiding transient web fads or neon gradients; maintaining dignity, sacred stillness, and awe.',
              icon: <Shield className="text-[var(--brand-blue)]" size={20} />
            },
            {
              title: 'Trilingual by Design',
              desc: 'English, Arabic, and Bohairic Coptic treated as co-equal first-class languages across all interfaces.',
              icon: <BookOpen className="text-[var(--brand-gold-dark)] dark:text-[var(--brand-gold)]" size={20} />
            },
            {
              title: 'Warm & Pastoral',
              desc: 'Warm ivory canvas, gentle parchment highlights, welcoming parents, servants, and children.',
              icon: <Heart className="text-[var(--color-danger)]" size={20} />
            },
            {
              title: 'Ecclesiastical Precision',
              desc: 'Authentic Unicode Bohairic Coptic texts verified against the euchologion, synaxarium, and psalmodia.',
              icon: <Sparkles className="text-[var(--brand-burgundy)] dark:text-[var(--brand-gold)]" size={20} />
            },
            {
              title: 'Accessible & Inclusive',
              desc: 'Compliant with WCAG AA standards, generous touch targets (≥44px), and clear focus indicators.',
              icon: <CheckCircle2 className="text-[var(--color-success)]" size={20} />
            }
          ].map((pillar, idx) => (
            <CopticCard key={idx} variant="default" padding="sm">
              <div className="flex items-center gap-2 mb-1.5">
                {pillar.icon}
                <h3 className="text-sm font-bold text-[var(--text-ink)]">{pillar.title}</h3>
              </div>
              <p className="text-xs text-[var(--color-neutral)] leading-relaxed">{pillar.desc}</p>
            </CopticCard>
          ))}
        </div>
      </div>

      {/* Liturgical Color Palette & Significance */}
      <CopticCard variant="sacred" padding="md">
        <h2 className="text-lg font-bold text-[var(--brand-burgundy)] dark:text-[var(--brand-gold)] mb-2">
          2. Liturgical Color Symbolism
        </h2>
        <p className="text-xs text-[var(--color-neutral)] mb-4">
          Every token in the palette has profound theological and historical significance in Coptic tradition.
        </p>

        <div className="space-y-3">
          <div className="flex items-start gap-3 p-3 bg-[var(--surface-elevated)] rounded-xl border border-[var(--border-stone)]">
            <div className="w-8 h-8 rounded-lg bg-[#6F1D2A] shrink-0 border border-black/20" />
            <div>
              <div className="flex items-center gap-2">
                <span className="text-xs font-bold text-[var(--text-ink)]">Deep Burgundy (#6F1D2A)</span>
                <CopticBadge variant="burgundy" size="sm">Primary</CopticBadge>
              </div>
              <p className="text-xs text-[var(--color-neutral)] mt-0.5">
                Represents the precious Blood of Christ, the vestments of Holy Pascha, and the crown of Coptic martyrdom.
              </p>
            </div>
          </div>

          <div className="flex items-start gap-3 p-3 bg-[var(--surface-elevated)] rounded-xl border border-[var(--border-stone)]">
            <div className="w-8 h-8 rounded-lg bg-[#B58A3A] shrink-0 border border-black/20" />
            <div>
              <div className="flex items-center gap-2">
                <span className="text-xs font-bold text-[var(--text-ink)]">Antique Gold (#B58A3A)</span>
                <CopticBadge variant="gold" size="sm">Sacred Accent</CopticBadge>
              </div>
              <p className="text-xs text-[var(--color-neutral)] mt-0.5">
                Represents divine majesty, the Resurrection, eternal life, and the celestial glory of Coptic iconography.
              </p>
            </div>
          </div>

          <div className="flex items-start gap-3 p-3 bg-[var(--surface-elevated)] rounded-xl border border-[var(--border-stone)]">
            <div className="w-8 h-8 rounded-lg bg-[#0B2E5C] shrink-0 border border-black/20" />
            <div>
              <div className="flex items-center gap-2">
                <span className="text-xs font-bold text-[var(--text-ink)]">Church Blue (#0B2E5C)</span>
                <CopticBadge variant="blue" size="sm">Secondary</CopticBadge>
              </div>
              <p className="text-xs text-[var(--color-neutral)] mt-0.5">
                Evoking the heavenly skies, the Virgin Mary's mantle, and the Nile waters of Egypt.
              </p>
            </div>
          </div>

          <div className="flex items-start gap-3 p-3 bg-[var(--surface-elevated)] rounded-xl border border-[var(--border-stone)]">
            <div className="w-8 h-8 rounded-lg bg-[#F7F2E8] shrink-0 border border-black/20" />
            <div>
              <div className="flex items-center gap-2">
                <span className="text-xs font-bold text-[var(--text-ink)]">Warm Ivory (#F7F2E8)</span>
                <CopticBadge variant="neutral" size="sm">Canvas</CopticBadge>
              </div>
              <p className="text-xs text-[var(--color-neutral)] mt-0.5">
                The hue of ancient papyrus, clean monk tunics, and church marble sanctuaries, avoiding sterile high-glare whites.
              </p>
            </div>
          </div>
        </div>
      </CopticCard>

      {/* Liturgical Seasons Guide */}
      <CopticCard variant="default" padding="md">
        <h2 className="text-lg font-bold text-[var(--brand-burgundy)] dark:text-[var(--brand-gold)] mb-3">
          3. Dynamic Liturgical Seasons
        </h2>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
          {[
            { name: 'Annual Days (Ⲡⲓⲥⲙⲟⲧ ⲛ̀ⲧⲉ ϯⲣⲟⲙⲡⲓ)', season: 'Standard', color: 'Burgundy & Ivory' },
            { name: 'Month of Kiahk (Ⲭⲟⲓⲁⲕ)', season: 'Theotokia praises', color: 'Blue & Gold' },
            { name: 'Holy Great Fast (Great Lent)', season: 'Repentance & Prostrations', color: 'Deep Burgundy & Stone' },
            { name: 'Holy Week (Ⲡⲓⲡⲁⲥⲭⲁ)', season: 'Paschal Mourning', color: 'Black & Deep Burgundy' },
            { name: 'Holy Paschal Resurrection (Ⲡⲓⲧⲱⲟⲩⲛ)', season: '50 Joyous Days', color: 'Brilliant Gold & White' },
            { name: 'Apostles Fast & Dormition', season: 'Ministry & Fasting', color: 'Heritage Blue' }
          ].map((s, i) => (
            <div key={i} className="p-3 bg-[var(--surface-elevated)] rounded-xl border border-[var(--border-stone)]">
              <span className="text-xs font-bold text-[var(--brand-burgundy)] dark:text-[var(--brand-gold)] block">
                {s.name}
              </span>
              <span className="text-[11px] text-[var(--color-neutral)] block mt-0.5">
                Theme: {s.season} • Palette: {s.color}
              </span>
            </div>
          ))}
        </div>
      </CopticCard>
    </div>
  );
};
