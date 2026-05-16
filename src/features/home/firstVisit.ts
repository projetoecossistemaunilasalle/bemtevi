const FIRST_VISIT_STORAGE_KEY = 'secuida:onboarding-seen';
let hasVisitedFallback = false;

function getStorage() {
  if (typeof window === 'undefined') {
    return null;
  }

  try {
    return window.localStorage;
  } catch {
    return null;
  }
}

export function isFirstVisit() {
  const storage = getStorage();

  if (!storage) {
    return !hasVisitedFallback;
  }

  try {
    return storage.getItem(FIRST_VISIT_STORAGE_KEY) !== 'true';
  } catch {
    return !hasVisitedFallback;
  }
}

export function markVisited() {
  hasVisitedFallback = true;

  const storage = getStorage();

  if (!storage) {
    return;
  }

  try {
    storage.setItem(FIRST_VISIT_STORAGE_KEY, 'true');
  } catch {
    // Keep the in-memory fallback for browsers that expose but block storage.
  }
}
