import { afterEach, beforeEach, expect, it, vi } from 'vitest';
import {
  bindEditorNavigation,
  requestEditorLeave,
} from '@/lib/editor-navigation';

let dirty: boolean;
let win: EventTarget & {
  navigation: EventTarget;
  confirm: ReturnType<typeof vi.fn>;
};
let detach: () => void;
beforeEach(() => {
  dirty = true;
  win = Object.assign(new EventTarget(), {
    navigation: new EventTarget(),
    location: new URL('https://admin.test/admin/exercises/new'),
    confirm: vi.fn(() => false),
  });
  vi.stubGlobal('window', win);
  vi.stubGlobal('document', new EventTarget());
  detach = bindEditorNavigation(() => dirty);
});
afterEach(() => {
  detach();
  vi.unstubAllGlobals();
});
const traverse = (
  cancelable = true,
  sameDocument = true,
  url = 'https://admin.test/admin/exercises',
) => {
  const event = Object.assign(new Event('navigate', { cancelable }), {
    navigationType: 'traverse',
    destination: { url, sameDocument },
  });
  win.navigation.dispatchEvent(event);
  return event;
};
it('refuse une mutation de catalogue si le brouillon ne doit pas être perdu', () => {
  expect(requestEditorLeave()).toBe(false);
  expect(win.confirm).toHaveBeenCalledOnce();
  win.confirm.mockReturnValue(true);
  expect(requestEditorLeave()).toBe(true);
});
it('annule une traversée interne annulable, mais permet le départ confirmé', () => {
  expect(traverse().defaultPrevented).toBe(true);
  win.confirm.mockReturnValue(true);
  expect(traverse().defaultPrevented).toBe(false);
});
it('respecte les traversées non annulables et laisse beforeunload gérer les autres documents', () => {
  expect(traverse(false).defaultPrevented).toBe(false);
  expect(traverse(true, false).defaultPrevented).toBe(false);
  expect(win.confirm).not.toHaveBeenCalled();
  const exit = new Event('beforeunload', { cancelable: true });
  win.dispatchEvent(exit);
  expect(exit.defaultPrevented).toBe(true);
});
it('ne demande rien après sauvegarde ni pour une ancre du même éditeur', () => {
  expect(
    traverse(true, true, 'https://admin.test/admin/exercises/new#question')
      .defaultPrevented,
  ).toBe(false);
  dirty = false;
  expect(requestEditorLeave()).toBe(true);
  expect(traverse().defaultPrevented).toBe(false);
  const exit = new Event('beforeunload', { cancelable: true });
  win.dispatchEvent(exit);
  expect(exit.defaultPrevented).toBe(false);
  expect(win.confirm).not.toHaveBeenCalled();
});
it('retire tous les gardes au démontage', () => {
  detach();
  expect(requestEditorLeave()).toBe(true);
  expect(traverse().defaultPrevented).toBe(false);
  expect(win.confirm).not.toHaveBeenCalled();
});
