import { useEffect, useRef, useState, type FormEvent } from 'react';
import { BrowserMultiFormatReader, type IScannerControls } from '@zxing/browser';
import { t, type MessageKey } from '../i18n';
import { isValidBarCode } from '../lib/nutritionCheck';
import { normalizeBarCode } from '../lib/barcodeLookup';

interface BarcodeScannerProps {
  onDetected: (barCode: string) => void;
  onClose: () => void;
}

type CameraState = 'starting' | 'scanning' | 'denied' | 'unavailable';

const CAMERA_MESSAGES: Partial<Record<CameraState, MessageKey>> = {
  starting: 'scanner.starting',
  denied: 'scanner.permissionDenied',
  unavailable: 'scanner.noCamera',
};

function cameraErrorState(error: unknown): CameraState {
  const name = error instanceof Error ? error.name : '';
  return name === 'NotAllowedError' || name === 'SecurityError' ? 'denied' : 'unavailable';
}

export function BarcodeScanner({ onDetected, onClose }: BarcodeScannerProps) {
  const videoRef = useRef<HTMLVideoElement>(null);
  const onDetectedRef = useRef(onDetected);
  const [cameraState, setCameraState] = useState<CameraState>('starting');
  const [manualCode, setManualCode] = useState('');
  const [manualError, setManualError] = useState(false);

  useEffect(() => {
    onDetectedRef.current = onDetected;
  }, [onDetected]);

  useEffect(() => {
    let controls: IScannerControls | null = null;
    let finished = false;
    const video = videoRef.current;

    if (!video || !navigator.mediaDevices?.getUserMedia) {
      setCameraState('unavailable');
      return;
    }

    new BrowserMultiFormatReader()
      .decodeFromVideoDevice(undefined, video, (result, _error, activeControls) => {
        if (!result || finished) return;
        const code = normalizeBarCode(result.getText());
        if (!isValidBarCode(code)) return;
        finished = true;
        activeControls.stop();
        onDetectedRef.current(code);
      })
      .then(started => {
        if (finished) {
          started.stop();
          return;
        }
        controls = started;
        setCameraState('scanning');
      })
      .catch(error => {
        if (!finished) setCameraState(cameraErrorState(error));
      });

    return () => {
      finished = true;
      controls?.stop();
    };
  }, []);

  const submitManualCode = (event: FormEvent) => {
    event.preventDefault();
    const code = normalizeBarCode(manualCode);
    if (!isValidBarCode(code)) {
      setManualError(true);
      return;
    }
    onDetected(code);
  };

  const cameraMessage = CAMERA_MESSAGES[cameraState];

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-label={t('scanner.title')}
      className="fixed inset-0 z-[150] flex flex-col justify-end bg-black/60 backdrop-blur-sm animate-fade-in"
      onClick={onClose}
    >
      <div
        className="bg-surface-container-lowest rounded-t-[32px] p-6 pb-8 w-full max-w-xl mx-auto flex flex-col gap-4"
        onClick={event => event.stopPropagation()}
      >
        <div className="flex items-center justify-between">
          <h2 className="font-headline font-bold text-lg text-on-surface">{t('scanner.title')}</h2>
          <button
            type="button"
            onClick={onClose}
            aria-label={t('scanner.close')}
            className="w-8 h-8 rounded-full bg-surface-container-highest flex items-center justify-center text-on-surface-variant active:scale-90"
          >
            <span className="material-symbols-outlined text-[18px]">close</span>
          </button>
        </div>

        <div className="relative w-full aspect-[4/3] rounded-2xl overflow-hidden bg-black">
          <video ref={videoRef} className="w-full h-full object-cover" muted playsInline />
          {cameraState === 'scanning' && (
            <div className="absolute inset-x-8 top-1/2 h-0.5 bg-primary/80 shadow-[0_0_12px_rgba(0,0,0,0.4)]" />
          )}
          {cameraMessage && (
            <p className="absolute inset-0 flex items-center justify-center p-6 text-center text-sm font-medium text-white/90">
              {t(cameraMessage)}
            </p>
          )}
        </div>

        <form onSubmit={submitManualCode} className="flex flex-col gap-2">
          <label htmlFor="manual-bar-code" className="text-xs font-bold text-on-surface-variant pl-1 uppercase tracking-widest">
            {t('scanner.manualLabel')}
          </label>
          <div className="flex gap-2">
            <input
              id="manual-bar-code"
              inputMode="numeric"
              autoComplete="off"
              value={manualCode}
              onChange={event => {
                setManualCode(event.target.value);
                setManualError(false);
              }}
              className="flex-1 bg-surface-container-low rounded-2xl py-3 px-4 outline-none focus:ring-2 focus:ring-primary/20 text-on-surface font-bold text-sm"
              placeholder="5900000000000"
            />
            <button type="submit" className="px-5 rounded-2xl bg-primary text-on-primary font-bold text-sm active:scale-95">
              {t('scanner.search')}
            </button>
          </div>
          {manualError && <p className="text-xs font-medium text-error pl-1">{t('nutrition.invalid-bar-code')}</p>}
        </form>
      </div>
    </div>
  );
}
