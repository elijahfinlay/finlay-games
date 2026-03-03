import { Link } from 'react-router-dom';

export function Header() {
  return (
    <header className="w-full max-w-4xl mb-8">
      <Link to="/" className="font-pixel text-retro-accent text-[10px] hover:text-retro-accent-dim transition-colors">
        &lt; BACK
      </Link>
    </header>
  );
}
