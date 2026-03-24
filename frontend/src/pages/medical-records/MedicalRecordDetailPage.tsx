import { useState, useMemo } from "react";
import { useParams, Link } from "react-router-dom";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { ArrowLeft, Plus, ChevronDown, ChevronUp, FlaskConical, BedDouble } from "lucide-react";
import { toast } from "sonner";

import { visitsApi, NEXT_STATUSES, STATUS_LABELS, STATUS_COLORS, hasNextStatus, type VisitStatus } from "@/api/visits";
import { hospitalizationApi } from "@/api/hospitalization";
import { AdmissionModal } from "@/components/hospitalization/AdmissionModal";
import { AdmissionTab } from "@/components/hospitalization/AdmissionTab";
import {
  clinicalApi,
  type SoapNoteCreate,
  type SoapNoteRead,
  type NursingNoteCreate,
  type NursingNoteRead,
  type LabAnalyteRead,
  type LabCategoryRead,
  type LabOrderCreate,
  type LabOrderRead,
  type LabResultItemCreate,
} from "@/api/clinical";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import { VitalSignsSection } from "@/components/clinical/VitalSignsSection";
import { cn } from "@/lib/utils";

// ── 工具函式 ──────────────────────────────────────────────────

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

function formatRecordNo(id: number): string {
  return `V-${String(id).padStart(6, "0")}`;
}

// ── 舊記錄外框（灰階 append-only 顯示）────────────────────────

function HistoryCard({ children }: { children: React.ReactNode }) {
  return (
    <div className="rounded-md border border-dashed bg-muted/30 px-5 py-4 space-y-1.5">
      {children}
    </div>
  );
}

// ── SoapNote Section ──────────────────────────────────────────

function SoapNotesSection({ visitId }: { visitId: number }) {
  const qc = useQueryClient();
  const [open, setOpen] = useState(false);
  const [form, setForm] = useState<SoapNoteCreate>({ diagnoses: [] });
  const [diagText, setDiagText] = useState("");

  const { data: notes = [] } = useQuery<SoapNoteRead[]>({
    queryKey: ["soap-notes", visitId],
    queryFn: () => clinicalApi.getSoapNotes(visitId),
  });

  const mutation = useMutation({
    mutationFn: (body: SoapNoteCreate) =>
      clinicalApi.createSoapNote(visitId, body),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["soap-notes", visitId] });
      setOpen(false);
      setForm({ diagnoses: [] });
      setDiagText("");
    },
  });

  function addDiag() {
    const t = diagText.trim();
    if (!t) return;
    setForm((f) => ({
      ...f,
      diagnoses: [...(f.diagnoses ?? []), { free_text: t }],
    }));
    setDiagText("");
  }

  function textarea(
    label: string,
    key: keyof Pick<SoapNoteCreate, "subjective" | "objective" | "assessment" | "plan">,
    placeholder?: string
  ) {
    return (
      <div>
        <label className="text-sm text-muted-foreground block mb-1.5">{label}</label>
        <textarea
          rows={3}
          value={form[key] ?? ""}
          onChange={(e) =>
            setForm((f) => ({ ...f, [key]: e.target.value || undefined }))
          }
          placeholder={placeholder}
          className="flex w-full rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 resize-none"
        />
      </div>
    );
  }

  return (
    <section className="space-y-3">
      <div className="flex items-center justify-between border-b-2 border-foreground/10 pb-2">
        <h2 className="text-sm font-semibold uppercase tracking-wider text-muted-foreground">SOAP 病歷</h2>
        {!open && (
          <button
            type="button"
            onClick={() => setOpen(true)}
            className="flex items-center gap-1 text-xs text-muted-foreground hover:text-foreground transition-colors"
          >
            <Plus className="h-3.5 w-3.5" />
            新增
          </button>
        )}
      </div>

      {notes.map((n) => (
        <HistoryCard key={n.id}>
          <p className="text-sm text-foreground/60">{formatDatetime(n.created_at)}</p>
          {n.subjective && (
            <div className="mt-1">
              <span className="text-sm font-semibold text-foreground/70">S</span>
              <p className="text-sm whitespace-pre-wrap mt-0.5">{n.subjective}</p>
            </div>
          )}
          {n.objective && (
            <div>
              <span className="text-sm font-semibold text-foreground/70">O</span>
              <p className="text-sm whitespace-pre-wrap mt-0.5">{n.objective}</p>
            </div>
          )}
          {n.assessment && (
            <div>
              <span className="text-sm font-semibold text-foreground/70">A</span>
              <p className="text-sm whitespace-pre-wrap mt-0.5">{n.assessment}</p>
            </div>
          )}
          {n.plan && (
            <div>
              <span className="text-sm font-semibold text-foreground/70">P</span>
              <p className="text-sm whitespace-pre-wrap mt-0.5">{n.plan}</p>
            </div>
          )}
          {n.diagnoses.length > 0 && (
            <div className="mt-2 flex flex-wrap gap-1.5">
              {n.diagnoses.map((d) => (
                <span
                  key={d.id}
                  className="rounded-full px-2.5 py-0.5 text-sm border border-input bg-muted/30"
                >
                  {d.free_text}
                </span>
              ))}
            </div>
          )}
        </HistoryCard>
      ))}

      {open ? (
        <div className="rounded-md border bg-background p-5 space-y-4">
          {textarea("S — 主觀（主訴 / 病史）", "subjective", "飼主主述、症狀描述、發病時間與經過…")}
          {textarea("O — 客觀（理學檢查）", "objective", "體格檢查、生命徵象、觸診 / 聽診結果…")}
          {textarea("A — 評估", "assessment", "臨床評估、鑑別診斷、問題清單…")}
          {textarea("P — 計畫", "plan", "治療計畫、用藥、追蹤安排…")}

          <div>
            <label className="text-sm text-muted-foreground block mb-1.5">診斷</label>
            <div className="flex gap-2">
              <input
                type="text"
                value={diagText}
                onChange={(e) => setDiagText(e.target.value)}
                onKeyDown={(e) => e.key === "Enter" && (e.preventDefault(), addDiag())}
                placeholder="輸入診斷文字，按 Enter 新增…"
                className="flex-1 h-9 rounded-md border border-input bg-background px-3 text-sm focus:outline-none focus:ring-1 focus:ring-ring"
              />
              <Button type="button" variant="outline" size="sm" onClick={addDiag}>
                新增
              </Button>
            </div>
            {(form.diagnoses ?? []).length > 0 && (
              <div className="mt-2 flex flex-wrap gap-1.5">
                {form.diagnoses!.map((d, i) => (
                  <span
                    key={i}
                    className="rounded-full px-2.5 py-0.5 text-sm border border-input bg-muted/30 flex items-center gap-1"
                  >
                    {d.free_text}
                    <button
                      type="button"
                      onClick={() =>
                        setForm((f) => ({
                          ...f,
                          diagnoses: f.diagnoses!.filter((_, j) => j !== i),
                        }))
                      }
                      className="ml-0.5 hover:text-destructive"
                    >
                      ×
                    </button>
                  </span>
                ))}
              </div>
            )}
          </div>

          <div className="flex justify-end gap-2">
            <Button variant="outline" size="sm" onClick={() => setOpen(false)}>
              取消
            </Button>
            <Button
              size="sm"
              disabled={mutation.isPending}
              onClick={() => mutation.mutate(form)}
            >
              {mutation.isPending ? "儲存中…" : "儲存"}
            </Button>
          </div>
        </div>
      ) : null}
    </section>
  );
}

// ── NursingNote Section ───────────────────────────────────────

function NursingNotesSection({ visitId }: { visitId: number }) {
  const qc = useQueryClient();
  const [open, setOpen] = useState(false);
  const [text, setText] = useState("");

  const { data: notes = [] } = useQuery<NursingNoteRead[]>({
    queryKey: ["nursing-notes", visitId],
    queryFn: () => clinicalApi.getNursingNotes(visitId),
  });

  const mutation = useMutation({
    mutationFn: (body: NursingNoteCreate) =>
      clinicalApi.createNursingNote(visitId, body),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["nursing-notes", visitId] });
      setOpen(false);
      setText("");
    },
  });

  return (
    <section className="space-y-3">
      <div className="flex items-center justify-between border-b-2 border-foreground/10 pb-2">
        <h2 className="text-sm font-semibold uppercase tracking-wider text-muted-foreground">護理紀錄</h2>
        {!open && (
          <button
            type="button"
            onClick={() => setOpen(true)}
            className="flex items-center gap-1 text-xs text-muted-foreground hover:text-foreground transition-colors"
          >
            <Plus className="h-3.5 w-3.5" />
            新增
          </button>
        )}
      </div>

      {notes.map((n) => (
        <HistoryCard key={n.id}>
          <p className="text-sm text-foreground/60">{formatDatetime(n.created_at)}</p>
          <p className="text-sm whitespace-pre-wrap mt-1">{n.note_text}</p>
        </HistoryCard>
      ))}

      {open ? (
        <div className="rounded-md border bg-background p-5 space-y-4">
          <textarea
            rows={4}
            value={text}
            onChange={(e) => setText(e.target.value)}
            placeholder="輸入護理觀察、處置說明…"
            className="flex w-full rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 resize-none"
          />
          <div className="flex justify-end gap-2">
            <Button variant="outline" size="sm" onClick={() => setOpen(false)}>
              取消
            </Button>
            <Button
              size="sm"
              disabled={!text.trim() || mutation.isPending}
              onClick={() => mutation.mutate({ note_text: text.trim() })}
            >
              {mutation.isPending ? "儲存中…" : "儲存"}
            </Button>
          </div>
        </div>
      ) : null}
    </section>
  );
}

// ── LabOrderCard ──────────────────────────────────────────────

function LabOrderCard({
  order,
  analytes,
  onResultsSubmit,
  onCancel,
  isSubmitting,
  isCancelling,
}: {
  order: LabOrderRead;
  analytes: LabAnalyteRead[];
  onResultsSubmit: (items: LabResultItemCreate[]) => void;
  onCancel: () => void;
  isSubmitting: boolean;
  isCancelling: boolean;
}) {
  const [values, setValues] = useState<
    Record<number, { value_numeric?: number | null; value_text?: string | null }>
  >({});

  if (order.status === "cancelled") {
    return (
      <div className="rounded-md border bg-muted/20 px-4 py-3 opacity-60">
        <div className="flex items-center justify-between">
          <p className="font-medium text-sm">{order.test_type_name}</p>
          <Badge variant="secondary">已取消</Badge>
        </div>
        <p className="text-xs text-muted-foreground mt-1">{formatDatetime(order.created_at)}</p>
      </div>
    );
  }

  if (order.status === "resulted") {
    const activeItems = order.result_items.filter((i) => !i.is_superseded);
    return (
      <div className="rounded-md border bg-background px-4 py-4 space-y-3">
        <div className="flex items-center justify-between">
          <p className="font-medium">{order.test_type_name}</p>
          <Badge className="bg-green-100 text-green-800 border-green-200">已回報</Badge>
        </div>
        <p className="text-xs text-muted-foreground">
          回報：{formatDatetime(order.resulted_at)}
          {order.resulted_by_name && ` · ${order.resulted_by_name}`}
        </p>
        {activeItems.length > 0 && (
          <table className="w-full text-sm">
            <thead>
              <tr className="text-xs text-muted-foreground border-b">
                <th className="text-left py-1.5 font-medium">指標</th>
                <th className="text-right py-1.5 font-medium">數值</th>
                <th className="text-right py-1.5 font-medium pr-1">單位</th>
                <th className="text-right py-1.5 font-medium">異常</th>
              </tr>
            </thead>
            <tbody>
              {activeItems.map((item) => (
                <tr
                  key={item.id}
                  className={cn(
                    "border-b last:border-0",
                    item.is_abnormal && "text-red-600 font-medium"
                  )}
                >
                  <td className="py-1.5">{item.analyte_name}</td>
                  <td className="text-right py-1.5">
                    {item.analyte_type === "numeric"
                      ? (item.value_numeric ?? "—")
                      : (item.value_text ?? "—")}
                  </td>
                  <td className="text-right py-1.5 text-muted-foreground pr-1">
                    {item.unit ?? ""}
                  </td>
                  <td className="text-right py-1.5">
                    {item.is_abnormal ? "↑↓" : "—"}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
        {activeItems.length === 0 && (
          <p className="text-sm text-muted-foreground italic">（無量化指標）</p>
        )}
      </div>
    );
  }

  // pending
  return (
    <div className="rounded-md border bg-background px-4 py-4 space-y-3">
      <div className="flex items-center justify-between">
        <p className="font-medium">{order.test_type_name}</p>
        <div className="flex items-center gap-2">
          <Badge className="bg-amber-100 text-amber-800 border-amber-200">待結果</Badge>
          <Button
            variant="ghost"
            size="sm"
            className="text-muted-foreground text-xs h-7 px-2"
            disabled={isCancelling}
            onClick={onCancel}
          >
            取消醫囑
          </Button>
        </div>
      </div>
      <p className="text-xs text-muted-foreground">
        開單：{formatDatetime(order.created_at)}
        {order.created_by_name && ` · ${order.created_by_name}`}
      </p>
      {order.notes && (
        <p className="text-xs text-muted-foreground">備註：{order.notes}</p>
      )}

      {analytes.length > 0 ? (
        <>
          <div className="grid grid-cols-2 sm:grid-cols-3 gap-3 pt-1">
            {analytes.map((analyte) => (
              <div key={analyte.id}>
                <label className="text-xs text-muted-foreground block mb-1">
                  {analyte.name}
                  {analyte.unit && (
                    <span className="ml-1 text-muted-foreground/60">({analyte.unit})</span>
                  )}
                </label>
                {analyte.analyte_type === "numeric" ? (
                  <input
                    type="number"
                    step="0.01"
                    value={values[analyte.id]?.value_numeric ?? ""}
                    onChange={(e) =>
                      setValues((v) => ({
                        ...v,
                        [analyte.id]: {
                          ...v[analyte.id],
                          value_numeric:
                            e.target.value === "" ? null : Number(e.target.value),
                        },
                      }))
                    }
                    className="w-full h-8 rounded-md border border-input bg-background px-2 text-sm focus:outline-none focus:ring-1 focus:ring-ring"
                  />
                ) : (
                  <input
                    type="text"
                    value={values[analyte.id]?.value_text ?? ""}
                    onChange={(e) =>
                      setValues((v) => ({
                        ...v,
                        [analyte.id]: {
                          ...v[analyte.id],
                          value_text: e.target.value,
                        },
                      }))
                    }
                    className="w-full h-8 rounded-md border border-input bg-background px-2 text-sm focus:outline-none focus:ring-1 focus:ring-ring"
                  />
                )}
              </div>
            ))}
          </div>
          <div className="flex justify-end pt-1">
            <Button
              size="sm"
              disabled={isSubmitting}
              onClick={() => {
                const items: LabResultItemCreate[] = analytes.map((a) => ({
                  analyte_id: a.id,
                  value_numeric:
                    a.analyte_type === "numeric"
                      ? (values[a.id]?.value_numeric ?? null)
                      : null,
                  value_text:
                    a.analyte_type === "text"
                      ? (values[a.id]?.value_text ?? null)
                      : null,
                }));
                onResultsSubmit(items);
              }}
            >
              {isSubmitting ? "送出中…" : "儲存並送出"}
            </Button>
          </div>
        </>
      ) : (
        <p className="text-sm text-muted-foreground italic">
          影像 / 病理結果由外部系統整合（待規劃）
        </p>
      )}
    </div>
  );
}

// ── LabOrders Section ─────────────────────────────────────────

function LabOrdersSection({
  visitId,
  orders,
  showOrderForm,
  setShowOrderForm,
}: {
  visitId: number;
  orders: LabOrderRead[];
  showOrderForm: boolean;
  setShowOrderForm: (v: boolean) => void;
}) {
  const qc = useQueryClient();
  const [selectedTestTypeId, setSelectedTestTypeId] = useState<number | "">("");
  const [orderNotes, setOrderNotes] = useState("");
  const [submittingOrderId, setSubmittingOrderId] = useState<number | null>(null);
  const [cancellingOrderId, setCancellingOrderId] = useState<number | null>(null);

  const { data: labCategories = [] } = useQuery<LabCategoryRead[]>({
    queryKey: ["lab-categories"],
    queryFn: clinicalApi.getLabCategories,
    staleTime: 5 * 60_000,
  });

  const analytesByTestType = useMemo(() => {
    const map: Record<number, LabAnalyteRead[]> = {};
    for (const cat of labCategories) {
      for (const tt of cat.test_types) {
        map[tt.id] = tt.analytes;
      }
    }
    return map;
  }, [labCategories]);

  const createMutation = useMutation({
    mutationFn: (body: LabOrderCreate) => clinicalApi.createLabOrder(visitId, body),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["lab-orders", visitId] });
      setShowOrderForm(false);
      setSelectedTestTypeId("");
      setOrderNotes("");
    },
  });

  const submitMutation = useMutation({
    mutationFn: ({
      orderId,
      items,
    }: {
      orderId: number;
      items: LabResultItemCreate[];
    }) => clinicalApi.submitLabResults(visitId, orderId, { items }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["lab-orders", visitId] });
      setSubmittingOrderId(null);
    },
    onError: () => setSubmittingOrderId(null),
  });

  const cancelMutation = useMutation({
    mutationFn: (orderId: number) => clinicalApi.cancelLabOrder(visitId, orderId),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["lab-orders", visitId] });
      setCancellingOrderId(null);
    },
    onError: () => setCancellingOrderId(null),
  });

  // 相同 test_type 的 orders 分在同一組（橫排比較）
  const orderGroups = useMemo(() => {
    const active = orders.filter((o) => !o.is_superseded && o.status !== "cancelled");
    const map = new Map<number, LabOrderRead[]>();
    for (const o of active) {
      if (!map.has(o.test_type_id)) map.set(o.test_type_id, []);
      map.get(o.test_type_id)!.push(o);
    }
    return Array.from(map.values());
  }, [orders]);

  return (
    <section className="space-y-4">
      {/* 開檢驗單表單 */}
      {showOrderForm && (
        <div className="rounded-md border bg-background p-5 space-y-4">
          <h3 className="text-sm font-semibold">新增檢驗醫囑</h3>
          <div>
            <label className="text-sm text-muted-foreground block mb-1.5">檢驗項目</label>
            <select
              value={selectedTestTypeId}
              onChange={(e) =>
                setSelectedTestTypeId(
                  e.target.value === "" ? "" : Number(e.target.value)
                )
              }
              className="w-full h-9 rounded-md border border-input bg-background px-3 text-sm focus:outline-none focus:ring-1 focus:ring-ring"
            >
              <option value="">請選擇…</option>
              {labCategories.map((cat) => (
                <optgroup key={cat.id} label={cat.name}>
                  {cat.test_types.map((tt) => (
                    <option key={tt.id} value={tt.id}>
                      {tt.name}
                    </option>
                  ))}
                </optgroup>
              ))}
            </select>
          </div>
          <div>
            <label className="text-sm text-muted-foreground block mb-1.5">
              備註（可選）
            </label>
            <input
              type="text"
              value={orderNotes}
              onChange={(e) => setOrderNotes(e.target.value)}
              placeholder="特殊說明或注意事項…"
              className="w-full h-9 rounded-md border border-input bg-background px-3 text-sm focus:outline-none focus:ring-1 focus:ring-ring"
            />
          </div>
          <div className="flex justify-end gap-2">
            <Button
              variant="outline"
              size="sm"
              onClick={() => setShowOrderForm(false)}
            >
              取消
            </Button>
            <Button
              size="sm"
              disabled={!selectedTestTypeId || createMutation.isPending}
              onClick={() =>
                createMutation.mutate({
                  test_type_id: selectedTestTypeId as number,
                  notes: orderNotes.trim() || undefined,
                })
              }
            >
              {createMutation.isPending ? "建立中…" : "開立檢驗單"}
            </Button>
          </div>
        </div>
      )}

      {/* 檢驗單列表（同類型橫排，不同類型縱排） */}
      {orderGroups.length > 0 ? (
        <div className="space-y-6">
          {orderGroups.map((group) => (
            <div key={group[0].test_type_id} className="space-y-2">
              {group.length > 1 && (
                <p className="text-sm font-semibold text-muted-foreground">
                  {group[0].test_type_name}
                </p>
              )}
              <div className={group.length > 1 ? "flex gap-3 overflow-x-auto pb-1" : ""}>
                {group.map((order) => (
                  <div
                    key={order.id}
                    className={group.length > 1 ? "min-w-[280px] max-w-[420px] flex-1" : ""}
                  >
                    <LabOrderCard
                      order={order}
                      analytes={analytesByTestType[order.test_type_id] ?? []}
                      isSubmitting={submittingOrderId === order.id && submitMutation.isPending}
                      isCancelling={cancellingOrderId === order.id && cancelMutation.isPending}
                      onResultsSubmit={(items) => {
                        setSubmittingOrderId(order.id);
                        submitMutation.mutate({ orderId: order.id, items });
                      }}
                      onCancel={() => {
                        setCancellingOrderId(order.id);
                        cancelMutation.mutate(order.id);
                      }}
                    />
                  </div>
                ))}
              </div>
            </div>
          ))}
        </div>
      ) : (
        !showOrderForm && (
          <p className="text-sm text-muted-foreground italic">尚無檢驗醫囑</p>
        )
      )}

      {/* 影像佔位區 */}
      <div className="rounded-md border border-dashed p-8 text-center space-y-1">
        <p className="text-sm font-medium text-muted-foreground">影像結果</p>
        <p className="text-xs text-muted-foreground">PACS 整合功能開發中（待規劃）</p>
      </div>
    </section>
  );
}

// ── 主頁面 ────────────────────────────────────────────────────

// ── 狀態操作按鈕 ──────────────────────────────────────────────

function StatusActions({
  visit,
  onAdmit,
}: {
  visit: { id: number; status: VisitStatus; attending_vet_id: number | null };
  onAdmit: () => void;
}) {
  const qc = useQueryClient();

  const mutation = useMutation({
    mutationFn: (newStatus: VisitStatus) => visitsApi.update(visit.id, { status: newStatus }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["visit", visit.id] });
      qc.invalidateQueries({ queryKey: ["visits-kanban"] });
    },
    onError: (err: unknown) => {
      const detail = (err as { response?: { data?: { detail?: string } } })?.response?.data?.detail;
      toast.error(detail ?? "狀態更新失敗");
    },
  });

  const allowed = NEXT_STATUSES[visit.status] ?? [];
  // 常用的快捷狀態（不含 cancelled，取消放在看板）
  const quickStatuses = allowed.filter((s) => s !== "cancelled" && s !== "admitted") as VisitStatus[];

  return (
    <div className="flex items-center gap-1.5 flex-wrap">
      {quickStatuses.map((s) => (
        <Button
          key={s}
          variant="outline"
          size="sm"
          onClick={() => mutation.mutate(s)}
          disabled={mutation.isPending}
          className="text-xs"
        >
          {STATUS_LABELS[s]}
        </Button>
      ))}
      {allowed.includes("admitted") && visit.status !== "admitted" && (
        <Button
          variant="outline"
          size="sm"
          onClick={onAdmit}
          className="text-xs"
        >
          <BedDouble className="h-3.5 w-3.5 mr-1" />
          住院中
        </Button>
      )}
    </div>
  );
}

export default function MedicalRecordDetailPage() {
  const { visitId } = useParams<{ visitId: string }>();
  const id = Number(visitId);
  const [headerExpanded, setHeaderExpanded] = useState(true);
  const [activeTab, setActiveTab] = useState<"clinical" | "labs" | "admission">("clinical");
  const [showOrderForm, setShowOrderForm] = useState(false);
  const [showAdmissionModal, setShowAdmissionModal] = useState(false);
  const [showDischargeForm, setShowDischargeForm] = useState(false);

  const { data: visit, isLoading } = useQuery({
    queryKey: ["visit", id],
    queryFn: () => visitsApi.get(id),
    enabled: !isNaN(id),
  });

  // 查詢是否有 active admission（用於判斷是否隱藏狀態按鈕）
  const { data: admission } = useQuery({
    queryKey: ["admission-by-visit", id],
    queryFn: () => hospitalizationApi.getAdmissionByVisit(id),
    enabled: !isNaN(id),
  });

  const hasActiveAdmission = admission?.status === "active";

  const { data: labOrders = [] } = useQuery<LabOrderRead[]>({
    queryKey: ["lab-orders", id],
    queryFn: () => clinicalApi.getLabOrders(id),
    enabled: !isNaN(id),
  });

  const hasPendingLab = labOrders.some(
    (o) => o.status === "pending"
  );

  function openOrderForm() {
    setActiveTab("labs");
    setShowOrderForm(true);
  }

  if (isLoading) {
    return (
      <div className="w-full px-8 py-8">
        <p className="text-sm text-muted-foreground">載入中…</p>
      </div>
    );
  }

  if (!visit) {
    return (
      <div className="w-full px-8 py-8">
        <p className="text-sm text-destructive">找不到就診紀錄</p>
      </div>
    );
  }

  return (
    <div className="w-full px-8 py-8 max-w-5xl space-y-6">
      {/* 返回 + 出院按鈕 */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <Button variant="ghost" size="sm" asChild>
            <Link to="/medical-records">
              <ArrowLeft className="h-4 w-4 mr-1" />
              返回病歷列表
            </Link>
          </Button>
          <span className="text-sm text-muted-foreground font-mono">
            {formatRecordNo(visit.id)}
          </span>
        </div>
        {hasActiveAdmission && (
          <Button
            variant="outline"
            size="sm"
            onClick={() => {
              setActiveTab("admission");
              setShowDischargeForm(true);
            }}
          >
            辦理出院
          </Button>
        )}
      </div>

      {/* Visit Header */}
      <div className="rounded-lg border bg-background">
        <button
          type="button"
          onClick={() => setHeaderExpanded((v) => !v)}
          className="w-full flex items-center justify-between px-5 py-4 hover:bg-muted/30 transition-colors rounded-lg"
        >
          <div className="flex items-center gap-4">
            <div className="text-left">
              <p className="font-semibold text-base">
                {visit.animal_name ?? "—"}
                {visit.species_name && (
                  <span className="ml-1.5 text-sm text-muted-foreground font-normal">
                    ({visit.species_name})
                  </span>
                )}
              </p>
              <p className="text-sm text-muted-foreground">
                飼主：{visit.owner_name ?? "—"}
              </p>
            </div>
            <Badge
              variant="secondary"
              className={cn("text-sm px-3 py-1 font-medium", STATUS_COLORS[visit.status])}
            >
              {STATUS_LABELS[visit.status]}
            </Badge>
            {visit.priority === "urgent" && (
              <Badge variant="destructive" className="text-sm px-2.5 py-0.5">
                急診
              </Badge>
            )}
            {hasPendingLab && (
              <Badge className="text-sm px-2.5 py-0.5 bg-amber-100 text-amber-800 border border-amber-200">
                待檢驗結果
              </Badge>
            )}
          </div>
          {headerExpanded ? (
            <ChevronUp className="h-4 w-4 text-muted-foreground" />
          ) : (
            <ChevronDown className="h-4 w-4 text-muted-foreground" />
          )}
        </button>

        {/* 狀態操作按鈕（獨立一行，與狀態 Badge 視覺分離） */}
        {hasNextStatus(visit.status) && !hasActiveAdmission && (
          <div className="px-5 pb-3 border-t pt-3">
            <div className="flex items-center gap-2">
              <span className="text-xs text-muted-foreground mr-1">轉換至：</span>
              <StatusActions
                visit={visit}
                onAdmit={() => setShowAdmissionModal(true)}
              />
            </div>
          </div>
        )}

        {headerExpanded && (
          <div className="px-5 pb-5 space-y-3 border-t">
            <div className="pt-4">
              <p className="text-sm text-muted-foreground mb-1">主訴</p>
              <p className="text-base">{visit.chief_complaint || "—"}</p>
            </div>
            <div className="grid grid-cols-3 gap-4 text-sm">
              <div>
                <p className="text-muted-foreground font-medium">掛號時間</p>
                <p className="mt-0.5 text-foreground">{formatDatetime(visit.registered_at)}</p>
              </div>
              <div>
                <p className="text-muted-foreground font-medium">住院時間</p>
                <p className="mt-0.5 text-foreground">{formatDatetime(visit.admitted_at)}</p>
              </div>
              <div>
                <p className="text-muted-foreground font-medium">完診時間</p>
                <p className="mt-0.5 text-foreground">{formatDatetime(visit.completed_at)}</p>
              </div>
            </div>
          </div>
        )}
      </div>

      {/* 書籤頁 */}
      <Tabs
        value={activeTab}
        onValueChange={(v) => setActiveTab(v as "clinical" | "labs" | "admission")}
      >
        <TabsList className="mb-2">
          <TabsTrigger value="clinical">診斷記錄</TabsTrigger>
          <TabsTrigger value="labs" className="flex items-center gap-1.5">
            檢查 &amp; 檢驗
            {hasPendingLab && (
              <span className="h-2 w-2 rounded-full bg-amber-500 inline-block" />
            )}
          </TabsTrigger>
          {(visit.status === "admitted" || visit.admitted_at) && (
            <TabsTrigger value="admission" className="flex items-center gap-1.5">
              <BedDouble className="h-3.5 w-3.5" />
              住院
            </TabsTrigger>
          )}
        </TabsList>

        {/* ── 診斷記錄 Tab ── */}
        <TabsContent value="clinical" className="space-y-8">
          <div className="flex justify-end">
            <Button variant="outline" size="sm" onClick={openOrderForm}>
              <FlaskConical className="h-4 w-4 mr-1.5" />
              開檢驗單
            </Button>
          </div>
          <VitalSignsSection visitId={id} />
          <SoapNotesSection visitId={id} />
          <NursingNotesSection visitId={id} />
        </TabsContent>

        {/* ── 檢查 & 檢驗 Tab ── */}
        <TabsContent value="labs" className="space-y-4">
          <div className="flex justify-end">
            <Button variant="outline" size="sm" onClick={() => setShowOrderForm(true)}>
              <FlaskConical className="h-4 w-4 mr-1.5" />
              開檢驗單
            </Button>
          </div>
          <LabOrdersSection
            visitId={id}
            orders={labOrders}
            showOrderForm={showOrderForm}
            setShowOrderForm={setShowOrderForm}
          />
        </TabsContent>

        {/* ── 住院 Tab ── */}
        <TabsContent value="admission" className="space-y-4">
          <AdmissionTab
            visitId={id}
            showDischargeForm={showDischargeForm}
            onDischargeFormClose={() => setShowDischargeForm(false)}
          />
        </TabsContent>
      </Tabs>

      {/* 轉住院 Modal */}
      <AdmissionModal
        visitId={id}
        open={showAdmissionModal}
        onClose={() => {
          setShowAdmissionModal(false);
          setActiveTab("admission");
        }}
      />
    </div>
  );
}
