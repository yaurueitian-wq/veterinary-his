import { useState } from "react";
import { useParams, Link } from "react-router-dom";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { ArrowLeft, Plus, ChevronDown, ChevronUp } from "lucide-react";

import { visitsApi, STATUS_LABELS, STATUS_COLORS } from "@/api/visits";
import {
  clinicalApi,
  type VitalSignCreate,
  type VitalSignRead,
  type SoapNoteCreate,
  type SoapNoteRead,
  type NursingNoteCreate,
  type NursingNoteRead,
} from "@/api/clinical";
import { catalogsApi, type MucousMembraneColorRead } from "@/api/catalogs";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
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
    <div className="rounded-md border border-dashed bg-muted/20 px-4 py-3 opacity-60 space-y-1">
      {children}
    </div>
  );
}

// ── VitalSign Section ─────────────────────────────────────────

function VitalSignsSection({ visitId }: { visitId: number }) {
  const qc = useQueryClient();
  const [open, setOpen] = useState(false);
  const [form, setForm] = useState<VitalSignCreate>({});

  const { data: signs = [] } = useQuery<VitalSignRead[]>({
    queryKey: ["vital-signs", visitId],
    queryFn: () => clinicalApi.getVitalSigns(visitId),
  });

  const { data: colors = [] } = useQuery<MucousMembraneColorRead[]>({
    queryKey: ["mucous-membrane-colors"],
    queryFn: catalogsApi.mucousMembraneColors,
    staleTime: 5 * 60_000,
  });

  const mutation = useMutation({
    mutationFn: (body: VitalSignCreate) =>
      clinicalApi.createVitalSign(visitId, body),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["vital-signs", visitId] });
      setOpen(false);
      setForm({});
    },
  });

  function numField(
    label: string,
    key: keyof VitalSignCreate,
    unit: string,
    step = "0.01"
  ) {
    return (
      <div>
        <label className="text-xs text-muted-foreground block mb-1">
          {label}
          <span className="ml-1 text-muted-foreground/60">{unit}</span>
        </label>
        <input
          type="number"
          step={step}
          value={form[key] ?? ""}
          onChange={(e) =>
            setForm((f) => ({
              ...f,
              [key]: e.target.value === "" ? undefined : Number(e.target.value),
            }))
          }
          className="w-full h-8 rounded-md border border-input bg-background px-2 text-sm focus:outline-none focus:ring-1 focus:ring-ring"
        />
      </div>
    );
  }

  return (
    <section className="space-y-3">
      <h2 className="text-sm font-semibold">生命徵象</h2>

      {/* 歷史記錄 */}
      {signs.map((s) => (
        <HistoryCard key={s.id}>
          <div className="flex items-center justify-between">
            <p className="text-sm font-semibold text-foreground">{formatDatetime(s.created_at)}</p>
            {s.created_by_name && (
              <p className="text-xs text-muted-foreground">記錄人：{s.created_by_name}</p>
            )}
          </div>
          <div className="grid grid-cols-4 gap-x-4 gap-y-1 text-sm mt-2">
            {(
              [
                ["體重",   s.weight_kg,             "kg"],
                ["體溫",   s.temperature_c,          "°C"],
                ["心率",   s.heart_rate_bpm,         "bpm"],
                ["呼吸",   s.respiratory_rate_bpm,   "/min"],
                ["收縮壓", s.systolic_bp_mmhg,       "mmHg"],
                ["CRT",    s.capillary_refill_sec,   "s"],
                ["BCS",    s.body_condition_score,   "/9"],
              ] as [string, number | null | undefined, string][]
            ).map(([label, val, unit]) => (
              <div key={label} className="min-w-0">
                <p className="text-xs text-muted-foreground/70 leading-none mb-0.5">{label}</p>
                <p className="font-medium">
                  {val != null ? `${val} ${unit}` : <span className="text-muted-foreground/40">—</span>}
                </p>
              </div>
            ))}
            <div className="min-w-0">
              <p className="text-xs text-muted-foreground/70 leading-none mb-0.5">黏膜顏色</p>
              <p className="font-medium">
                {s.mucous_membrane_color_name ?? <span className="text-muted-foreground/40">—</span>}
              </p>
            </div>
          </div>
        </HistoryCard>
      ))}

      {/* 新增表單 */}
      {open ? (
        <div className="rounded-md border bg-background p-4 space-y-3">
          <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
            {numField("體重", "weight_kg", "kg")}
            {numField("體溫", "temperature_c", "°C")}
            {numField("心率", "heart_rate_bpm", "bpm", "1")}
            {numField("呼吸速率", "respiratory_rate_bpm", "/min", "1")}
            {numField("收縮壓", "systolic_bp_mmhg", "mmHg", "1")}
            {numField("CRT", "capillary_refill_sec", "s", "0.1")}
            {numField("BCS", "body_condition_score", "/9", "1")}
            <div>
              <label className="text-xs text-muted-foreground block mb-1">黏膜顏色</label>
              <select
                value={form.mucous_membrane_color_id ?? ""}
                onChange={(e) =>
                  setForm((f) => ({
                    ...f,
                    mucous_membrane_color_id: e.target.value === "" ? undefined : Number(e.target.value),
                  }))
                }
                className="w-full h-8 rounded-md border border-input bg-background px-2 text-sm focus:outline-none focus:ring-1 focus:ring-ring"
              >
                <option value="">—</option>
                {colors.map((c) => (
                  <option key={c.id} value={c.id}>{c.name}</option>
                ))}
              </select>
            </div>
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
      ) : (
        <button
          type="button"
          onClick={() => setOpen(true)}
          className="flex items-center gap-1 text-sm text-muted-foreground hover:text-foreground transition-colors"
        >
          <Plus className="h-4 w-4" />
          新增生命徵象
        </button>
      )}
    </section>
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
      diagnoses: [...(f.diagnoses ?? []), { free_text: t, is_primary: (f.diagnoses ?? []).length === 0 }],
    }));
    setDiagText("");
  }

  function textarea(
    label: string,
    key: keyof Pick<SoapNoteCreate, "subjective" | "objective" | "assessment" | "plan">
  ) {
    return (
      <div>
        <label className="text-xs text-muted-foreground block mb-1">{label}</label>
        <textarea
          rows={3}
          value={form[key] ?? ""}
          onChange={(e) =>
            setForm((f) => ({ ...f, [key]: e.target.value || undefined }))
          }
          className="flex w-full rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 resize-none"
        />
      </div>
    );
  }

  return (
    <section className="space-y-3">
      <h2 className="text-sm font-semibold">SOAP 病歷</h2>

      {notes.map((n) => (
        <HistoryCard key={n.id}>
          <p className="text-xs text-muted-foreground">{formatDatetime(n.created_at)}</p>
          {n.subjective && (
            <div className="mt-1">
              <span className="text-xs font-medium text-muted-foreground">S</span>
              <p className="text-sm whitespace-pre-wrap">{n.subjective}</p>
            </div>
          )}
          {n.objective && (
            <div>
              <span className="text-xs font-medium text-muted-foreground">O</span>
              <p className="text-sm whitespace-pre-wrap">{n.objective}</p>
            </div>
          )}
          {n.assessment && (
            <div>
              <span className="text-xs font-medium text-muted-foreground">A</span>
              <p className="text-sm whitespace-pre-wrap">{n.assessment}</p>
            </div>
          )}
          {n.plan && (
            <div>
              <span className="text-xs font-medium text-muted-foreground">P</span>
              <p className="text-sm whitespace-pre-wrap">{n.plan}</p>
            </div>
          )}
          {n.diagnoses.length > 0 && (
            <div className="mt-1 flex flex-wrap gap-1">
              {n.diagnoses.map((d) => (
                <span
                  key={d.id}
                  className={cn(
                    "rounded-full px-2 py-0.5 text-xs border",
                    d.is_primary
                      ? "border-blue-300 bg-blue-50 text-blue-700"
                      : "border-input bg-muted/30"
                  )}
                >
                  {d.free_text}
                  {d.is_primary && <span className="ml-1 opacity-60">主</span>}
                </span>
              ))}
            </div>
          )}
        </HistoryCard>
      ))}

      {open ? (
        <div className="rounded-md border bg-background p-4 space-y-3">
          {textarea("S — 主觀（主訴 / 病史）", "subjective")}
          {textarea("O — 客觀（理學檢查）", "objective")}
          {textarea("A — 評估", "assessment")}
          {textarea("P — 計畫", "plan")}

          {/* 診斷 */}
          <div>
            <label className="text-xs text-muted-foreground block mb-1">診斷</label>
            <div className="flex gap-2">
              <input
                type="text"
                value={diagText}
                onChange={(e) => setDiagText(e.target.value)}
                onKeyDown={(e) => e.key === "Enter" && (e.preventDefault(), addDiag())}
                placeholder="輸入診斷文字，按 Enter 新增…"
                className="flex-1 h-8 rounded-md border border-input bg-background px-3 text-sm focus:outline-none focus:ring-1 focus:ring-ring"
              />
              <Button type="button" variant="outline" size="sm" onClick={addDiag}>
                新增
              </Button>
            </div>
            {(form.diagnoses ?? []).length > 0 && (
              <div className="mt-2 flex flex-wrap gap-1">
                {form.diagnoses!.map((d, i) => (
                  <span
                    key={i}
                    className={cn(
                      "rounded-full px-2 py-0.5 text-xs border flex items-center gap-1",
                      d.is_primary
                        ? "border-blue-300 bg-blue-50 text-blue-700"
                        : "border-input bg-muted/30"
                    )}
                  >
                    {d.free_text}
                    {d.is_primary && <span className="opacity-60">主</span>}
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
      ) : (
        <button
          type="button"
          onClick={() => setOpen(true)}
          className="flex items-center gap-1 text-sm text-muted-foreground hover:text-foreground transition-colors"
        >
          <Plus className="h-4 w-4" />
          新增 SOAP 病歷
        </button>
      )}
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
      <h2 className="text-sm font-semibold">護理紀錄</h2>

      {notes.map((n) => (
        <HistoryCard key={n.id}>
          <p className="text-xs text-muted-foreground">{formatDatetime(n.created_at)}</p>
          <p className="text-sm whitespace-pre-wrap mt-1">{n.note_text}</p>
        </HistoryCard>
      ))}

      {open ? (
        <div className="rounded-md border bg-background p-4 space-y-3">
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
      ) : (
        <button
          type="button"
          onClick={() => setOpen(true)}
          className="flex items-center gap-1 text-sm text-muted-foreground hover:text-foreground transition-colors"
        >
          <Plus className="h-4 w-4" />
          新增護理紀錄
        </button>
      )}
    </section>
  );
}

// ── 主頁面 ────────────────────────────────────────────────────

export default function MedicalRecordDetailPage() {
  const { visitId } = useParams<{ visitId: string }>();
  const id = Number(visitId);
  const [headerExpanded, setHeaderExpanded] = useState(true);

  const { data: visit, isLoading } = useQuery({
    queryKey: ["visit", id],
    queryFn: () => visitsApi.get(id),
    enabled: !isNaN(id),
  });

  if (isLoading) {
    return (
      <div className="w-full px-6 py-6">
        <p className="text-sm text-muted-foreground">載入中…</p>
      </div>
    );
  }

  if (!visit) {
    return (
      <div className="w-full px-6 py-6">
        <p className="text-sm text-destructive">找不到就診紀錄</p>
      </div>
    );
  }

  return (
    <div className="w-full px-6 py-6 max-w-3xl space-y-6">
      {/* 返回 */}
      <div className="flex items-center gap-3">
        <Button variant="ghost" size="sm" asChild>
          <Link to="/medical-records">
            <ArrowLeft className="h-4 w-4 mr-1" />
            返回病歷列表
          </Link>
        </Button>
        <span className="text-xs text-muted-foreground font-mono">
          {formatRecordNo(visit.id)}
        </span>
      </div>

      {/* Visit Header */}
      <div className="rounded-lg border bg-background">
        <button
          type="button"
          onClick={() => setHeaderExpanded((v) => !v)}
          className="w-full flex items-center justify-between px-4 py-3 hover:bg-muted/30 transition-colors rounded-lg"
        >
          <div className="flex items-center gap-3">
            <div className="text-left">
              <p className="font-semibold text-sm">
                {visit.animal_name ?? "—"}
                {visit.species_name && (
                  <span className="ml-1.5 text-xs text-muted-foreground font-normal">
                    ({visit.species_name})
                  </span>
                )}
              </p>
              <p className="text-xs text-muted-foreground">
                飼主：{visit.owner_name ?? "—"}
              </p>
            </div>
            <Badge
              variant="secondary"
              className={cn("text-xs", STATUS_COLORS[visit.status])}
            >
              {STATUS_LABELS[visit.status]}
            </Badge>
            {visit.priority === "urgent" && (
              <Badge variant="destructive" className="text-xs">
                急診
              </Badge>
            )}
          </div>
          {headerExpanded ? (
            <ChevronUp className="h-4 w-4 text-muted-foreground" />
          ) : (
            <ChevronDown className="h-4 w-4 text-muted-foreground" />
          )}
        </button>

        {headerExpanded && (
          <div className="px-4 pb-4 space-y-2 border-t">
            <div className="pt-3">
              <p className="text-xs text-muted-foreground mb-1">主訴</p>
              <p className="text-sm">{visit.chief_complaint || "—"}</p>
            </div>
            <div className="grid grid-cols-3 gap-4 text-xs text-muted-foreground">
              <div>
                <p className="font-medium">掛號時間</p>
                <p>{formatDatetime(visit.registered_at)}</p>
              </div>
              <div>
                <p className="font-medium">住院時間</p>
                <p>{formatDatetime(visit.admitted_at)}</p>
              </div>
              <div>
                <p className="font-medium">完診時間</p>
                <p>{formatDatetime(visit.completed_at)}</p>
              </div>
            </div>
          </div>
        )}
      </div>

      {/* 臨床記錄 */}
      <VitalSignsSection visitId={id} />
      <SoapNotesSection visitId={id} />
      <NursingNotesSection visitId={id} />
    </div>
  );
}
