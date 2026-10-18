import { useCloseOnBack } from './backNavigation';
import { useSwipeDownToClose } from './swipeDownToClose';

export function useBottomSheet<T extends HTMLElement = HTMLDivElement>(open: boolean, onClose: () => void, locked = false) {
  useCloseOnBack(open, onClose, locked);
  return useSwipeDownToClose<T>(onClose, locked);
}
