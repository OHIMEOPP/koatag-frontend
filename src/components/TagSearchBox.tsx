import React, { useEffect, useRef, useState } from 'react';
import { Icon } from './Icon';
import { getAllTag } from 'services/tag.service';
import { TagData } from './types/tags';

interface TagSearchBoxProps {
  onSearch: (query: string) => void;
  placeholder?: string;
  // 空白也送出，用來清掉搜尋條件
  allowEmpty?: boolean;
  showKbd?: boolean;
  autoFocus?: boolean;
}

// 標籤搜尋框，打字時建議標籤，逗號分隔可輸入多個
export const TagSearchBox: React.FC<TagSearchBoxProps> = ({
  onSearch, placeholder = '搜尋標籤、人物或作者…', allowEmpty = false, showKbd = false, autoFocus = false,
}) => {
  const [tagData, setTagData] = useState<TagData[]>([]);
  const [query, setQuery] = useState('');
  const [open, setOpen] = useState(false);
  const [highlight, setHighlight] = useState(-1);
  const wrapRef = useRef<HTMLFormElement>(null);

  useEffect(() => {
    getAllTag().then((res) => {
      if (res?.result) setTagData(res.result);
    });
  }, []);

  // Multi-tag input: split by comma; suggest on the last fragment.
  const lastFragment = () => {
    const parts = query.split(',').map((p) => p.trim());
    return parts[parts.length - 1] ?? '';
  };
  const enteredTags = query.split(',').map((p) => p.trim()).filter(Boolean).slice(0, -1);
  const last = lastFragment().toLowerCase();
  const suggestions = last
    ? tagData
        .filter((t) => t.tag_name.toLowerCase().includes(last) && !enteredTags.includes(t.tag_name))
        .slice(0, 8)
    : [];

  useEffect(() => {
    const onClick = (e: MouseEvent) => {
      if (wrapRef.current && !wrapRef.current.contains(e.target as Node)) setOpen(false);
    };
    document.addEventListener('click', onClick);
    return () => document.removeEventListener('click', onClick);
  }, []);

  const selectTag = (tag: string) => {
    const parts = query.split(',');
    parts[parts.length - 1] = tag;
    setQuery(parts.map((p) => p.trim()).join(','));
    setOpen(false);
    setHighlight(-1);
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    const trimmed = query.trim();
    if (!trimmed && !allowEmpty) return;
    setOpen(false);
    onSearch(trimmed);
  };

  const handleKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (!suggestions.length) return;
    if (e.key === 'ArrowDown') {
      e.preventDefault();
      setHighlight((p) => (p + 1 >= suggestions.length ? 0 : p + 1));
    } else if (e.key === 'ArrowUp') {
      e.preventDefault();
      setHighlight((p) => (p - 1 < 0 ? suggestions.length - 1 : p - 1));
    } else if (e.key === 'Enter' && highlight >= 0) {
      e.preventDefault();
      selectTag(suggestions[highlight].tag_name);
    }
  };

  return (
    <form ref={wrapRef} className="search" onSubmit={handleSubmit} style={{ position: 'relative' }}>
      <Icon.search size={15} />
      <input
        value={query}
        onChange={(e) => { setQuery(e.target.value); setOpen(true); setHighlight(-1); }}
        onFocus={() => setOpen(true)}
        onKeyDown={handleKeyDown}
        placeholder={placeholder}
        autoComplete="off"
        autoFocus={autoFocus}
      />
      {showKbd && <span className="search-kbd">⌘K</span>}
      {open && suggestions.length > 0 && (
        <div className="search-suggest">
          {suggestions.map((s, i) => (
            <div
              key={s.tag_name}
              className={`search-suggest-item ${i === highlight ? 'active' : ''}`}
              onMouseDown={(e) => { e.preventDefault(); selectTag(s.tag_name); }}
            >
              {s.tag_name}
            </div>
          ))}
        </div>
      )}
    </form>
  );
};
