import { afterEach, describe, expect, it, vi } from 'vitest';
import {
  CAMERA_CONSTRAINTS,
  TARGET_ZOOM,
  isCameraSupported,
  openBarcodeCamera,
  setTorch,
  stopCamera,
  tuneBarcodeCamera,
} from './barcodeCamera';

function fakeTrack(capabilities?: object, applyConstraints = vi.fn().mockResolvedValue(undefined)) {
  return {
    getCapabilities: capabilities ? () => capabilities : undefined,
    applyConstraints,
    stop: vi.fn(),
  } as unknown as MediaStreamTrack & { applyConstraints: ReturnType<typeof vi.fn> };
}

afterEach(() => {
  Object.defineProperty(navigator, 'mediaDevices', { configurable: true, value: undefined });
});

describe('barcodeCamera', () => {
  it('opens the back camera in high resolution', async () => {
    const getUserMedia = vi.fn().mockResolvedValue('stream');
    Object.defineProperty(navigator, 'mediaDevices', { configurable: true, value: { getUserMedia } });

    expect(isCameraSupported()).toBe(true);
    await expect(openBarcodeCamera()).resolves.toBe('stream');
    expect(getUserMedia).toHaveBeenCalledWith(CAMERA_CONSTRAINTS);
  });

  it('reports a browser without camera access', () => {
    expect(isCameraSupported()).toBe(false);
  });

  it('turns on continuous focus and zooms in when the camera allows it', async () => {
    const track = fakeTrack({ focusMode: ['manual', 'continuous'], zoom: { min: 1, max: 8 }, torch: true });

    await expect(tuneBarcodeCamera(track)).resolves.toEqual({ torchSupported: true });

    expect(track.applyConstraints).toHaveBeenCalledWith({ advanced: [{ focusMode: 'continuous' }] });
    expect(track.applyConstraints).toHaveBeenCalledWith({ advanced: [{ zoom: TARGET_ZOOM }] });
  });

  it('keeps the zoom within the camera range', async () => {
    const track = fakeTrack({ zoom: { min: 1, max: 1.5 } });

    await tuneBarcodeCamera(track);

    expect(track.applyConstraints).toHaveBeenCalledWith({ advanced: [{ zoom: 1.5 }] });
  });

  it('skips settings the camera does not support or rejects', async () => {
    const rejecting = fakeTrack({ focusMode: ['continuous'], zoom: { min: 1, max: 4 } }, vi.fn().mockRejectedValue(new Error('no')));
    await expect(tuneBarcodeCamera(rejecting)).resolves.toEqual({ torchSupported: false });
    expect(rejecting.applyConstraints).toHaveBeenCalledTimes(2);

    const plain = fakeTrack({ focusMode: ['manual'], zoom: { min: 1, max: 1 } });
    await tuneBarcodeCamera(plain);
    expect(plain.applyConstraints).not.toHaveBeenCalled();

    const old = fakeTrack();
    await expect(tuneBarcodeCamera(old)).resolves.toEqual({ torchSupported: false });
  });

  it('switches the flashlight and reports failures', async () => {
    const track = fakeTrack({});
    await expect(setTorch(track, true)).resolves.toBe(true);
    expect(track.applyConstraints).toHaveBeenCalledWith({ advanced: [{ torch: true }] });

    const failing = fakeTrack({}, vi.fn().mockRejectedValue(new Error('no torch')));
    await expect(setTorch(failing, true)).resolves.toBe(false);
  });

  it('stops every camera track', () => {
    const first = fakeTrack({});
    const second = fakeTrack({});

    stopCamera({ getTracks: () => [first, second] } as unknown as MediaStream);
    stopCamera(null);

    expect(first.stop).toHaveBeenCalled();
    expect(second.stop).toHaveBeenCalled();
  });
});
