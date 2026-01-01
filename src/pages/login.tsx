import { useState, useEffect, useRef } from 'react';
import style from '../style/account.module.scss';
import { login } from '../services/auth.service';
import { deleteCookie, getCookie, setCookie } from 'utils';
import { Button } from 'components';



const Login = () => {
    const passwordRef = useRef<HTMLInputElement>(null);

    // 狀態管理
    const [account, setAccount] = useState<string>('');
    const [password, setPassword] = useState<string>('');
    const [showPassword, setShowPassword] = useState<boolean>(false);
    const [showRegister, setShowRegister] = useState<boolean>(false);
    const [remember, setRemember] = useState<boolean>(false);
    const [loading, setLoading] = useState(false);

    // 載入時檢查 cookie 有無記住帳號
    useEffect(() => {
        const savedAccount = getCookie('rememberAccount');
        if (savedAccount) {
            setAccount(savedAccount);
            setRemember(true);
        }
    }, []);

    const handleLogin = async (e: React.FormEvent) => {
        e.preventDefault();
        setLoading(true);

        // 如果勾選記住帳號 → 寫入 cookie（保存 30 天）
        if (remember) {
            setCookie('rememberAccount', account, 30);
        } else {
            deleteCookie('rememberAccount');
        }

        await login(account, password);
         setLoading(false);
    };

    const handleTogglePassword = () => {
        if (!passwordRef.current) return;
        setShowPassword(!showPassword);
        passwordRef.current.type = showPassword ? 'password' : 'text';
    };

    return (
        <div className="mainframe">
            <div className={style.topcontainer}>
                <a href="/login">OHIMEOPP素材網</a>
            </div>

            <div className={style.container1}>
                <div className={style.logintitle}>會員登入</div>

                {!showRegister ? (
                    <form method="post" onSubmit={handleLogin}>
                        <div className={style.login}>
                            {/* 帳號輸入 */}
                            <div className={style.passwordzone}>
                                <input
                                    id="account"
                                    type="text"
                                    value={account}
                                    onChange={(e) => setAccount(e.target.value)}
                                    placeholder="輸入帳號"
                                    required
                                />
                            </div>

                            {/* 密碼輸入 */}
                            <div className={style.passwordzone}>
                                <input
                                    id="password"
                                    ref={passwordRef}
                                    type={showPassword ? 'text' : 'password'}
                                    value={password}
                                    onChange={(e) => setPassword(e.target.value)}
                                    placeholder="輸入密碼"
                                    required
                                />
                                <a href="#" onClick={handleTogglePassword}>
                                    <i className="material-icons">
                                        {showPassword ? 'visibility' : 'visibility_off'}
                                    </i>
                                </a>
                            </div>

                            {/* 記住帳號 */}
                            <div className={style.rememberZone}>
                                <label className='d-flex justify-content-center align-items-center'>
                                    <input
                                        type="checkbox"
                                        checked={remember}
                                        onChange={(e) => setRemember(e.target.checked)}
                                    />
                                    <a>記住帳號</a>
                                </label>
                            </div>

                            {/* 登入按鈕 */}
                            <div>
                                <Button loading={loading} className={style.submit_bt} type={'submit'} text="登入" loadingText='登入中...'/>
                            </div>

                            {/* 註冊與忘記密碼 */}
                            <div className={style.switchRegister}>
                                <span className={style.forgotZone}>
                                    還沒有帳號嗎?{' '}
                                    <a href="#" onClick={() => setShowRegister(true)}>註冊帳號</a>
                                </span>
                                <br />
                                <span className={style.forgotZone}>
                                    忘記密碼？{' '}
                                    <a
                                        href="#"
                                        onClick={(e) => {
                                            e.preventDefault();
                                            alert('忘記密碼功能尚未開放');
                                        }}
                                    >
                                        點我重設
                                    </a>
                                </span>
                            </div>
                        </div>
                    </form>
                ) : (
                    <form method="post">
                        <div className={style.login}>
                            <div className="switch-login">
                                <a onClick={() => setShowRegister(false)} style={{ cursor: 'pointer' }}>
                                    返回登入
                                </a>
                            </div>
                            <input type="text" name="increaseaccount" id="signAccount" placeholder="輸入帳號" />
                            <div className="tab"></div>
                            <input type="text" name="increasepassword" id="signPassword" placeholder="輸入密碼" />
                            <div className="tab"></div>
                            <button type="submit" className={style.submit_bt}>註冊</button>
                        </div>
                    </form>
                )}
            </div>
        </div>
    );
};

export { Login };
