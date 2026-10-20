import { Component, lazy, Suspense, useState, type ComponentProps, type ReactNode } from 'react';
import { t } from '../i18n';
import { useCloseOnBack } from '../lib/backNavigation';
import { useSwipeDownToClose } from '../lib/swipeDownToClose';
import type { BarcodeScanner as BarcodeScannerComponent } from './BarcodeScanner';

function loadScanner() {
  return lazy(() => import('./BarcodeScanner').then(module => ({ default: module.BarcodeScanner })));
}

interface ScannerLoadBoundaryProps {
  onClose: () => void;
  onRetry: () => void;
  children: ReactNode;
}

function ScannerLoadFailed({ onClose, onRetry }: Omit<ScannerLoadBoundaryProps, 'children'>) {
  const sheetRef = useSwipeDownToClose(onClose);
  return (
    <div
      role="alertdialog"
      aria-modal="true"
      data-scroll-lock className="fixed inset-0 z-[150] flex flex-col justify-end bg-black/60 backdrop-blur-sm animate-fade-in"
      onClick={onClose}
    >
      <div
        ref={sheetRef}
        className="bg-surface-container-lowest rounded-t-[32px] p-6 pb-8 w-full max-w-xl mx-auto flex flex-col gap-4"
        onClick={event => event.stopPropagation()}
      >
        <p className="text-sm font-medium text-on-surface">{t('scanner.loadFailed')}</p>
        <button
          type="button"
          onClick={onRetry}
          className="w-full py-3 rounded-2xl bg-primary text-on-primary font-bold text-sm active:scale-95"
        >
          {t('scanner.retry')}
        </button>
        <button
          type="button"
          onClick={onClose}
          className="w-full py-3 rounded-2xl bg-surface-container-highest text-on-surface font-bold text-sm active:scale-95"
        >
          {t('scanner.close')}
        </button>
      </div>
    </div>
  );
}

class ScannerLoadBoundary extends Component<ScannerLoadBoundaryProps, { failed: boolean }> {
  state = { failed: false };

  static getDerivedStateFromError() {
    return { failed: true };
  }

  render() {
    if (!this.state.failed) return this.props.children;
    return <ScannerLoadFailed onClose={this.props.onClose} onRetry={this.props.onRetry} />;
  }
}

let BarcodeScanner = loadScanner();

export function LazyBarcodeScanner(props: ComponentProps<typeof BarcodeScannerComponent>) {
  const [attempt, setAttempt] = useState(0);
  useCloseOnBack(true, props.onClose);

  const retry = () => {
    BarcodeScanner = loadScanner();
    setAttempt(value => value + 1);
  };

  return (
    <ScannerLoadBoundary key={attempt} onClose={props.onClose} onRetry={retry}>
      <Suspense fallback={null}>
        <BarcodeScanner {...props} />
      </Suspense>
    </ScannerLoadBoundary>
  );
}
