import React, { useEffect, useRef, useState } from 'react';
import { Link, useSearchParams } from 'react-router-dom';
import axios from 'axios';
import api from 'api/axios';

// 驗證信連結點進來的頁面，不用登入
type State = 'checking' | 'verified' | 'already_verified' | 'expired' | 'invalid' | 'error';

const TEXT: Record<State, { title: string; message: string }> = {
    checking: { title: '驗證中', message: '正在確認驗證連結…' },
    verified: { title: '驗證完成', message: 'email 已驗證，現在可以登入了。' },
    already_verified: { title: '已經驗證過了', message: '這個 email 先前已完成驗證，直接登入即可。' },
    expired: { title: '連結已過期', message: '驗證連結已超過有效時間，請到登入頁輸入帳號密碼登入，再按「重寄驗證信」。' },
    invalid: { title: '連結無效', message: '驗證連結不完整或已失效，請確認是否複製了完整的網址。' },
    error: { title: '暫時無法驗證', message: '連線發生問題，請稍後重新整理這個頁面。' },
};

const VerifyEmail: React.FC = () => {
    const [params] = useSearchParams();
    const [state, setState] = useState<State>('checking');
    // 開發模式 effect 會跑兩次，只送一次
    const sentRef = useRef(false);

    useEffect(() => {
        if (sentRef.current) {
            return;
        }
        sentRef.current = true;

        const verify = async () => {
            try {
                const res = await api.post(`/email/verify`, {
                    id: params.get('id'),
                    hash: params.get('hash'),
                    expires: params.get('expires'),
                    signature: params.get('signature'),
                });
                if (res.data?.result === 'already_verified') {
                    setState('already_verified');
                } else {
                    setState('verified');
                }
            } catch (e) {
                if (axios.isAxiosError(e) && e.response?.data?.reason === 'expired') {
                    setState('expired');
                } else if (axios.isAxiosError(e) && e.response?.status === 422) {
                    setState('invalid');
                } else {
                    setState('error');
                }
            }
        };
        verify();
    }, [params]);

    let noticeClass = 'login-error';
    if (state === 'verified' || state === 'already_verified') {
        noticeClass = 'login-notice';
    }

    return (
        <div className="login-wrap">
            <div className="login-bg" />
            <div className="login-grid" />
            <div className="login-card">
                <div className="login-brand">
                    <div className="brand-mark">K</div>
                    <div>
                        <div className="brand-text">KOATAG</div>
                        <div className="brand-text-2">IMAGE TAG SYSTEM</div>
                    </div>
                </div>
                <h1 className="login-title" style={{ marginBottom: 20 }}>{TEXT[state].title}</h1>
                {state === 'checking' && <p className="login-sub">{TEXT[state].message}</p>}
                {state !== 'checking' && <div className={noticeClass}>{TEXT[state].message}</div>}
                {state !== 'checking' && (
                    <Link to="/login" className="btn btn-primary" style={{ width: '100%', justifyContent: 'center' }}>
                        前往登入
                    </Link>
                )}
            </div>
        </div>
    );
};

export { VerifyEmail };
