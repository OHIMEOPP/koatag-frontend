import { Routes, Route, Navigate, Link, useLocation } from 'react-router-dom';
import React, { useEffect, useRef, useState } from 'react';
import { Tooltip } from 'react-tooltip';

import LayOut from './LayOut';
import { Image_area, Image_page, Upload_area, Front_page, History } from 'pages'

import './style/style.scss'
import './style/message/message.scss'
import './style/main.scss';

import { getAllTag } from 'services/tag.service';
import { TagData, FloatIconAndList, MetaHead } from 'components';
import { Classifier, getFilePath } from 'utils';
import { fetchIcon } from 'services/image.service';
import { logout } from 'services/auth.service';
import { MenuList } from 'constans';

const pages = [
    { name: '首頁', path: 'front_page', pageName: Front_page },
    { name: '上傳區', path: 'upload_area', pageName: Upload_area },
    { name: '圖庫', path: 'image_area', pageName: Image_area },
];

const userRaw = localStorage.getItem('user');
const user = userRaw ? JSON.parse(userRaw) : null;
const user_id: string = user ? user.id : '0';
const defaultBg = `/backgroundImg.jpg`;
const Main = () => {
    const [isCollapsed, setIsCollapsed] = useState(false);
    const location = useLocation().pathname;

    useEffect(() => {
        const backGoundImage = localStorage.getItem('backGoundImage');
        if (backGoundImage) {
            document.body.style.backgroundImage = `url(${getFilePath(user_id, backGoundImage)})`;
            return;
        };

        fetchIcon('check_img_type', 'backGoundImage', String(user_id))
            .then(response => {
                const BGImage = new Image();
                console.log(getFilePath(user_id, response.result.img_path));
                BGImage.src = getFilePath(user_id, response.result.img_path);
                BGImage.onload = () => {
                    localStorage.setItem('backGoundImage', response.result.img_path)
                    document.body.style.backgroundImage = `url(${getFilePath(user_id, response.result.img_path)})`;
                }
                BGImage.onerror = () => {
                    document.body.style.backgroundImage = `url(${defaultBg})`;
                }
            })

    }, [user_id]);

    return (
        <>
            <MetaHead
                title="首頁 - KOATAG"
                description="這是一個標籤圖片網站"
                favicon="/favicon.ico"
            />
            <div className='cl'>

                <FloatIconAndList
                    pages={pages}
                    setIsCollapsed={setIsCollapsed}
                />
                <div className='main_container'>
                    <div className={`iconListWindow ${isCollapsed ? 'collapsed' : ''}`}>
                        <ul className='iconList mt-4'>
                            {MenuList.map((item, idx) => (
                                <li key={idx} className={`${item.iconlisturl} ${location.split('/')[2] === item.iconlisturl ? 'c' : ''}`}>
                                    <Link
                                        to={`/main/${item.iconlisturl}`}
                                        onClick={async (e) => {
                                            if (item.iconlistname === '登出') {
                                                e.preventDefault();
                                                await logout();
                                            }
                                        }}
                                    >
                                        <i className={`koatagIcon fa ${item.icon}`}></i>
                                        {item.iconlistname}
                                    </Link>
                                </li>
                            ))}
                        </ul>
                    </div>

                    <LayOut>
                        <Routes>
                            {pages.map((page) => (
                                <Route key={page.path} path={page.path} element={React.createElement(page.pageName)} />
                            ))}
                            {/* { name: '圖庫', path: 'image_page', pageName: Image_page }, */}
                            <Route path={'image_page'} element={React.createElement(Image_page)} />
                            <Route path={'history'} element={React.createElement(History)} />
                            <Route path="" element={<Navigate to="front_page" replace />} />
                        </Routes>
                    </LayOut>
                </div>
            </div>
            <Tooltip style={{ zIndex: 999 }} id="tooltip" />
        </>
    );
}
export default Main;