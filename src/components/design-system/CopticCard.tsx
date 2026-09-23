import React from 'react';

export interface CopticCardProps extends React.HTMLAttributes<HTMLDivElement> {
  variant?: 'default' | 'interactive' | 'sacred' | 'media' | 'status';
  padding?: 'none' | 'sm' | 'md' | 'lg';
}

export const CopticCard: React.FC<CopticCardProps> = ({
  children,
  variant = 'default',
  padding = 'md',
  className = '',
  ...props
}) => {
  const paddingStyles = {
    none: 'p-0',
    sm: 'p-3 sm:p-4',
    md: 'p-4 sm:p-6',
    lg: 'p-6 sm:p-8'
  };

  const variantStyles = {
    default:
      'bg-[var(--surface-card)] border border-[var(--border-stone)] shadow-xs rounded-2xl',
    interactive:
      'bg-[var(--surface-card)] border border-[var(--border-stone)] shadow-xs hover:border-[var(--brand-gold)] hover:shadow-md hover:-translate-y-0.5 transition-all duration-200 cursor-pointer rounded-2xl',
    sacred:
      'bg-[var(--surface-card)] border border-[var(--border-stone)] border-t-4 border-t-[var(--brand-gold)] shadow-xs rounded-2xl relative overflow-hidden',
    media:
      'bg-[var(--surface-card)] border border-[var(--border-stone)] shadow-xs rounded-2xl overflow-hidden',
    status:
      'bg-[var(--surface-elevated)] border border-[var(--border-stone)] rounded-xl'
  };

  return (
    <div
      className={`${variantStyles[variant]} ${paddingStyles[padding]} transition-colors duration-200 ${className}`}
      {...props}
    >
      {children}
    </div>
  );
};
