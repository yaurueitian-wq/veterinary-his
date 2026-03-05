import { useCallback, useState } from "react";
import { useNavigate } from "react-router-dom";
import { useQuery } from "@tanstack/react-query";
import { Plus } from "lucide-react";

import { ownersApi } from "@/api/owners";
import { SearchCombobox } from "@/components/SearchCombobox";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";

// ── 過濾條件狀態 ──────────────────────────────────────────

interface Filters {
  name: string;
  phone: string;
  national_id: string;
  animal: string;
  species: string;
}

const EMPTY_FILTERS: Filters = {
  name: "",
  phone: "",
  national_id: "",
  animal: "",
  species: "",
};

export default function OwnerListPage() {
  const navigate = useNavigate();
  const [filters, setFilters] = useState<Filters>(EMPTY_FILTERS);
  const [page, setPage] = useState(1);
  const PAGE_SIZE = 20;

  // 搜尋清單
  const { data, isLoading } = useQuery({
    queryKey: ["owners", filters, page],
    queryFn: () =>
      ownersApi.list({
        name: filters.name || undefined,
        phone: filters.phone || undefined,
        national_id: filters.national_id || undefined,
        animal: filters.animal || undefined,
        species: filters.species || undefined,
        page,
        page_size: PAGE_SIZE,
      }),
    placeholderData: (prev) => prev,
  });

  // Combobox 建議函式（useCallback 避免 SearchCombobox 重複渲染）
  const suggestName = useCallback(
    (q: string) => ownersApi.suggest("name", q),
    []
  );
  const suggestPhone = useCallback(
    (q: string) => ownersApi.suggest("phone", q),
    []
  );
  const suggestNationalId = useCallback(
    (q: string) => ownersApi.suggest("national_id", q),
    []
  );
  const suggestAnimal = useCallback(
    (q: string) => ownersApi.suggest("animal", q),
    []
  );
  const suggestSpecies = useCallback(
    (q: string) => ownersApi.suggest("species", q),
    []
  );

  function setFilter(key: keyof Filters, val: string) {
    setFilters((prev) => ({ ...prev, [key]: val }));
    setPage(1); // 換條件時回第 1 頁
  }

  const totalPages = data ? Math.ceil(data.total / PAGE_SIZE) : 1;

  return (
    <div className="container py-6 space-y-4">
      {/* 標題列 */}
      <div className="flex items-center justify-between">
        <h1 className="text-xl font-semibold">飼主管理</h1>
        <Button onClick={() => navigate("/owners/new")}>
          <Plus className="h-4 w-4" />
          新增飼主
        </Button>
      </div>

      {/* 搜尋區：relative z-10 確保下拉浮層不被下方 Card 蓋住 */}
      <Card className="relative z-10">
        <CardHeader className="pb-3">
          <CardTitle className="text-sm font-medium text-muted-foreground">
            搜尋條件（可複選，AND 組合）
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-5 gap-3">
            <SearchCombobox
              label="飼主姓名"
              value={filters.name}
              onChange={(v) => setFilter("name", v)}
              fetchSuggestions={suggestName}
            />
            <SearchCombobox
              label="電話"
              value={filters.phone}
              onChange={(v) => setFilter("phone", v)}
              fetchSuggestions={suggestPhone}
            />
            <SearchCombobox
              label="身分證字號"
              value={filters.national_id}
              onChange={(v) => setFilter("national_id", v)}
              fetchSuggestions={suggestNationalId}
            />
            <SearchCombobox
              label="寵物姓名"
              value={filters.animal}
              onChange={(v) => setFilter("animal", v)}
              fetchSuggestions={suggestAnimal}
            />
            <SearchCombobox
              label="物種"
              value={filters.species}
              onChange={(v) => setFilter("species", v)}
              fetchSuggestions={suggestSpecies}
            />
          </div>
        </CardContent>
      </Card>

      {/* 結果表格 */}
      <Card>
        <CardContent className="p-0">
          {isLoading ? (
            <div className="py-12 text-center text-sm text-muted-foreground">
              載入中…
            </div>
          ) : !data || data.items.length === 0 ? (
            <div className="py-12 text-center text-sm text-muted-foreground">
              {Object.values(filters).some(Boolean)
                ? "找不到符合條件的飼主"
                : "尚無飼主資料"}
            </div>
          ) : (
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b bg-muted/50">
                  <th className="px-4 py-3 text-left font-medium">飼主姓名</th>
                  <th className="px-4 py-3 text-left font-medium">身分證字號</th>
                  <th className="px-4 py-3 text-left font-medium">主要電話</th>
                  <th className="px-4 py-3 text-left font-medium">寵物姓名</th>
                  <th className="px-4 py-3 text-right font-medium">動物數</th>
                  <th className="px-4 py-3 text-right font-medium"></th>
                </tr>
              </thead>
              <tbody>
                {data.items.map((owner, idx) => (
                  <tr
                    key={owner.id}
                    className={idx % 2 === 1 ? "bg-muted/20" : ""}
                  >
                    <td className="px-4 py-3 font-medium">{owner.full_name}</td>
                    <td className="px-4 py-3 text-muted-foreground">
                      {owner.national_id ?? "—"}
                    </td>
                    <td className="px-4 py-3 text-muted-foreground">
                      {owner.primary_phone ?? "—"}
                    </td>
                    <td className="px-4 py-3 text-muted-foreground">
                      {owner.animal_names || "—"}
                    </td>
                    <td className="px-4 py-3 text-right">
                      {owner.animal_count}
                    </td>
                    <td className="px-4 py-3 text-right">
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => navigate(`/owners/${owner.id}`)}
                      >
                        查看
                      </Button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </CardContent>
      </Card>

      {/* 分頁 */}
      {data && data.total > PAGE_SIZE && (
        <div className="flex items-center justify-between text-sm text-muted-foreground">
          <span>
            共 {data.total} 筆，第 {page} / {totalPages} 頁
          </span>
          <div className="flex gap-2">
            <Button
              variant="outline"
              size="sm"
              disabled={page <= 1}
              onClick={() => setPage((p) => p - 1)}
            >
              上一頁
            </Button>
            <Button
              variant="outline"
              size="sm"
              disabled={page >= totalPages}
              onClick={() => setPage((p) => p + 1)}
            >
              下一頁
            </Button>
          </div>
        </div>
      )}
    </div>
  );
}
