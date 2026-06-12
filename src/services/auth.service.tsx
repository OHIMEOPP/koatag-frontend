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
import { setKeyBundleRef, getKeyBundleRef, KeyBundle } from "../contexts/MasterKeyContext";

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
//   3. POST /login with raw password (+ auth_password_hash) → token +
//      master_pubkey + master_privkey_wrap
//   4. aeadUnwrap master_privkey using master_key
//
// R4 hotfix (mailbox #2043): backend /login authenticates via JWTAuth::attempt
// (standard Laravel bcrypt provider reads $credentials['password']). The E2EE
// path must send the raw password — auth_password_hash is vestigial for auth
// (never verified server-side; bcrypt is the real layer, same as register's
// dual-mode and legacy login). Omitting password threw "Undefined array key
// 'password'" 500 on the first real enrolled-account login (id=1,2 rescue).
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
        password,
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
    // R4 #3 — redirect decoupled from the flow. Caller (login.tsx handleLogin)
    // decides the post-login destination so it can route id=1,2 rescue accounts
    // (still on the default password) to the forced change-password gate.
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

// R4 (Round 4 #3) — change-password flow. The X25519 master keypair is
// password-INDEPENDENT: file/folder/share keys are sealed-box'd to master_pubkey,
// and only master_privkey is wrapped under the password-derived master_key. So
// changing password = re-derive a new master_key from the new password and
// re-wrap the SAME master_privkey under it. master_pubkey is unchanged → every
// drive_files/folders/shares key_wrap stays valid, zero re-wrap.
//
// Per Round 4 §3.3 (USER LOCKED, override #1990): the old password is NOT
// required — auth is the existing JWT session. The form collects only the new
// password. derive-bundle returns freshly server-gen'd salts (§3.2 server-gen).
interface ChangePwDeriveBundleSuccess {
    status: 'ok';
    new_auth_kdf_salt: string;       // base64(16)
    new_master_key_kdf_salt: string; // base64(16)
    kdf_params: KdfParams;
}
type ChangePwDeriveBundleResponse = ChangePwDeriveBundleSuccess | DeriveBundleFail;

// Backend (mailbox #2015): success → 200 { status: 'ok' }; validation fail →
// 422 { status: 'error', reason: 'missing_fields'|'invalid_binary_length'|... }.
interface ChangePwSubmitResponse {
    status: string;
    reason?: string;
    massage?: string;
}

export class ChangePasswordError extends Error {
    constructor(message: string) {
        super(message);
        this.name = 'ChangePasswordError';
    }
}

export const changePasswordFlow = async (args: { newPassword: string }): Promise<void> => {
    const { newPassword } = args;

    // AAD source = authenticated account from the profile getUser() cached at
    // login. It MUST equal the account used when master_privkey was wrapped, or
    // the next login's aeadUnwrap tag verify fails. Never re-prompt for it.
    const userRaw = localStorage.getItem('user');
    const account: string | undefined = userRaw ? JSON.parse(userRaw)?.account : undefined;
    if (!account) {
        throw new ChangePasswordError('找不到帳號資訊，請重新登入後再試');
    }

    // master_privkey is already unwrapped in memory (set at login). We re-wrap
    // this exact key under the new master_key — never regenerate the keypair.
    const { masterPrivkey } = getKeyBundleRef();
    if (!masterPrivkey) {
        throw new ChangePasswordError('登入狀態金鑰遺失，請重新登入後再改密碼');
    }

    const bundleResp = await api.post<ChangePwDeriveBundleResponse>(`/change-password/derive-bundle`, {});
    const bundle = bundleResp.data;
    if (bundle.status !== 'ok') {
        throw new ChangePasswordError(bundle.massage || '取得 salt 失敗');
    }
    assertKdfParams(bundle.kdf_params);

    const { auth_password_hash, master_key: newMasterKey } = await deriveAuthBundle(newPassword, {
        auth_kdf_salt: bundle.new_auth_kdf_salt,
        master_key_kdf_salt: bundle.new_master_key_kdf_salt,
    });

    const aad = userIdToAad(account);
    const newPrivkeyWrap = await aeadWrap(masterPrivkey, newMasterKey, aad);

    // Body frozen with backend (mailbox #2015): 5 fields, JWT-authed, no old
    // password (§3.3). new_password is the raw password — backend Hash::make's it
    // to update the legacy bcrypt column that login actually verifies (the bcrypt
    // gap koatag caught in #2002). This reuses register's existing dual-mode
    // convention (registerFlow also posts raw password), so no new plaintext
    // exposure surface. new_auth_password_hash is base64(raw 32B), same encoding
    // as register (NOT a PHC string — confirmed via re-grep #2015).
    const resp = await api.post<ChangePwSubmitResponse>(`/change-password`, {
        new_password: newPassword,
        new_auth_password_hash: bytesToBase64(auth_password_hash),
        new_auth_kdf_salt: bundle.new_auth_kdf_salt,
        new_master_key_kdf_salt: bundle.new_master_key_kdf_salt,
        new_master_privkey_wrap_by_master_key: bytesToBase64(packWrap(newPrivkeyWrap)),
    });
    if (resp.data.status !== 'ok') {
        throw new ChangePasswordError(resp.data.reason || resp.data.massage || '改密碼失敗');
    }

    // Sync in-memory master_key (privkey/pubkey unchanged). Drive ops use
    // privkey/pubkey only, so this is consistency housekeeping for the session.
    setKeyBundleRef({ ...getKeyBundleRef(), masterKey: newMasterKey });
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
