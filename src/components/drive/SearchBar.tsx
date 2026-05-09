import React, { useState, useEffect, useRef } from "react";
import { Icon } from "components/Icon";

interface SearchBarProps {
  query: string;
  onQueryChange: (q: string) => void;
  debounceMs?: number;
  placeholder?: string;
}

export const SearchBar: React.FC<SearchBarProps> = ({
  query,
  onQueryChange,
  debounceMs = 300,
  placeholder = "搜尋檔案...",
}) => {
  const [local, setLocal] = useState(query);
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  // 外部 query 變動時同步 (例如 reset)
  useEffect(() => {
    setLocal(query);
  }, [query]);

  // debounce: local 改變 debounceMs 後送出去
  useEffect(() => {
    if (local === query) return;
    if (timerRef.current) clearTimeout(timerRef.current);
    timerRef.current = setTimeout(() => {
      onQueryChange(local);
    }, debounceMs);
    return () => {
      if (timerRef.current) clearTimeout(timerRef.current);
    };
  }, [local, query, onQueryChange, debounceMs]);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (timerRef.current) clearTimeout(timerRef.current);
    onQueryChange(local);
  };

  const handleClear = () => {
    setLocal("");
    if (timerRef.current) clearTimeout(timerRef.current);
    onQueryChange("");
  };

  return (
    <form className="drive-search-bar" onSubmit={handleSubmit} role="search">
      <Icon.search size={14} className="drive-search-icon" />
      <input
        type="text"
        value={local}
        onChange={(e) => setLocal(e.target.value)}
        placeholder={placeholder}
        className="drive-search-input"
        aria-label="搜尋檔案"
      />
      {local && (
        <button
          type="button"
          className="drive-search-clear"
          onClick={handleClear}
          aria-label="清除搜尋"
        >
          ×
        </button>
      )}
    </form>
  );
};
