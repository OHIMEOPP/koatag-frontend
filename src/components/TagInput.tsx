import { useEffect, useRef, useState, ReactNode } from "react";
import '../style/TagInput.scss';

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
    const [suggestions, setSuggestions] = useState<{ group: string; tag: string }[]>([]);
    const [highlightIndex, setHighlightIndex] = useState(-1);
    const ref = useRef<HTMLInputElement | HTMLTextAreaElement>(null);
    const itemRefs = useRef<(HTMLDivElement | null)[]>([]);

    const lastPart = () => {
        const parts = inputValue.split(',').map(p => p.trim());
        return parts.length ? parts[parts.length - 1] : '';
    };

    useEffect(() => {
        const last = lastPart().toLowerCase();
        const allParts = inputValue.split(',').map(p => p.trim()).filter(Boolean);
        const enteredTags = allParts.slice(0, -1); // <-- 只排除已選過的 tag，不排除最後正在輸入的片段

        const filtered: { group: string; tag: string }[] = [];

        Object.entries(allTags).forEach(([group, tags]) => {
            tags.forEach(tag => {
                const tagLower = tag.toLowerCase();
                if (tagLower.includes(last) && !enteredTags.includes(tag)) {
                    filtered.push({ group, tag });
                }
            });
        });

        setSuggestions(filtered);
        setHighlightIndex(-1);
    }, [inputValue, allTags]);


    useEffect(() => {
        const handleClickOutside = (e: MouseEvent) => {
            if (ref.current && !ref.current.contains(e.target as Node)) {
                setSuggestions([]);
            }
        };
        document.addEventListener('click', handleClickOutside);
        return () => document.removeEventListener('click', handleClickOutside);
    }, []);

    const selectTag = (tag: string) => {
        const parts = inputValue.split(',');
        parts[parts.length - 1] = tag;
        const newVal = parts.map(p => p.trim()).join(','); // 或 join(', ') 看你需求
        setInputValue(newVal);
        onChange(newVal);
        setSuggestions([]);

        requestAnimationFrame(() => {
            const el = ref.current;
            if (el && 'setSelectionRange' in el) {
                el.setSelectionRange(newVal.length, newVal.length);
                el.focus();
            }
        });
    };
    const handleKeyDown = (e: React.KeyboardEvent<HTMLInputElement | HTMLTextAreaElement>) => {
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
        defaultValue: inputValue,
        autoComplete: "off",
        onChange: (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) => {
            setInputValue(e.target.value);
            inputListaner?.(e.target.value); // 傳入最新文字
        },
        onKeyDown: handleKeyDown,
        onFocus: () => onToggleOpen?.(),
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
            groupedElements.push(
                <div
                    key={`tag-${group}-${tag}-${index}`}
                    onClick={() => selectTag(tag)}
                    className={highlightIndex === currentIdx ? "active" : ""}
                    ref={el => { itemRefs.current[currentIdx] = el; }}
                >
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
            {(isOpen || suggestions.length > 0) && groupedElements.length > 0 && inputValue !== "" && (
                <div className="tag-suggestions">{groupedElements}</div>
            )}
        </div>
    );
};

export { TagInput };
