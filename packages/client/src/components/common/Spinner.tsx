export function Spinner({ className = '' }: { className?: string }) {
  return (
    <div className={`flex items-center gap-1 font-pixel text-[10px] text-retro-accent ${className}`}>
      <span className="animate-blink">.</span>
      <span className="animate-blink [animation-delay:0.2s]">.</span>
      <span className="animate-blink [animation-delay:0.4s]">.</span>
    </div>
  );
}
