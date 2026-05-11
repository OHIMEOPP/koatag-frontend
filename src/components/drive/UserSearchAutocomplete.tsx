import React, { useEffect, useRef, useState } from "react";
import { searchUsers } from "services/drive.service";
import { mapDriveError } from "services/drive.errorMap";
import { useDebounce } from "hooks/useDebounce";
import type { User } from "components/types/users";

interface UserSearchAutocompleteProps {
  onSelect: (user: User) => void;
  selected?: User | null;
  /** filter out 已分享過的 user — Phase 3 write share reuse */
  excludeUserIds?: number[];
  placeholder?: string;
  autoFocus?: boolean;
}

const MIN_QUERY_LENGTH = 2;
const DEBOUNCE_MS = 300;

/**
 * KOATAG user picker — ShareDialog autocomplete (Phase 1, wiki #361 / #364 / #378 freeze)
 *
 * - debounce 300ms 對齊 backend throttle 60/min（796d37a 後）
 * - `q.length < 2` client guard 不發 request（backend 也 200+empty 容讓）
 * - exclude 自己 grantee 由 backend 過濾，excludeUserIds prop 是 frontend filter
 *   既有 share grantee（Phase 3 write-share 重複勾配對 spec）
 * - dropdown row: account 主顯 / name (NULL → 「（未設定）」) / email subtle
 * - avatar fallback 首 2 字大寫（既有 Sidebar UserCard pattern）
 * - keyboard: ↑↓ navigate / Enter 選 / ESC 關
 */
export const UserSearchAutocomplete: React.FC<UserSearchAutocompleteProps> = ({
  onSelect,
  selected,
  excludeUserIds = [],
  placeholder = "搜尋使用者…（帳號 / 名稱 / email）",
  autoFocus = false,
}) => {
  const [query, setQuery] = useState(selected ? selected.account : "");
  const [results, setResults] = useState<User[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [open, setOpen] = useState(false);
  const [hoverIndex, setHoverIndex] = useState(0);
  const containerRef = useRef<HTMLDivElement>(null);

  const debouncedQuery = useDebounce(query, DEBOUNCE_MS);

  // fetch on debounced query — excludeUserIds NOT in deps（caller 不一定 memoize array，
  // 進 deps 會每 render 新 reference 觸發 infinite useEffect。改 render-time filter。）
  useEffect(() => {
    if (debouncedQuery.length < MIN_QUERY_LENGTH) {
      setResults([]);
      setLoading(false);
      setError(null);
      return;
    }
    let aborted = false;
    setLoading(true);
    setError(null);
    searchUsers(debouncedQuery, 10)
      .then((users) => {
        if (aborted) return;
        setResults(users);
        setLoading(false);
        setHoverIndex(0);
      })
      .catch((err) => {
        if (aborted) return;
        setError(mapDriveError(err));
        setResults([]);
        setLoading(false);
      });
    return () => {
      aborted = true;
    };
  }, [debouncedQuery]);

  // render-time filter — excludeUserIds 跟 results 都不變才有意義
  const visibleResults = excludeUserIds.length
    ? results.filter((u) => !excludeUserIds.includes(u.id))
    : results;

  // close on click outside
  useEffect(() => {
    const handleDoc = (e: MouseEvent) => {
      if (containerRef.current && !containerRef.current.contains(e.target as Node)) {
        setOpen(false);
      }
    };
    document.addEventListener("mousedown", handleDoc);
    return () => document.removeEventListener("mousedown", handleDoc);
  }, []);

  const select = (user: User) => {
    onSelect(user);
    setQuery(user.account);
    setOpen(false);
  };

  const handleKey = (e: React.KeyboardEvent) => {
    if (!open || visibleResults.length === 0) {
      if (e.key === "Escape") setOpen(false);
      return;
    }
    if (e.key === "ArrowDown") {
      e.preventDefault();
      setHoverIndex((i) => Math.min(i + 1, visibleResults.length - 1));
    } else if (e.key === "ArrowUp") {
      e.preventDefault();
      setHoverIndex((i) => Math.max(i - 1, 0));
    } else if (e.key === "Enter") {
      e.preventDefault();
      const target = visibleResults[hoverIndex];
      if (target) select(target);
    } else if (e.key === "Escape") {
      setOpen(false);
    }
  };

  return (
    <div className="drive-user-autocomplete" ref={containerRef}>
      <input
        type="text"
        className="drive-modal-input"
        value={query}
        onChange={(e) => {
          setQuery(e.target.value);
          setOpen(true);
        }}
        onFocus={() => setOpen(true)}
        onKeyDown={handleKey}
        placeholder={placeholder}
        autoFocus={autoFocus}
        autoComplete="off"
      />
      {open && debouncedQuery.length >= MIN_QUERY_LENGTH && (
        <div className="drive-user-autocomplete-dropdown" role="listbox">
          {loading ? (
            <div className="drive-user-autocomplete-status">載入中…</div>
          ) : error ? (
            <div className="drive-user-autocomplete-status drive-user-autocomplete-error">
              {error}
            </div>
          ) : visibleResults.length === 0 ? (
            <div className="drive-user-autocomplete-status">無相符使用者</div>
          ) : (
            visibleResults.map((u, idx) => {
              const initial = u.account.slice(0, 2).toUpperCase();
              return (
                <button
                  type="button"
                  key={u.id}
                  className={`drive-user-autocomplete-item ${idx === hoverIndex ? "hover" : ""}`}
                  onClick={() => select(u)}
                  onMouseEnter={() => setHoverIndex(idx)}
                  role="option"
                  aria-selected={idx === hoverIndex}
                >
                  <div className="drive-user-autocomplete-avatar">
                    {u.avatar_url ? (
                      <img src={u.avatar_url} alt="" />
                    ) : (
                      initial
                    )}
                  </div>
                  <div className="drive-user-autocomplete-info">
                    <div className="drive-user-autocomplete-account">{u.account}</div>
                    <div className="drive-user-autocomplete-name">
                      {u.name ?? "（未設定）"}
                    </div>
                    <div className="drive-user-autocomplete-email">{u.email}</div>
                  </div>
                </button>
              );
            })
          )}
        </div>
      )}
    </div>
  );
};
