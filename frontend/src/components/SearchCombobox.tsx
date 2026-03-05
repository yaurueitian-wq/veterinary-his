import { useEffect, useRef, useState } from "react";
import { X } from "lucide-react";
import { useDebounce } from "@/hooks/useDebounce";
import { cn } from "@/lib/utils";

interface SearchComboboxProps {
  label: string;
  value: string;
  onChange: (value: string) => void;
  /** 根據輸入字串非同步取得建議清單 */
  fetchSuggestions: (q: string) => Promise<string[]>;
  placeholder?: string;
  className?: string;
}

/**
 * 即時建議搜尋框（Combobox）
 * - 輸入時 debounce 200ms 後呼叫 fetchSuggestions
 * - 點選建議 → onChange(選取值)
 * - 清除按鈕 → onChange("")
 * - 開啟時：全頁遮罩讓背景退後，下拉浮層突出顯示
 */
export function SearchCombobox({
  label,
  value,
  onChange,
  fetchSuggestions,
  placeholder,
  className,
}: SearchComboboxProps) {
  const [inputVal, setInputVal] = useState(value);
  const [suggestions, setSuggestions] = useState<string[]>([]);
  const [open, setOpen] = useState(false);
  const [loading, setLoading] = useState(false);
  const debouncedInput = useDebounce(inputVal, 200);
  const containerRef = useRef<HTMLDivElement>(null);

  // 外部 value 變更時同步 inputVal（例如清除）
  useEffect(() => {
    setInputVal(value);
  }, [value]);

  // debounce 後呼叫 API 取建議
  useEffect(() => {
    if (!debouncedInput.trim()) {
      setSuggestions([]);
      setOpen(false);
      return;
    }
    let cancelled = false;
    setLoading(true);
    fetchSuggestions(debouncedInput)
      .then((results) => {
        if (!cancelled) {
          setSuggestions(results);
          setOpen(results.length > 0);
        }
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [debouncedInput, fetchSuggestions]);

  function handleSelect(val: string) {
    setInputVal(val);
    onChange(val);
    setSuggestions([]);
    setOpen(false);
  }

  function handleClear() {
    setInputVal("");
    onChange("");
    setSuggestions([]);
    setOpen(false);
  }

  function handleBlur() {
    onChange(inputVal);
  }

  function handleBackdropMouseDown() {
    setOpen(false);
  }

  return (
    <>
      {/* 全頁遮罩：背景退後 */}
      {open && (
        <div
          className="fixed inset-0 z-40 bg-black/25 backdrop-blur-[1px]"
          onMouseDown={handleBackdropMouseDown}
        />
      )}

      {/* Combobox 本體：開啟時浮出遮罩上方 */}
      <div
        ref={containerRef}
        className={cn("relative", open && "z-50", className)}
      >
        <p className="text-xs text-muted-foreground mb-1">{label}</p>
        <div className="relative flex items-center">
          <input
            type="text"
            value={inputVal}
            onChange={(e) => setInputVal(e.target.value)}
            onBlur={handleBlur}
            onFocus={() => suggestions.length > 0 && setOpen(true)}
            placeholder={placeholder ?? `搜尋${label}…`}
            className={cn(
              "flex h-9 w-full rounded-md border border-input bg-background px-3 py-1 pr-8 text-sm ring-offset-background placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2",
              open && "border-ring ring-2 ring-ring ring-offset-2"
            )}
          />
          {inputVal && (
            <button
              type="button"
              onClick={handleClear}
              className="absolute right-2 text-muted-foreground hover:text-foreground"
              tabIndex={-1}
            >
              <X className="h-3.5 w-3.5" />
            </button>
          )}
        </div>

        {/* 建議下拉清單 */}
        {open && (
          <ul className="absolute z-50 mt-1 w-full rounded-md border border-ring bg-white shadow-xl max-h-52 overflow-auto">
            {loading ? (
              <li className="px-3 py-2 text-sm text-muted-foreground">搜尋中…</li>
            ) : (
              suggestions.map((s) => (
                <li
                  key={s}
                  onMouseDown={(e) => {
                    e.preventDefault(); // 避免觸發 input blur
                    handleSelect(s);
                  }}
                  className="px-3 py-2 text-sm cursor-pointer hover:bg-accent hover:text-accent-foreground"
                >
                  {s}
                </li>
              ))
            )}
          </ul>
        )}
      </div>
    </>
  );
}
