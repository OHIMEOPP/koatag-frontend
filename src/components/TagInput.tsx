import { useEffect, useRef, useState, ReactNode } from "react";
// .tag-suggestions styles 已搬進 src/style/v3/_tag_input.scss, 全域載入

interface TagInputProps {
    allTags: Record<string, string[]>; // { groupName: [tag1, tag2] }
    value: string;
    onChange: (val: string) => void;
    name?: string;
    isTextarea?: boolean;
    isOpen?: boolean;
    onToggleOpen?: () => void;
    inputListaner?: (value: string) => void;
    placeholder?: string
    setAnotherValue?: React.Dispatch<React.SetStateAction<string>>
}

const TagInput: React.FC<TagInputProps> = ({ allTags, value, onChange, name, isTextarea, isOpen, onToggleOpen, inputListaner, placeholder, setAnotherValue }) => {
    const [inputValue, setInputValue] = useState(value);

    // Sync external value prop → internal state (例如父層 useEffect 從 API 抓 imageData
    // 後才能填回 TagInput; 內部 typing 走 onChange path 不會觸發 loop 因為 value 已同步)
    useEffect(() => {
        if (value !== inputValue) setInputValue(value);
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [value]);
    const [suggestions, setSuggestions] = useState<{ group: string; tag: string }[]>([]);
    const [highlightIndex, setHighlightIndex] = useState(-1);
    const [isFocused, setIsFocused] = useState(false);
    const ref = useRef<HTMLInputElement | HTMLTextAreaElement>(null);
    const itemRefs = useRef<(HTMLDivElement | null)[]>([]);

    const lastPart = () => {
        const parts = inputValue.split(',').map(p => p.trim());
        return parts.length ? parts[parts.length - 1] : '';
    };

    // 已選 tag 的 set (從 inputValue 即時算)，用來在 dropdown 標註 + 點擊時 toggle
    const selectedSet = (() => {
        const parts = inputValue.split(',').map(p => p.trim()).filter(Boolean);
        return new Set(parts);
    })();

    useEffect(() => {
        const last = lastPart().toLowerCase();

        // Toggle 模式：dropdown 顯示「所有 match last」的 tag，含已選過的
        // (已選過的會用 .selected class 標註，點擊時 selectTag 偵測到後改成移除)
        const filtered: { group: string; tag: string }[] = [];

        Object.entries(allTags).forEach(([group, tags]) => {
            tags.forEach(tag => {
                const tagLower = tag.toLowerCase();
                if (tagLower.includes(last)) {
                    filtered.push({ group, tag });
                }
            });
        });

        setSuggestions(filtered);
        setHighlightIndex(-1);
    }, [inputValue, allTags]);


    useEffect(() => {
        const handleClickOutside = (e: MouseEvent) => {
            const target = e.target as Node;
            // Keep open if click is on the input OR within the .tag-suggestions dropdown
            if (ref.current?.contains(target)) return;
            const dropdown = ref.current?.parentElement?.querySelector('.tag-suggestions');
            if (dropdown?.contains(target)) return;
            setSuggestions([]);
            setIsFocused(false);
        };
        document.addEventListener('click', handleClickOutside);
        return () => document.removeEventListener('click', handleClickOutside);
    }, []);

    const selectTag = (tag: string) => {
        const parts = inputValue.split(',').map(p => p.trim());
        let newVal: string;

        if (selectedSet.has(tag)) {
            // 已在 list 內 → 移除
            const filtered = parts.filter(p => p !== tag).filter(Boolean);
            newVal = filtered.join(',');
        } else {
            // 不在 list 內 → 取代最後 partial (如果有) 或 append
            const last = parts[parts.length - 1] ?? '';
            if (last === '') {
                // last is empty (剛打完逗號) → 直接 append
                const cleaned = parts.filter(Boolean);
                cleaned.push(tag);
                newVal = cleaned.join(',');
            } else {
                // 取代 last partial
                parts[parts.length - 1] = tag;
                newVal = parts.filter(Boolean).join(',');
            }
        }

        setInputValue(newVal);
        onChange(newVal);
        // 不關 dropdown — 讓 user 連續 toggle 多個 tag

        requestAnimationFrame(() => {
            const el = ref.current;
            if (el && 'setSelectionRange' in el) {
                el.setSelectionRange(newVal.length, newVal.length);
                el.focus();
            }
        });
    };
    const handleKeyDown = (e: React.KeyboardEvent<HTMLInputElement | HTMLTextAreaElement>) => {
        if (e.key === 'Escape') {
            // Esc 收 dropdown + 失焦 (任何時候都可)
            setSuggestions([]);
            setIsFocused(false);
            setHighlightIndex(-1);
            ref.current?.blur();
            return;
        }
        if (!suggestions.length) return;
        if (e.key === 'ArrowDown') {
            e.preventDefault();
            setHighlightIndex(prev => (prev + 1 >= suggestions.length ? 0 : prev + 1));
        } else if (e.key === 'ArrowUp') {
            e.preventDefault();
            setHighlightIndex(prev => (prev - 1 < 0 ? suggestions.length - 1 : prev - 1));
        } else if (e.key === 'Enter') {
            if (highlightIndex >= 0) {
                // 有高亮才選擇 tag
                e.preventDefault();
                selectTag(suggestions[highlightIndex].tag);
            }
            // textarea 沒高亮就正常換行
        }
    };

    useEffect(() => {
        if (highlightIndex >= 0 && itemRefs.current[highlightIndex]) {
            itemRefs.current[highlightIndex]?.scrollIntoView({ block: 'nearest', behavior: 'auto' });
        }
    }, [highlightIndex]);

    const commonProps = {
        ref,
        value: inputValue,
        autoComplete: "off",
        className: "input",
        onChange: (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) => {
            const next = e.target.value;
            setInputValue(next);
            inputListaner?.(next); // 傳入最新文字
            onChange(next); // 同步父層狀態，讓 selectedTags 等 derived state 即時更新
        },
        onKeyDown: handleKeyDown,
        onFocus: () => { setIsFocused(true); onToggleOpen?.(); },
        name,
        placeholder,
        type: "text"
    };

    const groupedElements: ReactNode[] = [];
    let idxCounter = 0;

    // 先把每個 group 都建立 <p> 標題
    Object.entries(allTags).forEach(([group, tags]) => {
        const groupFiltered = tags.filter(tag =>
            suggestions.length === 0 || suggestions.some(s => s.tag === tag)
        );

        if (groupFiltered.length > 0)
            groupedElements.push(<p key={`group-${group}`} className="tag-group">{group}</p>);

        // 過濾 tag：如果 suggestions 有內容才 highlight / 過濾

        groupFiltered.forEach((tag, index) => {
            const currentIdx = idxCounter++;
            const isSelected = selectedSet.has(tag);
            const classes = [
                highlightIndex === currentIdx ? "active" : "",
                isSelected ? "selected" : "",
            ].filter(Boolean).join(" ");
            groupedElements.push(
                <div
                    key={`tag-${group}-${tag}-${index}`}
                    onClick={() => selectTag(tag)}
                    className={classes}
                    ref={el => { itemRefs.current[currentIdx] = el; }}
                    title={isSelected ? '已選 — 點擊移除' : '點擊加入'}
                >
                    {isSelected && <span style={{ color: 'var(--color-primary)', marginRight: 6, fontWeight: 700 }}>✓</span>}
                    {tag}
                </div>
            );
        });
    });

    return (
        <div className="set_anothertag" style={{ position: 'relative' }}>
            {isTextarea ? (
                <textarea {...commonProps as React.TextareaHTMLAttributes<HTMLTextAreaElement>} />
            ) : (
                <input {...commonProps as React.InputHTMLAttributes<HTMLInputElement>} />
            )}
            {(isOpen || isFocused) && groupedElements.length > 0 && (
                <div className="tag-suggestions">{groupedElements}</div>
            )}
        </div>
    );
};

export { TagInput };
