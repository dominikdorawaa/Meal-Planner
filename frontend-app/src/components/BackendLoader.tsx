import { useEffect, useState } from 'react';
import { Loader2 } from 'lucide-react';

export function BackendLoader() {
  const [isLoading, setIsLoading] = useState(false);
  const [elapsed, setElapsed] = useState(0);

  useEffect(() => {
    const handleLoading = (e: Event) => {
      const customEvent = e as CustomEvent<{ isLoading: boolean }>;
      setIsLoading(customEvent.detail.isLoading);
    };

    window.addEventListener('backend-loading', handleLoading);
    return () => {
      window.removeEventListener('backend-loading', handleLoading);
    };
  }, []);

  useEffect(() => {
    let interval: number;
    if (isLoading) {
      setElapsed(0);
      interval = window.setInterval(() => {
        setElapsed(prev => prev + 1);
      }, 1000);
    } else {
      setElapsed(0);
    }
    return () => window.clearInterval(interval);
  }, [isLoading]);

  if (!isLoading) return null;

  const formatTime = (seconds: number) => {
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return `${mins}:${secs.toString().padStart(2, '0')}`;
  };

  return (
    <div className="fixed inset-0 z-[9999] bg-black/60 backdrop-blur-sm flex items-center justify-center p-4">
      <div className="bg-surface rounded-2xl p-6 md:p-8 max-w-sm w-full shadow-2xl flex flex-col items-center text-center space-y-4">
        <Loader2 className="w-12 h-12 text-primary animate-spin" />
        <div>
          <h3 className="font-headline text-xl text-on-surface mb-2">Trwa uruchamianie serwera...</h3>
          <p className="text-on-surface-variant text-sm mb-4">
            Korzystamy z darmowego hostingu. Rozruch serwera może potrwać do 4 minut. Prosimy o cierpliwość.
          </p>
          <div className="font-headline text-3xl text-primary font-bold tracking-widest tabular-nums">
            {formatTime(elapsed)}
          </div>
        </div>
      </div>
    </div>
  );
}
