import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Search, AlertTriangle } from "lucide-react";

import { ownersApi, type OwnerListItem, type AnimalBrief } from "@/api/owners";
import { visitsApi } from "@/api/visits";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { cn } from "@/lib/utils";
import { useDebounce } from "@/hooks/useDebounce";

export default function VisitCreatePage() {
  const navigate = useNavigate();
  const queryClient = useQueryClient();

  // ── 搜尋飼主狀態 ───────────────────────────────────────────
  const [searchInput, setSearchInput] = useState("");
  const debouncedSearch = useDebounce(searchInput, 300);
  const [selectedOwner, setSelectedOwner] = useState<OwnerListItem | null>(null);
  const [selectedAnimal, setSelectedAnimal] = useState<AnimalBrief | null>(null);

  // ── 掛號欄位 ───────────────────────────────────────────────
  const [chiefComplaint, setChiefComplaint] = useState("");
  const [isUrgent, setIsUrgent] = useState(false);
  const [submitError, setSubmitError] = useState<string | null>(null);

  // ── 飼主搜尋 query ─────────────────────────────────────────
  const { data: searchResult, isFetching: isSearching } = useQuery({
    queryKey: ["owner-search", debouncedSearch],
    queryFn: () =>
      ownersApi.list({ name: debouncedSearch, page_size: 10 }),
    enabled: debouncedSearch.trim().length >= 1 && !selectedOwner,
    placeholderData: (prev) => prev,
  });

  // ── 飼主詳細（含動物清單）─────────────────────────────────
  const { data: ownerDetail } = useQuery({
    queryKey: ["owner-detail", selectedOwner?.id],
    queryFn: () => ownersApi.get(selectedOwner!.id),
    enabled: !!selectedOwner,
  });

  // ── 掛號 mutation ──────────────────────────────────────────
  const createMutation = useMutation({
    mutationFn: () =>
      visitsApi.create({
        animal_id: selectedAnimal!.id,
        chief_complaint: chiefComplaint.trim(),
        priority: isUrgent ? "urgent" : "normal",
      }),
    onMutate: () => setSubmitError(null),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["visits"] });
      navigate("/visits");
    },
    onError: (err: unknown) => {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const detail = (err as any)?.response?.data?.detail;
      setSubmitError(detail ?? "掛號失敗，請稍後再試");
    },
  });

  function handleSelectOwner(owner: OwnerListItem) {
    setSelectedOwner(owner);
    setSelectedAnimal(null);
    setSearchInput(owner.full_name);
  }

  function handleClearOwner() {
    setSelectedOwner(null);
    setSelectedAnimal(null);
    setSearchInput("");
  }

  const canSubmit =
    !!selectedAnimal &&
    chiefComplaint.trim().length > 0 &&
    !createMutation.isPending;

  const showDropdown =
    !selectedOwner &&
    debouncedSearch.trim().length >= 1 &&
    (isSearching || (searchResult?.items?.length ?? 0) > 0);

  return (
    <div className="container py-6 max-w-2xl space-y-4">
      {/* 標題 */}
      <div className="flex items-center gap-3">
        <Button variant="ghost" size="sm" onClick={() => navigate("/visits")}>
          ← 返回
        </Button>
        <h1 className="text-xl font-semibold">新增掛號</h1>
      </div>

      {/* Step 1：搜尋飼主 */}
      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="text-sm font-medium">1. 選擇飼主</CardTitle>
        </CardHeader>
        <CardContent className="space-y-3">
          <div className="relative">
            <div className="relative flex items-center">
              <Search className="absolute left-3 h-4 w-4 text-muted-foreground pointer-events-none" />
              <input
                type="text"
                value={searchInput}
                onChange={(e) => {
                  setSearchInput(e.target.value);
                  if (selectedOwner) handleClearOwner();
                }}
                placeholder="輸入飼主姓名搜尋…"
                className="flex h-9 w-full rounded-md border border-input bg-background pl-9 pr-3 py-1 text-sm ring-offset-background placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2"
              />
              {selectedOwner && (
                <button
                  type="button"
                  onClick={handleClearOwner}
                  className="absolute right-3 text-xs text-muted-foreground hover:text-foreground"
                >
                  更換
                </button>
              )}
            </div>

            {/* 下拉搜尋結果 */}
            {showDropdown && (
              <ul className="absolute z-10 mt-1 w-full rounded-md border border-input bg-white shadow-lg max-h-52 overflow-auto">
                {isSearching ? (
                  <li className="px-3 py-2 text-sm text-muted-foreground">
                    搜尋中…
                  </li>
                ) : (
                  searchResult?.items.map((owner) => (
                    <li
                      key={owner.id}
                      onMouseDown={() => handleSelectOwner(owner)}
                      className="px-3 py-2 text-sm cursor-pointer hover:bg-accent hover:text-accent-foreground"
                    >
                      <span className="font-medium">{owner.full_name}</span>
                      {owner.primary_phone && (
                        <span className="ml-2 text-muted-foreground text-xs">
                          {owner.primary_phone}
                        </span>
                      )}
                      {owner.animal_names && (
                        <span className="ml-2 text-muted-foreground text-xs">
                          · {owner.animal_names}
                        </span>
                      )}
                    </li>
                  ))
                )}
              </ul>
            )}
          </div>

          {/* 已選飼主顯示 */}
          {selectedOwner && (
            <div className="rounded-md border bg-muted/30 px-3 py-2 text-sm">
              <span className="font-medium">{selectedOwner.full_name}</span>
              {selectedOwner.primary_phone && (
                <span className="ml-2 text-muted-foreground">
                  {selectedOwner.primary_phone}
                </span>
              )}
            </div>
          )}
        </CardContent>
      </Card>

      {/* Step 2：選擇動物 */}
      {selectedOwner && (
        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-sm font-medium">2. 選擇就診動物</CardTitle>
          </CardHeader>
          <CardContent>
            {!ownerDetail ? (
              <p className="text-sm text-muted-foreground">載入中…</p>
            ) : ownerDetail.animals.length === 0 ? (
              <p className="text-sm text-muted-foreground">此飼主尚無動物資料</p>
            ) : (
              <div className="grid grid-cols-2 gap-2">
                {ownerDetail.animals.map((animal) => (
                  <button
                    key={animal.id}
                    type="button"
                    onClick={() => setSelectedAnimal(animal)}
                    className={cn(
                      "rounded-md border px-3 py-2 text-left text-sm transition-colors hover:bg-accent",
                      selectedAnimal?.id === animal.id
                        ? "border-primary bg-primary/5 font-medium"
                        : "border-input"
                    )}
                  >
                    <div className="font-medium">{animal.name}</div>
                    <div className="text-xs text-muted-foreground">
                      {animal.species_name}
                      {animal.breed_name && ` · ${animal.breed_name}`}
                    </div>
                  </button>
                ))}
              </div>
            )}
          </CardContent>
        </Card>
      )}

      {/* Step 3：主訴與優先度 */}
      {selectedAnimal && (
        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-sm font-medium">3. 主訴與優先度</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div>
              <p className="text-xs text-muted-foreground mb-1">
                主訴（必填）
              </p>
              <textarea
                value={chiefComplaint}
                onChange={(e) => setChiefComplaint(e.target.value)}
                placeholder="請描述就診原因…"
                rows={3}
                className="flex w-full rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 resize-none"
              />
            </div>

            <button
              type="button"
              onClick={() => setIsUrgent((v) => !v)}
              className={cn(
                "flex items-center gap-2 rounded-md border px-3 py-2 text-sm transition-colors w-full",
                isUrgent
                  ? "border-red-400 bg-red-50 text-red-700"
                  : "border-input hover:bg-accent"
              )}
            >
              <AlertTriangle
                className={cn(
                  "h-4 w-4",
                  isUrgent ? "text-red-500" : "text-muted-foreground"
                )}
              />
              <span className="font-medium">
                {isUrgent ? "急診（點擊取消）" : "標記為急診"}
              </span>
            </button>
          </CardContent>
        </Card>
      )}

      {/* 送出按鈕 */}
      {selectedAnimal && (
        <div className="flex justify-end gap-2">
          <Button variant="outline" onClick={() => navigate("/visits")}>
            取消
          </Button>
          <Button
            disabled={!canSubmit}
            onClick={() => createMutation.mutate()}
          >
            {createMutation.isPending ? "掛號中…" : "確認掛號"}
          </Button>
        </div>
      )}

      {submitError && (
        <p className="text-sm text-destructive text-right">{submitError}</p>
      )}
    </div>
  );
}
