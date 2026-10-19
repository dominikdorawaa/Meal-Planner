export const DEFAULT_ZOOM = 1;
export const CLOSE_UP_ZOOM = 2;

export const CAMERA_CONSTRAINTS: MediaStreamConstraints = {
  audio: false,
  video: {
    facingMode: { ideal: 'environment' },
    width: { ideal: 1920 },
    height: { ideal: 1080 },
  },
};

interface CameraCapabilities {
  focusMode?: string[];
  zoom?: { min: number; max: number };
  torch?: boolean;
}

type AdvancedConstraint = MediaTrackConstraintSet & { focusMode?: string; zoom?: number; torch?: boolean };

export interface ZoomRange {
  min: number;
  max: number;
}

export interface CameraTuning {
  torchSupported: boolean;
  zoom: ZoomRange | null;
}

export function isCameraSupported(): boolean {
  return typeof navigator !== 'undefined' && typeof navigator.mediaDevices?.getUserMedia === 'function';
}

export function openBarcodeCamera(): Promise<MediaStream> {
  return navigator.mediaDevices.getUserMedia(CAMERA_CONSTRAINTS);
}

function capabilitiesOf(track: MediaStreamTrack): CameraCapabilities {
  return typeof track.getCapabilities === 'function' ? (track.getCapabilities() as CameraCapabilities) : {};
}

export async function tuneBarcodeCamera(track: MediaStreamTrack): Promise<CameraTuning> {
  const capabilities = capabilitiesOf(track);
  const advanced: AdvancedConstraint[] = [];
  if (capabilities.focusMode?.includes('continuous')) advanced.push({ focusMode: 'continuous' });
  const zoom = capabilities.zoom && capabilities.zoom.max > capabilities.zoom.min ? capabilities.zoom : null;
  if (zoom) advanced.push({ zoom: clampZoom(zoom, DEFAULT_ZOOM) });
  for (const constraint of advanced) {
    try {
      await track.applyConstraints({ advanced: [constraint] });
    } catch {
      continue;
    }
  }
  return { torchSupported: capabilities.torch === true, zoom };
}

export function clampZoom(range: ZoomRange, value: number): number {
  return Math.max(range.min, Math.min(range.max, value));
}

export async function setZoom(track: MediaStreamTrack, value: number): Promise<boolean> {
  try {
    await track.applyConstraints({ advanced: [{ zoom: value } as AdvancedConstraint] });
    return true;
  } catch {
    return false;
  }
}

export async function setTorch(track: MediaStreamTrack, enabled: boolean): Promise<boolean> {
  try {
    await track.applyConstraints({ advanced: [{ torch: enabled } as AdvancedConstraint] });
    return true;
  } catch {
    return false;
  }
}

export function stopCamera(stream: MediaStream | null) {
  stream?.getTracks().forEach(track => track.stop());
}
