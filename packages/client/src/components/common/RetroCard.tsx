import React from 'react';

interface RetroCardProps {
  children: React.ReactNode;
  className?: string;
  glow?: boolean;
}

export function RetroCard({ children, className = '', glow = false }: RetroCardProps) {
  return (
    <div
      className={`bg-retro-surface border border-retro-border p-6 ${glow ? 'animate-pulse-glow' : ''} ${className}`}
    >
      {children}
    </div>
  );
}
