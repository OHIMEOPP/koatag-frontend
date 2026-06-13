import { Routes, Route, Navigate } from 'react-router-dom';
import React, { Suspense, lazy, useEffect } from 'react';
import { Tooltip } from 'react-tooltip';

import LayOut from './LayOut';
import { Image_area, Image_page, Upload_area, Front_page, History } from 'pages'

import './style/style.scss'
import './style/message/message.scss'
import './style/main.scss';
import './style/v3/index.scss';


import { AppShell, MetaHead } from 'components';
import { RequireKeys } from 'components/drive';
import { getFilePath } from 'utils';
import { fetchIcon } from 'services/image.service';

// Drive 走 lazy load — feature 較大且不是每個 user 必進入
const DrivePage = lazy(() => import('pages/drive/DrivePage'));
// R4 #3 — change-password 頁（自願改 + id=1,2 首登強制 gate 共用）
const ChangePasswordPage = lazy(() => import('pages/settings/ChangePasswordPage'));

const userRaw = localStorage.getItem('user');
const user = userRaw ? JSON.parse(userRaw) : null;
const user_id: string = user ? user.id : '0';
const defaultBg = `/backgroundImg.jpg`;

const Main = () => {
    useEffect(() => {
        const backGoundImage = localStorage.getItem('backGoundImage');
        if (backGoundImage) {
            document.body.style.backgroundImage = `url(${getFilePath(user_id, backGoundImage)})`;
            return;
        };

        fetchIcon('check_img_type', 'backGoundImage')
            .then(response => {
                const imgPath = response?.result?.img_path;
                if (!imgPath) {
                    document.body.style.backgroundImage = `url(${defaultBg})`;
                    return;
                }
                const BGImage = new Image();
                BGImage.src = getFilePath(user_id, imgPath);
                BGImage.onload = () => {
                    localStorage.setItem('backGoundImage', imgPath)
                    document.body.style.backgroundImage = `url(${getFilePath(user_id, imgPath)})`;
                }
                BGImage.onerror = () => {
                    document.body.style.backgroundImage = `url(${defaultBg})`;
                }
            })

    }, []);

    return (
        <>
            <MetaHead
                title="首頁 - KOATAG"
                description="這是一個標籤圖片網站"
                favicon="/favicon.ico"
            />
            <AppShell>
                <LayOut>
                    <Routes>
                        <Route path="front_page"  element={<Front_page />} />
                        <Route path="upload_area" element={<Upload_area />} />
                        <Route path="image_area"  element={<Image_area />} />
                        <Route path="image_page"  element={<Image_page />} />
                        <Route path="history"     element={<History />} />
                        <Route path="drive/*"     element={
                          <Suspense fallback={<div className="drive-loading">載入中…</div>}>
                            {/* R2 #4 cutover — force-re-login gate at the Drive
                                boundary: refresh washes in-memory E2EE keys, so
                                guard every encrypted write/decrypt with a re-login. */}
                            <RequireKeys>
                              <DrivePage />
                            </RequireKeys>
                          </Suspense>
                        } />
                        <Route path="settings/password" element={
                          <Suspense fallback={<div className="drive-loading">載入中…</div>}>
                            <ChangePasswordPage />
                          </Suspense>
                        } />
                        <Route path=""            element={<Navigate to="front_page" replace />} />
                    </Routes>
                </LayOut>
            </AppShell>
            <Tooltip style={{ zIndex: 999 }} id="tooltip" />
        </>
    );
}
export default Main;
