import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import {
  DndContext,
  DragOverlay,
  useDraggable,
  useDroppable,
  PointerSensor,
  useSensor,
  useSensors,
  type DragStartEvent,
  type DragEndEvent,
} from "@dnd-kit/core";
import { BedDouble, User, GripVertical } from "lucide-react";
import { toast } from "sonner";

import {
  hospitalizationApi,
  type WardRead,
  type WardDetailRead,
  type BedRead,
} from "@/api/hospitalization";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog";
import { cn } from "@/lib/utils";

// ── 型別 ──────────────────────────────────────────────────────

interface OccupancyInfo {
  bed_id: number;
  bed_number: string;
  admission_id: number;
  visit_id: number;
  animal_name: string;
  owner_name: string;
  admitted_at: string | null;
  days: number;
}

// ── 床位狀態配色 ──────────────────────────────────────────────

const BED_STATUS_CONFIG: Record<string, { label: string; dot: string; bg: string }> = {
  available:   { label: "空床",   dot: "bg-emerald-500", bg: "bg-emerald-50 border-emerald-200" },
  occupied:    { label: "占用",   dot: "bg-red-500",     bg: "bg-red-50 border-red-200" },
  maintenance: { label: "維護中", dot: "bg-amber-500",   bg: "bg-amber-50 border-amber-200" },
  inactive:    { label: "停用",   dot: "bg-gray-400",    bg: "bg-gray-50 border-gray-200 opacity-50" },
};

// ── 可拖曳的占用床位卡片 ──────────────────────────────────────

function DraggableBedCard({
  bed,
  occ,
  onNavigate,
}: {
  bed: BedRead;
  occ: OccupancyInfo;
  onNavigate: () => void;
}) {
  const { attributes, listeners, setNodeRef, isDragging } = useDraggable({
    id: `occ-${occ.admission_id}`,
    data: { occ, fromBed: bed },
  });

  return (
    <div
      ref={setNodeRef}
      className={cn(
        "rounded-lg border p-3 text-left transition-colors bg-red-50 border-red-200",
        isDragging && "opacity-40",
      )}
    >
      {/* 床號 + 拖曳把手 */}
      <div className="flex items-center justify-between mb-1.5">
        <span className="font-mono text-sm font-medium">{bed.bed_number}</span>
        <div className="flex items-center gap-1">
          <span className="h-2 w-2 rounded-full bg-red-500" />
          <span
            {...attributes}
            {...listeners}
            className="cursor-grab active:cursor-grabbing touch-none p-0.5"
          >
            <GripVertical className="h-3.5 w-3.5 text-muted-foreground" />
          </span>
        </div>
      </div>
      <p className="text-xs text-muted-foreground mb-1">{bed.bed_type_name}</p>
      <div className="space-y-1 mt-2">
        <button
          type="button"
          onClick={onNavigate}
          className="flex items-center gap-1 text-sm font-medium hover:underline"
        >
          <BedDouble className="h-3.5 w-3.5 text-muted-foreground" />
          {occ.animal_name}
        </button>
        <div className="flex items-center gap-1 text-xs text-muted-foreground">
          <User className="h-3 w-3" />
          {occ.owner_name}
        </div>
        <Badge variant="secondary" className="text-xs">Day {occ.days}</Badge>
      </div>
    </div>
  );
}

// ── 可放置的空床位 ────────────────────────────────────────────

function DroppableBedCard({ bed }: { bed: BedRead }) {
  const config = BED_STATUS_CONFIG[bed.status] ?? BED_STATUS_CONFIG.available;
  const canDrop = bed.status === "available";
  const { setNodeRef, isOver } = useDroppable({
    id: `bed-${bed.id}`,
    data: { bed },
    disabled: !canDrop,
  });

  return (
    <div
      ref={setNodeRef}
      className={cn(
        "rounded-lg border p-3 text-left transition-colors",
        config.bg,
        canDrop && isOver && "ring-2 ring-primary ring-inset bg-primary/5",
      )}
    >
      <div className="flex items-center justify-between mb-1.5">
        <span className="font-mono text-sm font-medium">{bed.bed_number}</span>
        <span className={cn("h-2 w-2 rounded-full", config.dot)} />
      </div>
      <p className="text-xs text-muted-foreground mb-1">{bed.bed_type_name}</p>
      <p className="text-xs text-muted-foreground mt-2">
        {canDrop && isOver ? "放開以移入" : config.label}
      </p>
    </div>
  );
}

// ── DragOverlay 浮動卡片 ──────────────────────────────────────

function DragOverlayCard({ occ }: { occ: OccupancyInfo }) {
  return (
    <div className="w-[180px] rounded-lg border bg-white p-3 shadow-xl rotate-1 opacity-95">
      <span className="font-mono text-sm font-medium">{occ.bed_number}</span>
      <div className="mt-1 text-sm font-medium">{occ.animal_name}</div>
      <div className="text-xs text-muted-foreground">{occ.owner_name}</div>
    </div>
  );
}

// ── 跨類型轉床 Modal ──────────────────────────────────────────

function CrossTypeTransferModal({
  open,
  onClose,
  onConfirm,
  isPending,
  fromWardName,
  toWardName,
}: {
  open: boolean;
  onClose: () => void;
  onConfirm: (assessment: string, plan: string) => void;
  isPending: boolean;
  fromWardName: string;
  toWardName: string;
}) {
  const [assessment, setAssessment] = useState("");
  const [plan, setPlan] = useState("");

  function handleSubmit() {
    if (!assessment.trim()) {
      toast.error("請填寫評估（巡房紀錄）");
      return;
    }
    onConfirm(assessment, plan);
  }

  return (
    <Dialog open={open} onOpenChange={(v) => !v && onClose()}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle>跨病房轉床</DialogTitle>
        </DialogHeader>
        <p className="text-sm text-muted-foreground">
          {fromWardName} → {toWardName}
        </p>
        <div className="space-y-3">
          <div className="space-y-1.5">
            <Label>評估（巡房紀錄）*</Label>
            <textarea
              className="w-full rounded-md border px-3 py-2 text-sm min-h-[60px]"
              value={assessment}
              onChange={(e) => setAssessment(e.target.value)}
              placeholder="病情變化說明…"
            />
          </div>
          <div className="space-y-1.5">
            <Label>治療計畫</Label>
            <textarea
              className="w-full rounded-md border px-3 py-2 text-sm min-h-[60px]"
              value={plan}
              onChange={(e) => setPlan(e.target.value)}
              placeholder="轉床後的治療計畫…"
            />
          </div>
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={onClose}>取消</Button>
          <Button onClick={handleSubmit} disabled={isPending}>
            {isPending ? "處理中…" : "確認轉床"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

// ── 病房內容（含 droppable 床位）─────────────────────────────

function WardContent({
  wardId,
  occupancyByBed,
  onNavigate,
}: {
  wardId: number;
  occupancyByBed: Map<number, OccupancyInfo>;
  onNavigate: (visitId: number) => void;
}) {
  const { data: ward, isLoading } = useQuery<WardDetailRead>({
    queryKey: ["ward-detail", wardId],
    queryFn: () => hospitalizationApi.getWard(wardId),
  });

  if (isLoading) {
    return <p className="text-sm text-muted-foreground py-4 text-center">載入中…</p>;
  }
  if (!ward) return null;

  const activeBeds = ward.beds.filter((b) => b.is_active);

  return (
    <div className="grid grid-cols-5 gap-3">
      {activeBeds.map((bed) => {
        const occ = occupancyByBed.get(bed.id);
        if (occ) {
          return (
            <DraggableBedCard
              key={bed.id}
              bed={bed}
              occ={occ}
              onNavigate={() => onNavigate(occ.visit_id)}
            />
          );
        }
        return <DroppableBedCard key={bed.id} bed={bed} />;
      })}
    </div>
  );
}

// ── 主頁面 ────────────────────────────────────────────────────

export default function InpatientPage() {
  const navigate = useNavigate();
  const qc = useQueryClient();

  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 8 } })
  );

  const { data: wards = [], isLoading } = useQuery<WardRead[]>({
    queryKey: ["wards"],
    queryFn: hospitalizationApi.listWards,
  });

  // 所有病房的 occupancy 一次查詢
  const wardIds = wards.map((w) => w.id);
  const occupancyQueries = useQuery({
    queryKey: ["all-ward-occupancy", wardIds],
    queryFn: async () => {
      const results: OccupancyInfo[] = [];
      for (const wid of wardIds) {
        const data = await hospitalizationApi.getWardOccupancy(wid);
        results.push(...data);
      }
      return results;
    },
    enabled: wardIds.length > 0,
    refetchInterval: 30_000,
  });

  const allOccupancy = occupancyQueries.data ?? [];
  const occupancyByBed = new Map(allOccupancy.map((o) => [o.bed_id, o]));

  // 拖曳狀態
  const [activeOcc, setActiveOcc] = useState<OccupancyInfo | null>(null);

  // 跨類型轉床 Modal
  const [crossTypeModal, setCrossTypeModal] = useState<{
    admissionId: number;
    toBedId: number;
    fromWardName: string;
    toWardName: string;
  } | null>(null);

  const transferMutation = useMutation({
    mutationFn: (params: { admissionId: number; body: { to_bed_id: number; reason_id?: number | null; reason_notes?: string | null; assessment?: string | null; plan?: string | null } }) =>
      hospitalizationApi.transfer(params.admissionId, params.body),
    onSuccess: () => {
      toast.success("轉床完成");
      qc.invalidateQueries({ queryKey: ["all-ward-occupancy"] });
      qc.invalidateQueries({ queryKey: ["wards"] });
      wardIds.forEach((wid) => {
        qc.invalidateQueries({ queryKey: ["ward-detail", wid] });
      });
      setCrossTypeModal(null);
    },
    onError: (err: unknown) => {
      const detail = (err as { response?: { data?: { detail?: string } } })?.response?.data?.detail;
      toast.error(detail ?? "轉床失敗");
    },
  });

  // 查找 bed 所屬的 ward
  function findWardForBed(bedId: number): WardRead | undefined {
    // 需要從 ward details 找；先用簡單方式——從 occupancy 或 ward detail cache 找
    for (const w of wards) {
      const cached = qc.getQueryData<WardDetailRead>(["ward-detail", w.id]);
      if (cached?.beds.some((b) => b.id === bedId)) return w;
    }
    return undefined;
  }

  function handleDragStart(event: DragStartEvent) {
    const occ = event.active.data.current?.occ as OccupancyInfo | undefined;
    setActiveOcc(occ ?? null);
  }

  function handleDragEnd(event: DragEndEvent) {
    setActiveOcc(null);
    const { active, over } = event;
    if (!over) return;

    const occ = active.data.current?.occ as OccupancyInfo | undefined;
    const targetBed = over.data.current?.bed as BedRead | undefined;
    if (!occ || !targetBed || targetBed.status !== "available") return;

    // 同一張床不處理
    if (occ.bed_id === targetBed.id) return;

    // 判斷是否跨類型
    const fromWard = findWardForBed(occ.bed_id);
    const toWard = findWardForBed(targetBed.id);

    if (!fromWard || !toWard) return;

    const isCrossType = fromWard.ward_type_id !== toWard.ward_type_id;

    if (isCrossType) {
      // 跨類型：彈出 Modal
      setCrossTypeModal({
        admissionId: occ.admission_id,
        toBedId: targetBed.id,
        fromWardName: fromWard.name,
        toWardName: toWard.name,
      });
    } else {
      // 同類型：直接執行
      transferMutation.mutate({
        admissionId: occ.admission_id,
        body: { to_bed_id: targetBed.id },
      });
    }
  }

  if (isLoading) {
    return (
      <div className="w-full px-6 py-6">
        <p className="text-sm text-muted-foreground">載入中…</p>
      </div>
    );
  }

  return (
    <div className="w-full px-6 py-6 space-y-4">
      <div>
        <h1 className="text-xl font-semibold">住院管理</h1>
        <p className="text-xs text-muted-foreground mt-0.5">
          住院中 {wards.reduce((sum, w) => sum + w.total_beds - w.available_beds, 0)} / 總床位 {wards.reduce((sum, w) => sum + w.total_beds, 0)}
        </p>
      </div>

      {wards.length === 0 ? (
        <p className="text-sm text-muted-foreground py-8 text-center">尚未設定病房</p>
      ) : (
        <DndContext
          sensors={sensors}
          onDragStart={handleDragStart}
          onDragEnd={handleDragEnd}
        >
          <div className="space-y-6">
            {wards.map((w) => (
              <div key={w.id}>
                <div className="flex items-center gap-2 mb-3">
                  <h2 className="text-base font-semibold">{w.name}</h2>
                  <span className="text-xs text-muted-foreground">
                    {w.total_beds - w.available_beds}/{w.total_beds} 占用
                  </span>
                </div>
                <WardContent
                  wardId={w.id}
                  occupancyByBed={occupancyByBed}
                  onNavigate={(visitId) => navigate(`/medical-records/${visitId}`)}
                />
              </div>
            ))}
          </div>

          <DragOverlay dropAnimation={null}>
            {activeOcc ? <DragOverlayCard occ={activeOcc} /> : null}
          </DragOverlay>
        </DndContext>
      )}

      {/* 跨類型轉床 Modal */}
      {crossTypeModal && (
        <CrossTypeTransferModal
          open={true}
          onClose={() => setCrossTypeModal(null)}
          isPending={transferMutation.isPending}
          fromWardName={crossTypeModal.fromWardName}
          toWardName={crossTypeModal.toWardName}
          onConfirm={(assessment, plan) => {
            transferMutation.mutate({
              admissionId: crossTypeModal.admissionId,
              body: {
                to_bed_id: crossTypeModal.toBedId,
                assessment: assessment || null,
                plan: plan || null,
              },
            });
          }}
        />
      )}
    </div>
  );
}
