export const TARGET_ZOOM = 2;

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

export interface CameraTuning {
  torchSupported: boolean;
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
  if (capabilities.zoom && capabilities.zoom.max > 1) {
    advanced.push({ zoom: Math.max(capabilities.zoom.min, Math.min(capabilities.zoom.max, TARGET_ZOOM)) });
  }
  for (const constraint of advanced) {
    try {
      await track.applyConstraints({ advanced: [constraint] });
    } catch {
      continue;
    }
  }
  return { torchSupported: capabilities.torch === true };
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
