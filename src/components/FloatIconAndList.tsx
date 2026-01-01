import React, { useState, useEffect, useRef } from 'react';
import { Link } from 'react-router-dom';
import { logout } from '../services/auth.service'
import { fetchIcon } from '../services/image.service'
import { getFilePath } from 'utils';
import { getAllTag } from 'services/tag.service';
import { TagData } from './types/tags';
import { TagInput } from './TagInput';

// import '../style/main.scss'

interface FloatIconAndListProps {
    pages: {
        name: string;
        path: string;
        pageName: React.FC<{}>;
    }[];
    setIsCollapsed: (value: React.SetStateAction<boolean>) => void
}

const FloatIconAndList: React.FC<FloatIconAndListProps> = ({ pages, setIsCollapsed }) => {
    const [visible, setVisible] = useState(false);
    const floaticonwindow = useRef<HTMLDivElement>(null);
    const [tagData, setTagData] = useState<TagData[]>([]);
    const formRef = useRef<HTMLFormElement>(null);

    const toggleWindow = () => {
        setVisible((prev) => !prev);
    };

    const handleClickOutside = (event: MouseEvent) => {
        if (floaticonwindow.current && !floaticonwindow.current.contains(event.target as Node)) {
            setVisible(true);
        }
    };
    const user_id = localStorage.getItem('user_id');

    useEffect(() => {
        if (visible) {
            document.addEventListener('click', handleClickOutside);
        } else {
            document.removeEventListener('click', handleClickOutside);
        }

        return () => {
            document.removeEventListener('click', handleClickOutside);
        };
    }, [visible]);
    const [imgUrl, setImgUrl] = useState('');

    useEffect(() => {
        const localIcon = async () => {
            if (!user_id) return;
            const icon = localStorage.getItem('icon');
            if (!icon) {
                const response = await fetchIcon('check_img_type', 'icon', user_id);
                const icon = new Image();
                icon.src = getFilePath(user_id, response.result.img_path);
                icon.onload = () => {
                    localStorage.setItem('icon', getFilePath(user_id, response.result.img_path));
                    setImgUrl(getFilePath(user_id, response.result.img_path));
                }
            }
            else {
                setImgUrl(icon);
            }
        }
        localIcon();
        // 取搜尋區使用的所有tag
        getAllTag()
            .then(res => {
                if (!res) return;
                console.log(res)
                setTagData(res.result);
            })
    }, [user_id]);


    return (
        <>
            <div className="menu">
                <div className='menuleft' style={{ display: 'flex' }}>
                    <div className='iconbtlabel' onClick={() => setIsCollapsed(prev => !prev)}>
                        <img src={imgUrl} alt="icon" />
                    </div>
                    <div className='menulist'>
                        <nav>
                            <ul>
                                {pages.map((page) => (
                                    <a key={page.path} href={`/main/${page.path}`} style={{ marginRight: 10 }}>
                                        {page.name}
                                    </a>
                                ))}
                            </ul>
                        </nav>
                    </div>
                </div>
                {/* 搜尋區 */}
                <div className='search_are'>
                    <form ref={formRef} method="get" action={"/main/image_area"}>
                        <div className='tag_search_input'>
                            <TagInput
                                allTags={{ ["標籤"]: tagData?.map((t) => t.tag_name) || [] }}
                                name={"tag"}
                                value={""}
                                onChange={(val) => {
                                    const input = formRef.current?.elements.namedItem("tag") as HTMLInputElement | null;
                                    if (input) {
                                        input.value = val;
                                        console.log(val)
                                    };
                                }}
                                placeholder={`請輸入 標籤1,標籤2...`}
                            />
                            <div className='tag_search_button'>
                                <button type="submit">🔍</button>
                            </div>
                        </div>
                    </form>
                </div>
            </div>
        </>
    );
}
export { FloatIconAndList }