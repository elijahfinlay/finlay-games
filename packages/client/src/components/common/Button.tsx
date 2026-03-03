import React from 'react';

interface ButtonProps extends React.ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: 'primary' | 'secondary' | 'danger';
  size?: 'sm' | 'md' | 'lg';
}

const variants = {
  primary:
    'bg-retro-accent text-retro-bg hover:bg-retro-accent-dim disabled:bg-retro-border disabled:text-retro-muted',
  secondary:
    'bg-retro-surface text-retro-text border border-retro-border hover:border-retro-accent disabled:opacity-50',
  danger:
    'bg-red-600 text-white hover:bg-red-700 disabled:opacity-50',
};

const sizes = {
  sm: 'px-3 py-1.5 text-[8px]',
  md: 'px-5 py-2.5 text-[10px]',
  lg: 'px-8 py-4 text-xs',
};

export function Button({ variant = 'primary', size = 'md', className = '', children, ...props }: ButtonProps) {
  return (
    <button
      className={`font-pixel uppercase tracking-wider transition-all duration-150 active:scale-95 ${variants[variant]} ${sizes[size]} ${className}`}
      {...props}
    >
      {children}
    </button>
  );
}
