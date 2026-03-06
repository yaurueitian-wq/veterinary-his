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
      <td className="px-4 py-3 text-xs text-muted-foreground font-mono whitespace-nowrap">
        {formatRecordNo(visit.id)}
      </td>
      <td className="px-4 py-3 text-sm font-medium">
        {visit.animal_name ?? "—"}
        {visit.species_name && (
          <span className="ml-1 text-xs text-muted-foreground font-normal">
            ({visit.species_name})
          </span>
        )}
      </td>
      <td className="px-4 py-3 text-sm text-muted-foreground">
        {visit.owner_name ?? "—"}
      </td>
      <td className="px-4 py-3 text-sm text-muted-foreground line-clamp-1 max-w-[200px]">
        {visit.chief_complaint}
      </td>
      <td className="px-4 py-3">
        <Badge
          variant="secondary"
          className={cn("text-xs", STATUS_COLORS[visit.status])}
        >
          {STATUS_LABELS[visit.status]}
        </Badge>
      </td>
      <td className="px-4 py-3 text-xs text-muted-foreground whitespace-nowrap">
        {formatDatetime(visit.registered_at)}
      </td>
      <td className="px-4 py-3 text-xs text-muted-foreground whitespace-nowrap">
        {formatDatetime(visit.admitted_at)}
      </td>
      <td className="px-4 py-3 text-xs text-muted-foreground whitespace-nowrap">
        {formatDatetime(visit.completed_at)}
      </td>
    </tr>
  );
}

// ── 主頁面 ────────────────────────────────────────────────────

export default function MedicalRecordsPage() {
  const navigate = useNavigate();
  const [search, setSearch] = useState<SearchState>(INITIAL_SEARCH);

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
      if (search.status && v.status !== search.status) return false;
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

  function clearSearch() {
    setSearch(INITIAL_SEARCH);
  }

  function setField<K extends keyof SearchState>(key: K, value: SearchState[K]) {
    setSearch((prev) => ({ ...prev, [key]: value }));
  }

  return (
    <div className="w-full px-6 py-6 space-y-4">
      {/* 標題列 */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-xl font-semibold">病歷</h1>
          {!isLoading && (
            <p className="text-xs text-muted-foreground mt-0.5">
              共 {filtered.length} 筆{hasFilters ? "（已篩選）" : ""}
            </p>
          )}
        </div>
        {hasFilters && (
          <Button variant="ghost" size="sm" onClick={clearSearch}>
            <X className="h-3.5 w-3.5 mr-1" />
            清除篩選
          </Button>
        )}
      </div>

      {/* 搜尋面板 */}
      <div className="rounded-lg border bg-background p-4 space-y-3">
        {/* 第一列：文字搜尋 */}
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
          <div>
            <label className="text-xs text-muted-foreground mb-1 block">病歷號</label>
            <Input
              placeholder="V-000001"
              value={search.recordNo}
              onChange={(e) => setField("recordNo", e.target.value)}
              className="h-8 text-sm"
            />
          </div>
          <div>
            <label className="text-xs text-muted-foreground mb-1 block">寵物姓名</label>
            <Input
              placeholder="搜尋…"
              value={search.animalName}
              onChange={(e) => setField("animalName", e.target.value)}
              className="h-8 text-sm"
            />
          </div>
          <div>
            <label className="text-xs text-muted-foreground mb-1 block">飼主姓名</label>
            <Input
              placeholder="搜尋…"
              value={search.ownerName}
              onChange={(e) => setField("ownerName", e.target.value)}
              className="h-8 text-sm"
            />
          </div>
          <div className="grid grid-cols-2 gap-2">
            <div>
              <label className="text-xs text-muted-foreground mb-1 block">就診狀態</label>
              <select
                value={search.status}
                onChange={(e) => setField("status", e.target.value)}
                className="w-full h-8 rounded-md border border-input bg-background px-2 text-sm focus:outline-none focus:ring-1 focus:ring-ring"
              >
                <option value="">全部</option>
                {(Object.entries(STATUS_LABELS) as [VisitStatus, string][]).map(
                  ([val, label]) => (
                    <option key={val} value={val}>
                      {label}
                    </option>
                  )
                )}
              </select>
            </div>
            <div>
              <label className="text-xs text-muted-foreground mb-1 block">物種</label>
              <select
                value={search.speciesId}
                onChange={(e) => setField("speciesId", e.target.value)}
                className="w-full h-8 rounded-md border border-input bg-background px-2 text-sm focus:outline-none focus:ring-1 focus:ring-ring"
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
        <div className="grid grid-cols-3 gap-3">
          <div>
            <label className="text-xs text-muted-foreground mb-1 block">掛號日</label>
            <input
              type="date"
              value={search.registeredDate}
              onChange={(e) => setField("registeredDate", e.target.value)}
              className="w-full h-8 rounded-md border border-input bg-background px-2 text-sm focus:outline-none focus:ring-1 focus:ring-ring"
            />
          </div>
          <div>
            <label className="text-xs text-muted-foreground mb-1 block">住院日</label>
            <input
              type="date"
              value={search.admittedDate}
              onChange={(e) => setField("admittedDate", e.target.value)}
              className="w-full h-8 rounded-md border border-input bg-background px-2 text-sm focus:outline-none focus:ring-1 focus:ring-ring"
            />
          </div>
          <div>
            <label className="text-xs text-muted-foreground mb-1 block">完診日</label>
            <input
              type="date"
              value={search.completedDate}
              onChange={(e) => setField("completedDate", e.target.value)}
              className="w-full h-8 rounded-md border border-input bg-background px-2 text-sm focus:outline-none focus:ring-1 focus:ring-ring"
            />
          </div>
        </div>
      </div>

      {/* 列表 */}
      {isLoading ? (
        <div className="py-20 text-center text-sm text-muted-foreground">
          載入中…
        </div>
      ) : filtered.length === 0 ? (
        <div className="py-20 text-center text-sm text-muted-foreground">
          <FileText className="mx-auto h-8 w-8 mb-2 opacity-30" />
          {hasFilters ? "無符合篩選條件的紀錄" : "目前無就診紀錄"}
        </div>
      ) : (
        <div className="rounded-lg border bg-background overflow-hidden">
          <table className="w-full text-left">
            <thead>
              <tr className="border-b bg-muted/40 text-xs text-muted-foreground uppercase tracking-wide">
                <th className="px-4 py-2.5 font-medium">病歷號</th>
                <th className="px-4 py-2.5 font-medium">寵物姓名</th>
                <th className="px-4 py-2.5 font-medium">飼主姓名</th>
                <th className="px-4 py-2.5 font-medium">主訴</th>
                <th className="px-4 py-2.5 font-medium">就診狀態</th>
                <th className="px-4 py-2.5 font-medium">掛號日</th>
                <th className="px-4 py-2.5 font-medium">住院日</th>
                <th className="px-4 py-2.5 font-medium">完診日</th>
              </tr>
            </thead>
            <tbody>
              {filtered.map((v) => (
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
    </div>
  );
}
