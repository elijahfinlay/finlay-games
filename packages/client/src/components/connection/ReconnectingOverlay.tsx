import { useConnectionStore } from '../../stores/connectionStore';
import { Spinner } from '../common/Spinner';

export function ReconnectingOverlay() {
  const status = useConnectionStore((s) => s.status);

  if (status !== 'reconnecting') return null;

  return (
    <div className="fixed inset-0 bg-black/80 z-50 flex items-center justify-center">
      <div className="text-center">
        <p className="font-pixel text-sm text-retro-accent mb-4">RECONNECTING</p>
        <Spinner />
      </div>
    </div>
  );
}
