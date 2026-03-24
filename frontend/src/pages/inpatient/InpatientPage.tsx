import { useNavigate } from "react-router-dom";
import { useQuery } from "@tanstack/react-query";
import { BedDouble, User, ArrowRight } from "lucide-react";

import {
  hospitalizationApi,
  type WardRead,
  type WardDetailRead,
  type BedRead,
} from "@/api/hospitalization";
import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";

// ── 床位狀態配色 ──────────────────────────────────────────────

const BED_STATUS_CONFIG: Record<string, { label: string; dot: string; bg: string }> = {
  available:   { label: "空床",   dot: "bg-emerald-500", bg: "bg-emerald-50 border-emerald-200 hover:bg-emerald-100" },
  occupied:    { label: "占用",   dot: "bg-red-500",     bg: "bg-red-50 border-red-200 hover:bg-red-100" },
  maintenance: { label: "維護中", dot: "bg-amber-500",   bg: "bg-amber-50 border-amber-200" },
  inactive:    { label: "停用",   dot: "bg-gray-400",    bg: "bg-gray-50 border-gray-200 opacity-50" },
};

// ── 床位卡片 ──────────────────────────────────────────────────

function BedCard({
  bed,
  admission,
  onClick,
}: {
  bed: BedRead;
  admission?: { animal_name: string; owner_name: string; visit_id: number; days: number } | null;
  onClick?: () => void;
}) {
  const config = BED_STATUS_CONFIG[bed.status] ?? BED_STATUS_CONFIG.available;
  const isOccupied = bed.status === "occupied" && admission;

  return (
    <button
      type="button"
      onClick={onClick}
      disabled={!isOccupied}
      className={cn(
        "rounded-lg border p-3 text-left transition-colors",
        config.bg,
        isOccupied && "cursor-pointer",
        !isOccupied && "cursor-default",
      )}
    >
      {/* 床號 + 狀態 */}
      <div className="flex items-center justify-between mb-1.5">
        <span className="font-mono text-sm font-medium">{bed.bed_number}</span>
        <span className={cn("h-2 w-2 rounded-full", config.dot)} />
      </div>

      {/* 床位類型 */}
      <p className="text-xs text-muted-foreground mb-1">{bed.bed_type_name}</p>

      {isOccupied ? (
        <div className="space-y-1 mt-2">
          <div className="flex items-center gap-1 text-sm font-medium">
            <BedDouble className="h-3.5 w-3.5 text-muted-foreground" />
            {admission.animal_name}
          </div>
          <div className="flex items-center gap-1 text-xs text-muted-foreground">
            <User className="h-3 w-3" />
            {admission.owner_name}
          </div>
          <div className="flex items-center justify-between mt-1">
            <Badge variant="secondary" className="text-xs">
              Day {admission.days}
            </Badge>
            <ArrowRight className="h-3.5 w-3.5 text-muted-foreground" />
          </div>
        </div>
      ) : (
        <p className="text-xs text-muted-foreground mt-2">{config.label}</p>
      )}
    </button>
  );
}

// ── 病房內容 ──────────────────────────────────────────────────

function WardContent({ wardId }: { wardId: number }) {
  const navigate = useNavigate();

  const { data: ward, isLoading } = useQuery<WardDetailRead>({
    queryKey: ["ward-detail", wardId],
    queryFn: () => hospitalizationApi.getWard(wardId),
  });

  const { data: occupancy = [] } = useQuery({
    queryKey: ["ward-occupancy", wardId],
    queryFn: () => hospitalizationApi.getWardOccupancy(wardId),
    refetchInterval: 30_000,
  });

  if (isLoading) {
    return <p className="text-sm text-muted-foreground py-8 text-center">載入中…</p>;
  }

  if (!ward) return null;

  const activeBeds = ward.beds.filter((b) => b.is_active);
  const occupiedCount = activeBeds.filter((b) => b.status === "occupied").length;
  const availableCount = activeBeds.filter((b) => b.status === "available").length;

  // 建立 bed_id → occupancy 映射
  const occupancyByBed = new Map(
    occupancy.map((o) => [o.bed_id, o])
  );

  return (
    <div className="space-y-4">
      {/* 統計 */}
      <div className="flex items-center gap-4 text-sm">
        <span className="text-muted-foreground">
          總床位 {activeBeds.length}
        </span>
        <span className="flex items-center gap-1">
          <span className="h-2 w-2 rounded-full bg-red-500" />
          占用 {occupiedCount}
        </span>
        <span className="flex items-center gap-1">
          <span className="h-2 w-2 rounded-full bg-emerald-500" />
          空床 {availableCount}
        </span>
      </div>

      {/* 床位格 */}
      <div className="grid grid-cols-5 gap-3">
        {activeBeds.map((bed) => {
          const occ = occupancyByBed.get(bed.id);
          return (
            <BedCard
              key={bed.id}
              bed={bed}
              admission={occ ? {
                animal_name: occ.animal_name,
                owner_name: occ.owner_name,
                visit_id: occ.visit_id,
                days: occ.days,
              } : null}
              onClick={() => {
                if (occ) {
                  navigate(`/medical-records/${occ.visit_id}`);
                }
              }}
            />
          );
        })}
      </div>
    </div>
  );
}

// ── 主頁面 ────────────────────────────────────────────────────

export default function InpatientPage() {
  const { data: wards = [], isLoading } = useQuery<WardRead[]>({
    queryKey: ["wards"],
    queryFn: hospitalizationApi.listWards,
  });

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
        <div className="space-y-6">
          {wards.map((w) => (
            <div key={w.id}>
              <div className="flex items-center gap-2 mb-3">
                <h2 className="text-base font-semibold">{w.name}</h2>
                <span className="text-xs text-muted-foreground">
                  {w.total_beds - w.available_beds}/{w.total_beds} 占用
                </span>
              </div>
              <WardContent wardId={w.id} />
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
