import React from 'react';
import { Loader2 } from 'lucide-react';
import { Language } from '../../types';
import { getFontFamilyClass } from '../../localization/i18n';

export interface CopticButtonProps extends React.ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: 'primary' | 'secondary' | 'gold' | 'ghost' | 'danger' | 'outline';
  size?: 'sm' | 'md' | 'lg';
  loading?: boolean;
  icon?: React.ReactNode;
  iconPosition?: 'start' | 'end';
  lang?: Language;
  fullWidth?: boolean;
}

export const CopticButton: React.FC<CopticButtonProps> = ({
  children,
  variant = 'primary',
  size = 'md',
  loading = false,
  icon,
  iconPosition = 'start',
  lang = 'en',
  fullWidth = false,
  className = '',
  disabled,
  ...props
}) => {
  const fontClass = getFontFamilyClass(lang);

  // Variant styling
  const variantStyles = {
    primary:
      'bg-[var(--brand-burgundy)] text-white hover:brightness-110 active:brightness-95 border border-[var(--brand-burgundy-dark)] shadow-xs focus-visible:ring-2 focus-visible:ring-[var(--brand-gold)]',
    secondary:
      'bg-[var(--surface-card)] text-[var(--text-ink)] hover:bg-[var(--surface-elevated)] active:bg-[var(--border-stone)]/40 border border-[var(--border-stone)] shadow-xs focus-visible:ring-2 focus-visible:ring-[var(--brand-blue)]',
    gold:
      'bg-[var(--brand-gold)] text-white hover:brightness-108 active:brightness-95 border border-[var(--brand-gold-dark)] shadow-xs focus-visible:ring-2 focus-visible:ring-[var(--brand-burgundy)] font-bold',
    ghost:
      'bg-transparent text-[var(--text-ink)] hover:bg-[var(--surface-elevated)] active:bg-[var(--border-stone)]/30 border border-transparent focus-visible:ring-2 focus-visible:ring-[var(--brand-gold)]',
    danger:
      'bg-[var(--color-danger)] text-white hover:brightness-110 active:brightness-95 border border-red-900 shadow-xs focus-visible:ring-2 focus-visible:ring-red-400',
    outline:
      'bg-transparent text-[var(--brand-burgundy)] dark:text-[var(--brand-gold)] border border-[var(--brand-burgundy)] dark:border-[var(--brand-gold)] hover:bg-[var(--brand-burgundy)]/10 active:bg-[var(--brand-burgundy)]/20 focus-visible:ring-2 focus-visible:ring-[var(--brand-gold)]'
  };

  // Size styling - meeting 44px min touch target rule on mobile
  const sizeStyles = {
    sm: 'text-xs py-2 px-3.5 min-h-[38px] rounded-lg gap-1.5',
    md: 'text-sm py-2.5 px-5 min-h-[44px] rounded-xl gap-2 font-semibold',
    lg: 'text-base py-3 px-6 min-h-[50px] rounded-xl gap-2.5 font-bold'
  };

  return (
    <button
      disabled={disabled || loading}
      className={`inline-flex items-center justify-center transition-all duration-200 cursor-pointer select-none outline-none disabled:opacity-50 disabled:cursor-not-allowed ${fontClass} ${variantStyles[variant]} ${sizeStyles[size]} ${fullWidth ? 'w-full' : ''} ${className}`}
      {...props}
    >
      {loading && <Loader2 size={size === 'sm' ? 14 : 18} className="animate-spin shrink-0" />}
      {!loading && icon && iconPosition === 'start' && <span className="shrink-0">{icon}</span>}
      <span className="truncate leading-none">{children}</span>
      {!loading && icon && iconPosition === 'end' && <span className="shrink-0">{icon}</span>}
    </button>
  );
};
