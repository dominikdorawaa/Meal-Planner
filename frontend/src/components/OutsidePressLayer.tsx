import { createPortal } from 'react-dom';

export const OPEN_HEADER_CLASS = 'z-[200] pointer-events-none';

interface OutsidePressLayerProps {
  onClose: () => void;
}

export function OutsidePressLayer({ onClose }: OutsidePressLayerProps) {
  return createPortal(
    <div data-scroll-lock data-outside-press-layer className="fixed inset-0 z-[190]" onClick={onClose} />,
    document.body,
  );
}
