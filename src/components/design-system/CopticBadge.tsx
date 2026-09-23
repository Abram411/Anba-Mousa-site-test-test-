import React from 'react';

export interface CopticBadgeProps extends React.HTMLAttributes<HTMLSpanElement> {
  variant?: 'burgundy' | 'gold' | 'blue' | 'success' | 'warning' | 'danger' | 'neutral';
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
      'bg-[var(--color-neutral)]/15 text-[var(--text-ink)] border-[var(--border-stone)]'
  };

  const dotColors = {
    burgundy: 'bg-[var(--brand-burgundy)]',
    gold: 'bg-[var(--brand-gold)]',
    blue: 'bg-[var(--brand-blue)]',
    success: 'bg-[var(--color-success)]',
    warning: 'bg-[var(--color-warning)]',
    danger: 'bg-[var(--color-danger)]',
    neutral: 'bg-[var(--color-neutral)]'
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
