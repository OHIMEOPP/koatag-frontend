import React, { useEffect, useState } from 'react';
import { loginFlow, registerFlow, LoginError, RegisterError } from '../services/auth.service';
import { useMasterKey } from '../contexts/MasterKeyContext';
import { deleteCookie, getCookie, setCookie } from 'utils';
import { Btn, Field, Icon } from 'components';
import ChangePasswordPage from './settings/ChangePasswordPage';

// R4 #3 — id=1,2 rescue gate. These accounts are force-enrolled into E2EE with
// a known default password; on their first login (typing that default) we push
// them to set their own password before entering. Pure client-side, zero schema:
// self-clearing because once the password is changed it no longer matches the
// default, so the gate never fires again. Removable once both are confirmed done.
const RESCUE_USER_IDS = ['1', '2'];
const RESCUE_DEFAULT_PASSWORD = 'e2ee12345';

const Login = () => {
    const [account, setAccount] = useState('');
    const [password, setPassword] = useState('');
    const [showPassword, setShowPassword] = useState(false);
    const [showRegister, setShowRegister] = useState(false);
    const [remember, setRemember] = useState(false);
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState('');
    // R4 #3 — id=1,2 rescue: render the forced change-password page inline (no
    // navigation/reload) so the in-memory master key bundle survives for it.
    const [forcedChange, setForcedChange] = useState(false);
    const { setKeys } = useMasterKey();

    useEffect(() => {
        const saved = getCookie('rememberAccount');
        if (saved) {
            setAccount(saved);
            setRemember(true);
        }
    }, []);

    const handleLogin = async (e: React.FormEvent) => {
        e.preventDefault();
        setError('');
        setLoading(true);

        if (remember) {
            setCookie('rememberAccount', account, 30);
        } else {
            deleteCookie('rememberAccount');
        }

        try {
            await loginFlow({ account, password, onKeys: setKeys });
            // R4 #3 — loginFlow no longer redirects; caller picks the destination.
            // Route id=1,2 rescue accounts (still on the default password) to the
            // forced change-password gate; everyone else goes to the app.
            const uid = localStorage.getItem('user_id');
            const mustChangePw =
                uid !== null &&
                RESCUE_USER_IDS.includes(uid) &&
                password === RESCUE_DEFAULT_PASSWORD;
            if (mustChangePw) {
                // Inline-render the forced change-password page WITHOUT navigating.
                // A full reload (or even SPA nav) would drop the in-memory master
                // key bundle loginFlow just unwrapped, leaving changePasswordFlow
                // with no privkey ("金鑰遺失"). Staying in this component keeps it
                // alive. No shell/sidebar is rendered here, so the forced page also
                // can't be escaped — the lock is inherent.
                setForcedChange(true);
                return;
            }
            window.location.href = '/main';
        } catch (err) {
            if (err instanceof LoginError) {
                setError(err.message);
            } else {
                setError('登入時發生錯誤，請稍後再試');
                console.error(err);
            }
            setLoading(false);
        }
    };

    const handleRegisterSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        setError('');
        setLoading(true);

        const form = e.currentTarget as HTMLFormElement;
        const regAccount = (form.elements.namedItem('signAccount') as HTMLInputElement)?.value ?? '';
        const regPassword = (form.elements.namedItem('signPassword') as HTMLInputElement)?.value ?? '';

        try {
            await registerFlow({ account: regAccount, password: regPassword, onKeys: setKeys });
        } catch (err) {
            if (err instanceof RegisterError) {
                setError(err.message);
            } else {
                setError('註冊時發生錯誤，請稍後再試');
                console.error(err);
            }
            setLoading(false);
        }
    };

    const handleForgotPassword = (e: React.MouseEvent) => {
        e.preventDefault();
        alert('忘記密碼功能尚未開放');
    };

    // R4 #3 rescue — forced change-password rendered inline (same JS context as
    // the just-completed login, so the in-memory master key bundle is intact).
    if (forcedChange) {
        return <ChangePasswordPage forced />;
    }

    return (
        <div className="login-wrap">
            <div className="login-bg" />
            <div className="login-grid" />

            {!showRegister ? (
                <form className="login-card" onSubmit={handleLogin}>
                    <div className="login-brand">
                        <div className="brand-mark">K</div>
                        <div>
                            <div className="brand-text">KOATAG</div>
                            <div className="brand-text-2">IMAGE TAG SYSTEM</div>
                        </div>
                    </div>
                    <h1 className="login-title">會員登入</h1>
                    <p className="login-sub">用您的帳號繼續管理圖庫</p>

                    {error && <div className="login-error">{error}</div>}

                    <Field label="帳號">
                        <input
                            className="input"
                            name="account"
                            value={account}
                            onChange={(e) => setAccount(e.target.value)}
                            placeholder="輸入帳號"
                            autoComplete="username"
                            required
                        />
                    </Field>
                    <div style={{ height: 14 }} />
                    <Field label="密碼">
                        <div style={{ position: 'relative' }}>
                            <input
                                className="input"
                                name="password"
                                type={showPassword ? 'text' : 'password'}
                                value={password}
                                onChange={(e) => setPassword(e.target.value)}
                                placeholder="輸入密碼"
                                autoComplete="current-password"
                                required
                            />
                            <button
                                type="button"
                                className="login-pwd-toggle"
                                onClick={() => setShowPassword((s) => !s)}
                                aria-label={showPassword ? '隱藏密碼' : '顯示密碼'}
                            >
                                {showPassword ? <Icon.eyeOff /> : <Icon.eye />}
                            </button>
                        </div>
                    </Field>

                    <div className="field-row" style={{ margin: '16px 0 20px' }}>
                        <label style={{ display: 'flex', alignItems: 'center', gap: 8, fontSize: 12.5, color: 'var(--color-text-secondary)' }}>
                            <input
                                type="checkbox"
                                checked={remember}
                                onChange={(e) => setRemember(e.target.checked)}
                            />
                            記住帳號 30 天
                        </label>
                        <a
                            href="#"
                            onClick={handleForgotPassword}
                            style={{ fontSize: 12.5, color: 'var(--color-primary-light)', textDecoration: 'none' }}
                        >
                            忘記密碼?
                        </a>
                    </div>

                    <Btn variant="primary" type="submit" disabled={loading}>
                        {loading ? '登入中...' : <>登入 <Icon.chevronRight size={15} /></>}
                    </Btn>

                    <div className="login-foot">
                        還沒有帳號嗎?{' '}
                        <a href="#" onClick={(e) => { e.preventDefault(); setShowRegister(true); setError(''); }}>
                            註冊帳號
                        </a>
                    </div>
                </form>
            ) : (
                <form className="login-card" onSubmit={handleRegisterSubmit}>
                    <div className="login-brand">
                        <div className="brand-mark">K</div>
                        <div>
                            <div className="brand-text">KOATAG</div>
                            <div className="brand-text-2">IMAGE TAG SYSTEM</div>
                        </div>
                    </div>
                    <h1 className="login-title">註冊帳號</h1>
                    <p className="login-sub">建立你的 KOATAG 帳號</p>

                    <Field label="帳號">
                        <input className="input" name="signAccount" placeholder="輸入帳號" required />
                    </Field>
                    <div style={{ height: 14 }} />
                    <Field label="密碼">
                        <input className="input" type="password" name="signPassword" placeholder="輸入密碼" required />
                    </Field>

                    <div style={{ height: 24 }} />

                    {error && <div className="login-error">{error}</div>}

                    <Btn variant="primary" type="submit" disabled={loading}>
                        {loading ? '註冊中...' : '註冊'}
                    </Btn>

                    <div className="login-foot">
                        已有帳號?{' '}
                        <a href="#" onClick={(e) => { e.preventDefault(); setShowRegister(false); }}>
                            返回登入
                        </a>
                    </div>
                </form>
            )}
        </div>
    );
};

export { Login };
