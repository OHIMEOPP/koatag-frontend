import api from "api/axios";
import axios from "axios";
import { $message, delay } from "utils";
import {
    deriveAuthBundle,
    assertKdfParams,
    bytesToBase64,
    KdfParams,
} from "./auth/keyDerivation";
import {
    aeadWrap,
    aeadUnwrap,
    generateKeypair,
    packWrap,
    unpackWrap,
    userIdToAad,
} from "./auth/keypair";
import { setKeyBundleRef, KeyBundle } from "../contexts/MasterKeyContext";

// Backend POST /login response shape (per koatag 2026-05-02 contract):
// success → HTTP 200 + { status: 'success', massage, 'user_id(nosession)', token, expires_in }
// fail (帳號/密碼錯誤) → HTTP 200 + { status: 'login-fail', massage }
// JWT 簽發異常 → HTTP 500 + { error } (no status field)
// `massage` is a backend typo (not message) — preserved per contract.
// `user_id(nosession)` literal key (parens included) — alias to userId internally.
interface LegacyLoginSuccess {
    status: 'success';
    massage: string;
    'user_id(nosession)': number;
    token: string;
    expires_in: number;
}
interface LoginFail {
    status: 'login-fail';
    massage: string;
}
type LegacyLoginResponse = LegacyLoginSuccess | LoginFail;

// R3 #1 Design A FINAL (wiki #1492) — /login + /register success response
// adds master_pubkey + master_privkey_wrap_by_master_key (single base64 blob,
// nonce(24) || ciphertext(48) per backend #1490 VARBINARY(80) column layout).
// master_key itself is NOT in the response — client re-derives it from
// password+master_key_kdf_salt via Argon2id.
interface E2eeLoginSuccess extends LegacyLoginSuccess {
    master_pubkey: string;
    master_privkey_wrap_by_master_key: string;
}
type E2eeLoginResponse = E2eeLoginSuccess | LoginFail;

// R3 #1 §2.2 — derive-bundle endpoint response (per Catch 3 wiki lock).
// POST /{login,register}/derive-bundle Request: { account } (per Catch 6).
interface DeriveBundleSuccess {
    status: 'ok';
    auth_kdf_salt: string;       // base64(16)
    master_key_kdf_salt: string; // base64(16) — fake HMAC salt for unknown account (timing-attack防護)
    kdf_params: KdfParams;
}
interface DeriveBundleFail {
    status: 'error';
    massage: string;
}
type DeriveBundleResponse = DeriveBundleSuccess | DeriveBundleFail;

interface LogoutResponse {
    message: string;
}

export class LoginError extends Error {
    constructor(message: string) {
        super(message);
        this.name = 'LoginError';
    }
}

export class RegisterError extends Error {
    constructor(message: string) {
        super(message);
        this.name = 'RegisterError';
    }
}

export const getUser = async () => {
    try {
        const token = localStorage.getItem('token');
        if (!token) {
            alert('未登入，請先登入以取得 token');
            return;
        }
        const response = await api.get(`/getUser`);

        let userData: any = response.data;
        if (userData?.result) {
            userData = userData.result;
        } else if (userData?.data) {
            userData = userData.data;
        }

        localStorage.setItem('user', JSON.stringify(userData));

        if (userData?.id) {
            localStorage.setItem('user_id', String(userData.id));
        } else if (userData?.user_id) {
            localStorage.setItem('user_id', String(userData.user_id));
        }
    } catch (e) {
        console.error(e);
        alert(`取得使用者資料失敗 -> ${e}`);
    }
};

// R3 #1 §2.2 — legacy plaintext-password login retained for migration window.
// New E2EE flow callers should use loginFlow() which derives auth_password_hash
// client-side via Argon2id before posting to /login.
export const login = async (account: string, password: string): Promise<void> => {
    const response = await api.post<LegacyLoginResponse>(`/login`, { account, password });
    const data = response.data;

    if (data.status !== 'success') {
        throw new LoginError(data.massage || '登入失敗');
    }

    localStorage.setItem('token', data.token);
    localStorage.setItem('user_id', String(data['user_id(nosession)']));
    localStorage.setItem('tokenExpireAt', String(Date.now() + data.expires_in * 1000));

    await getUser();
    window.location.href = '/main';
};

function base64ToBytes(b64: string): Uint8Array {
    const binary = atob(b64);
    const bytes = new Uint8Array(binary.length);
    for (let i = 0; i < binary.length; i++) bytes[i] = binary.charCodeAt(i);
    return bytes;
}

// R3 #1 Design A FINAL (wiki #1492) — login flow. 4-step atomic:
//   1. /login/derive-bundle → salts + kdf_params
//   2. KDF derive { auth_password_hash, master_key } from password
//   3. POST /login with auth_password_hash → token + master_pubkey + master_privkey_wrap
//   4. aeadUnwrap master_privkey using master_key
// master_key is NOT unwrapped from a stored blob — it is re-derived from
// password each login (the salt determines stability). No password_KEK
// intermediate (that was Design B, retracted by wiki #1492).
//
// No redirect on middle failure; caller catches LoginError and surfaces
// retry UI. setMasterKeyRef + onMasterKey fire only after step 4.
export const loginFlow = async (args: {
    account: string;
    password: string;
    onKeys?: (bundle: KeyBundle) => void;
}): Promise<void> => {
    const { account, password, onKeys } = args;

    const bundleResp = await api.post<DeriveBundleResponse>(`/login/derive-bundle`, { account });
    const bundle = bundleResp.data;
    if (bundle.status !== 'ok') {
        throw new LoginError(bundle.massage || '取得 salts 失敗');
    }
    assertKdfParams(bundle.kdf_params);

    const { auth_password_hash, master_key } = await deriveAuthBundle(password, {
        auth_kdf_salt: bundle.auth_kdf_salt,
        master_key_kdf_salt: bundle.master_key_kdf_salt,
    });

    const loginResp = await api.post<E2eeLoginResponse>(`/login`, {
        account,
        auth_password_hash: bytesToBase64(auth_password_hash),
    });
    const data = loginResp.data;
    if (data.status !== 'success') {
        throw new LoginError(data.massage || '登入失敗');
    }

    const aad = userIdToAad(account);
    const masterPubkey = base64ToBytes(data.master_pubkey);

    // R3 #2 Catch 11 — master_privkey is now KEPT (R3 #1 discarded it post
    // verify-back). Drive list/folder decrypt uses crypto_box_seal_open which
    // requires master_privkey to unwrap per-resource file_keys.
    let masterPrivkey: Uint8Array;
    try {
        const packed = base64ToBytes(data.master_privkey_wrap_by_master_key);
        masterPrivkey = await aeadUnwrap(unpackWrap(packed), master_key, aad);
    } catch (err) {
        throw new LoginError('master_privkey 解密失敗 — 密碼或 wrap chain 異常');
    }

    localStorage.setItem('token', data.token);
    localStorage.setItem('user_id', String(data['user_id(nosession)']));
    localStorage.setItem('tokenExpireAt', String(Date.now() + data.expires_in * 1000));

    const keys: KeyBundle = {
        masterKey: master_key,
        masterPrivkey,
        masterPubkey,
    };
    setKeyBundleRef(keys);
    onKeys?.(keys);

    await getUser();
    window.location.href = '/main';
};

// R3 #1 Design A FINAL (wiki #1492) — register flow. 6-step atomic:
//   1. /register/derive-bundle → salts + kdf_params
//   2. KDF derive { auth_password_hash, master_key } from password
//   3. Generate X25519 keypair
//   4. aeadWrap master_privkey by master_key → packed wire blob (nonce||ciphertext)
//   5. POST /register with password (legacy bcrypt dual-mode) + auth_password_hash +
//      master_pubkey + 2 salts + master_privkey_wrap_by_master_key
//   6. setMasterKeyRef + onMasterKey
// AAD bound to account UTF-8 bytes (per Catch 7 lock).
//
// Note: plaintext password posted alongside auth_password_hash — backend keeps
// bcrypt(password) for the dual-mode migration era (per backend #1490 §1.3).
// Once migration is complete (Round 4+ scope), plaintext field can be dropped.
export const registerFlow = async (args: {
    account: string;
    password: string;
    onKeys?: (bundle: KeyBundle) => void;
}): Promise<void> => {
    const { account, password, onKeys } = args;

    const bundleResp = await api.post<DeriveBundleResponse>(`/register/derive-bundle`, { account });
    const bundle = bundleResp.data;
    if (bundle.status !== 'ok') {
        throw new RegisterError(bundle.massage || '取得 salts 失敗');
    }
    assertKdfParams(bundle.kdf_params);

    const { auth_password_hash, master_key } = await deriveAuthBundle(password, {
        auth_kdf_salt: bundle.auth_kdf_salt,
        master_key_kdf_salt: bundle.master_key_kdf_salt,
    });

    const aad = userIdToAad(account);
    const keypair = await generateKeypair();
    const master_privkey_wrap = await aeadWrap(keypair.privateKey, master_key, aad);

    const registerResp = await api.post<E2eeLoginResponse>(`/register`, {
        account,
        password,
        auth_password_hash: bytesToBase64(auth_password_hash),
        master_pubkey: bytesToBase64(keypair.publicKey),
        auth_kdf_salt: bundle.auth_kdf_salt,
        master_key_kdf_salt: bundle.master_key_kdf_salt,
        master_privkey_wrap_by_master_key: bytesToBase64(packWrap(master_privkey_wrap)),
    });
    const data = registerResp.data;
    if (data.status !== 'success') {
        throw new RegisterError(data.massage || '註冊失敗');
    }

    localStorage.setItem('token', data.token);
    localStorage.setItem('user_id', String(data['user_id(nosession)']));
    localStorage.setItem('tokenExpireAt', String(Date.now() + data.expires_in * 1000));

    // R3 #2 Catch 11 — keep privkey (we just generated it client-side, no
    // need to round-trip through unwrap chain).
    const keys: KeyBundle = {
        masterKey: master_key,
        masterPrivkey: keypair.privateKey,
        masterPubkey: keypair.publicKey,
    };
    setKeyBundleRef(keys);
    onKeys?.(keys);

    await getUser();
    window.location.href = '/main';
};

export const logout = async () => {
    try {
        await axios.post<LogoutResponse>(`${process.env.REACT_APP_API_URL}/logout`);
        $message("即將登出請稍後...");
        await delay(2);
    } catch (e) {
        alert(`登出失敗 -> ${e}`);
    } finally {
        // R3 #4 §1.8 5-layer logout zero-out:
        //   1. master_key/master_privkey/master_pubkey in-memory bundle
        //   2. localStorage (token + user)
        //   3. sessionStorage (upload session_id resume token)
        //   4. Web Worker termination (encrypt + decrypt)
        //   5. decryptedAssetStore ObjectURL purge (thumb/full caches)
        setKeyBundleRef({ masterKey: null, masterPrivkey: null, masterPubkey: null });
        try {
            // Lazy import to keep auth.service free of decrypt worker deps in
            // non-logout call paths; intentionally fire-and-forget on failure.
            const { decryptedAssetStore } = await import('../stores/decryptedAssetStore');
            decryptedAssetStore.clear();
        } catch { /* non-fatal */ }
        try {
            const { terminateEncryptWorker } = await import('./crypto/encryptWorkerClient');
            terminateEncryptWorker();
        } catch { /* non-fatal */ }
        try {
            const { terminateDecryptWorker } = await import('./crypto/decryptClient');
            terminateDecryptWorker();
        } catch { /* non-fatal */ }
        try {
            // R3 #5 §1.8 6th layer — sharedWithMeStore cleartext file/thumb
            // keys for incoming shares + notify polling teardown.
            const { useSharedWithMeStore } = await import('../stores/sharedWithMeStore');
            useSharedWithMeStore.getState().clear();
            const { useIncomingShareNotifyStore } = await import('../stores/incomingShareNotifyStore');
            useIncomingShareNotifyStore.getState().reset();
        } catch { /* non-fatal */ }
        sessionStorage.clear();
        localStorage.clear();
        window.location.href = '/login';
    }
};
