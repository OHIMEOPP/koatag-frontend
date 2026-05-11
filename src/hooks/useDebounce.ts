import { useEffect, useState } from "react";

/**
 * 給 input 值加 debounce 延遲——typing 期間不每 keystroke 觸發 caller。
 *
 * 用於 UserSearchAutocomplete autocomplete fetch 等對 server load 敏感的場景。
 * 既有 SearchBar 內 inline 實作 timer ref pattern，新 code 走此 hook。
 */
export function useDebounce<T>(value: T, delayMs: number): T {
  const [debounced, setDebounced] = useState(value);

  useEffect(() => {
    const handle = setTimeout(() => setDebounced(value), delayMs);
    return () => clearTimeout(handle);
  }, [value, delayMs]);

  return debounced;
}
