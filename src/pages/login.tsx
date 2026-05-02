import React, { useEffect, useState } from 'react';
import { login, LoginError } from '../services/auth.service';
import { deleteCookie, getCookie, setCookie } from 'utils';
import { Btn, Field, Icon } from 'components';

const Login = () => {
    const [account, setAccount] = useState('');
    const [password, setPassword] = useState('');
    const [showPassword, setShowPassword] = useState(false);
    const [showRegister, setShowRegister] = useState(false);
    const [remember, setRemember] = useState(false);
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState('');

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
            await login(account, password);
            // login() will redirect on success via window.location.href
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

    const handleRegisterSubmit = (e: React.FormEvent) => {
        e.preventDefault();
        alert('註冊功能尚未開放');
    };

    const handleForgotPassword = (e: React.MouseEvent) => {
        e.preventDefault();
        alert('忘記密碼功能尚未開放');
    };

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

                    <Btn variant="primary" type="submit">註冊</Btn>

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
