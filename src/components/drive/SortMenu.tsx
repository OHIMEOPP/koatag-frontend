import React, { useState, useRef, useEffect } from "react";
import { Icon } from "components/Icon";
import { SortKey, SortOrder, SORT_LABELS } from "services/drive.service";

interface SortMenuProps {
  sort: SortKey;
  order: SortOrder;
  onChange: (sort: SortKey, order: SortOrder) => void;
}

const SORT_KEYS: SortKey[] = ["name", "size_bytes", "created_at", "updated_at"];

export const SortMenu: React.FC<SortMenuProps> = ({ sort, order, onChange }) => {
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!open) return;
    const handler = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) {
        setOpen(false);
      }
    };
    document.addEventListener("mousedown", handler);
    return () => document.removeEventListener("mousedown", handler);
  }, [open]);

  const handleSort = (key: SortKey) => {
    if (key === sort) {
      // 同 key → toggle order
      onChange(sort, order === "asc" ? "desc" : "asc");
    } else {
      // 換 key → 預設 asc
      onChange(key, "asc");
    }
    setOpen(false);
  };

  return (
    <div className="drive-sort-menu" ref={ref}>
      <button
        type="button"
        className="drive-sort-trigger"
        onClick={() => setOpen((o) => !o)}
        aria-haspopup="listbox"
        aria-expanded={open}
      >
        <Icon.filter size={14} />
        <span>{SORT_LABELS[sort]}</span>
        <span className="drive-sort-order">{order === "asc" ? "↑" : "↓"}</span>
      </button>
      {open && (
        <ul className="drive-sort-dropdown" role="listbox">
          {SORT_KEYS.map((key) => (
            <li key={key} role="option" aria-selected={key === sort}>
              <button
                type="button"
                className={`drive-sort-option ${key === sort ? "active" : ""}`}
                onClick={() => handleSort(key)}
              >
                <span>{SORT_LABELS[key]}</span>
                {key === sort && (
                  <span className="drive-sort-current-order">
                    {order === "asc" ? "↑" : "↓"}
                  </span>
                )}
              </button>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
};
