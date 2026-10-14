const leaveEvent = 'novlearn:editor-leave';
const question =
  'Quitter cette page et perdre les modifications non enregistrées ?';

/** Protected actions ask before mutating or refreshing the current editor. */
export function requestEditorLeave() {
  return window.dispatchEvent(new Event(leaveEvent, { cancelable: true }));
}

type NavigationEvent = Event & {
  navigationType: string;
  destination: { url: string; sameDocument: boolean };
};

export function bindEditorNavigation(isDirty: () => boolean) {
  const navigation = (window as Window & { navigation?: EventTarget })
    .navigation;
  const allow = () => !isDirty() || window.confirm(question);
  const warn = (event: BeforeUnloadEvent) => {
    if (!isDirty()) return;
    event.preventDefault();
    event.returnValue = '';
  };
  const action = (event: Event) => {
    if (!allow()) event.preventDefault();
  };
  const traverse = (event: Event) => {
    const move = event as NavigationEvent;
    // Cross-document exits use beforeunload. Respect browser non-cancelable exits.
    if (
      move.navigationType === 'traverse' &&
      move.destination.sameDocument &&
      move.cancelable &&
      new URL(move.destination.url).pathname +
        new URL(move.destination.url).search !==
        window.location.pathname + window.location.search &&
      !allow()
    )
      move.preventDefault();
  };
  const link = (event: MouseEvent) => {
    if (
      !isDirty() ||
      event.defaultPrevented ||
      event.button !== 0 ||
      event.ctrlKey ||
      event.metaKey ||
      event.shiftKey ||
      event.altKey
    )
      return;
    const anchor =
      event.target instanceof Element ? event.target.closest('a[href]') : null;
    if (
      !(anchor instanceof HTMLAnchorElement) ||
      anchor.hasAttribute('download') ||
      (anchor.target && anchor.target !== '_self')
    )
      return;
    const destination = new URL(anchor.href, window.location.href);
    if (
      destination.origin === window.location.origin &&
      destination.pathname === window.location.pathname &&
      destination.search === window.location.search
    )
      return;
    if (!allow()) {
      event.preventDefault();
      event.stopPropagation();
    }
  };
  window.addEventListener('beforeunload', warn);
  window.addEventListener(leaveEvent, action);
  document.addEventListener('click', link, true);
  navigation?.addEventListener('navigate', traverse);
  return () => {
    window.removeEventListener('beforeunload', warn);
    window.removeEventListener(leaveEvent, action);
    document.removeEventListener('click', link, true);
    navigation?.removeEventListener('navigate', traverse);
  };
}
