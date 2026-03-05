import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Plus, RefreshCw, AlertTriangle } from "lucide-react";

import {
  visitsApi,
  STATUS_LABELS,
  STATUS_COLORS,
  NEXT_STATUSES,
  NEXT_STATUS_LABELS,
  type VisitListItem,
  type VisitStatus,
} from "@/api/visits";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { cn } from "@/lib/utils";

// ── 狀態過濾選項 ─────────────────────────────────────────────

const FILTER_OPTIONS: { label: string; value: string }[] = [
  { label: "進行中", value: "registered,triaged,in_consultation,pending_results" },
  { label: "全部", value: "" },
  { label: "已完成", value: "completed" },
  { label: "已取消", value: "cancelled" },
];

// ── 時間格式化 ────────────────────────────────────────────────

function formatTime(iso: string) {
  const d = new Date(iso);
  return d.toLocaleTimeString("zh-TW", { hour: "2-digit", minute: "2-digit" });
}

function minutesAgo(iso: string) {
  const diff = Math.floor((Date.now() - new Date(iso).getTime()) / 60000);
  if (diff < 1) return "剛剛";
  if (diff < 60) return `${diff} 分鐘前`;
  const h = Math.floor(diff / 60);
  const m = diff % 60;
  return `${h} 小時${m > 0 ? ` ${m} 分鐘` : ""}前`;
}

// ── 狀態轉換按鈕 ─────────────────────────────────────────────

function NextStatusButtons({
  visit,
  onTransition,
  loading,
}: {
  visit: VisitListItem;
  onTransition: (id: number, status: VisitStatus) => void;
  loading: boolean;
}) {
  const nexts = NEXT_STATUSES[visit.status] ?? [];
  if (nexts.length === 0) return null;

  return (
    <div className="flex flex-wrap gap-1">
      {nexts.map((s) => (
        <Button
          key={s}
          size="sm"
          variant={s === "cancelled" ? "ghost" : "outline"}
          className={cn(
            "h-7 px-2 text-xs",
            s === "cancelled" && "text-destructive hover:text-destructive"
          )}
          disabled={loading}
          onClick={() => onTransition(visit.id, s)}
        >
          {NEXT_STATUS_LABELS[s] ?? s}
        </Button>
      ))}
    </div>
  );
}

// ── 主頁面 ────────────────────────────────────────────────────

export default function WaitingRoomPage() {
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const [statusFilter, setStatusFilter] = useState(FILTER_OPTIONS[0].value);

  const { data, isLoading, isRefetching, refetch } = useQuery({
    queryKey: ["visits", statusFilter],
    queryFn: () =>
      visitsApi.list(statusFilter ? { status: statusFilter } : {}),
    refetchInterval: 30_000, // 每 30 秒自動重新整理
  });

  const updateMutation = useMutation({
    mutationFn: ({
      id,
      status,
      priority,
    }: {
      id: number;
      status?: VisitStatus;
      priority?: "normal" | "urgent";
    }) => visitsApi.update(id, { status, priority }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["visits"] });
    },
  });

  function handleTransition(id: number, status: VisitStatus) {
    updateMutation.mutate({ id, status });
  }

  function handleTogglePriority(visit: VisitListItem) {
    const next = visit.priority === "urgent" ? "normal" : "urgent";
    updateMutation.mutate({ id: visit.id, priority: next });
  }

  const visits = data?.items ?? [];

  return (
    <div className="container py-6 space-y-4">
      {/* 標題列 */}
      <div className="flex items-center justify-between">
        <h1 className="text-xl font-semibold">候診室</h1>
        <div className="flex gap-2">
          <Button
            variant="outline"
            size="sm"
            onClick={() => refetch()}
            disabled={isRefetching}
          >
            <RefreshCw className={cn("h-4 w-4", isRefetching && "animate-spin")} />
          </Button>
          <Button onClick={() => navigate("/visits/new")}>
            <Plus className="h-4 w-4" />
            掛號
          </Button>
        </div>
      </div>

      {/* 狀態過濾 */}
      <div className="flex gap-2">
        {FILTER_OPTIONS.map((opt) => (
          <Button
            key={opt.value}
            variant={statusFilter === opt.value ? "default" : "outline"}
            size="sm"
            onClick={() => setStatusFilter(opt.value)}
          >
            {opt.label}
          </Button>
        ))}
      </div>

      {/* 候診清單 */}
      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="text-sm font-medium text-muted-foreground">
            今日
            {statusFilter === FILTER_OPTIONS[0].value
              ? "進行中"
              : statusFilter === "completed"
              ? "已完成"
              : statusFilter === "cancelled"
              ? "已取消"
              : "全部"}
            　共 {data?.total ?? 0} 筆
          </CardTitle>
        </CardHeader>
        <CardContent className="p-0">
          {isLoading ? (
            <div className="py-12 text-center text-sm text-muted-foreground">
              載入中…
            </div>
          ) : visits.length === 0 ? (
            <div className="py-12 text-center text-sm text-muted-foreground">
              目前無候診紀錄
            </div>
          ) : (
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b bg-muted/50">
                  <th className="px-4 py-3 text-left font-medium w-6"></th>
                  <th className="px-4 py-3 text-left font-medium">動物 / 飼主</th>
                  <th className="px-4 py-3 text-left font-medium">主訴</th>
                  <th className="px-4 py-3 text-left font-medium">狀態</th>
                  <th className="px-4 py-3 text-left font-medium">掛號時間</th>
                  <th className="px-4 py-3 text-left font-medium">操作</th>
                </tr>
              </thead>
              <tbody>
                {visits.map((visit, idx) => (
                  <tr
                    key={visit.id}
                    className={cn(
                      idx % 2 === 1 ? "bg-muted/20" : "",
                      visit.priority === "urgent" && "border-l-2 border-l-red-500"
                    )}
                  >
                    {/* 緊急標記 */}
                    <td className="px-2 py-3 text-center">
                      <button
                        title={
                          visit.priority === "urgent" ? "點擊解除急診" : "點擊標記急診"
                        }
                        onClick={() => handleTogglePriority(visit)}
                        className="hover:opacity-70 transition-opacity"
                      >
                        <AlertTriangle
                          className={cn(
                            "h-4 w-4",
                            visit.priority === "urgent"
                              ? "text-red-500 fill-red-100"
                              : "text-muted-foreground/30"
                          )}
                        />
                      </button>
                    </td>

                    {/* 動物 / 飼主 */}
                    <td className="px-4 py-3">
                      <div className="font-medium">
                        {visit.animal_name ?? "—"}
                        {visit.species_name && (
                          <span className="ml-1 text-xs text-muted-foreground font-normal">
                            ({visit.species_name})
                          </span>
                        )}
                      </div>
                      <div className="text-xs text-muted-foreground">
                        {visit.owner_name ?? "—"}
                      </div>
                    </td>

                    {/* 主訴 */}
                    <td className="px-4 py-3 max-w-[200px]">
                      <p className="truncate text-muted-foreground">
                        {visit.chief_complaint}
                      </p>
                    </td>

                    {/* 狀態 badge */}
                    <td className="px-4 py-3">
                      <span
                        className={cn(
                          "inline-flex items-center rounded-full px-2 py-0.5 text-xs font-medium",
                          STATUS_COLORS[visit.status]
                        )}
                      >
                        {STATUS_LABELS[visit.status]}
                      </span>
                    </td>

                    {/* 掛號時間 */}
                    <td className="px-4 py-3 text-muted-foreground whitespace-nowrap">
                      <div>{formatTime(visit.registered_at)}</div>
                      <div className="text-xs">{minutesAgo(visit.registered_at)}</div>
                    </td>

                    {/* 狀態操作按鈕 */}
                    <td className="px-4 py-3">
                      <NextStatusButtons
                        visit={visit}
                        onTransition={handleTransition}
                        loading={updateMutation.isPending}
                      />
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
