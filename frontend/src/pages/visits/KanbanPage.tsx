import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import {
  DndContext,
  DragOverlay,
  useDraggable,
  useDroppable,
  PointerSensor,
  TouchSensor,
  useSensor,
  useSensors,
  type DragStartEvent,
  type DragEndEvent,
} from "@dnd-kit/core";
import { Plus, RefreshCw, AlertTriangle, Clock } from "lucide-react";
import { toast } from "sonner";

import {
  visitsApi,
  type VisitListItem,
  type VisitStatus,
} from "@/api/visits";
import { Button } from "@/components/ui/button";
import { VisitDetailModal } from "@/components/visits/VisitDetailModal";
import { cn } from "@/lib/utils";

// ── 看板欄位設定 ──────────────────────────────────────────────

type ActiveStatus =
  | "registered"
  | "triaged"
  | "in_consultation"
  | "pending_results"
  | "admitted"
  | "completed";

const ACTIVE_COLUMNS: ActiveStatus[] = [
  "registered",
  "triaged",
  "in_consultation",
  "pending_results",
  "admitted",
  "completed",
];

const COLUMN_CONFIG: Record<
  ActiveStatus,
  { label: string; headerClass: string; bodyClass: string }
> = {
  registered: {
    label: "候診中",
    headerClass: "bg-blue-50 text-blue-800 border-blue-200",
    bodyClass: "border-blue-200 bg-blue-50/30",
  },
  triaged: {
    label: "已初診",
    headerClass: "bg-yellow-50 text-yellow-800 border-yellow-200",
    bodyClass: "border-yellow-200 bg-yellow-50/30",
  },
  in_consultation: {
    label: "診療中",
    headerClass: "bg-green-50 text-green-800 border-green-200",
    bodyClass: "border-green-200 bg-green-50/30",
  },
  pending_results: {
    label: "待檢驗",
    headerClass: "bg-purple-50 text-purple-800 border-purple-200",
    bodyClass: "border-purple-200 bg-purple-50/30",
  },
  admitted: {
    label: "住院中",
    headerClass: "bg-orange-50 text-orange-800 border-orange-200",
    bodyClass: "border-orange-200 bg-orange-50/30",
  },
  completed: {
    label: "已完診",
    headerClass: "bg-emerald-50 text-emerald-800 border-emerald-200",
    bodyClass: "border-emerald-200 bg-emerald-50/30",
  },
};

// ── 時間格式化 ────────────────────────────────────────────────

function waitingTime(iso: string): string {
  const diff = Math.floor((Date.now() - new Date(iso).getTime()) / 60000);
  if (diff < 1) return "剛剛";
  if (diff < 60) return `${diff} 分`;
  const h = Math.floor(diff / 60);
  const m = diff % 60;
  return m > 0 ? `${h} 時 ${m} 分` : `${h} 時`;
}

// ── 卡片純顯示元件（共用於看板和 DragOverlay） ─────────────────

function VisitCardContent({ visit }: { visit: VisitListItem }) {
  return (
    <div
      className={cn(
        "rounded-lg border bg-white p-3 space-y-1.5 shadow-sm",
        visit.priority === "urgent"
          ? "border-l-[3px] border-l-red-500"
          : "border-border"
      )}
    >
      {/* 動物 + 物種 + 急診標記 */}
      <div className="flex items-start justify-between gap-1">
        <div className="min-w-0">
          <span className="font-medium text-sm leading-tight">
            {visit.animal_name ?? "—"}
          </span>
          {visit.species_name && (
            <span className="text-xs text-muted-foreground ml-1">
              ({visit.species_name})
            </span>
          )}
        </div>
        {visit.priority === "urgent" && (
          <AlertTriangle className="h-3.5 w-3.5 text-red-500 flex-shrink-0 mt-0.5" />
        )}
      </div>

      {/* 飼主 */}
      <p className="text-xs text-muted-foreground">{visit.owner_name ?? "—"}</p>

      {/* 主訴 */}
      <p className="text-xs text-muted-foreground line-clamp-2 leading-relaxed">
        {visit.chief_complaint}
      </p>

      {/* 等待時間 */}
      <div className="flex items-center gap-1 text-xs text-muted-foreground pt-0.5">
        <Clock className="h-3 w-3" />
        <span>{waitingTime(visit.registered_at)}</span>
      </div>
    </div>
  );
}

// ── 可拖曳卡片 ────────────────────────────────────────────────

function DraggableVisitCard({
  visit,
  onCardClick,
}: {
  visit: VisitListItem;
  onCardClick: (visit: VisitListItem) => void;
}) {
  const { attributes, listeners, setNodeRef, isDragging } = useDraggable({
    id: visit.id,
    data: { visit },
  });

  return (
    <div
      ref={setNodeRef}
      {...attributes}
      {...listeners}
      onClick={() => !isDragging && onCardClick(visit)}
      className={cn(
        "cursor-grab active:cursor-grabbing touch-none",
        isDragging && "opacity-40"
      )}
    >
      <VisitCardContent visit={visit} />
    </div>
  );
}

// ── 看板欄位 ──────────────────────────────────────────────────

function KanbanColumn({
  status,
  visits,
  activeVisit,
  onCardClick,
}: {
  status: ActiveStatus;
  visits: VisitListItem[];
  activeVisit: VisitListItem | null;
  onCardClick: (visit: VisitListItem) => void;
}) {
  const config = COLUMN_CONFIG[status];
  const { setNodeRef, isOver } = useDroppable({ id: status });

  // 任何欄位皆可接收（後端為唯一驗證層）
  const canReceive =
    activeVisit !== null &&
    activeVisit.status !== status;

  const isDragging = activeVisit !== null;

  return (
    <div className="flex flex-col flex-1 min-w-[180px]">
      {/* 欄位標頭 */}
      <div
        className={cn(
          "flex items-center justify-between px-3 py-2 rounded-t-lg border border-b-0 text-sm font-medium",
          config.headerClass
        )}
      >
        <span>{config.label}</span>
        <span className="text-xs rounded-full px-1.5 py-0.5 bg-white/60 font-normal">
          {visits.length}
        </span>
      </div>

      {/* 可拖放區域 */}
      <div
        ref={setNodeRef}
        className={cn(
          "min-h-[600px] rounded-b-lg border p-2 space-y-2 transition-all duration-150",
          config.bodyClass,
          // 正在拖曳且此欄可以接收 → 高亮
          isDragging && canReceive && isOver && "ring-2 ring-primary ring-inset bg-primary/5",
          // 正在拖曳且此欄不可接收 → 淡出
          isDragging && !canReceive && "opacity-40"
        )}
      >
        {visits.map((v) => (
          <DraggableVisitCard key={v.id} visit={v} onCardClick={onCardClick} />
        ))}

        {/* 空欄位提示 */}
        {visits.length === 0 && (
          <div
            className={cn(
              "flex items-center justify-center h-20 rounded-md border-2 border-dashed text-xs transition-colors",
              isDragging && canReceive
                ? "border-primary text-primary"
                : "border-muted-foreground/20 text-muted-foreground/40"
            )}
          >
            {isDragging && canReceive ? "放開以移動" : "—"}
          </div>
        )}
      </div>
    </div>
  );
}

// ── 主頁面 ────────────────────────────────────────────────────

export default function KanbanPage() {
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const [activeVisit, setActiveVisit] = useState<VisitListItem | null>(null);
  const [selectedVisit, setSelectedVisit] = useState<VisitListItem | null>(null);

  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 8 } }),
    useSensor(TouchSensor, { activationConstraint: { delay: 250, tolerance: 5 } })
  );

  const { data, isLoading, isRefetching, refetch } = useQuery({
    queryKey: ["visits-kanban"],
    queryFn: () => visitsApi.list({}), // 今天全部，前端分組
    refetchInterval: 30_000,
  });

  const updateMutation = useMutation({
    mutationFn: ({ id, status }: { id: number; status: VisitStatus }) =>
      visitsApi.update(id, { status }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["visits-kanban"] });
    },
    onError: (err: unknown) => {
      const detail = (err as { response?: { data?: { detail?: string } } })?.response?.data?.detail;
      toast.error(detail ? `狀態更新失敗：${detail}` : "狀態更新失敗，請重試");
      console.error("[KanbanPage] 狀態更新失敗", err);
      queryClient.invalidateQueries({ queryKey: ["visits-kanban"] });
    },
  });

  const allVisits = data?.items ?? [];

  // 按狀態分組
  const visitsByStatus = ACTIVE_COLUMNS.reduce<
    Record<ActiveStatus, VisitListItem[]>
  >(
    (acc, col) => {
      acc[col] = allVisits.filter((v) => v.status === col);
      return acc;
    },
    { registered: [], triaged: [], in_consultation: [], pending_results: [], admitted: [], completed: [] }
  );

  function handleDragStart(event: DragStartEvent) {
    const visit = allVisits.find((v) => v.id === event.active.id);
    setActiveVisit(visit ?? null);
  }

  function handleDragEnd(event: DragEndEvent) {
    const { active, over } = event;
    setActiveVisit(null);
    if (!over) return;

    const visitId = active.id as number;
    const targetStatus = over.id as VisitStatus;
    const visit = allVisits.find((v) => v.id === visitId);
    if (!visit || visit.status === targetStatus) return;

    updateMutation.mutate({ id: visitId, status: targetStatus });
  }

  const inProgressCount = (["registered", "triaged", "in_consultation", "pending_results", "admitted"] as const).reduce(
    (sum, col) => sum + visitsByStatus[col].length,
    0
  );
  const todayTotal = allVisits.length;

  return (
    <div className="w-full px-6 py-6 space-y-4">
      {/* 標題列 */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-xl font-semibold">候診室</h1>
          {!isLoading && (
            <p className="text-xs text-muted-foreground mt-0.5">
              進行中 {inProgressCount} / 今日 {todayTotal} 筆
            </p>
          )}
        </div>
        <div className="flex gap-2">
          <Button
            variant="outline"
            size="sm"
            onClick={() => refetch()}
            disabled={isRefetching}
          >
            <RefreshCw
              className={cn("h-4 w-4", isRefetching && "animate-spin")}
            />
          </Button>
          <Button onClick={() => navigate("/visits/new")}>
            <Plus className="h-4 w-4" />
            掛號
          </Button>
        </div>
      </div>

      {/* 看板 */}
      {isLoading ? (
        <div className="py-20 text-center text-sm text-muted-foreground">
          載入中…
        </div>
      ) : (
        <DndContext
          sensors={sensors}
          onDragStart={handleDragStart}
          onDragEnd={handleDragEnd}
        >
          {/* 看板欄位 */}
          <div className="flex gap-3 pb-2 items-start">
            {ACTIVE_COLUMNS.map((col) => (
              <KanbanColumn
                key={col}
                status={col}
                visits={visitsByStatus[col]}
                activeVisit={activeVisit}
                onCardClick={setSelectedVisit}
              />
            ))}
          </div>

          {/* 拖曳中的浮動卡片（跟隨游標） */}
          <DragOverlay dropAnimation={null}>
            {activeVisit ? (
              <div className="w-[220px] rotate-1 cursor-grabbing shadow-xl opacity-95">
                <VisitCardContent visit={activeVisit} />
              </div>
            ) : null}
          </DragOverlay>
        </DndContext>
      )}

      <VisitDetailModal
        visit={selectedVisit}
        onClose={() => setSelectedVisit(null)}
      />
    </div>
  );
}
