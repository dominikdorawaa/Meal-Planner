import { isValidBarCode } from './nutritionCheck';

export const SCAN_FORMATS = ['ean_13', 'ean_8', 'upc_a'];
export const REQUIRED_MATCHING_READS = 2;

export interface DetectedBarcode {
  rawValue: string;
}

export interface BarcodeReader {
  detect(source: HTMLVideoElement): Promise<DetectedBarcode[]>;
}

interface NativeDetectorConstructor {
  new (options: { formats: string[] }): BarcodeReader;
  getSupportedFormats(): Promise<string[]>;
}

function nativeDetector(): NativeDetectorConstructor | null {
  const candidate = (globalThis as { BarcodeDetector?: NativeDetectorConstructor }).BarcodeDetector;
  return typeof candidate === 'function' ? candidate : null;
}

export async function createBarcodeReader(): Promise<BarcodeReader> {
  const native = nativeDetector();
  if (native) {
    try {
      const supported = await native.getSupportedFormats();
      if (SCAN_FORMATS.every(format => supported.includes(format))) return new native({ formats: SCAN_FORMATS });
    } catch {
      return createWasmReader();
    }
  }
  return createWasmReader();
}

async function createWasmReader(): Promise<BarcodeReader> {
  const [{ BarcodeDetector, prepareZXingModule }, { default: wasmUrl }] = await Promise.all([
    import('barcode-detector/ponyfill'),
    import('zxing-wasm/reader/zxing_reader.wasm?url'),
  ]);
  await prepareZXingModule({
    overrides: {
      locateFile: (path: string, prefix: string) => (path.endsWith('.wasm') ? wasmUrl : prefix + path),
    },
    fireImmediately: true,
  });
  return new BarcodeDetector({ formats: SCAN_FORMATS as never });
}

export function createReadConfirmer(requiredReads = REQUIRED_MATCHING_READS) {
  let lastCode: string | null = null;
  let count = 0;
  return (rawValue: string): string | null => {
    const code = rawValue.trim();
    if (!isValidBarCode(code)) return null;
    count = code === lastCode ? count + 1 : 1;
    lastCode = code;
    return count >= requiredReads ? code : null;
  };
}
