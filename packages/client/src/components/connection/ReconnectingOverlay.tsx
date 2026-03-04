import { useEffect, useState } from 'react';
import { useConnectionStore } from '../../stores/connectionStore';
import { Spinner } from '../common/Spinner';

const RECONNECT_TIMEOUT_MS = 15000;

export function ReconnectingOverlay() {
  const status = useConnectionStore((s) => s.status);
  const [timedOut, setTimedOut] = useState(false);

  useEffect(() => {
    if (status !== 'reconnecting') {
      setTimedOut(false);
      return;
    }

    const timer = setTimeout(() => {
      setTimedOut(true);
    }, RECONNECT_TIMEOUT_MS);

    return () => clearTimeout(timer);
  }, [status]);

  if (status !== 'reconnecting') return null;

  return (
    <div className="fixed inset-0 bg-black/80 z-50 flex items-center justify-center">
      <div className="text-center">
        {timedOut ? (
          <>
            <p className="font-pixel text-sm text-red-400 mb-4">CONNECTION LOST</p>
            <p className="font-pixel text-[8px] text-retro-muted mb-6">
              Unable to reach the server.
            </p>
            <button
              onClick={() => {
                window.location.href = '/';
              }}
              className="font-pixel text-xs bg-retro-accent text-retro-bg px-4 py-2 hover:brightness-110 transition"
            >
              BACK TO HOME
            </button>
          </>
        ) : (
          <>
            <p className="font-pixel text-sm text-retro-accent mb-4">RECONNECTING</p>
            <Spinner />
          </>
        )}
      </div>
    </div>
  );
}
