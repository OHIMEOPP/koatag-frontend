import React, { useState } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { changePasswordFlow, ChangePasswordError } from '../../services/auth.service';
import { $message } from 'utils';
import { Btn, Field, Icon } from 'components';

// R4 #3 — change-password page. Two modes share one component:
//   - normal (self-serve from settings): has a 返回 link
//   - forced (?forced=1): id=1,2 rescue accounts landed here right after logging
//     in with the default password. No skip/back; must set a new password to
//     leave. Per Round 4 §3.3 the form takes only new + confirm (no old password).
const MIN_LEN = 8;

const ChangePasswordPage: React.FC = () => {
    const [searchParams] = useSearchParams();
    const forced = searchParams.get('forced') === '1';
    const navigate = useNavigate();

    const [newPassword, setNewPassword] = useState('');
    const [confirm, setConfirm] = useState('');
    const [showPassword, setShowPassword] = useState(false);
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState('');

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        setError('');

        if (newPassword.length < MIN_LEN) {
            setError(`新密碼至少需 ${MIN_LEN} 個字元`);
            return;
        }
        if (newPassword !== confirm) {
            setError('兩次輸入的新密碼不一致');
            return;
        }

        setLoading(true);
        try {
            await changePasswordFlow({ newPassword });
            $message('密碼已更新');
            if (forced) {
                // Full reload so the gate re-evaluates with the new password
                // (which no longer matches the default → no re-trigger).
                window.location.href = '/main';
            } else {
                navigate('/main/front_page');
            }
        } catch (err) {
            if (err instanceof ChangePasswordError) {
                setError(err.message);
            } else {
                setError('改密碼時發生錯誤，請稍後再試');
                console.error(err);
            }
            setLoading(false);
        }
    };

    return (
        <div className="login-wrap">
            <div className="login-bg" />
            <div className="login-grid" />
            <form className="login-card" onSubmit={handleSubmit}>
                <div className="login-brand">
                    <div className="brand-mark">K</div>
                    <div>
                        <div className="brand-text">KOATAG</div>
                        <div className="brand-text-2">IMAGE TAG SYSTEM</div>
                    </div>
                </div>
                <h1 className="login-title">{forced ? '請設定新密碼' : '變更密碼'}</h1>
                <p className="login-sub">
                    {forced
                        ? '您目前使用的是預設密碼，請先設定自己的新密碼才能繼續使用。'
                        : '為您的帳號設定新的登入密碼'}
                </p>

                {forced && (
                    <div className="login-error" role="alert">
                        為了帳號安全，未設定新密碼前無法進入系統。
                    </div>
                )}

                {error && <div className="login-error">{error}</div>}

                <Field label="新密碼">
                    <div style={{ position: 'relative' }}>
                        <input
                            className="input"
                            name="newPassword"
                            type={showPassword ? 'text' : 'password'}
                            value={newPassword}
                            onChange={(e) => setNewPassword(e.target.value)}
                            placeholder={`至少 ${MIN_LEN} 個字元`}
                            autoComplete="new-password"
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
                <div style={{ height: 14 }} />
                <Field label="確認新密碼">
                    <input
                        className="input"
                        name="confirmPassword"
                        type={showPassword ? 'text' : 'password'}
                        value={confirm}
                        onChange={(e) => setConfirm(e.target.value)}
                        placeholder="再次輸入新密碼"
                        autoComplete="new-password"
                        required
                    />
                </Field>

                <div style={{ height: 24 }} />

                <Btn variant="primary" type="submit" disabled={loading}>
                    {loading ? '更新中...' : '設定新密碼'}
                </Btn>

                {!forced && (
                    <div className="login-foot">
                        <a href="#" onClick={(e) => { e.preventDefault(); navigate(-1); }}>
                            返回
                        </a>
                    </div>
                )}
            </form>
        </div>
    );
};

export default ChangePasswordPage;
