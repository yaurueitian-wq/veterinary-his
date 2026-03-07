import { useState, useMemo } from "react";
import { useNavigate } from "react-router-dom";
import { useQuery } from "@tanstack/react-query";
import { FileText, X } from "lucide-react";

import {
  visitsApi,
  STATUS_LABELS,
  STATUS_COLORS,
  type VisitListItem,
  type VisitStatus,
} from "@/api/visits";
import { catalogsApi } from "@/api/catalogs";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";

// ── 工具函式 ──────────────────────────────────────────────────

/** 病歷號格式（ADR-013） */
function formatRecordNo(id: number): string {
  return `V-${String(id).padStart(6, "0")}`;
}

function formatDatetime(iso: string | null | undefined): string {
  if (!iso) return "—";
  return new Date(iso).toLocaleString("zh-TW", {
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    hour12: false,
  });
}

/** 將 ISO 字串轉為本地日期字串 "YYYY-MM-DD"（用於與 date input 值比較） */
function toLocalDate(iso: string | null | undefined): string | null {
  if (!iso) return null;
  return new Date(iso).toLocaleDateString("en-CA"); // "2026-03-07"
}

// ── 搜尋狀態 ─────────────────────────────────────────────────

interface SearchState {
  recordNo: string;
  animalName: string;
  ownerName: string;
  status: string;       // "" = all
  speciesId: string;    // "" = all, else number string
  registeredDate: string;
  admittedDate: string;
  completedDate: string;
}

const INITIAL_SEARCH: SearchState = {
  recordNo: "",
  animalName: "",
  ownerName: "",
  status: "",
  speciesId: "",
  registeredDate: "",
  admittedDate: "",
  completedDate: "",
};

// ── 列表列 ────────────────────────────────────────────────────

function RecordRow({
  visit,
  onClick,
}: {
  visit: VisitListItem;
  onClick: () => void;
}) {
  return (
    <tr
      className="border-b last:border-0 hover:bg-muted/40 cursor-pointer transition-colors"
      onClick={onClick}
    >
      <td className="px-5 py-4 text-sm text-muted-foreground font-mono whitespace-nowrap">
        {formatRecordNo(visit.id)}
      </td>
      <td className="px-5 py-4 text-base font-medium">
        {visit.animal_name ?? "—"}
        {visit.species_name && (
          <span className="ml-1.5 text-sm text-muted-foreground font-normal">
            ({visit.species_name})
          </span>
        )}
      </td>
      <td className="px-5 py-4 text-base text-muted-foreground">
        {visit.owner_name ?? "—"}
      </td>
      <td className="px-5 py-4 text-sm text-muted-foreground line-clamp-1 max-w-xs">
        {visit.chief_complaint}
      </td>
      <td className="px-5 py-4">
        <Badge
          variant="secondary"
          className={cn("text-sm px-2.5 py-0.5", STATUS_COLORS[visit.status])}
        >
          {STATUS_LABELS[visit.status]}
        </Badge>
      </td>
      <td className="px-5 py-4 text-sm text-muted-foreground whitespace-nowrap">
        {formatDatetime(visit.registered_at)}
      </td>
      <td className="px-5 py-4 text-sm text-muted-foreground whitespace-nowrap">
        {formatDatetime(visit.admitted_at)}
      </td>
      <td className="px-5 py-4 text-sm text-muted-foreground whitespace-nowrap">
        {formatDatetime(visit.completed_at)}
      </td>
    </tr>
  );
}

// ── 主頁面 ────────────────────────────────────────────────────

export default function MedicalRecordsPage() {
  const navigate = useNavigate();
  const [search, setSearch] = useState<SearchState>(INITIAL_SEARCH);
  const [page, setPage] = useState(1);
  const PAGE_SIZE = 8;

  const { data, isLoading } = useQuery({
    queryKey: ["medical-records-list"],
    queryFn: () => visitsApi.list({ all_dates: true }),
  });

  const { data: speciesData } = useQuery({
    queryKey: ["species"],
    queryFn: catalogsApi.species,
  });

  const allVisits = data?.items ?? [];

  const filtered = useMemo(() => {
    return allVisits.filter((v) => {
      // 病歷號
      if (search.recordNo.trim()) {
        const q = search.recordNo.trim().toLowerCase();
        if (!formatRecordNo(v.id).toLowerCase().includes(q)) return false;
      }
      // 寵物姓名
      if (search.animalName.trim()) {
        const q = search.animalName.trim().toLowerCase();
        if (!v.animal_name?.toLowerCase().includes(q)) return false;
      }
      // 飼主姓名
      if (search.ownerName.trim()) {
        const q = search.ownerName.trim().toLowerCase();
        if (!v.owner_name?.toLowerCase().includes(q)) return false;
      }
      // 就診狀態
      if (search.status) {
        if (search.status === "incomplete") {
          const INCOMPLETE: VisitStatus[] = ["registered", "triaged", "in_consultation", "pending_results", "admitted"];
          if (!INCOMPLETE.includes(v.status)) return false;
        } else if (v.status !== search.status) {
          return false;
        }
      }
      // 物種
      if (search.speciesId) {
        const sid = parseInt(search.speciesId, 10);
        const species = speciesData?.find((s) => s.id === sid);
        if (species && v.species_name !== species.name) return false;
      }
      // 掛號日
      if (search.registeredDate) {
        if (toLocalDate(v.registered_at) !== search.registeredDate) return false;
      }
      // 住院日
      if (search.admittedDate) {
        if (toLocalDate(v.admitted_at) !== search.admittedDate) return false;
      }
      // 完診日
      if (search.completedDate) {
        if (toLocalDate(v.completed_at) !== search.completedDate) return false;
      }
      return true;
    });
  }, [allVisits, search, speciesData]);

  const hasFilters = Object.values(search).some((v) => v !== "");
  const totalPages = Math.ceil(filtered.length / PAGE_SIZE) || 1;
  const pagedItems = filtered.slice((page - 1) * PAGE_SIZE, page * PAGE_SIZE);

  function clearSearch() {
    setSearch(INITIAL_SEARCH);
    setPage(1);
  }

  function setField<K extends keyof SearchState>(key: K, value: SearchState[K]) {
    setSearch((prev) => ({ ...prev, [key]: value }));
    setPage(1);
  }

  return (
    <div className="w-full px-8 py-8 space-y-5">
      {/* 標題列 */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-semibold">病歷</h1>
        </div>
        {hasFilters && (
          <Button variant="ghost" size="sm" onClick={clearSearch}>
            <X className="h-4 w-4 mr-1" />
            清除篩選
          </Button>
        )}
      </div>

      {/* 搜尋面板 */}
      <div className="rounded-lg border bg-background p-5 space-y-4">
        {/* 第一列：文字搜尋 */}
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
          <div>
            <label className="text-sm text-muted-foreground mb-1.5 block">病歷號</label>
            <Input
              placeholder="V-000001"
              value={search.recordNo}
              onChange={(e) => setField("recordNo", e.target.value)}
              className="h-10 text-base"
            />
          </div>
          <div>
            <label className="text-sm text-muted-foreground mb-1.5 block">寵物姓名</label>
            <Input
              placeholder="搜尋…"
              value={search.animalName}
              onChange={(e) => setField("animalName", e.target.value)}
              className="h-10 text-base"
            />
          </div>
          <div>
            <label className="text-sm text-muted-foreground mb-1.5 block">飼主姓名</label>
            <Input
              placeholder="搜尋…"
              value={search.ownerName}
              onChange={(e) => setField("ownerName", e.target.value)}
              className="h-10 text-base"
            />
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="text-sm text-muted-foreground mb-1.5 block">就診狀態</label>
              <select
                value={search.status}
                onChange={(e) => setField("status", e.target.value)}
                className="w-full h-10 rounded-md border border-input bg-background px-3 text-base focus:outline-none focus:ring-1 focus:ring-ring"
              >
                <option value="">全部</option>
                <optgroup label="快速篩選">
                  <option value="incomplete">未完成</option>
                  <option value="completed">{STATUS_LABELS.completed}</option>
                </optgroup>
                <optgroup label="個別狀態">
                  {(["registered", "triaged", "in_consultation", "pending_results", "admitted", "completed", "cancelled"] as VisitStatus[]).map(
                    (val) => (
                      <option key={val} value={val}>
                        {STATUS_LABELS[val]}
                      </option>
                    )
                  )}
                </optgroup>
              </select>
            </div>
            <div>
              <label className="text-sm text-muted-foreground mb-1.5 block">物種</label>
              <select
                value={search.speciesId}
                onChange={(e) => setField("speciesId", e.target.value)}
                className="w-full h-10 rounded-md border border-input bg-background px-3 text-base focus:outline-none focus:ring-1 focus:ring-ring"
              >
                <option value="">全部</option>
                {speciesData?.map((s) => (
                  <option key={s.id} value={String(s.id)}>
                    {s.name}
                  </option>
                ))}
              </select>
            </div>
          </div>
        </div>

        {/* 第二列：日期搜尋 */}
        <div className="grid grid-cols-3 gap-4">
          <div>
            <label className="text-sm text-muted-foreground mb-1.5 block">掛號日</label>
            <input
              type="date"
              value={search.registeredDate}
              onChange={(e) => setField("registeredDate", e.target.value)}
              className="w-full h-10 rounded-md border border-input bg-background px-3 text-base focus:outline-none focus:ring-1 focus:ring-ring"
            />
          </div>
          <div>
            <label className="text-sm text-muted-foreground mb-1.5 block">住院日</label>
            <input
              type="date"
              value={search.admittedDate}
              onChange={(e) => setField("admittedDate", e.target.value)}
              className="w-full h-10 rounded-md border border-input bg-background px-3 text-base focus:outline-none focus:ring-1 focus:ring-ring"
            />
          </div>
          <div>
            <label className="text-sm text-muted-foreground mb-1.5 block">完診日</label>
            <input
              type="date"
              value={search.completedDate}
              onChange={(e) => setField("completedDate", e.target.value)}
              className="w-full h-10 rounded-md border border-input bg-background px-3 text-base focus:outline-none focus:ring-1 focus:ring-ring"
            />
          </div>
        </div>
      </div>

      {/* 列表 */}
      {isLoading ? (
        <div className="py-24 text-center text-base text-muted-foreground">
          載入中…
        </div>
      ) : filtered.length === 0 ? (
        <div className="py-24 text-center text-base text-muted-foreground">
          <FileText className="mx-auto h-10 w-10 mb-3 opacity-30" />
          {hasFilters ? "無符合篩選條件的紀錄" : "目前無就診紀錄"}
        </div>
      ) : (
        <div className="rounded-lg border bg-background overflow-hidden">
          {/* 筆數列 */}
          <div className="px-5 py-2.5 border-b text-sm text-muted-foreground flex items-center justify-between">
            <span>
              共 <span className="font-medium text-foreground">{filtered.length}</span> 筆
              {hasFilters && "（已篩選）"}
            </span>
            {filtered.length > 0 && (
              <span>
                第 {(page - 1) * PAGE_SIZE + 1}–{Math.min(page * PAGE_SIZE, filtered.length)} 筆
              </span>
            )}
          </div>
          <table className="w-full text-left">
            <thead>
              <tr className="border-b bg-muted/40 text-sm text-muted-foreground">
                <th className="px-5 py-3.5 font-medium">病歷號</th>
                <th className="px-5 py-3.5 font-medium">寵物姓名</th>
                <th className="px-5 py-3.5 font-medium">飼主姓名</th>
                <th className="px-5 py-3.5 font-medium">主訴</th>
                <th className="px-5 py-3.5 font-medium">就診狀態</th>
                <th className="px-5 py-3.5 font-medium">掛號日</th>
                <th className="px-5 py-3.5 font-medium">住院日</th>
                <th className="px-5 py-3.5 font-medium">完診日</th>
              </tr>
            </thead>
            <tbody>
              {pagedItems.map((v) => (
                <RecordRow
                  key={v.id}
                  visit={v}
                  onClick={() => navigate(`/medical-records/${v.id}`)}
                />
              ))}
            </tbody>
          </table>
        </div>
      )}

      {/* 分頁列 */}
      {!isLoading && filtered.length > 0 && totalPages > 1 && (
        <div className="flex items-center justify-center gap-1 py-3">
          <Button
            variant="outline"
            size="sm"
            disabled={page <= 1}
            onClick={() => setPage((p) => p - 1)}
          >
            ‹
          </Button>

          {(() => {
            const delta = 2;
            const start = Math.max(1, page - delta);
            const end = Math.min(totalPages, page + delta);
            const pages: (number | "…")[] = [];
            if (start > 1) { pages.push(1); if (start > 2) pages.push("…"); }
            for (let i = start; i <= end; i++) pages.push(i);
            if (end < totalPages) { if (end < totalPages - 1) pages.push("…"); pages.push(totalPages); }
            return pages.map((p, i) =>
              p === "…" ? (
                <span key={`ellipsis-${i}`} className="px-1 text-sm text-muted-foreground">…</span>
              ) : (
                <Button
                  key={p}
                  variant={p === page ? "default" : "outline"}
                  size="sm"
                  className="w-8 px-0"
                  onClick={() => setPage(p)}
                >
                  {p}
                </Button>
              )
            );
          })()}

          <Button
            variant="outline"
            size="sm"
            disabled={page >= totalPages}
            onClick={() => setPage((p) => p + 1)}
          >
            ›
          </Button>
        </div>
      )}
    </div>
  );
}
