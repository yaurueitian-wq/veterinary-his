import { useState } from "react";
import { useNavigate, useParams } from "react-router-dom";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Pencil, Plus, Trash2, AlertTriangle, Camera } from "lucide-react";

import {
  animalsApi,
  SEX_LABELS,
  DISEASE_STATUS_LABELS,
  type AnimalDiseaseCreate,
  type AnimalMedicationCreate,
} from "@/api/owners";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { cn } from "@/lib/utils";

// ── 工具 ────────────────────────────────────────────────

function Field({ label, value }: { label: string; value?: string | null }) {
  if (!value) return null;
  return (
    <div className="flex gap-2 text-sm">
      <span className="text-muted-foreground w-28 shrink-0">{label}</span>
      <span>{value}</span>
    </div>
  );
}

// ── 疾病新增表單 ─────────────────────────────────────────

function DiseaseForm({
  animalId,
  onClose,
}: {
  animalId: number;
  onClose: () => void;
}) {
  const queryClient = useQueryClient();
  const [form, setForm] = useState<AnimalDiseaseCreate>({
    free_text: "",
    is_allergy: false,
    status: "active",
    onset_date: "",
    notes: "",
  });

  const mutation = useMutation({
    mutationFn: () => animalsApi.createDisease(animalId, {
      ...form,
      free_text: form.free_text || undefined,
      onset_date: form.onset_date || undefined,
      notes: form.notes || undefined,
    }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["animal-diseases", animalId] });
      onClose();
    },
  });

  return (
    <div className="border rounded-lg p-4 space-y-3 bg-muted/30">
      <div className="space-y-1.5">
        <label className="text-sm font-medium">疾病 / 過敏名稱 *</label>
        <Input
          placeholder="例：糖尿病、Penicillin 過敏"
          value={form.free_text ?? ""}
          onChange={(e) => setForm((f) => ({ ...f, free_text: e.target.value }))}
        />
      </div>

      <div className="grid grid-cols-2 gap-3">
        <div className="space-y-1.5">
          <label className="text-sm font-medium">狀態</label>
          <select
            value={form.status}
            onChange={(e) => setForm((f) => ({ ...f, status: e.target.value }))}
            className="w-full h-9 rounded-md border border-input bg-background px-3 text-sm focus:outline-none focus:ring-1 focus:ring-ring"
          >
            {Object.entries(DISEASE_STATUS_LABELS).map(([val, label]) => (
              <option key={val} value={val}>{label}</option>
            ))}
          </select>
        </div>
        <div className="space-y-1.5">
          <label className="text-sm font-medium">發病日期</label>
          <Input
            type="date"
            value={form.onset_date ?? ""}
            onChange={(e) => setForm((f) => ({ ...f, onset_date: e.target.value }))}
          />
        </div>
      </div>

      <div className="flex items-center gap-2">
        <input
          type="checkbox"
          id="is_allergy"
          checked={form.is_allergy ?? false}
          onChange={(e) => setForm((f) => ({ ...f, is_allergy: e.target.checked }))}
          className="h-4 w-4"
        />
        <label htmlFor="is_allergy" className="text-sm">標記為過敏（患者安全警示）</label>
      </div>

      <div className="space-y-1.5">
        <label className="text-sm font-medium">備註</label>
        <Input
          placeholder="補充說明…"
          value={form.notes ?? ""}
          onChange={(e) => setForm((f) => ({ ...f, notes: e.target.value }))}
        />
      </div>

      <div className="flex gap-2 justify-end">
        <Button type="button" variant="outline" size="sm" onClick={onClose}>
          取消
        </Button>
        <Button
          size="sm"
          onClick={() => mutation.mutate()}
          disabled={!form.free_text?.trim() || mutation.isPending}
        >
          {mutation.isPending ? "新增中…" : "新增"}
        </Button>
      </div>
    </div>
  );
}

// ── 用藥新增表單 ─────────────────────────────────────────

function MedicationForm({
  animalId,
  onClose,
}: {
  animalId: number;
  onClose: () => void;
}) {
  const queryClient = useQueryClient();
  const [form, setForm] = useState<AnimalMedicationCreate>({
    free_text: "",
    dose_unit: "",
    frequency: "",
    start_date: "",
    end_date: "",
    notes: "",
  });

  const mutation = useMutation({
    mutationFn: () => animalsApi.createMedication(animalId, {
      ...form,
      free_text: form.free_text || undefined,
      dose_unit: form.dose_unit || undefined,
      frequency: form.frequency || undefined,
      start_date: form.start_date || undefined,
      end_date: form.end_date || undefined,
      notes: form.notes || undefined,
    }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["animal-medications", animalId] });
      onClose();
    },
  });

  return (
    <div className="border rounded-lg p-4 space-y-3 bg-muted/30">
      <div className="space-y-1.5">
        <label className="text-sm font-medium">藥品名稱 *</label>
        <Input
          placeholder="例：Vetmedin 5mg"
          value={form.free_text ?? ""}
          onChange={(e) => setForm((f) => ({ ...f, free_text: e.target.value }))}
        />
      </div>

      <div className="grid grid-cols-3 gap-3">
        <div className="space-y-1.5">
          <label className="text-sm font-medium">劑量</label>
          <Input
            type="number"
            step="0.001"
            placeholder="例：2.5"
            value={form.dose ?? ""}
            onChange={(e) => setForm((f) => ({ ...f, dose: e.target.value ? Number(e.target.value) : undefined }))}
          />
        </div>
        <div className="space-y-1.5">
          <label className="text-sm font-medium">單位</label>
          <Input
            placeholder="mg / mL / tablet"
            value={form.dose_unit ?? ""}
            onChange={(e) => setForm((f) => ({ ...f, dose_unit: e.target.value }))}
          />
        </div>
        <div className="space-y-1.5">
          <label className="text-sm font-medium">頻率</label>
          <Input
            placeholder="SID / BID / PRN"
            value={form.frequency ?? ""}
            onChange={(e) => setForm((f) => ({ ...f, frequency: e.target.value }))}
          />
        </div>
      </div>

      <div className="grid grid-cols-2 gap-3">
        <div className="space-y-1.5">
          <label className="text-sm font-medium">開始日期</label>
          <Input
            type="date"
            value={form.start_date ?? ""}
            onChange={(e) => setForm((f) => ({ ...f, start_date: e.target.value }))}
          />
        </div>
        <div className="space-y-1.5">
          <label className="text-sm font-medium">結束日期（空白 = 持續中）</label>
          <Input
            type="date"
            value={form.end_date ?? ""}
            onChange={(e) => setForm((f) => ({ ...f, end_date: e.target.value }))}
          />
        </div>
      </div>

      <div className="space-y-1.5">
        <label className="text-sm font-medium">備註</label>
        <Input
          placeholder="補充說明…"
          value={form.notes ?? ""}
          onChange={(e) => setForm((f) => ({ ...f, notes: e.target.value }))}
        />
      </div>

      <div className="flex gap-2 justify-end">
        <Button type="button" variant="outline" size="sm" onClick={onClose}>
          取消
        </Button>
        <Button
          size="sm"
          onClick={() => mutation.mutate()}
          disabled={!form.free_text?.trim() || mutation.isPending}
        >
          {mutation.isPending ? "新增中…" : "新增"}
        </Button>
      </div>
    </div>
  );
}

// ── 主頁面 ────────────────────────────────────────────────

export default function AnimalDetailPage() {
  const { animalId } = useParams<{ animalId: string }>();
  const navigate = useNavigate();
  const queryClient = useQueryClient();

  const [showDiseaseForm, setShowDiseaseForm] = useState(false);
  const [showMedicationForm, setShowMedicationForm] = useState(false);

  const { data: animal, isLoading } = useQuery({
    queryKey: ["animal", animalId],
    queryFn: () => animalsApi.get(Number(animalId)),
    enabled: Boolean(animalId),
  });

  const { data: diseases = [] } = useQuery({
    queryKey: ["animal-diseases", Number(animalId)],
    queryFn: () => animalsApi.getDiseases(Number(animalId)),
    enabled: Boolean(animalId),
  });

  const { data: medications = [] } = useQuery({
    queryKey: ["animal-medications", Number(animalId)],
    queryFn: () => animalsApi.getMedications(Number(animalId)),
    enabled: Boolean(animalId),
  });

  const deleteDisease = useMutation({
    mutationFn: (diseaseId: number) =>
      animalsApi.deleteDisease(Number(animalId), diseaseId),
    onSuccess: () =>
      queryClient.invalidateQueries({ queryKey: ["animal-diseases", Number(animalId)] }),
  });

  const deleteMedication = useMutation({
    mutationFn: (medicationId: number) =>
      animalsApi.deleteMedication(Number(animalId), medicationId),
    onSuccess: () =>
      queryClient.invalidateQueries({ queryKey: ["animal-medications", Number(animalId)] }),
  });

  if (isLoading) {
    return (
      <div className="container py-12 text-center text-sm text-muted-foreground">
        載入中…
      </div>
    );
  }

  if (!animal) {
    return (
      <div className="container py-12 text-center text-sm text-destructive">
        無法載入動物資料
      </div>
    );
  }

  return (
    <div className="container py-6 max-w-3xl space-y-5">
      {/* 標頭 */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <Button variant="ghost" size="sm" onClick={() => navigate(-1)}>
            ← 返回
          </Button>
          <div>
            <h1 className="text-xl font-semibold">{animal.name}</h1>
            <p className="text-sm text-muted-foreground">
              {animal.species_name}
              {animal.breed_name && ` · ${animal.breed_name}`}
            </p>
          </div>
        </div>
        <Button
          variant="outline"
          size="sm"
          onClick={() => navigate(`/animals/${animal.id}/edit`)}
        >
          <Pencil className="h-3.5 w-3.5 mr-1" />
          編輯基本資料
        </Button>
      </div>

      {/* 警示資訊 */}
      {animal.critical_info && (
        <div className="rounded-lg border border-destructive/50 bg-destructive/5 px-4 py-3 flex gap-3">
          <AlertTriangle className="h-5 w-5 text-destructive shrink-0 mt-0.5" />
          <div>
            <p className="text-sm font-semibold text-destructive mb-0.5">警示資訊</p>
            <p className="text-sm whitespace-pre-wrap">{animal.critical_info}</p>
          </div>
        </div>
      )}

      {/* 基本資料 */}
      <Card>
        <CardHeader>
          <CardTitle className="text-base">基本資料</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="flex gap-6">
            {/* 欄位 */}
            <div className="flex-1 space-y-1.5">
              <Field label="性別" value={SEX_LABELS[animal.sex] ?? animal.sex} />
              <Field label="血型" value={animal.blood_type_name ?? "不明"} />
              <Field label="生日" value={animal.date_of_birth ?? (animal.birth_year ? `${animal.birth_year} 年` : null)} />
              <Field label="絕育日期" value={animal.neutered_date} />
              <Field label="晶片號碼" value={animal.microchip_number} />
              <Field label="毛色外觀" value={animal.color} />
              <Field label="行政備註" value={animal.notes} />
              {animal.is_deceased && (
                <div className="flex gap-2 text-sm">
                  <span className="text-muted-foreground w-28">狀態</span>
                  <Badge variant="secondary" className="text-destructive">已亡故</Badge>
                  {animal.deceased_date && <span className="text-muted-foreground">{animal.deceased_date}</span>}
                </div>
              )}
            </div>

            {/* 照片佔位 */}
            <div className="shrink-0 w-28 flex flex-col items-center gap-2">
              <div className="w-28 h-28 rounded-lg border-2 border-dashed border-muted-foreground/30 flex flex-col items-center justify-center gap-1.5 bg-muted/20 text-muted-foreground/50">
                <Camera className="h-6 w-6" />
                <span className="text-xs">尚無照片</span>
              </div>
              <p className="text-xs text-muted-foreground/50">（功能開發中）</p>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* 一般背景病史 */}
      {animal.general_info && (
        <Card>
          <CardHeader>
            <CardTitle className="text-base">背景病史</CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-sm whitespace-pre-wrap">{animal.general_info}</p>
          </CardContent>
        </Card>
      )}

      {/* 疾病史 */}
      <Card>
        <CardHeader className="flex flex-row items-center justify-between">
          <CardTitle className="text-base">疾病 / 過敏史（{diseases.length}）</CardTitle>
          {!showDiseaseForm && (
            <Button
              variant="outline"
              size="sm"
              onClick={() => setShowDiseaseForm(true)}
            >
              <Plus className="h-3.5 w-3.5 mr-1" />
              新增
            </Button>
          )}
        </CardHeader>
        <CardContent className="space-y-3">
          {showDiseaseForm && (
            <DiseaseForm
              animalId={animal.id}
              onClose={() => setShowDiseaseForm(false)}
            />
          )}

          {diseases.length === 0 && !showDiseaseForm && (
            <p className="text-sm text-muted-foreground">尚無疾病紀錄</p>
          )}

          {diseases.map((d) => (
            <div
              key={d.id}
              className={cn(
                "flex items-start justify-between rounded-lg border px-4 py-3",
                d.is_allergy && "border-destructive/40 bg-destructive/5"
              )}
            >
              <div className="space-y-0.5">
                <div className="flex items-center gap-2">
                  {d.is_allergy && (
                    <AlertTriangle className="h-3.5 w-3.5 text-destructive" />
                  )}
                  <span className="text-sm font-medium">{d.free_text}</span>
                  <Badge variant="secondary" className="text-xs">
                    {DISEASE_STATUS_LABELS[d.status] ?? d.status}
                  </Badge>
                </div>
                {d.onset_date && (
                  <p className="text-xs text-muted-foreground">發病：{d.onset_date}</p>
                )}
                {d.notes && (
                  <p className="text-xs text-muted-foreground">{d.notes}</p>
                )}
              </div>
              <Button
                variant="ghost"
                size="sm"
                className="text-destructive hover:text-destructive shrink-0 ml-2"
                onClick={() => deleteDisease.mutate(d.id)}
                disabled={deleteDisease.isPending}
              >
                <Trash2 className="h-3.5 w-3.5" />
              </Button>
            </div>
          ))}
        </CardContent>
      </Card>

      {/* 長期用藥 */}
      <Card>
        <CardHeader className="flex flex-row items-center justify-between">
          <CardTitle className="text-base">長期維持用藥（{medications.length}）</CardTitle>
          {!showMedicationForm && (
            <Button
              variant="outline"
              size="sm"
              onClick={() => setShowMedicationForm(true)}
            >
              <Plus className="h-3.5 w-3.5 mr-1" />
              新增
            </Button>
          )}
        </CardHeader>
        <CardContent className="space-y-3">
          {showMedicationForm && (
            <MedicationForm
              animalId={animal.id}
              onClose={() => setShowMedicationForm(false)}
            />
          )}

          {medications.length === 0 && !showMedicationForm && (
            <p className="text-sm text-muted-foreground">尚無長期用藥紀錄</p>
          )}

          {medications.map((m) => (
            <div
              key={m.id}
              className="flex items-start justify-between rounded-lg border px-4 py-3"
            >
              <div className="space-y-0.5">
                <span className="text-sm font-medium">{m.free_text}</span>
                <div className="flex gap-3 text-xs text-muted-foreground">
                  {(m.dose || m.dose_unit) && (
                    <span>{[m.dose, m.dose_unit].filter(Boolean).join(" ")}</span>
                  )}
                  {m.frequency && <span>{m.frequency}</span>}
                  {m.start_date && (
                    <span>
                      {m.start_date} ~ {m.end_date ?? "持續中"}
                    </span>
                  )}
                </div>
                {m.notes && (
                  <p className="text-xs text-muted-foreground">{m.notes}</p>
                )}
              </div>
              <Button
                variant="ghost"
                size="sm"
                className="text-destructive hover:text-destructive shrink-0 ml-2"
                onClick={() => deleteMedication.mutate(m.id)}
                disabled={deleteMedication.isPending}
              >
                <Trash2 className="h-3.5 w-3.5" />
              </Button>
            </div>
          ))}
        </CardContent>
      </Card>
    </div>
  );
}
