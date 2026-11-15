// @vitest-environment jsdom
// The modal focus trap must cycle Tab within .modal-sheet: Tab on the last
// focusable wraps to the first (and vice versa with shift), and focus outside
// the sheet is pulled back in — otherwise keyboard users escape the dialog.
import React, { act } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import { afterEach, describe, expect, it } from 'vitest';
import { useModalLock } from './use-modal-lock';

// jsdom has no layout engine, so offsetParent is always null; the trap's
// visibility filter keeps elements that are currently focused. Patch
// offsetParent to a truthy stub so focusables count as visible.
Object.defineProperty(HTMLElement.prototype, 'offsetParent', {
  configurable: true,
  get(this: HTMLElement) {
    return this.closest('.modal-sheet');
  },
});

afterEach(() => {
  document.body.innerHTML = '';
  // @ts-expect-error test-only teardown of the stub
  delete HTMLElement.prototype.offsetParent;
});

let root: Root;
let container: HTMLDivElement;

function mountLock(isOpen: boolean, onClose: () => void = () => {}) {
  container = document.createElement('div');
  document.body.appendChild(container);
  root = createRoot(container);
  (globalThis as unknown as { IS_REACT_ACT_ENVIRONMENT: boolean }).IS_REACT_ACT_ENVIRONMENT = true;
  function Probe() {
    useModalLock(isOpen, onClose);
    return null;
  }
  act(() => root.render(<Probe />));
}

function unmount() {
  act(() => root.unmount());
  container.remove();
}

function pressTab(shift = false): boolean {
  const e = new KeyboardEvent('keydown', { key: 'Tab', shiftKey: shift, bubbles: true, cancelable: true });
  act(() => {
    window.dispatchEvent(e);
  });
  return e.defaultPrevented;
}

function sheetWithButtons(count: number): HTMLElement {
  const sheet = document.createElement('div');
  sheet.className = 'modal-sheet';
  sheet.tabIndex = -1;
  for (let i = 0; i < count; i++) {
    const b = document.createElement('button');
    b.textContent = `btn-${i}`;
    sheet.appendChild(b);
  }
  document.body.appendChild(sheet);
  return sheet;
}

describe('useModalLock focus trap', () => {
  it('wraps Tab from the last focusable back to the first', () => {
    const sheet = sheetWithButtons(3);
    const buttons = sheet.querySelectorAll('button');
    buttons[2].focus();
    mountLock(true);
    const prevented = pressTab();
    expect(prevented).toBe(true);
    expect(document.activeElement).toBe(buttons[0]);
    unmount();
  });

  it('wraps shift+Tab from the first focusable to the last', () => {
    const sheet = sheetWithButtons(3);
    const buttons = sheet.querySelectorAll('button');
    buttons[0].focus();
    mountLock(true);
    const prevented = pressTab(true);
    expect(prevented).toBe(true);
    expect(document.activeElement).toBe(buttons[2]);
    unmount();
  });

  it('pulls focus back into the sheet when focus escapes outside', () => {
    const sheet = sheetWithButtons(2);
    const buttons = sheet.querySelectorAll('button');
    const outside = document.createElement('button');
    document.body.appendChild(outside);
    outside.focus();
    mountLock(true);
    pressTab();
    expect(document.activeElement).toBe(buttons[0]);
    unmount();
  });

  it('parks focus on the sheet itself when it has no focusables', () => {
    const sheet = sheetWithButtons(0);
    sheet.focus();
    mountLock(true);
    const prevented = pressTab();
    expect(prevented).toBe(true);
    expect(document.activeElement).toBe(sheet);
    unmount();
  });

  it('does not trap Tab when the lock is not open', () => {
    sheetWithButtons(2);
    mountLock(false);
    const prevented = pressTab();
    unmount();
    expect(prevented).toBe(false);
  });
});
