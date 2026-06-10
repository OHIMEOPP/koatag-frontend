import { create } from "zustand";

// R3 #7 §2.2.5 — tracks whether the user has dismissed the one-time E2EE upload
// trust banner. Persisted in localStorage so it stays dismissed across sessions
// (USER LOCKED §3 #6 — one-time banner + persistent info icon).

const DISMISS_KEY = "koatag.e2ee.uploadDisclosureDismissed.v1";

function readDismissed(): boolean {
  try {
    return localStorage.getItem(DISMISS_KEY) === "1";
  } catch {
    // localStorage unavailable (private mode etc.) — treat as not-yet-dismissed;
    // the banner simply shows each visit, which is the safe (more-informative)
    // direction.
    return false;
  }
}

interface DisclosureState {
  bannerDismissed: boolean;
  dismissBanner: () => void;
}

export const useDisclosureStore = create<DisclosureState>((set) => ({
  bannerDismissed: readDismissed(),
  dismissBanner: () => {
    try {
      localStorage.setItem(DISMISS_KEY, "1");
    } catch {
      // non-fatal — state still updates for this session
    }
    set({ bannerDismissed: true });
  },
}));
