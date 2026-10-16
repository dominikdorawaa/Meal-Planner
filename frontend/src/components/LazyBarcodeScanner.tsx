import { lazy, Suspense, type ComponentProps } from 'react';

const BarcodeScanner = lazy(() => import('./BarcodeScanner').then(module => ({ default: module.BarcodeScanner })));

export function LazyBarcodeScanner(props: ComponentProps<typeof BarcodeScanner>) {
  return (
    <Suspense fallback={null}>
      <BarcodeScanner {...props} />
    </Suspense>
  );
}
