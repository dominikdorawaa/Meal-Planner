import { useEffect, useRef, useState, type FormEvent } from 'react';
import { t, type MessageKey } from '../i18n';
import { isValidBarCode } from '../lib/nutritionCheck';
import { normalizeBarCode } from '../lib/barcodeLookup';
import {
  CLOSE_UP_ZOOM,
  DEFAULT_ZOOM,
  clampZoom,
  isCameraSupported,
  openBarcodeCamera,
  setTorch,
  setZoom,
  stopCamera,
  tuneBarcodeCamera,
  type ZoomRange,
} from '../lib/barcodeCamera';
import { createBarcodeReader, createReadConfirmer } from '../lib/barcodeDetection';
import { useSwipeDownToClose } from '../lib/swipeDownToClose';

interface BarcodeScannerProps {
  onDetected: (barCode: string) => void;
  onClose: () => void;
}

type CameraState = 'starting' | 'scanning' | 'denied' | 'unavailable' | 'engineFailed';

export const SCAN_INTERVAL_MS = 120;

const CAMERA_MESSAGES: Partial<Record<CameraState, MessageKey>> = {
  starting: 'scanner.starting',
  denied: 'scanner.permissionDenied',
  unavailable: 'scanner.noCamera',
  engineFailed: 'scanner.engineFailed',
};

function cameraErrorState(error: unknown): CameraState {
  const name = error instanceof Error ? error.name : '';
  return name === 'NotAllowedError' || name === 'SecurityError' ? 'denied' : 'unavailable';
}

export function BarcodeScanner({ onDetected, onClose }: BarcodeScannerProps) {
  const videoRef = useRef<HTMLVideoElement>(null);
  const sheetRef = useSwipeDownToClose(onClose);
  const trackRef = useRef<MediaStreamTrack | null>(null);
  const onDetectedRef = useRef(onDetected);
  const [cameraState, setCameraState] = useState<CameraState>('starting');
  const [torchSupported, setTorchSupported] = useState(false);
  const [torchOn, setTorchOn] = useState(false);
  const [zoomRange, setZoomRange] = useState<ZoomRange | null>(null);
  const [closeUp, setCloseUp] = useState(false);
  const [manualCode, setManualCode] = useState('');
  const [manualError, setManualError] = useState(false);

  useEffect(() => {
    onDetectedRef.current = onDetected;
  }, [onDetected]);

  useEffect(() => {
    let finished = false;
    let stream: MediaStream | null = null;
    let timer: ReturnType<typeof setTimeout> | null = null;
    const video = videoRef.current;

    if (!video || !isCameraSupported()) {
      setCameraState('unavailable');
      return;
    }

    const start = async () => {
      try {
        stream = await openBarcodeCamera();
      } catch (error) {
        if (!finished) setCameraState(cameraErrorState(error));
        return;
      }
      if (finished) {
        stopCamera(stream);
        return;
      }
      const track = stream.getVideoTracks()[0];
      trackRef.current = track ?? null;
      video.srcObject = stream;
      try {
        await video.play();
      } catch {
        if (!finished) setCameraState('unavailable');
        return;
      }
      if (track) {
        const tuning = await tuneBarcodeCamera(track);
        if (!finished) {
          setTorchSupported(tuning.torchSupported);
          setZoomRange(tuning.zoom);
        }
      }

      let reader;
      try {
        reader = await createBarcodeReader();
      } catch {
        if (!finished) setCameraState('engineFailed');
        return;
      }
      if (finished) return;
      setCameraState('scanning');

      const confirm = createReadConfirmer();
      const scan = async () => {
        if (finished) return;
        try {
          for (const barcode of await reader.detect(video)) {
            const code = confirm(barcode.rawValue);
            if (code && !finished) {
              finished = true;
              stopCamera(stream);
              onDetectedRef.current(code);
              return;
            }
          }
        } catch {
          if (finished) return;
        }
        if (!finished) timer = setTimeout(scan, SCAN_INTERVAL_MS);
      };
      scan();
    };

    start();

    return () => {
      finished = true;
      if (timer) clearTimeout(timer);
      stopCamera(stream);
      trackRef.current = null;
    };
  }, []);

  const toggleTorch = async () => {
    const track = trackRef.current;
    if (!track) return;
    if (await setTorch(track, !torchOn)) setTorchOn(!torchOn);
  };

  const toggleZoom = async () => {
    const track = trackRef.current;
    if (!track || !zoomRange) return;
    const target = clampZoom(zoomRange, closeUp ? DEFAULT_ZOOM : CLOSE_UP_ZOOM);
    if (await setZoom(track, target)) setCloseUp(!closeUp);
  };

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
        ref={sheetRef}
        className="bg-surface-container-lowest rounded-t-[32px] px-4 pt-6 pb-8 w-full max-w-xl max-h-[100dvh] overflow-y-auto mx-auto flex flex-col gap-4"
        onClick={event => event.stopPropagation()}
      >
        <div className="flex items-center justify-between px-2">
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

        <div data-testid="scanner-preview" className="relative w-full aspect-square rounded-2xl overflow-hidden bg-black">
          <video ref={videoRef} className="w-full h-full object-cover" muted playsInline autoPlay />
          {cameraState === 'scanning' && (
            <>
              <div data-testid="scanner-aim-frame" className="absolute left-[10%] right-[10%] top-[30%] bottom-[30%] rounded-xl border-2 border-white/90 shadow-[0_0_0_9999px_rgba(0,0,0,0.35)]" />
              <div className="absolute left-[12%] right-[12%] top-1/2 h-0.5 bg-primary/90" />
              <p className="absolute inset-x-0 bottom-3 text-center text-xs font-medium text-white/90 px-4">
                {t('scanner.aimHint')}
              </p>
              {zoomRange && (
                <button
                  type="button"
                  onClick={toggleZoom}
                  aria-pressed={closeUp}
                  aria-label={t(closeUp ? 'scanner.zoomOut' : 'scanner.zoomIn')}
                  className="absolute top-3 left-3 h-10 min-w-10 px-3 rounded-full bg-black/50 text-white text-sm font-bold flex items-center justify-center active:scale-90"
                >
                  {`${clampZoom(zoomRange, closeUp ? CLOSE_UP_ZOOM : DEFAULT_ZOOM)}x`}
                </button>
              )}
              {torchSupported && (
                <button
                  type="button"
                  onClick={toggleTorch}
                  aria-pressed={torchOn}
                  aria-label={t('scanner.torch')}
                  className="absolute top-3 right-3 w-10 h-10 rounded-full bg-black/50 text-white flex items-center justify-center active:scale-90"
                >
                  <span className="material-symbols-outlined text-[20px]">{torchOn ? 'flashlight_off' : 'flashlight_on'}</span>
                </button>
              )}
            </>
          )}
          {cameraMessage && (
            <p className="absolute inset-0 flex items-center justify-center p-6 text-center text-sm font-medium text-white/90">
              {t(cameraMessage)}
            </p>
          )}
        </div>

        <form onSubmit={submitManualCode} className="flex flex-col gap-2 px-2">
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
