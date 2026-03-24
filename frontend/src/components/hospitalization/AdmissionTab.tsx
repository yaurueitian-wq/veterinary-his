import { useState, useEffect } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { Plus } from "lucide-react";

import {
  hospitalizationApi,
  type AdmissionRead,
} from "@/api/hospitalization";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { VitalSignsSection } from "@/components/clinical/VitalSignsSection";

// ── 工具函式 ──────────────────────────────────────────────────

function fmt(iso: string | null | undefined): string {
  if (!iso) return "—";
  return new Date(iso).toLocaleString("zh-TW", {
    month: "2-digit", day: "2-digit", hour: "2-digit", minute: "2-digit", hour12: false,
  });
}

function fmtDate(iso: string | null | undefined): string {
  if (!iso) return "—";
  return new Date(iso).toLocaleDateString("zh-TW");
}

// ── 入院資訊 ──────────────────────────────────────────────────

function AdmissionInfo({ admission }: { admission: AdmissionRead }) {
  return (
    <div className="rounded-lg border p-4 space-y-3">
      <h3 className="text-sm font-semibold uppercase tracking-wider text-muted-foreground border-b-2 border-foreground/10 pb-2">入院資訊</h3>
      <div className="grid grid-cols-2 gap-3 text-sm">
        <div>
          <span className="text-muted-foreground">病房 / 床位：</span>
          <span className="ml-1">{admission.ward_name} — {admission.bed_number}</span>
        </div>
        <div>
          <span className="text-muted-foreground">入院原因：</span>
          <span className="ml-1">{admission.admission_reason_name}</span>
        </div>
        <div>
          <span className="text-muted-foreground">負責獸醫：</span>
          <span className="ml-1">{admission.attending_vet_name}</span>
        </div>
        <div>
          <span className="text-muted-foreground">入院時間：</span>
          <span className="ml-1">{fmt(admission.admitted_at)}</span>
        </div>
        {admission.reason_notes && (
          <div className="col-span-2">
            <span className="text-muted-foreground">補充說明：</span>
            <span className="ml-1">{admission.reason_notes}</span>
          </div>
        )}
        {admission.equipment.length > 0 && (
          <div className="col-span-2">
            <span className="text-muted-foreground">使用設備：</span>
            <span className="ml-1">{admission.equipment.map((e) => e.name).join("、")}</span>
          </div>
        )}
      </div>
    </div>
  );
}

// ── 巡房紀錄 ──────────────────────────────────────────────────

function DailyRoundsSection({ admissionId, isActive }: { admissionId: number; isActive: boolean }) {
  const qc = useQueryClient();
  const [showForm, setShowForm] = useState(false);
  const [assessment, setAssessment] = useState("");
  const [plan, setPlan] = useState("");

  const { data: rounds = [] } = useQuery({
    queryKey: ["daily-rounds", admissionId],
    queryFn: () => hospitalizationApi.listDailyRounds(admissionId),
  });

  const mutation = useMutation({
    mutationFn: () =>
      hospitalizationApi.createDailyRound(admissionId, {
        round_date: new Date().toISOString().slice(0, 10),
        assessment: assessment || null,
        plan: plan || null,
      }),
    onSuccess: () => {
      toast.success("巡房紀錄已新增");
      qc.invalidateQueries({ queryKey: ["daily-rounds", admissionId] });
      setShowForm(false);
      setAssessment("");
      setPlan("");
    },
    onError: () => toast.error("新增失敗"),
  });

  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between border-b-2 border-foreground/10 pb-2">
        <h3 className="text-sm font-semibold uppercase tracking-wider text-muted-foreground">巡房紀錄</h3>
        {isActive && (
          <button
            type="button"
            onClick={() => setShowForm(!showForm)}
            className="flex items-center gap-1 text-xs text-muted-foreground hover:text-foreground transition-colors"
          >
            <Plus className="h-3.5 w-3.5" />
            新增
          </button>
        )}
      </div>

      {showForm && (
        <div className="rounded-lg border p-4 space-y-3">
          <div className="space-y-1.5">
            <Label>評估</Label>
            <textarea
              className="w-full rounded-md border px-3 py-2 text-sm min-h-[60px]"
              value={assessment}
              onChange={(e) => setAssessment(e.target.value)}
              placeholder="精神狀態、治療反應…"
            />
          </div>
          <div className="space-y-1.5">
            <Label>治療計畫</Label>
            <textarea
              className="w-full rounded-md border px-3 py-2 text-sm min-h-[60px]"
              value={plan}
              onChange={(e) => setPlan(e.target.value)}
              placeholder="今日調整…"
            />
          </div>
          <div className="flex gap-2">
            <Button size="sm" onClick={() => mutation.mutate()} disabled={mutation.isPending}>
              {mutation.isPending ? "儲存中…" : "儲存"}
            </Button>
            <Button variant="ghost" size="sm" onClick={() => setShowForm(false)}>取消</Button>
          </div>
        </div>
      )}

      {rounds.length === 0 && !showForm && (
        <p className="text-sm text-muted-foreground">尚無巡房紀錄</p>
      )}
      {rounds.map((r) => (
        <div key={r.id} className="rounded-md border p-3 space-y-1 text-sm">
          <div className="flex items-center justify-between">
            <span className="font-medium">{fmtDate(r.round_date)}</span>
            <span className="text-xs text-muted-foreground">{r.created_by_name} · {fmt(r.created_at)}</span>
          </div>
          {r.assessment && <p><span className="text-muted-foreground">評估：</span>{r.assessment}</p>}
          {r.plan && <p><span className="text-muted-foreground">計畫：</span>{r.plan}</p>}
        </div>
      ))}
    </div>
  );
}

// ── 住院醫囑 ──────────────────────────────────────────────────

function OrdersSection({ admissionId, isActive }: { admissionId: number; isActive: boolean }) {
  const qc = useQueryClient();
  const [showForm, setShowForm] = useState(false);
  const [orderTypeId, setOrderTypeId] = useState<number | null>(null);
  const [description, setDescription] = useState("");
  const [frequencyId, setFrequencyId] = useState<number | null>(null);

  const { data: catalogs } = useQuery({
    queryKey: ["hospitalization-catalogs"],
    queryFn: hospitalizationApi.getCatalogs,
  });

  const { data: orders = [] } = useQuery({
    queryKey: ["inpatient-orders", admissionId],
    queryFn: () => hospitalizationApi.listOrders(admissionId),
  });

  const createMutation = useMutation({
    mutationFn: () =>
      hospitalizationApi.createOrder(admissionId, {
        order_type_id: orderTypeId!,
        description,
        frequency_id: frequencyId,
      }),
    onSuccess: () => {
      toast.success("醫囑已新增");
      qc.invalidateQueries({ queryKey: ["inpatient-orders", admissionId] });
      setShowForm(false);
      setOrderTypeId(null);
      setDescription("");
      setFrequencyId(null);
    },
    onError: () => toast.error("新增失敗"),
  });

  const executeMutation = useMutation({
    mutationFn: (orderId: number) => hospitalizationApi.executeOrder(orderId),
    onSuccess: () => {
      toast.success("已執行");
      qc.invalidateQueries({ queryKey: ["inpatient-orders", admissionId] });
    },
    onError: () => toast.error("執行失敗"),
  });

  const cancelMutation = useMutation({
    mutationFn: (orderId: number) => hospitalizationApi.cancelOrder(orderId),
    onSuccess: () => {
      toast.success("醫囑已取消");
      qc.invalidateQueries({ queryKey: ["inpatient-orders", admissionId] });
    },
    onError: () => toast.error("取消失敗"),
  });

  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between border-b-2 border-foreground/10 pb-2">
        <h3 className="text-sm font-semibold uppercase tracking-wider text-muted-foreground">住院醫囑</h3>
        {isActive && (
          <button
            type="button"
            onClick={() => setShowForm(!showForm)}
            className="flex items-center gap-1 text-xs text-muted-foreground hover:text-foreground transition-colors"
          >
            <Plus className="h-3.5 w-3.5" />
            新增
          </button>
        )}
      </div>

      {showForm && (
        <div className="rounded-lg border p-4 space-y-3">
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1.5">
              <Label>醫囑類型 *</Label>
              <select
                className="w-full rounded-md border px-3 py-2 text-sm"
                value={orderTypeId ?? ""}
                onChange={(e) => setOrderTypeId(e.target.value ? Number(e.target.value) : null)}
              >
                <option value="">請選擇</option>
                {catalogs?.order_types.map((t) => (
                  <option key={t.id} value={t.id}>{t.name}</option>
                ))}
              </select>
            </div>
            <div className="space-y-1.5">
              <Label>頻率</Label>
              <select
                className="w-full rounded-md border px-3 py-2 text-sm"
                value={frequencyId ?? ""}
                onChange={(e) => setFrequencyId(e.target.value ? Number(e.target.value) : null)}
              >
                <option value="">一次性</option>
                {catalogs?.frequencies.map((f) => (
                  <option key={f.id} value={f.id}>{f.code} — {f.name}</option>
                ))}
              </select>
            </div>
          </div>
          <div className="space-y-1.5">
            <Label>醫囑內容 *</Label>
            <Input
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              placeholder="藥名 + 劑量 / 處置說明…"
            />
          </div>
          <div className="flex gap-2">
            <Button
              size="sm"
              onClick={() => createMutation.mutate()}
              disabled={!orderTypeId || !description || createMutation.isPending}
            >
              {createMutation.isPending ? "儲存中…" : "儲存"}
            </Button>
            <Button variant="ghost" size="sm" onClick={() => setShowForm(false)}>取消</Button>
          </div>
        </div>
      )}

      {orders.length === 0 && !showForm && (
        <p className="text-sm text-muted-foreground">尚無醫囑</p>
      )}
      {orders.map((o) => (
        <div key={o.id} className="rounded-md border p-3 space-y-2 text-sm">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <Badge variant="outline">{o.order_type_name}</Badge>
              {o.frequency_code && (
                <Badge variant="secondary">{o.frequency_code}</Badge>
              )}
              <Badge variant={o.status === "active" ? "default" : "secondary"}>
                {o.status === "active" ? "執行中" : o.status === "completed" ? "已完成" : "已取消"}
              </Badge>
            </div>
            <span className="text-xs text-muted-foreground">{o.created_by_name} · {fmt(o.created_at)}</span>
          </div>
          <p>{o.description}</p>

          {/* 執行紀錄 */}
          {o.executions.length > 0 && (
            <div className="pl-3 border-l-2 space-y-1">
              {o.executions.map((e) => (
                <div key={e.id} className="text-xs text-muted-foreground">
                  {fmt(e.executed_at)} — {e.created_by_name}{e.notes ? `（${e.notes}）` : ""}
                </div>
              ))}
            </div>
          )}

          {/* 操作按鈕 */}
          {o.status === "active" && isActive && (
            <div className="flex gap-2 pt-1">
              <Button
                variant="outline" size="sm"
                onClick={() => executeMutation.mutate(o.id)}
                disabled={executeMutation.isPending}
              >
                執行打勾
              </Button>
              <Button
                variant="ghost" size="sm"
                className="text-destructive"
                onClick={() => cancelMutation.mutate(o.id)}
                disabled={cancelMutation.isPending}
              >
                取消醫囑
              </Button>
            </div>
          )}
        </div>
      ))}
    </div>
  );
}

// ── 出院 ──────────────────────────────────────────────────────

function DischargeSection({
  admissionId,
  visitId,
  autoOpen,
  onClose,
}: {
  admissionId: number;
  visitId: number;
  autoOpen?: boolean;
  onClose?: () => void;
}) {
  const qc = useQueryClient();
  const [showForm, setShowForm] = useState(autoOpen ?? false);

  // 外部觸發展開
  useEffect(() => {
    if (autoOpen) setShowForm(true);
  }, [autoOpen]);

  function closeForm() {
    setShowForm(false);
    onClose?.();
  }
  const [reasonId, setReasonId] = useState<number | null>(null);
  const [conditionId, setConditionId] = useState<number | null>(null);
  const [notes, setNotes] = useState("");
  const [followUp, setFollowUp] = useState("");
  const [postStatus, setPostStatus] = useState<"completed" | "in_consultation">("completed");

  const { data: catalogs } = useQuery({
    queryKey: ["hospitalization-catalogs"],
    queryFn: hospitalizationApi.getCatalogs,
    enabled: showForm,
  });

  const mutation = useMutation({
    mutationFn: () =>
      hospitalizationApi.discharge(admissionId, {
        discharge_reason_id: reasonId!,
        discharge_condition_id: conditionId!,
        discharge_notes: notes || null,
        follow_up_plan: followUp || null,
        post_discharge_status: postStatus,
      }),
    onSuccess: () => {
      toast.success(postStatus === "completed" ? "已出院並結案" : "已出院，轉回門診");
      qc.invalidateQueries({ queryKey: ["admission-by-visit", visitId] });
      qc.invalidateQueries({ queryKey: ["visit", visitId] });
      qc.invalidateQueries({ queryKey: ["visits-kanban"] });
      qc.invalidateQueries({ queryKey: ["wards"] });
      qc.invalidateQueries({ queryKey: ["all-ward-occupancy"] });
      closeForm();
    },
    onError: (err: unknown) => {
      const detail = (err as { response?: { data?: { detail?: string } } })?.response?.data?.detail;
      toast.error(detail ?? "出院失敗");
    },
  });

  function handleSubmit() {
    const missing: string[] = [];
    if (!reasonId) missing.push("出院原因");
    if (!conditionId) missing.push("出院時狀態");
    if (missing.length > 0) {
      toast.error(`請填寫：${missing.join("、")}`);
      return;
    }
    mutation.mutate();
  }

  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between">
        <h3 className="text-sm font-semibold uppercase tracking-wider text-muted-foreground">出院</h3>
        {!showForm && (
          <button
            type="button"
            onClick={() => setShowForm(true)}
            className="flex items-center gap-1 text-xs text-muted-foreground hover:text-foreground transition-colors"
          >
            辦理出院
          </button>
        )}
      </div>

      {showForm && (
        <div className="rounded-lg border p-4 space-y-3">
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1.5">
              <Label>出院原因 *</Label>
              <select
                className="w-full rounded-md border px-3 py-2 text-sm"
                value={reasonId ?? ""}
                onChange={(e) => setReasonId(e.target.value ? Number(e.target.value) : null)}
              >
                <option value="">請選擇</option>
                {catalogs?.discharge_reasons.map((r) => (
                  <option key={r.id} value={r.id}>{r.name}</option>
                ))}
              </select>
            </div>
            <div className="space-y-1.5">
              <Label>出院時狀態 *</Label>
              <select
                className="w-full rounded-md border px-3 py-2 text-sm"
                value={conditionId ?? ""}
                onChange={(e) => setConditionId(e.target.value ? Number(e.target.value) : null)}
              >
                <option value="">請選擇</option>
                {catalogs?.discharge_conditions.map((c) => (
                  <option key={c.id} value={c.id}>{c.name}</option>
                ))}
              </select>
            </div>
          </div>
          <div className="space-y-1.5">
            <Label>出院後</Label>
            <div className="flex gap-4">
              <label className="flex items-center gap-1.5 text-sm cursor-pointer">
                <input
                  type="radio"
                  name="postStatus"
                  checked={postStatus === "completed"}
                  onChange={() => setPostStatus("completed")}
                />
                結案（回家）
              </label>
              <label className="flex items-center gap-1.5 text-sm cursor-pointer">
                <input
                  type="radio"
                  name="postStatus"
                  checked={postStatus === "in_consultation"}
                  onChange={() => setPostStatus("in_consultation")}
                />
                轉回門診（留觀）
              </label>
            </div>
          </div>
          <div className="space-y-1.5">
            <Label>出院備註</Label>
            <textarea
              className="w-full rounded-md border px-3 py-2 text-sm min-h-[50px]"
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              placeholder="選填"
            />
          </div>
          <div className="space-y-1.5">
            <Label>回診安排</Label>
            <textarea
              className="w-full rounded-md border px-3 py-2 text-sm min-h-[50px]"
              value={followUp}
              onChange={(e) => setFollowUp(e.target.value)}
              placeholder="選填"
            />
          </div>
          <div className="flex gap-2">
            <Button size="sm" onClick={handleSubmit} disabled={mutation.isPending}>
              {mutation.isPending ? "處理中…" : "確認出院"}
            </Button>
            <Button variant="ghost" size="sm" onClick={closeForm}>取消</Button>
          </div>
        </div>
      )}
    </div>
  );
}

// ── 主元件 ────────────────────────────────────────────────────

interface Props {
  visitId: number;
  showDischargeForm?: boolean;
  onDischargeFormClose?: () => void;
}

export function AdmissionTab({ visitId, showDischargeForm, onDischargeFormClose }: Props) {
  const { data: admission, isLoading } = useQuery({
    queryKey: ["admission-by-visit", visitId],
    queryFn: () => hospitalizationApi.getAdmissionByVisit(visitId),
  });

  if (isLoading) {
    return <p className="text-sm text-muted-foreground py-4">載入中…</p>;
  }

  if (!admission) {
    return <p className="text-sm text-muted-foreground py-4">此就診無住院紀錄</p>;
  }

  const isActive = admission.status === "active";

  return (
    <div className="space-y-8">
      <AdmissionInfo admission={admission} />
      <VitalSignsSection visitId={visitId} />
      <DailyRoundsSection admissionId={admission.id} isActive={isActive} />
      <OrdersSection admissionId={admission.id} isActive={isActive} />
      {isActive && (
        <DischargeSection
          admissionId={admission.id}
          visitId={visitId}
          autoOpen={showDischargeForm}
          onClose={onDischargeFormClose}
        />
      )}
    </div>
  );
}
