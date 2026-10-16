import { afterEach, describe, expect, it, vi } from 'vitest';
import { SCAN_FORMATS, createBarcodeReader, createReadConfirmer } from './barcodeDetection';

const mocks = vi.hoisted(() => ({
  prepare: vi.fn().mockResolvedValue(undefined),
  created: [] as unknown[],
}));

vi.mock('barcode-detector/ponyfill', () => ({
  prepareZXingModule: mocks.prepare,
  BarcodeDetector: class {
    readonly kind = 'wasm';
    constructor(options: unknown) {
      mocks.created.push(options);
    }
  },
}));

vi.mock('zxing-wasm/reader/zxing_reader.wasm?url', () => ({ default: '/assets/zxing_reader.wasm' }));

function stubNativeDetector(supported: string[] | Error) {
  const Native = class {
    readonly kind = 'native';
    readonly options: unknown;
    constructor(options: unknown) {
      this.options = options;
    }
    static getSupportedFormats = () => (supported instanceof Error ? Promise.reject(supported) : Promise.resolve(supported));
  };
  vi.stubGlobal('BarcodeDetector', Native);
}

afterEach(() => {
  vi.unstubAllGlobals();
  mocks.prepare.mockClear();
  mocks.created.length = 0;
});

describe('createBarcodeReader', () => {
  it('uses the built in detector when it reads every product code format', async () => {
    stubNativeDetector(['qr_code', ...SCAN_FORMATS]);

    const reader = await createBarcodeReader();

    expect(reader).toMatchObject({ kind: 'native', options: { formats: SCAN_FORMATS } });
    expect(mocks.prepare).not.toHaveBeenCalled();
  });

  it('falls back to the bundled reader when the built in one is missing or incomplete', async () => {
    await expect(createBarcodeReader()).resolves.toMatchObject({ kind: 'wasm' });

    stubNativeDetector(['qr_code']);
    await expect(createBarcodeReader()).resolves.toMatchObject({ kind: 'wasm' });

    stubNativeDetector(new Error('not supported'));
    await expect(createBarcodeReader()).resolves.toMatchObject({ kind: 'wasm' });

    expect(mocks.created).toEqual([{ formats: SCAN_FORMATS }, { formats: SCAN_FORMATS }, { formats: SCAN_FORMATS }]);
  });

  it('loads the reader binary from the app instead of a CDN', async () => {
    await createBarcodeReader();

    const { overrides } = mocks.prepare.mock.calls[0][0];
    expect(overrides.locateFile('zxing_reader.wasm', 'https://cdn.example/')).toBe('/assets/zxing_reader.wasm');
    expect(overrides.locateFile('zxing_reader.js', 'https://cdn.example/')).toBe('https://cdn.example/zxing_reader.js');
  });
});

describe('createReadConfirmer', () => {
  it('accepts a code only after matching reads in a row', () => {
    const confirm = createReadConfirmer(2);

    expect(confirm('5900820000318')).toBeNull();
    expect(confirm(' 5900820000318 ')).toBe('5900820000318');
  });

  it('starts counting again when a different code shows up', () => {
    const confirm = createReadConfirmer(2);

    confirm('5900820000318');
    expect(confirm('5901234123457')).toBeNull();
    expect(confirm('5901234123457')).toBe('5901234123457');
  });

  it('ignores codes with a wrong check digit', () => {
    const confirm = createReadConfirmer(1);

    expect(confirm('5900820000319')).toBeNull();
    expect(confirm('96385074')).toBe('96385074');
  });
});
