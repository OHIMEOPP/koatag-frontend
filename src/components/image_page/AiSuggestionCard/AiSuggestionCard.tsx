import React, { useState } from 'react';
import { Btn, Data, Icon } from 'components';
import { $message, getFilePath } from 'utils';

interface AiSuggestionCardProps {
    imageData: Data | undefined;
    onMergeMainTag: (incoming: string[]) => void;
    onMergeSecondaryTag: (incoming: string[]) => void;
    onMergeAnotherTag: (incoming: string[]) => void;
}

// AI 辨識 suggestion card — 點按鈕 fetch AI service, 結果 merge 進對應 tag 欄位
// (作者欄 AI 通常認不出, 不處理)
const AiSuggestionCard: React.FC<AiSuggestionCardProps> = ({
    imageData,
    onMergeMainTag,
    onMergeSecondaryTag,
    onMergeAnotherTag,
}) => {
    const user_id = localStorage.getItem('user_id') ?? '0';
    const [isAiLoading, setIsAiLoading] = useState(false);

    const handleAiTag = async () => {
        if (!imageData) return;
        setIsAiLoading(true);
        $message('AI 辨識中…');

        const isHttp = imageData.check_img_type === 'HTTP'
            || imageData.img_path?.startsWith('http://')
            || imageData.img_path?.startsWith('https://');
        const aiSrc = isHttp ? imageData.img_path : getFilePath(user_id, imageData.img_path ?? '');
        if (!aiSrc) { setIsAiLoading(false); return; }

        const isCrossOrigin = aiSrc.startsWith('http://') || aiSrc.startsWith('https://');

        try {
            let response: Response;
            if (isCrossOrigin) {
                response = await fetch(`${process.env.REACT_APP_AI_API_URL}/upload_by_url`, {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({ url: aiSrc, translate_to_zh: true }),
                });
            } else {
                const blob = await fetch(aiSrc).then((r) => r.blob());
                const formData = new FormData();
                formData.append('file', blob, 'image.jpg');
                response = await fetch(`${process.env.REACT_APP_AI_API_URL}/upload`, {
                    method: 'POST',
                    body: formData,
                });
            }
            const result = await response.json();

            // 人物 (mainTag) ← character_res_zh keys
            const mainNames = Object.keys(result?.character_res_zh ?? {});
            if (mainNames.length) onMergeMainTag(mainNames);

            // 團體 (secondaryTag) ← character_res key 中括號內的作品名
            const copyrights = Object.keys(result?.character_res ?? {})
                .map((k: string) => {
                    const m = k.match(/\(([^)]+)\)/);
                    return m ? m[1] : '';
                })
                .filter(Boolean);
            if (copyrights.length) onMergeSecondaryTag(copyrights);

            // 其他 (anotherTag) ← sorted_general_strings_zh
            const generalsZh = String(result?.sorted_general_strings_zh ?? '')
                .split(',').map((t: string) => t.trim()).filter(Boolean);
            if (generalsZh.length) onMergeAnotherTag(generalsZh);

            $message('AI 辨識完成 — 已合併到對應欄位 (作者欄需手填)');
        } catch (err) {
            console.error('AI 辨識失敗:', err);
            $message('AI 辨識失敗', 'error');
        } finally {
            setIsAiLoading(false);
        }
    };

    return (
        <div className="card info-card" style={{ background: 'linear-gradient(135deg, rgba(232,185,106,0.08), transparent)', borderColor: 'rgba(232,185,106,0.2)' }}>
            <h3 style={{ color: 'var(--color-primary-light)' }}>
                <span style={{ display: 'inline-flex', alignItems: 'center', gap: 8 }}>
                    <Icon.star size={14} />AI 辨識
                </span>
            </h3>
            <p style={{ fontSize: 12.5, lineHeight: 1.6, color: 'var(--color-text-primary)', margin: '0 0 12px' }}>
                自動辨識圖片中的人物、作品系列、其他標籤，並合併到對應欄位（作者欄需手填）。
            </p>
            <Btn variant="primary" size="sm" disabled={isAiLoading || !imageData} onClick={handleAiTag}>
                {isAiLoading ? '辨識中…' : '開始 AI 辨識'}
            </Btn>
        </div>
    );
};

export { AiSuggestionCard };
