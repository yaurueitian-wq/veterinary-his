import { AlertTriangle, Clock } from "lucide-react";
import type { VisitListItem } from "@/api/visits";
import { cn } from "@/lib/utils";

function waitingTime(iso: string): string {
  const diff = Math.floor((Date.now() - new Date(iso).getTime()) / 60000);
  if (diff < 1) return "剛剛";
  if (diff < 60) return `${diff} 分`;
  const h = Math.floor(diff / 60);
  const m = diff % 60;
  return m > 0 ? `${h} 時 ${m} 分` : `${h} 時`;
}

export function VisitCardContent({ visit }: { visit: VisitListItem }) {
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

      {/* 階段停留時間 + 待結果徽章 */}
      <div className="flex items-center justify-between pt-0.5">
        <div className="flex items-center gap-1 text-xs text-muted-foreground">
          <Clock className="h-3 w-3" />
          <span>{waitingTime(visit.status_changed_at ?? visit.registered_at)}</span>
        </div>
        {visit.has_pending_lab && (
          <div className="flex items-center gap-1 text-xs text-amber-600">
            <span className="h-1.5 w-1.5 rounded-full bg-amber-500 inline-block" />
            <span>待結果</span>
          </div>
        )}
      </div>
    </div>
  );
}
