import { act, cleanup, fireEvent, render, screen } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { BarcodeScanner, SCAN_INTERVAL_MS } from './BarcodeScanner';

const mocks = vi.hoisted(() => ({
  supported: vi.fn(),
  open: vi.fn(),
  tune: vi.fn(),
  torch: vi.fn(),
  stop: vi.fn(),
  createReader: vi.fn(),
  detect: vi.fn(),
}));

vi.mock('../lib/barcodeCamera', () => ({
  isCameraSupported: mocks.supported,
  openBarcodeCamera: mocks.open,
  tuneBarcodeCamera: mocks.tune,
  setTorch: mocks.torch,
  stopCamera: mocks.stop,
}));

vi.mock('../lib/barcodeDetection', async importOriginal => {
  const original = await importOriginal<typeof import('../lib/barcodeDetection')>();
  return { ...original, createBarcodeReader: mocks.createReader };
});

const track = { kind: 'video' };
const stream = { getVideoTracks: () => [track] };

function namedError(name: string) {
  const error = new Error(name);
  error.name = name;
  return error;
}

async function flush(ms = 0) {
  await act(async () => {
    await vi.advanceTimersByTimeAsync(ms);
  });
}

function renderScanner(onDetected = vi.fn(), onClose = vi.fn()) {
  const view = render(<BarcodeScanner onDetected={onDetected} onClose={onClose} />);
  return { ...view, onDetected, onClose };
}

beforeEach(() => {
  vi.useFakeTimers();
  vi.spyOn(HTMLMediaElement.prototype, 'play').mockResolvedValue(undefined);
  mocks.supported.mockReturnValue(true);
  mocks.open.mockResolvedValue(stream);
  mocks.tune.mockResolvedValue({ torchSupported: false });
  mocks.torch.mockResolvedValue(true);
  mocks.createReader.mockResolvedValue({ detect: mocks.detect });
  mocks.detect.mockResolvedValue([]);
});

afterEach(() => {
  cleanup();
  vi.useRealTimers();
  vi.restoreAllMocks();
  Object.values(mocks).forEach(mock => mock.mockReset());
});

describe('BarcodeScanner', () => {
  it('reports a code after two matching reads and stops the camera', async () => {
    mocks.detect
      .mockResolvedValueOnce([{ rawValue: '5900820000319' }])
      .mockResolvedValueOnce([{ rawValue: '5900820000318' }])
      .mockResolvedValueOnce([{ rawValue: '5900820000318' }]);
    const { onDetected } = renderScanner();

    await flush();
    expect(screen.getByText(/Ustaw kod w ramce/)).toBeTruthy();
    await flush(SCAN_INTERVAL_MS * 3);

    expect(onDetected).toHaveBeenCalledTimes(1);
    expect(onDetected).toHaveBeenCalledWith('5900820000318');
    expect(mocks.stop).toHaveBeenCalledWith(stream);
  });

  it('keeps scanning when a frame cannot be read', async () => {
    mocks.detect
      .mockRejectedValueOnce(new Error('frame not ready'))
      .mockResolvedValue([{ rawValue: '96385074' }]);
    const { onDetected } = renderScanner();

    await flush(SCAN_INTERVAL_MS * 3);

    expect(onDetected).toHaveBeenCalledWith('96385074');
  });

  it('stops the camera and the scanning when closed', async () => {
    const { unmount } = renderScanner();
    await flush(SCAN_INTERVAL_MS);
    const calls = mocks.detect.mock.calls.length;

    unmount();
    await flush(SCAN_INTERVAL_MS * 3);

    expect(mocks.stop).toHaveBeenCalledWith(stream);
    expect(mocks.detect.mock.calls.length).toBe(calls);
  });

  it('releases a camera that opens after the scanner was closed', async () => {
    let finishOpening: (value: unknown) => void = () => {};
    mocks.open.mockReturnValue(new Promise(resolve => { finishOpening = resolve; }));
    const { unmount } = renderScanner();

    unmount();
    await act(async () => finishOpening(stream));

    expect(mocks.stop).toHaveBeenCalledWith(stream);
    expect(mocks.createReader).not.toHaveBeenCalled();
  });

  it('does not start scanning when closed while the reader loads', async () => {
    let finishLoading: (value: unknown) => void = () => {};
    mocks.createReader.mockReturnValue(new Promise(resolve => { finishLoading = resolve; }));
    const { unmount } = renderScanner();
    await flush();

    unmount();
    await act(async () => finishLoading({ detect: mocks.detect }));
    await flush(SCAN_INTERVAL_MS);

    expect(mocks.detect).not.toHaveBeenCalled();
  });

  it.each([
    ['NotAllowedError', /Brak dostępu do kamery/],
    ['NotFoundError', /Nie znaleziono kamery/],
  ])('explains a %s', async (name, message) => {
    mocks.open.mockRejectedValue(namedError(name));
    renderScanner();
    await flush();

    expect(screen.getByText(message)).toBeTruthy();
  });

  it('explains when the video cannot start', async () => {
    vi.spyOn(HTMLMediaElement.prototype, 'play').mockRejectedValue(new Error('blocked'));
    renderScanner();
    await flush();

    expect(screen.getByText(/Nie znaleziono kamery/)).toBeTruthy();
  });

  it('explains when the barcode reader cannot load', async () => {
    mocks.createReader.mockRejectedValue(new Error('wasm failed'));
    renderScanner();
    await flush();

    expect(screen.getByText(/Nie udało się uruchomić skanera/)).toBeTruthy();
  });

  it('does not touch the camera when the browser has no camera support', () => {
    mocks.supported.mockReturnValue(false);
    renderScanner();

    expect(screen.getByText(/Nie znaleziono kamery/)).toBeTruthy();
    expect(mocks.open).not.toHaveBeenCalled();
  });

  it('switches the flashlight when the camera has one', async () => {
    mocks.tune.mockResolvedValue({ torchSupported: true });
    mocks.torch.mockResolvedValueOnce(true).mockResolvedValueOnce(false);
    renderScanner();
    await flush();
    const button = screen.getByRole('button', { name: 'Latarka' });

    await act(async () => fireEvent.click(button));
    expect(mocks.torch).toHaveBeenLastCalledWith(track, true);
    expect(button.getAttribute('aria-pressed')).toBe('true');

    await act(async () => fireEvent.click(button));
    expect(mocks.torch).toHaveBeenLastCalledWith(track, false);
    expect(button.getAttribute('aria-pressed')).toBe('true');
  });

  it('hides the flashlight button when the camera has none', async () => {
    renderScanner();
    await flush();

    expect(screen.queryByRole('button', { name: 'Latarka' })).toBeNull();
  });

  it('accepts a valid code typed by hand and rejects an invalid one', () => {
    mocks.supported.mockReturnValue(false);
    const { onDetected } = renderScanner();
    const input = screen.getByLabelText('Albo wpisz kod');

    fireEvent.change(input, { target: { value: '5900820000319' } });
    fireEvent.click(screen.getByRole('button', { name: 'Szukaj' }));
    expect(screen.getByText('Kod kreskowy jest nieprawidłowy.')).toBeTruthy();

    fireEvent.change(input, { target: { value: '590 0820 000318' } });
    expect(screen.queryByText('Kod kreskowy jest nieprawidłowy.')).toBeNull();
    fireEvent.click(screen.getByRole('button', { name: 'Szukaj' }));
    expect(onDetected).toHaveBeenCalledWith('5900820000318');
  });

  it('closes with the close button or a click outside but not inside', () => {
    mocks.supported.mockReturnValue(false);
    const { onClose } = renderScanner();

    fireEvent.click(screen.getByLabelText('Albo wpisz kod'));
    expect(onClose).not.toHaveBeenCalled();
    fireEvent.click(screen.getByRole('button', { name: 'Zamknij skaner' }));
    fireEvent.click(screen.getByRole('dialog'));
    expect(onClose).toHaveBeenCalledTimes(2);
  });
});
