import { useState, useEffect } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";

import {
  hospitalizationApi,
  type AdmissionCreate,
} from "@/api/hospitalization";
import { useAuth } from "@/contexts/AuthContext";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog";

interface Props {
  visitId: number;
  open: boolean;
  onClose: () => void;
}

export function AdmissionModal({ visitId, open, onClose }: Props) {
  const { user } = useAuth();
  const qc = useQueryClient();
  const [selectedWardId, setSelectedWardId] = useState<number | null>(null);
  const [selectedBedId, setSelectedBedId] = useState<number | null>(null);
  const [reasonId, setReasonId] = useState<number | null>(null);
  const [reasonNotes, setReasonNotes] = useState("");
  const [equipmentIds, setEquipmentIds] = useState<number[]>([]);

  // 載入 catalogs
  const { data: catalogs } = useQuery({
    queryKey: ["hospitalization-catalogs"],
    queryFn: hospitalizationApi.getCatalogs,
    enabled: open,
  });

  // 載入病房列表
  const { data: wards = [] } = useQuery({
    queryKey: ["wards"],
    queryFn: hospitalizationApi.listWards,
    enabled: open,
  });

  // 載入選中病房的詳情（含病床 + 預設設備）
  const { data: wardDetail } = useQuery({
    queryKey: ["ward-detail", selectedWardId],
    queryFn: () => hospitalizationApi.getWard(selectedWardId!),
    enabled: !!selectedWardId,
  });

  // 選擇病房時：帶出預設設備、清空床位選擇
  useEffect(() => {
    setSelectedBedId(null);
    if (wardDetail?.default_equipment) {
      setEquipmentIds(wardDetail.default_equipment.map((e) => e.id));
    } else {
      setEquipmentIds([]);
    }
  }, [wardDetail]);

  // 重置表單
  useEffect(() => {
    if (open) {
      setSelectedWardId(null);
      setSelectedBedId(null);
      setReasonId(null);
      setReasonNotes("");
      setEquipmentIds([]);
    }
  }, [open]);

  const availableBeds = wardDetail?.beds.filter(
    (b) => b.status === "available" && b.is_active
  ) ?? [];

  const mutation = useMutation({
    mutationFn: (body: AdmissionCreate) =>
      hospitalizationApi.createAdmission(visitId, body),
    onSuccess: () => {
      toast.success("已成功轉為住院");
      qc.invalidateQueries({ queryKey: ["visit", visitId] });
      qc.invalidateQueries({ queryKey: ["visits-kanban"] });
      qc.invalidateQueries({ queryKey: ["admission-by-visit", visitId] });
      onClose();
    },
    onError: (err: unknown) => {
      const detail = (err as { response?: { data?: { detail?: string } } })?.response?.data?.detail;
      toast.error(detail ?? "住院登記失敗");
    },
  });

  function handleSubmit() {
    const missing: string[] = [];
    if (!selectedWardId) missing.push("病房");
    if (!selectedBedId) missing.push("床位");
    if (!reasonId) missing.push("入院原因");
    if (missing.length > 0) {
      toast.error(`請填寫：${missing.join("、")}`);
      return;
    }
    mutation.mutate({
      bed_id: selectedBedId!,
      admission_reason_id: reasonId!,
      reason_notes: reasonNotes || null,
      attending_vet_id: user!.id,
      equipment_item_ids: equipmentIds,
    });
  }

  function toggleEquipment(eqId: number) {
    setEquipmentIds((prev) =>
      prev.includes(eqId) ? prev.filter((id) => id !== eqId) : [...prev, eqId]
    );
  }

  return (
    <Dialog open={open} onOpenChange={(v) => !v && onClose()}>
      <DialogContent className="max-w-lg max-h-[85vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>轉為住院</DialogTitle>
        </DialogHeader>

        <div className="space-y-4">
          {/* 病房選擇 */}
          <div className="space-y-1.5">
            <Label>病房 *</Label>
            <select
              className="w-full rounded-md border px-3 py-2 text-sm"
              value={selectedWardId ?? ""}
              onChange={(e) => setSelectedWardId(e.target.value ? Number(e.target.value) : null)}
            >
              <option value="">請選擇病房</option>
              {wards.map((w) => (
                <option key={w.id} value={w.id}>
                  {w.name}（{w.ward_type_name}）— 空床 {w.available_beds}/{w.total_beds}
                </option>
              ))}
            </select>
          </div>

          {/* 床位選擇 */}
          {selectedWardId && (
            <div className="space-y-1.5">
              <Label>床位 *</Label>
              {availableBeds.length === 0 ? (
                <p className="text-sm text-destructive">此病房無可用床位</p>
              ) : (
                <div className="grid grid-cols-4 gap-2">
                  {availableBeds.map((b) => (
                    <button
                      key={b.id}
                      type="button"
                      onClick={() => setSelectedBedId(b.id)}
                      className={`rounded-md border px-3 py-2 text-sm text-center transition-colors ${
                        selectedBedId === b.id
                          ? "border-primary bg-primary/10 font-medium"
                          : "hover:bg-muted"
                      }`}
                    >
                      <div>{b.bed_number}</div>
                      <div className="text-xs text-muted-foreground">{b.bed_type_name}</div>
                    </button>
                  ))}
                </div>
              )}
            </div>
          )}

          {/* 入院原因 */}
          <div className="space-y-1.5">
            <Label>入院原因 *</Label>
            <select
              className="w-full rounded-md border px-3 py-2 text-sm"
              value={reasonId ?? ""}
              onChange={(e) => setReasonId(e.target.value ? Number(e.target.value) : null)}
            >
              <option value="">請選擇</option>
              {catalogs?.admission_reasons.map((r) => (
                <option key={r.id} value={r.id}>{r.name}</option>
              ))}
            </select>
          </div>

          {/* 補充說明 */}
          <div className="space-y-1.5">
            <Label>補充說明</Label>
            <Input
              value={reasonNotes}
              onChange={(e) => setReasonNotes(e.target.value)}
              placeholder="選填"
            />
          </div>

          {/* 設備勾選 */}
          <div className="space-y-1.5">
            <Label>使用設備</Label>
            <div className="flex flex-wrap gap-2">
              {catalogs?.equipment_items.map((eq) => (
                <label
                  key={eq.id}
                  className={`inline-flex items-center gap-1.5 rounded-md border px-3 py-1.5 text-sm cursor-pointer transition-colors ${
                    equipmentIds.includes(eq.id)
                      ? "border-primary bg-primary/10"
                      : "hover:bg-muted"
                  }`}
                >
                  <input
                    type="checkbox"
                    checked={equipmentIds.includes(eq.id)}
                    onChange={() => toggleEquipment(eq.id)}
                    className="sr-only"
                  />
                  <span className={`h-3.5 w-3.5 rounded border flex items-center justify-center ${
                    equipmentIds.includes(eq.id) ? "bg-primary border-primary" : "border-muted-foreground/30"
                  }`}>
                    {equipmentIds.includes(eq.id) && (
                      <svg className="h-2.5 w-2.5 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={3}>
                        <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
                      </svg>
                    )}
                  </span>
                  {eq.name}
                </label>
              ))}
            </div>
          </div>
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={onClose}>取消</Button>
          <Button onClick={handleSubmit} disabled={mutation.isPending}>
            {mutation.isPending ? "處理中…" : "確認住院"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
