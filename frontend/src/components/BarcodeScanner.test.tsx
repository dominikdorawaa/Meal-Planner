import { act, cleanup, fireEvent, render, screen } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { BarcodeScanner } from './BarcodeScanner';

type DecodeCallback = (result: { getText: () => string } | undefined, error: unknown, controls: { stop: () => void }) => void;

const mocks = vi.hoisted(() => ({
  decode: vi.fn(),
  stop: vi.fn(),
}));

vi.mock('@zxing/browser', () => ({
  BrowserMultiFormatReader: class {
    decodeFromVideoDevice = mocks.decode;
  },
}));

function stubCamera(available: boolean) {
  Object.defineProperty(navigator, 'mediaDevices', {
    configurable: true,
    value: available ? { getUserMedia: vi.fn() } : undefined,
  });
}

function startScanning() {
  let callback: DecodeCallback = () => {};
  mocks.decode.mockImplementation((_device: unknown, _video: unknown, onResult: DecodeCallback) => {
    callback = onResult;
    return Promise.resolve({ stop: mocks.stop });
  });
  return (text?: string) => callback(text ? { getText: () => text } : undefined, undefined, { stop: mocks.stop });
}

function namedError(name: string) {
  const error = new Error(name);
  error.name = name;
  return error;
}

beforeEach(() => {
  stubCamera(true);
});

afterEach(() => {
  cleanup();
  mocks.decode.mockReset();
  mocks.stop.mockReset();
});

describe('BarcodeScanner', () => {
  it('reports the first scanned code and stops the camera', async () => {
    const emit = startScanning();
    const onDetected = vi.fn();
    render(<BarcodeScanner onDetected={onDetected} onClose={vi.fn()} />);
    await act(async () => {});

    act(() => emit());
    act(() => emit('5900820000318'));
    act(() => emit('5901234123457'));

    expect(onDetected).toHaveBeenCalledTimes(1);
    expect(onDetected).toHaveBeenCalledWith('5900820000318');
    expect(mocks.stop).toHaveBeenCalled();
  });

  it('keeps scanning when the camera reads a code that is not a product barcode', async () => {
    const emit = startScanning();
    const onDetected = vi.fn();
    render(<BarcodeScanner onDetected={onDetected} onClose={vi.fn()} />);
    await act(async () => {});

    act(() => emit('https://example.com'));
    act(() => emit('5900820000319'));
    expect(onDetected).not.toHaveBeenCalled();
    expect(mocks.stop).not.toHaveBeenCalled();

    act(() => emit(' 5900820000318 '));
    expect(onDetected).toHaveBeenCalledWith('5900820000318');
  });

  it('stops the camera when closed', async () => {
    startScanning();
    const { unmount } = render(<BarcodeScanner onDetected={vi.fn()} onClose={vi.fn()} />);
    await act(async () => {});

    unmount();

    expect(mocks.stop).toHaveBeenCalled();
  });

  it('stops a camera that starts after the scanner was closed', async () => {
    let finishStart: (controls: { stop: () => void }) => void = () => {};
    mocks.decode.mockReturnValue(new Promise(resolve => { finishStart = resolve; }));
    const { unmount } = render(<BarcodeScanner onDetected={vi.fn()} onClose={vi.fn()} />);

    unmount();
    await act(async () => finishStart({ stop: mocks.stop }));

    expect(mocks.stop).toHaveBeenCalled();
  });

  it('explains when camera access is denied', async () => {
    mocks.decode.mockRejectedValue(namedError('NotAllowedError'));
    render(<BarcodeScanner onDetected={vi.fn()} onClose={vi.fn()} />);

    expect(await screen.findByText(/Brak dostępu do kamery/)).toBeTruthy();
  });

  it('explains when there is no camera', async () => {
    mocks.decode.mockRejectedValue(namedError('NotFoundError'));
    render(<BarcodeScanner onDetected={vi.fn()} onClose={vi.fn()} />);

    expect(await screen.findByText(/Nie znaleziono kamery/)).toBeTruthy();
  });

  it('does not touch the camera when the browser has no camera support', () => {
    stubCamera(false);
    render(<BarcodeScanner onDetected={vi.fn()} onClose={vi.fn()} />);

    expect(screen.getByText(/Nie znaleziono kamery/)).toBeTruthy();
    expect(mocks.decode).not.toHaveBeenCalled();
  });

  it('accepts a valid code typed by hand', () => {
    stubCamera(false);
    const onDetected = vi.fn();
    render(<BarcodeScanner onDetected={onDetected} onClose={vi.fn()} />);

    fireEvent.change(screen.getByLabelText('Albo wpisz kod'), { target: { value: '590 0820 000318' } });
    fireEvent.click(screen.getByRole('button', { name: 'Szukaj' }));

    expect(onDetected).toHaveBeenCalledWith('5900820000318');
  });

  it('rejects an invalid code typed by hand until it is corrected', () => {
    stubCamera(false);
    const onDetected = vi.fn();
    render(<BarcodeScanner onDetected={onDetected} onClose={vi.fn()} />);
    const input = screen.getByLabelText('Albo wpisz kod');

    fireEvent.change(input, { target: { value: '5900820000319' } });
    fireEvent.click(screen.getByRole('button', { name: 'Szukaj' }));
    expect(screen.getByText('Kod kreskowy jest nieprawidłowy.')).toBeTruthy();
    expect(onDetected).not.toHaveBeenCalled();

    fireEvent.change(input, { target: { value: '590082000031' } });
    expect(screen.queryByText('Kod kreskowy jest nieprawidłowy.')).toBeNull();
  });

  it('closes with the close button or a click outside but not inside', () => {
    stubCamera(false);
    const onClose = vi.fn();
    render(<BarcodeScanner onDetected={vi.fn()} onClose={onClose} />);

    fireEvent.click(screen.getByLabelText('Albo wpisz kod'));
    expect(onClose).not.toHaveBeenCalled();
    fireEvent.click(screen.getByRole('button', { name: 'Zamknij skaner' }));
    fireEvent.click(screen.getByRole('dialog'));
    expect(onClose).toHaveBeenCalledTimes(2);
  });
});
