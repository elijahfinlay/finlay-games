import { useState } from 'react';

interface RoomCodeDisplayProps {
  code: string;
  size?: 'md' | 'lg';
}

export function RoomCodeDisplay({ code, size = 'md' }: RoomCodeDisplayProps) {
  const [copied, setCopied] = useState(false);

  const handleCopy = async () => {
    await navigator.clipboard.writeText(code);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const textSize = size === 'lg' ? 'text-3xl sm:text-5xl' : 'text-xl sm:text-2xl';

  return (
    <button
      onClick={handleCopy}
      className="group flex flex-col items-center gap-2 cursor-pointer"
      title="Click to copy"
    >
      <span className="font-pixel text-[8px] text-retro-muted uppercase">Room Code</span>
      <span
        className={`font-pixel ${textSize} text-retro-accent tracking-[0.3em] group-hover:text-white transition-colors`}
      >
        {code}
      </span>
      <span className="font-pixel text-[7px] text-retro-muted">
        {copied ? 'COPIED!' : 'CLICK TO COPY'}
      </span>
    </button>
  );
}
