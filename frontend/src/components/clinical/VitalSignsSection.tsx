import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Plus } from "lucide-react";

import {
  clinicalApi,
  type VitalSignCreate,
  type VitalSignRead,
} from "@/api/clinical";
import { catalogsApi, type MucousMembraneColorRead } from "@/api/catalogs";
import { Button } from "@/components/ui/button";

function formatDatetime(iso: string | null | undefined): string {
  if (!iso) return "—";
  return new Date(iso).toLocaleString("zh-TW", {
    year: "numeric", month: "2-digit", day: "2-digit",
    hour: "2-digit", minute: "2-digit", hour12: false,
  });
}

function HistoryCard({ children }: { children: React.ReactNode }) {
  return (
    <div className="rounded-md border border-dashed bg-muted/30 px-5 py-4 space-y-1.5">
      {children}
    </div>
  );
}

export function VitalSignsSection({ visitId }: { visitId: number }) {
  const qc = useQueryClient();
  const [open, setOpen] = useState(false);
  const [form, setForm] = useState<VitalSignCreate>({});

  const { data: signs = [] } = useQuery<VitalSignRead[]>({
    queryKey: ["vital-signs", visitId],
    queryFn: () => clinicalApi.getVitalSigns(visitId),
  });

  const { data: colors = [] } = useQuery<MucousMembraneColorRead[]>({
    queryKey: ["mucous-membrane-colors"],
    queryFn: () => catalogsApi.mucousMembraneColors(),
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
        <label className="text-sm text-muted-foreground block mb-1.5">
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
          className="w-full h-9 rounded-md border border-input bg-background px-3 text-sm focus:outline-none focus:ring-1 focus:ring-ring"
        />
      </div>
    );
  }

  return (
    <section className="space-y-3">
      <h2 className="text-base font-semibold">生命徵象</h2>

      {signs.map((s) => (
        <HistoryCard key={s.id}>
          <div className="flex items-center justify-between">
            <p className="text-sm font-semibold text-foreground">{formatDatetime(s.created_at)}</p>
            {s.created_by_name && (
              <p className="text-sm text-muted-foreground">{s.created_by_name}</p>
            )}
          </div>
          <div className="grid grid-cols-4 gap-x-4 gap-y-2 text-sm mt-2">
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
                <p className="text-xs text-muted-foreground leading-none mb-1">{label}</p>
                <p className="text-sm font-medium">
                  {val != null ? `${val} ${unit}` : <span className="text-muted-foreground">—</span>}
                </p>
              </div>
            ))}
            <div className="min-w-0">
              <p className="text-xs text-muted-foreground leading-none mb-1">黏膜顏色</p>
              <p className="text-sm font-medium">
                {s.mucous_membrane_color_name ?? <span className="text-muted-foreground">—</span>}
              </p>
            </div>
          </div>
        </HistoryCard>
      ))}

      {open ? (
        <div className="rounded-md border bg-background p-5 space-y-4">
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
            {numField("體重", "weight_kg", "kg")}
            {numField("體溫", "temperature_c", "°C")}
            {numField("心率", "heart_rate_bpm", "bpm", "1")}
            {numField("呼吸速率", "respiratory_rate_bpm", "/min", "1")}
            {numField("收縮壓", "systolic_bp_mmhg", "mmHg", "1")}
            {numField("CRT", "capillary_refill_sec", "s", "0.1")}
            {numField("BCS", "body_condition_score", "/9", "1")}
            <div>
              <label className="text-sm text-muted-foreground block mb-1.5">黏膜顏色</label>
              <select
                value={form.mucous_membrane_color_id ?? ""}
                onChange={(e) =>
                  setForm((f) => ({
                    ...f,
                    mucous_membrane_color_id: e.target.value === "" ? undefined : Number(e.target.value),
                  }))
                }
                className="w-full h-9 rounded-md border border-input bg-background px-3 text-sm focus:outline-none focus:ring-1 focus:ring-ring"
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
          className="flex items-center gap-1.5 text-sm text-muted-foreground hover:text-foreground transition-colors"
        >
          <Plus className="h-4 w-4" />
          新增生命徵象
        </button>
      )}
    </section>
  );
}
