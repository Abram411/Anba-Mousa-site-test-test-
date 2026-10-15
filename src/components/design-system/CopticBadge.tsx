import React from 'react';

export interface CopticBadgeProps extends React.HTMLAttributes<HTMLSpanElement> {
  variant?: 'burgundy' | 'gold' | 'blue' | 'success' | 'warning' | 'danger' | 'neutral' | 'mousa-gold' | 'mousa-teal' | 'mousa-coral' | 'mousa-sand';
  size?: 'sm' | 'md';
  dot?: boolean;
  icon?: React.ReactNode;
}

export const CopticBadge: React.FC<CopticBadgeProps> = ({
  children,
  variant = 'burgundy',
  size = 'md',
  dot = false,
  icon,
  className = '',
  ...props
}) => {
  const variantStyles = {
    burgundy:
      'bg-[var(--brand-burgundy)]/10 text-[var(--brand-burgundy)] dark:text-[#E88C9A] border-[var(--brand-burgundy)]/30',
    gold:
      'bg-[var(--brand-gold)]/15 text-[var(--brand-gold-dark)] dark:text-[var(--brand-gold)] border-[var(--brand-gold)]/30',
    blue:
      'bg-[var(--brand-blue)]/15 text-[var(--brand-blue)] dark:text-[#8BB0D1] border-[var(--brand-blue)]/30',
    success:
      'bg-[var(--color-success)]/15 text-[var(--color-success)] dark:text-[#67B88F] border-[var(--color-success)]/30',
    warning:
      'bg-[var(--color-warning)]/15 text-[var(--color-warning)] dark:text-[#E0A83A] border-[var(--color-warning)]/30',
    danger:
      'bg-[var(--color-danger)]/15 text-[var(--color-danger)] dark:text-[#E87E75] border-[var(--color-danger)]/30',
    neutral:
      'bg-[var(--color-neutral)]/15 text-[var(--text-ink)] border-[var(--border-stone)]',
    'mousa-gold':
      'bg-[var(--mousa-gold)]/15 text-[var(--mousa-gold-dark)] dark:text-[var(--mousa-gold-light)] border-[var(--mousa-gold)]/40 font-bold',
    'mousa-teal':
      'bg-[var(--mousa-teal)]/15 text-[var(--mousa-teal)] dark:text-[var(--mousa-teal-glow)] border-[var(--mousa-teal)]/40 font-bold',
    'mousa-coral':
      'bg-[var(--mousa-coral)]/15 text-[var(--mousa-coral)] dark:text-[var(--mousa-coral-glow)] border-[var(--mousa-coral)]/40 font-bold',
    'mousa-sand':
      'bg-[var(--mousa-sand-200)] text-[var(--mousa-sand-600)] dark:text-[var(--mousa-sand-500)] border-[var(--mousa-border-sand)] font-medium'
  };

  const dotColors = {
    burgundy: 'bg-[var(--brand-burgundy)]',
    gold: 'bg-[var(--brand-gold)]',
    blue: 'bg-[var(--brand-blue)]',
    success: 'bg-[var(--color-success)]',
    warning: 'bg-[var(--color-warning)]',
    danger: 'bg-[var(--color-danger)]',
    neutral: 'bg-[var(--color-neutral)]',
    'mousa-gold': 'bg-[var(--mousa-gold)]',
    'mousa-teal': 'bg-[var(--mousa-teal)]',
    'mousa-coral': 'bg-[var(--mousa-coral)]',
    'mousa-sand': 'bg-[var(--mousa-sand-400)]'
  };

  const sizeStyles = {
    sm: 'text-[11px] py-0.5 px-2 rounded-md font-semibold gap-1',
    md: 'text-xs py-1 px-2.5 rounded-lg font-bold gap-1.5'
  };

  return (
    <span
      className={`inline-flex items-center border whitespace-nowrap leading-none select-none ${variantStyles[variant]} ${sizeStyles[size]} ${className}`}
      {...props}
    >
      {dot && <span className={`w-1.5 h-1.5 rounded-full shrink-0 ${dotColors[variant]}`} />}
      {icon && <span className="shrink-0">{icon}</span>}
      <span>{children}</span>
    </span>
  );
};
