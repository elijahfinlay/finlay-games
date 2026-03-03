import React from 'react';

interface InputProps extends React.InputHTMLAttributes<HTMLInputElement> {
  label?: string;
  error?: string;
}

export function Input({ label, error, className = '', ...props }: InputProps) {
  return (
    <div className="w-full">
      {label && (
        <label className="block font-pixel text-[8px] text-retro-muted uppercase mb-2">
          {label}
        </label>
      )}
      <input
        className={`w-full bg-retro-bg border border-retro-border px-4 py-3 font-pixel text-xs text-retro-text
          placeholder:text-retro-muted focus:outline-none focus:border-retro-accent transition-colors
          ${error ? 'border-red-500' : ''} ${className}`}
        {...props}
      />
      {error && <p className="font-pixel text-[8px] text-red-500 mt-1">{error}</p>}
    </div>
  );
}
