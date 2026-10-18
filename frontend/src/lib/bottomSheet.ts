import { useCloseOnBack } from './backNavigation';
import { useSwipeDownToClose } from './swipeDownToClose';

export function useBottomSheet<T extends HTMLElement = HTMLDivElement>(open: boolean, onClose: () => void) {
  useCloseOnBack(open, onClose);
  return useSwipeDownToClose<T>(onClose);
}
