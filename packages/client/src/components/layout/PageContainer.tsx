import React from 'react';

interface PageContainerProps {
  children: React.ReactNode;
  className?: string;
}

export function PageContainer({ children, className = '' }: PageContainerProps) {
  return (
    <div className={`min-h-screen bg-retro-bg flex flex-col items-center px-4 py-8 ${className}`}>
      {children}
    </div>
  );
}
