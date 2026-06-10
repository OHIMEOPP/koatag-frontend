import React, { createContext, useCallback, useContext, useState, useMemo } from 'react';

// R3 #1 §2.4 + R3 #2 Catch 11 — master_key state lives in-memory only.
// Token stays in localStorage (auth bearer); the three E2EE secrets are
// separate trust layers and never persist across tab refresh.
//
// Layer roles:
//   - masterKey    = Argon2id-derived from password (R3 #1 Design A);
//                    AEAD key for master_privkey wrap chain verify-back
//   - masterPrivkey = X25519 private key, decrypted at login via masterKey;
//                    used for crypto_box_seal_open of per-resource key_wrap
//                    (drive_files.key_wrap / drive_folders.key_wrap etc.)
//   - masterPubkey  = X25519 public key, fetched server-side at login;
//                    handed to share grantors so they can seal-box file keys for us
//
// On tab refresh: all three reset to null → app detect missing keys but
// token present → force re-login flow (per R3 #1 Catch 4 lock; modal UX
// follow-up).

export interface KeyBundle {
  masterKey: Uint8Array | null;
  masterPrivkey: Uint8Array | null;
  masterPubkey: Uint8Array | null;
}

interface MasterKeyState extends KeyBundle {
  setKeys: (bundle: KeyBundle) => void;
  clearKeys: () => void;
}

const EMPTY: KeyBundle = { masterKey: null, masterPrivkey: null, masterPubkey: null };

const MasterKeyContext = createContext<MasterKeyState>({
  ...EMPTY,
  setKeys: () => {},
  clearKeys: () => {},
});

export const MasterKeyProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [bundle, setBundle] = useState<KeyBundle>(EMPTY);

  const setKeys = useCallback((next: KeyBundle) => {
    setBundle(next);
  }, []);

  const clearKeys = useCallback(() => {
    setBundle(EMPTY);
  }, []);

  const value = useMemo(
    () => ({ ...bundle, setKeys, clearKeys }),
    [bundle, setKeys, clearKeys],
  );

  return <MasterKeyContext.Provider value={value}>{children}</MasterKeyContext.Provider>;
};

export function useMasterKey(): MasterKeyState {
  return useContext(MasterKeyContext);
}

// Imperative escape hatch for non-React callers (axios interceptors, service
// modules). Mirrors the Context state. Updated by auth.service after login
// success and by logout. Reading from here in render-time React code is
// wrong — use useMasterKey hook instead.
let _ref: KeyBundle = EMPTY;
export function getKeyBundleRef(): KeyBundle {
  return _ref;
}
export function setKeyBundleRef(bundle: KeyBundle): void {
  _ref = bundle;
}
