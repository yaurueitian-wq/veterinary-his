import { useNavigate } from "react-router-dom";
import { AlertTriangle, Clock, ExternalLink } from "lucide-react";

import { type VisitListItem, STATUS_LABELS, STATUS_COLORS } from "@/api/visits";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from "@/components/ui/dialog";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

// ── 工具函式 ──────────────────────────────────────────────────

/** MVP 暫代病歷號（ADR-013） */
function formatRecordNo(id: number): string {
  return `V-${String(id).padStart(6, "0")}`;
}

function formatDateTime(iso: string): string {
  return new Date(iso).toLocaleString("zh-TW", {
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    hour12: false,
  });
}

function waitingTime(iso: string): string {
  const diff = Math.floor((Date.now() - new Date(iso).getTime()) / 60000);
  if (diff < 1) return "剛剛";
  if (diff < 60) return `${diff} 分鐘前`;
  const h = Math.floor(diff / 60);
  const m = diff % 60;
  return m > 0 ? `${h} 時 ${m} 分前` : `${h} 時前`;
}

// ── 資訊列元件 ────────────────────────────────────────────────

function InfoRow({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="flex gap-3 text-sm">
      <span className="w-20 flex-shrink-0 text-muted-foreground">{label}</span>
      <span className="flex-1">{children}</span>
    </div>
  );
}

// ── VisitDetailModal ───────────────────────────────────────────

interface VisitDetailModalProps {
  visit: VisitListItem | null;
  onClose: () => void;
}

export function VisitDetailModal({ visit, onClose }: VisitDetailModalProps) {
  const navigate = useNavigate();

  return (
    <Dialog open={visit !== null} onOpenChange={(open) => !open && onClose()}>
      {visit && (
        <DialogContent className="max-w-md">
          <DialogHeader>
            {/* 動物名稱 + 物種 + 急診標記 */}
            <div className="flex items-center gap-2 pr-6">
              <DialogTitle className="text-base">
                {visit.animal_name ?? "—"}
                {visit.species_name && (
                  <span className="ml-1.5 text-sm font-normal text-muted-foreground">
                    ({visit.species_name})
                  </span>
                )}
              </DialogTitle>
              {visit.priority === "urgent" && (
                <span className="flex items-center gap-1 text-xs text-red-600 font-medium">
                  <AlertTriangle className="h-3.5 w-3.5" />
                  急診
                </span>
              )}
            </div>

            {/* 狀態 + 時間資訊 */}
            <DialogDescription asChild>
              <div className="space-y-1 mt-1">
                <div className="flex items-center gap-2">
                  <Badge
                    variant="secondary"
                    className={cn("text-xs", STATUS_COLORS[visit.status])}
                  >
                    {STATUS_LABELS[visit.status]}
                  </Badge>
                  {visit.status_changed_at && (
                    <span className="flex items-center gap-1 text-xs text-muted-foreground">
                      <Clock className="h-3 w-3" />
                      在此階段 {waitingTime(visit.status_changed_at)}
                    </span>
                  )}
                </div>
                <p className="text-xs text-muted-foreground">
                  掛號：{formatDateTime(visit.registered_at)}（{waitingTime(visit.registered_at)}）
                </p>
              </div>
            </DialogDescription>
          </DialogHeader>

          {/* 詳細資訊 */}
          <div className="space-y-2.5 pt-1">
            <InfoRow label="病歷號">
              <span className="font-mono text-xs">{formatRecordNo(visit.id)}</span>
            </InfoRow>
            <InfoRow label="飼主">
              {visit.owner_name ?? "—"}
            </InfoRow>
            <InfoRow label="主治獸醫">
              {visit.attending_vet_name ?? (
                <span className="text-muted-foreground">尚未指派</span>
              )}
            </InfoRow>
            <InfoRow label="主訴">
              <span className="leading-relaxed">{visit.chief_complaint}</span>
            </InfoRow>
          </div>

          {/* 分隔線 + 病歷連結 */}
          <div className="border-t pt-3">
            <Button
              className="w-full gap-2"
              onClick={() => {
                onClose();
                navigate(`/medical-records/${visit.id}`);
              }}
            >
              <ExternalLink className="h-4 w-4" />
              開啟完整病歷
            </Button>
          </div>
        </DialogContent>
      )}
    </Dialog>
  );
}
