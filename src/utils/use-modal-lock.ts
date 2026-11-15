import { useEffect, useRef } from 'react';

/**
 * Hook to lock background scrolling, trap Tab focus, and handle Escape key
 * dismissal for modals/drawers.
 * - onClose is kept in a ref so the effect does not re-subscribe on every parent
 *   render (callers typically pass inline arrow functions).
 * - ESC only closes the topmost lock: if several overlays are stacked, a child
 *   modal mounted later wins; parents ignore ESC while a newer lock is active.
 * - Tab is cycled within the modal sheet: focusable elements are collected
 *   fresh on each Tab press (contents can change between presses), wrapping
 *   from last back to first and vice versa. The container is queried via
 *   document at keydown time, so it also works when the modal re-renders.
 */
const lockStack: symbol[] = [];

const FOCUSABLE_SELECTOR =
  'a[href], button:not([disabled]), input:not([disabled]):not([type="hidden"]), select:not([disabled]), textarea:not([disabled]), [tabindex]:not([tabindex="-1"])';

export function useModalLock(isOpen: boolean, onClose: () => void) {
  const onCloseRef = useRef(onClose);
  onCloseRef.current = onClose;

  useEffect(() => {
    if (!isOpen) return;

    const lockId = Symbol('modal-lock');
    lockStack.push(lockId);

    const originalOverflow = document.body.style.overflow;
    const originalTouchAction = document.body.style.touchAction;
    const previouslyFocused =
      document.activeElement instanceof HTMLElement ? document.activeElement : null;

    document.body.style.overflow = 'hidden';
    document.body.style.touchAction = 'none';

    // Resolve the overlay this lock belongs to: the modal content is found by
    // walking up from the focused element (focus moves into the modal on
    // open) — fallback to the last .modal-sheet in the DOM.
    const overlayFor = (): HTMLElement | null => {
      const active = document.activeElement;
      if (active instanceof HTMLElement) {
        const sheet = active.closest('.modal-sheet');
        if (sheet instanceof HTMLElement) return sheet;
      }
      const sheets = document.querySelectorAll<HTMLElement>('.modal-sheet');
      return sheets.length ? sheets[sheets.length - 1] : null;
    };

    const focusablesIn = (root: HTMLElement): HTMLElement[] =>
      Array.from(root.querySelectorAll<HTMLElement>(FOCUSABLE_SELECTOR)).filter(
        (el) => el.offsetParent !== null || el === document.activeElement
      );

    const handleKeyDown = (e: KeyboardEvent) => {
      if (lockStack[lockStack.length - 1] !== lockId) return;
      if (e.key === 'Escape') {
        e.preventDefault();
        onCloseRef.current();
        return;
      }
      if (e.key === 'Tab') {
        const overlay = overlayFor();
        if (!overlay) return;
        const items = focusablesIn(overlay);
        if (items.length === 0) {
          // Nothing focusable: keep focus parked on the overlay itself.
          e.preventDefault();
          overlay.focus();
          return;
        }
        const first = items[0];
        const last = items[items.length - 1];
        const active = document.activeElement;
        if (e.shiftKey) {
          if (active === first || !(active instanceof HTMLElement) || !overlay.contains(active)) {
            e.preventDefault();
            last.focus();
          }
        } else if (active === last || !(active instanceof HTMLElement) || !overlay.contains(active)) {
          e.preventDefault();
          first.focus();
        }
      }
    };

    window.addEventListener('keydown', handleKeyDown);

    return () => {
      document.body.style.overflow = originalOverflow;
      document.body.style.touchAction = originalTouchAction;
      window.removeEventListener('keydown', handleKeyDown);
      const idx = lockStack.indexOf(lockId);
      if (idx >= 0) lockStack.splice(idx, 1);
      previouslyFocused?.focus?.();
    };
  }, [isOpen]);
}
