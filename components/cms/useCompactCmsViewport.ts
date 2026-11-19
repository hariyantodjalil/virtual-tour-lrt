import { useSyncExternalStore } from "react";

const compactQuery = "(width < 64rem)";

function subscribe(listener: () => void) {
  const mediaQuery = window.matchMedia(compactQuery);
  mediaQuery.addEventListener("change", listener);
  return () => mediaQuery.removeEventListener("change", listener);
}

const getSnapshot = () => window.matchMedia(compactQuery).matches;
const getServerSnapshot = () => false;

export function useCompactCmsViewport() {
  return useSyncExternalStore(subscribe, getSnapshot, getServerSnapshot);
}
