import React, { useEffect, useRef, useState } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import { Icon } from './Icon';
import { logout } from 'services/auth.service';
import { getAllTag } from 'services/tag.service';
import { TagData } from './types/tags';

interface TopbarProps {
  onCollapse: () => void;
}

const PATH_LABELS: Record<string, string> = {
  '/main/front_page':  'Front page',
  '/main/upload_area': 'Upload',
  '/main/image_area':  'Gallery',
  '/main/image_page':  'Image detail',
  '/main/history':     'History',
};

export const Topbar: React.FC<TopbarProps> = ({ onCollapse }) => {
  const location = useLocation();
  const navigate = useNavigate();
  const label = PATH_LABELS[location.pathname] ?? 'Library';

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
    if (!trimmed) return;
    setOpen(false);
    navigate(`/main/image_area?tag=${encodeURIComponent(trimmed)}`);
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

  const handleLogout = async () => {
    await logout();
  };

  return (
    <header className="top">
      <button className="icon-btn" onClick={onCollapse} aria-label="toggle sidebar">
        <Icon.menu />
      </button>
      <div className="crumbs">
        <span>KOATAG</span>
        <span className="sep">/</span>
        <span className="here">{label}</span>
      </div>
      <div className="spacer" />
      <form ref={wrapRef} className="search" onSubmit={handleSubmit} style={{ position: 'relative' }}>
        <Icon.search size={15} />
        <input
          value={query}
          onChange={(e) => { setQuery(e.target.value); setOpen(true); setHighlight(-1); }}
          onFocus={() => setOpen(true)}
          onKeyDown={handleKeyDown}
          placeholder="Search by tag, character, artist…"
          autoComplete="off"
        />
        <span className="search-kbd">⌘K</span>
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
      <button className="icon-btn" aria-label="notifications">
        <Icon.bell />
        <span className="dot"></span>
      </button>
      <button className="icon-btn" onClick={handleLogout} aria-label="logout">
        <Icon.logout />
      </button>
    </header>
  );
};
