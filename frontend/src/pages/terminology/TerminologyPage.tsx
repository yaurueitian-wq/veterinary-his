import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { toast } from "sonner";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import CatalogSection from "@/components/catalog/CatalogSection";
import { catalogsApi } from "@/api/catalogs";
import type {
  SpeciesRead, BreedRead, BloodTypeRead,
  ContactTypeRead, MucousMembraneColorRead,
  AdministrationRouteRead,
  MedicationCategoryRead, MedicationRead,
  ProcedureCategoryRead, ProcedureTypeRead,
  DiagnosisCategoryRead, DiagnosisCodeRead,
  LabCategoryRead, LabTestTypeRead, LabAnalyteRead,
} from "@/api/catalogs";

// ── 共用小工具 ─────────────────────────────────────────────────

function NameField({ register, error }: { register: ReturnType<ReturnType<typeof useForm>["register"]>; error?: string }) {
  return (
    <div className="space-y-1.5">
      <Label htmlFor="name">名稱</Label>
      <Input id="name" {...register} />
      {error && <p className="text-xs text-destructive">{error}</p>}
    </div>
  );
}

// ── 通用單名稱 Form ───────────────────────────────────────────

const nameSchema = z.object({ name: z.string().min(1, "請輸入名稱").max(200) });
type NameForm = z.infer<typeof nameSchema>;

function SimpleNameForm({
  item,
  onClose,
  onCreate,
  onUpdate,
}: {
  item: { id: number; name: string } | null;
  onClose: () => void;
  onCreate: (data: NameForm) => Promise<unknown>;
  onUpdate: (id: number, data: NameForm) => Promise<unknown>;
}) {
  const { register, handleSubmit, formState: { errors, isSubmitting } } = useForm<NameForm>({
    resolver: zodResolver(nameSchema),
    defaultValues: { name: item?.name ?? "" },
  });

  async function onSubmit(data: NameForm) {
    try {
      if (item) await onUpdate(item.id, data);
      else await onCreate(data);
      onClose();
    } catch (e: unknown) {
      const msg = (e as { response?: { data?: { detail?: string } } })?.response?.data?.detail;
      toast.error(msg ?? "操作失敗");
    }
  }

  return (
    <form onSubmit={handleSubmit(onSubmit)} className="space-y-4 pt-2">
      <NameField register={register("name")} error={errors.name?.message} />
      <div className="flex justify-end gap-2">
        <Button type="button" variant="outline" onClick={onClose}>取消</Button>
        <Button type="submit" disabled={isSubmitting}>{item ? "儲存" : "新增"}</Button>
      </div>
    </form>
  );
}

// ══════════════════════════════════════════════════════════════════
// Tab 1：臨床術語
// ══════════════════════════════════════════════════════════════════

function ClinicalTab() {
  const qc = useQueryClient();

  // Diagnosis Categories
  const { data: diagCats = [], isLoading: loadingDiagCats } = useQuery({
    queryKey: ["diagnosis-categories", true],
    queryFn: () => catalogsApi.diagnosisCategories(true),
  });
  const createDiagCat = useMutation({
    mutationFn: catalogsApi.createDiagnosisCategory,
    onSuccess: () => { qc.invalidateQueries({ queryKey: ["diagnosis-categories"] }); toast.success("已新增"); },
  });
  const updateDiagCat = useMutation({
    mutationFn: ({ id, data }: { id: number; data: { name?: string } }) => catalogsApi.updateDiagnosisCategory(id, data),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ["diagnosis-categories"] }); toast.success("已更新"); },
  });
  const toggleDiagCat = useMutation({
    mutationFn: catalogsApi.toggleDiagnosisCategoryActive,
    onSuccess: () => qc.invalidateQueries({ queryKey: ["diagnosis-categories"] }),
  });

  // Diagnosis Codes
  const { data: diagCodes = [], isLoading: loadingDiagCodes } = useQuery({
    queryKey: ["diagnosis-codes", true],
    queryFn: () => catalogsApi.diagnosisCodes(undefined, undefined, true),
  });
  const createDiagCode = useMutation({
    mutationFn: catalogsApi.createDiagnosisCode,
    onSuccess: () => { qc.invalidateQueries({ queryKey: ["diagnosis-codes"] }); toast.success("已新增"); },
  });
  const updateDiagCode = useMutation({
    mutationFn: ({ id, data }: { id: number; data: Parameters<typeof catalogsApi.updateDiagnosisCode>[1] }) =>
      catalogsApi.updateDiagnosisCode(id, data),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ["diagnosis-codes"] }); toast.success("已更新"); },
  });
  const toggleDiagCode = useMutation({
    mutationFn: catalogsApi.toggleDiagnosisCodeActive,
    onSuccess: () => qc.invalidateQueries({ queryKey: ["diagnosis-codes"] }),
  });

  // Mucous Membrane Colors
  const { data: colors = [], isLoading: loadingColors } = useQuery({
    queryKey: ["mucous-membrane-colors", true],
    queryFn: () => catalogsApi.mucousMembraneColors(true),
  });
  const createColor = useMutation({
    mutationFn: catalogsApi.createMucousMembraneColor,
    onSuccess: () => { qc.invalidateQueries({ queryKey: ["mucous-membrane-colors"] }); toast.success("已新增"); },
  });
  const updateColor = useMutation({
    mutationFn: ({ id, data }: { id: number; data: { name?: string } }) => catalogsApi.updateMucousMembraneColor(id, data),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ["mucous-membrane-colors"] }); toast.success("已更新"); },
  });
  const toggleColor = useMutation({
    mutationFn: catalogsApi.toggleMucousMembraneColorActive,
    onSuccess: () => qc.invalidateQueries({ queryKey: ["mucous-membrane-colors"] }),
  });

  function DiagnosisCodeForm({ item, onClose }: { item: DiagnosisCodeRead | null; onClose: () => void }) {
    const schema = z.object({
      name: z.string().min(1, "請輸入名稱").max(200),
      code: z.string().max(50).optional(),
      coding_system: z.enum(["internal", "venomcode", "snomed"]).default("internal"),
      category_id: z.preprocess(
        (v) => (v === "" || v == null ? null : Number(v)),
        z.number().int().positive().nullable().optional()
      ),
    });
    type Form = z.infer<typeof schema>;
    const { register, handleSubmit, formState: { errors, isSubmitting } } = useForm<Form>({
      resolver: zodResolver(schema),
      defaultValues: {
        name: item?.name ?? "",
        code: item?.code ?? "",
        coding_system: (item?.coding_system as "internal" | "venomcode" | "snomed") ?? "internal",
        category_id: item?.category_id ?? null,
      },
    });

    async function onSubmit(data: Form) {
      try {
        if (item) await updateDiagCode.mutateAsync({ id: item.id, data });
        else await createDiagCode.mutateAsync(data);
        onClose();
      } catch (e: unknown) {
        const msg = (e as { response?: { data?: { detail?: string } } })?.response?.data?.detail;
        toast.error(msg ?? "操作失敗");
      }
    }

    return (
      <form onSubmit={handleSubmit(onSubmit)} className="space-y-4 pt-2">
        <div className="space-y-1.5">
          <Label htmlFor="dc-name">名稱</Label>
          <Input id="dc-name" {...register("name")} />
          {errors.name && <p className="text-xs text-destructive">{errors.name.message}</p>}
        </div>
        <div className="grid grid-cols-2 gap-3">
          <div className="space-y-1.5">
            <Label htmlFor="dc-code">外部代碼（選填）</Label>
            <Input id="dc-code" {...register("code")} placeholder="VeNom / SNOMED 代碼" />
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="dc-system">編碼系統</Label>
            <select id="dc-system" {...register("coding_system")} className="flex h-9 w-full rounded-md border border-input bg-transparent px-3 py-1 text-sm shadow-sm">
              <option value="internal">內部自訂</option>
              <option value="venomcode">VeNom</option>
              <option value="snomed">SNOMED</option>
            </select>
          </div>
        </div>
        <div className="space-y-1.5">
          <Label htmlFor="dc-cat">診斷分類（選填）</Label>
          <select id="dc-cat" {...register("category_id")} className="flex h-9 w-full rounded-md border border-input bg-transparent px-3 py-1 text-sm shadow-sm">
            <option value="">— 無分類 —</option>
            {diagCats.filter((c) => c.is_active).map((c) => (
              <option key={c.id} value={c.id}>{c.name}</option>
            ))}
          </select>
        </div>
        <div className="flex justify-end gap-2">
          <Button type="button" variant="outline" onClick={onClose}>取消</Button>
          <Button type="submit" disabled={isSubmitting}>{item ? "儲存" : "新增"}</Button>
        </div>
      </form>
    );
  }

  return (
    <div className="space-y-8">
      <CatalogSection<DiagnosisCategoryRead>
        title="診斷分類"
        items={diagCats}
        isLoading={loadingDiagCats}
        headers={["名稱"]}
        renderRow={(item) => <td className="px-4 py-2">{item.name}</td>}
        onToggleActive={(id) => toggleDiagCat.mutate(id)}
        renderForm={(item, onClose) => (
          <SimpleNameForm
            item={item}
            onClose={onClose}
            onCreate={(d) => createDiagCat.mutateAsync(d)}
            onUpdate={(id, d) => updateDiagCat.mutateAsync({ id, data: d })}
          />
        )}
      />

      <CatalogSection<DiagnosisCodeRead>
        title="診斷碼"
        items={diagCodes}
        isLoading={loadingDiagCodes}
        headers={["名稱", "代碼", "編碼系統", "分類"]}
        renderRow={(item) => (
          <>
            <td className="px-4 py-2">{item.name}</td>
            <td className="px-4 py-2 text-muted-foreground">{item.code ?? "—"}</td>
            <td className="px-4 py-2 text-muted-foreground">{item.coding_system ?? "—"}</td>
            <td className="px-4 py-2 text-muted-foreground">
              {diagCats.find((c) => c.id === item.category_id)?.name ?? "—"}
            </td>
          </>
        )}
        onToggleActive={(id) => toggleDiagCode.mutate(id)}
        renderForm={(item, onClose) => <DiagnosisCodeForm item={item} onClose={onClose} />}
      />

      <CatalogSection<MucousMembraneColorRead>
        title="黏膜顏色"
        items={colors}
        isLoading={loadingColors}
        headers={["名稱"]}
        renderRow={(item) => <td className="px-4 py-2">{item.name}</td>}
        onToggleActive={(id) => toggleColor.mutate(id)}
        renderForm={(item, onClose) => (
          <SimpleNameForm
            item={item}
            onClose={onClose}
            onCreate={(d) => createColor.mutateAsync(d)}
            onUpdate={(id, d) => updateColor.mutateAsync({ id, data: d })}
          />
        )}
      />
    </div>
  );
}

// ══════════════════════════════════════════════════════════════════
// Tab 2：用藥 & 處置
// ══════════════════════════════════════════════════════════════════

function PharmacyTab() {
  const qc = useQueryClient();

  const { data: medCats = [], isLoading: loadingMedCats } = useQuery({
    queryKey: ["medication-categories", true],
    queryFn: () => catalogsApi.medicationCategories(true),
  });
  const createMedCat = useMutation({
    mutationFn: catalogsApi.createMedicationCategory,
    onSuccess: () => { qc.invalidateQueries({ queryKey: ["medication-categories"] }); toast.success("已新增"); },
  });
  const updateMedCat = useMutation({
    mutationFn: ({ id, data }: { id: number; data: { name?: string } }) => catalogsApi.updateMedicationCategory(id, data),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ["medication-categories"] }); toast.success("已更新"); },
  });
  const toggleMedCat = useMutation({
    mutationFn: catalogsApi.toggleMedicationCategoryActive,
    onSuccess: () => qc.invalidateQueries({ queryKey: ["medication-categories"] }),
  });

  const { data: meds = [], isLoading: loadingMeds } = useQuery({
    queryKey: ["medications", true],
    queryFn: () => catalogsApi.medications(undefined, true),
  });
  const createMed = useMutation({
    mutationFn: catalogsApi.createMedication,
    onSuccess: () => { qc.invalidateQueries({ queryKey: ["medications"] }); toast.success("已新增"); },
  });
  const updateMed = useMutation({
    mutationFn: ({ id, data }: { id: number; data: Parameters<typeof catalogsApi.updateMedication>[1] }) =>
      catalogsApi.updateMedication(id, data),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ["medications"] }); toast.success("已更新"); },
  });
  const toggleMed = useMutation({
    mutationFn: catalogsApi.toggleMedicationActive,
    onSuccess: () => qc.invalidateQueries({ queryKey: ["medications"] }),
  });

  const { data: procCats = [], isLoading: loadingProcCats } = useQuery({
    queryKey: ["procedure-categories", true],
    queryFn: () => catalogsApi.procedureCategories(true),
  });
  const createProcCat = useMutation({
    mutationFn: catalogsApi.createProcedureCategory,
    onSuccess: () => { qc.invalidateQueries({ queryKey: ["procedure-categories"] }); toast.success("已新增"); },
  });
  const updateProcCat = useMutation({
    mutationFn: ({ id, data }: { id: number; data: { name?: string } }) => catalogsApi.updateProcedureCategory(id, data),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ["procedure-categories"] }); toast.success("已更新"); },
  });
  const toggleProcCat = useMutation({
    mutationFn: catalogsApi.toggleProcedureCategoryActive,
    onSuccess: () => qc.invalidateQueries({ queryKey: ["procedure-categories"] }),
  });

  const { data: procTypes = [], isLoading: loadingProcTypes } = useQuery({
    queryKey: ["procedure-types", true],
    queryFn: () => catalogsApi.procedureTypes(undefined, undefined, true),
  });
  const createProcType = useMutation({
    mutationFn: catalogsApi.createProcedureType,
    onSuccess: () => { qc.invalidateQueries({ queryKey: ["procedure-types"] }); toast.success("已新增"); },
  });
  const updateProcType = useMutation({
    mutationFn: ({ id, data }: { id: number; data: Parameters<typeof catalogsApi.updateProcedureType>[1] }) =>
      catalogsApi.updateProcedureType(id, data),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ["procedure-types"] }); toast.success("已更新"); },
  });
  const toggleProcType = useMutation({
    mutationFn: catalogsApi.toggleProcedureTypeActive,
    onSuccess: () => qc.invalidateQueries({ queryKey: ["procedure-types"] }),
  });

  const { data: routes = [], isLoading: loadingRoutes } = useQuery({
    queryKey: ["administration-routes", true],
    queryFn: () => catalogsApi.administrationRoutes(true),
  });
  const createRoute = useMutation({
    mutationFn: catalogsApi.createAdministrationRoute,
    onSuccess: () => { qc.invalidateQueries({ queryKey: ["administration-routes"] }); toast.success("已新增"); },
  });
  const updateRoute = useMutation({
    mutationFn: ({ id, data }: { id: number; data: { name?: string } }) => catalogsApi.updateAdministrationRoute(id, data),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ["administration-routes"] }); toast.success("已更新"); },
  });
  const toggleRoute = useMutation({
    mutationFn: catalogsApi.toggleAdministrationRouteActive,
    onSuccess: () => qc.invalidateQueries({ queryKey: ["administration-routes"] }),
  });

  function MedicationForm({ item, onClose }: { item: MedicationRead | null; onClose: () => void }) {
    const schema = z.object({
      name: z.string().min(1, "請輸入名稱").max(200),
      medication_category_id: z.preprocess(
        (v) => (v === "" || v == null ? null : Number(v)),
        z.number().int().positive().nullable().optional()
      ),
      default_dose_unit: z.string().max(30).optional(),
    });
    type Form = z.infer<typeof schema>;
    const { register, handleSubmit, formState: { errors, isSubmitting } } = useForm<Form>({
      resolver: zodResolver(schema),
      defaultValues: {
        name: item?.name ?? "",
        medication_category_id: item?.medication_category_id ?? null,
        default_dose_unit: item?.default_dose_unit ?? "",
      },
    });

    async function onSubmit(data: Form) {
      try {
        if (item) await updateMed.mutateAsync({ id: item.id, data });
        else await createMed.mutateAsync(data);
        onClose();
      } catch (e: unknown) {
        const msg = (e as { response?: { data?: { detail?: string } } })?.response?.data?.detail;
        toast.error(msg ?? "操作失敗");
      }
    }

    return (
      <form onSubmit={handleSubmit(onSubmit)} className="space-y-4 pt-2">
        <div className="space-y-1.5">
          <Label htmlFor="med-name">藥品名稱</Label>
          <Input id="med-name" {...register("name")} />
          {errors.name && <p className="text-xs text-destructive">{errors.name.message}</p>}
        </div>
        <div className="grid grid-cols-2 gap-3">
          <div className="space-y-1.5">
            <Label htmlFor="med-cat">分類（選填）</Label>
            <select id="med-cat" {...register("medication_category_id")} className="flex h-9 w-full rounded-md border border-input bg-transparent px-3 py-1 text-sm shadow-sm">
              <option value="">— 無分類 —</option>
              {medCats.filter((c) => c.is_active).map((c) => (
                <option key={c.id} value={c.id}>{c.name}</option>
              ))}
            </select>
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="med-unit">預設劑量單位（選填）</Label>
            <Input id="med-unit" {...register("default_dose_unit")} placeholder="mg / mL / tablet" />
          </div>
        </div>
        <div className="flex justify-end gap-2">
          <Button type="button" variant="outline" onClick={onClose}>取消</Button>
          <Button type="submit" disabled={isSubmitting}>{item ? "儲存" : "新增"}</Button>
        </div>
      </form>
    );
  }

  function ProcedureTypeForm({ item, onClose }: { item: ProcedureTypeRead | null; onClose: () => void }) {
    const { data: speciesList = [] } = useQuery({ queryKey: ["species", false], queryFn: () => catalogsApi.species() });
    const schema = z.object({
      name: z.string().min(1, "請輸入名稱").max(200),
      procedure_category_id: z.preprocess(
        (v) => (v === "" || v == null ? null : Number(v)),
        z.number().int().positive().nullable().optional()
      ),
      species_id: z.preprocess(
        (v) => (v === "" || v == null ? null : Number(v)),
        z.number().int().positive().nullable().optional()
      ),
    });
    type Form = z.infer<typeof schema>;
    const { register, handleSubmit, formState: { errors, isSubmitting } } = useForm<Form>({
      resolver: zodResolver(schema),
      defaultValues: {
        name: item?.name ?? "",
        procedure_category_id: item?.procedure_category_id ?? null,
        species_id: item?.species_id ?? null,
      },
    });

    async function onSubmit(data: Form) {
      try {
        if (item) await updateProcType.mutateAsync({ id: item.id, data });
        else await createProcType.mutateAsync(data);
        onClose();
      } catch (e: unknown) {
        const msg = (e as { response?: { data?: { detail?: string } } })?.response?.data?.detail;
        toast.error(msg ?? "操作失敗");
      }
    }

    return (
      <form onSubmit={handleSubmit(onSubmit)} className="space-y-4 pt-2">
        <div className="space-y-1.5">
          <Label htmlFor="pt-name">處置名稱</Label>
          <Input id="pt-name" {...register("name")} />
          {errors.name && <p className="text-xs text-destructive">{errors.name.message}</p>}
        </div>
        <div className="grid grid-cols-2 gap-3">
          <div className="space-y-1.5">
            <Label htmlFor="pt-cat">分類（選填）</Label>
            <select id="pt-cat" {...register("procedure_category_id")} className="flex h-9 w-full rounded-md border border-input bg-transparent px-3 py-1 text-sm shadow-sm">
              <option value="">— 無分類 —</option>
              {procCats.filter((c) => c.is_active).map((c) => (
                <option key={c.id} value={c.id}>{c.name}</option>
              ))}
            </select>
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="pt-species">適用物種（選填）</Label>
            <select id="pt-species" {...register("species_id")} className="flex h-9 w-full rounded-md border border-input bg-transparent px-3 py-1 text-sm shadow-sm">
              <option value="">— 跨物種通用 —</option>
              {speciesList.map((s) => (
                <option key={s.id} value={s.id}>{s.name}</option>
              ))}
            </select>
          </div>
        </div>
        <div className="flex justify-end gap-2">
          <Button type="button" variant="outline" onClick={onClose}>取消</Button>
          <Button type="submit" disabled={isSubmitting}>{item ? "儲存" : "新增"}</Button>
        </div>
      </form>
    );
  }

  return (
    <div className="space-y-8">
      <CatalogSection<MedicationCategoryRead>
        title="藥品分類"
        items={medCats}
        isLoading={loadingMedCats}
        headers={["名稱"]}
        renderRow={(item) => <td className="px-4 py-2">{item.name}</td>}
        onToggleActive={(id) => toggleMedCat.mutate(id)}
        renderForm={(item, onClose) => (
          <SimpleNameForm
            item={item}
            onClose={onClose}
            onCreate={(d) => createMedCat.mutateAsync(d)}
            onUpdate={(id, d) => updateMedCat.mutateAsync({ id, data: d })}
          />
        )}
      />

      <CatalogSection<MedicationRead>
        title="藥品"
        items={meds}
        isLoading={loadingMeds}
        headers={["名稱", "分類", "預設單位"]}
        renderRow={(item) => (
          <>
            <td className="px-4 py-2">{item.name}</td>
            <td className="px-4 py-2 text-muted-foreground">
              {medCats.find((c) => c.id === item.medication_category_id)?.name ?? "—"}
            </td>
            <td className="px-4 py-2 text-muted-foreground">{item.default_dose_unit ?? "—"}</td>
          </>
        )}
        onToggleActive={(id) => toggleMed.mutate(id)}
        renderForm={(item, onClose) => <MedicationForm item={item} onClose={onClose} />}
      />

      <CatalogSection<ProcedureCategoryRead>
        title="處置分類"
        items={procCats}
        isLoading={loadingProcCats}
        headers={["名稱"]}
        renderRow={(item) => <td className="px-4 py-2">{item.name}</td>}
        onToggleActive={(id) => toggleProcCat.mutate(id)}
        renderForm={(item, onClose) => (
          <SimpleNameForm
            item={item}
            onClose={onClose}
            onCreate={(d) => createProcCat.mutateAsync(d)}
            onUpdate={(id, d) => updateProcCat.mutateAsync({ id, data: d })}
          />
        )}
      />

      <CatalogSection<ProcedureTypeRead>
        title="處置項目"
        items={procTypes}
        isLoading={loadingProcTypes}
        headers={["名稱", "分類"]}
        renderRow={(item) => (
          <>
            <td className="px-4 py-2">{item.name}</td>
            <td className="px-4 py-2 text-muted-foreground">
              {procCats.find((c) => c.id === item.procedure_category_id)?.name ?? "—"}
            </td>
          </>
        )}
        onToggleActive={(id) => toggleProcType.mutate(id)}
        renderForm={(item, onClose) => <ProcedureTypeForm item={item} onClose={onClose} />}
      />

      <CatalogSection<AdministrationRouteRead>
        title="給藥途徑"
        items={routes}
        isLoading={loadingRoutes}
        headers={["名稱"]}
        renderRow={(item) => <td className="px-4 py-2">{item.name}</td>}
        onToggleActive={(id) => toggleRoute.mutate(id)}
        renderForm={(item, onClose) => (
          <SimpleNameForm
            item={item}
            onClose={onClose}
            onCreate={(d) => createRoute.mutateAsync(d)}
            onUpdate={(id, d) => updateRoute.mutateAsync({ id, data: d })}
          />
        )}
      />
    </div>
  );
}

// ══════════════════════════════════════════════════════════════════
// Tab 3：檢驗目錄
// ══════════════════════════════════════════════════════════════════

function LabTab() {
  const qc = useQueryClient();

  const { data: labCats = [], isLoading: loadingLabCats } = useQuery({
    queryKey: ["lab-categories", true],
    queryFn: () => catalogsApi.labCategories(true),
  });
  const createLabCat = useMutation({
    mutationFn: catalogsApi.createLabCategory,
    onSuccess: () => { qc.invalidateQueries({ queryKey: ["lab-categories"] }); toast.success("已新增"); },
  });
  const updateLabCat = useMutation({
    mutationFn: ({ id, data }: { id: number; data: { name?: string } }) => catalogsApi.updateLabCategory(id, data),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ["lab-categories"] }); toast.success("已更新"); },
  });
  const toggleLabCat = useMutation({
    mutationFn: catalogsApi.toggleLabCategoryActive,
    onSuccess: () => qc.invalidateQueries({ queryKey: ["lab-categories"] }),
  });

  const { data: labTestTypes = [], isLoading: loadingLabTypes } = useQuery({
    queryKey: ["lab-test-types", true],
    queryFn: () => catalogsApi.labTestTypes(undefined, true),
  });
  const createLabType = useMutation({
    mutationFn: catalogsApi.createLabTestType,
    onSuccess: () => { qc.invalidateQueries({ queryKey: ["lab-test-types"] }); toast.success("已新增"); },
  });
  const updateLabType = useMutation({
    mutationFn: ({ id, data }: { id: number; data: Parameters<typeof catalogsApi.updateLabTestType>[1] }) =>
      catalogsApi.updateLabTestType(id, data),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ["lab-test-types"] }); toast.success("已更新"); },
  });
  const toggleLabType = useMutation({
    mutationFn: catalogsApi.toggleLabTestTypeActive,
    onSuccess: () => qc.invalidateQueries({ queryKey: ["lab-test-types"] }),
  });

  const { data: labAnalytes = [], isLoading: loadingLabAnalytes } = useQuery({
    queryKey: ["lab-analytes", true],
    queryFn: () => catalogsApi.labAnalytes(undefined, true),
  });
  const createLabAnalyte = useMutation({
    mutationFn: catalogsApi.createLabAnalyte,
    onSuccess: () => { qc.invalidateQueries({ queryKey: ["lab-analytes"] }); toast.success("已新增"); },
  });
  const updateLabAnalyte = useMutation({
    mutationFn: ({ id, data }: { id: number; data: Parameters<typeof catalogsApi.updateLabAnalyte>[1] }) =>
      catalogsApi.updateLabAnalyte(id, data),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ["lab-analytes"] }); toast.success("已更新"); },
  });
  const toggleLabAnalyte = useMutation({
    mutationFn: catalogsApi.toggleLabAnalyteActive,
    onSuccess: () => qc.invalidateQueries({ queryKey: ["lab-analytes"] }),
  });

  function LabTestTypeForm({ item, onClose }: { item: LabTestTypeRead | null; onClose: () => void }) {
    const schema = z.object({
      name: z.string().min(1, "請輸入名稱").max(200),
      lab_category_id: z.preprocess((v) => Number(v), z.number().int().positive("請選擇分類")),
    });
    type Form = z.infer<typeof schema>;
    const { register, handleSubmit, formState: { errors, isSubmitting } } = useForm<Form>({
      resolver: zodResolver(schema),
      defaultValues: { name: item?.name ?? "", lab_category_id: item?.lab_category_id ?? 0 },
    });
    async function onSubmit(data: Form) {
      try {
        if (item) await updateLabType.mutateAsync({ id: item.id, data });
        else await createLabType.mutateAsync(data);
        onClose();
      } catch (e: unknown) {
        const msg = (e as { response?: { data?: { detail?: string } } })?.response?.data?.detail;
        toast.error(msg ?? "操作失敗");
      }
    }
    return (
      <form onSubmit={handleSubmit(onSubmit)} className="space-y-4 pt-2">
        <div className="space-y-1.5">
          <Label htmlFor="ltt-name">名稱</Label>
          <Input id="ltt-name" {...register("name")} />
          {errors.name && <p className="text-xs text-destructive">{errors.name.message}</p>}
        </div>
        <div className="space-y-1.5">
          <Label htmlFor="ltt-cat">檢驗分類</Label>
          <select id="ltt-cat" {...register("lab_category_id")} className="flex h-9 w-full rounded-md border border-input bg-transparent px-3 py-1 text-sm shadow-sm">
            <option value="">— 請選擇 —</option>
            {labCats.filter((c) => c.is_active).map((c) => (
              <option key={c.id} value={c.id}>{c.name}</option>
            ))}
          </select>
          {errors.lab_category_id && <p className="text-xs text-destructive">{errors.lab_category_id.message}</p>}
        </div>
        <div className="flex justify-end gap-2">
          <Button type="button" variant="outline" onClick={onClose}>取消</Button>
          <Button type="submit" disabled={isSubmitting}>{item ? "儲存" : "新增"}</Button>
        </div>
      </form>
    );
  }

  function LabAnalyteForm({ item, onClose }: { item: LabAnalyteRead | null; onClose: () => void }) {
    const schema = z.object({
      name: z.string().min(1, "請輸入名稱").max(100),
      lab_test_type_id: z.preprocess((v) => Number(v), z.number().int().positive("請選擇檢驗類型")),
      unit: z.string().max(30).optional(),
      analyte_type: z.enum(["numeric", "text"]).default("numeric"),
      sort_order: z.preprocess((v) => Number(v), z.number().int().min(0)).default(0),
    });
    type Form = z.infer<typeof schema>;
    const { register, handleSubmit, formState: { errors, isSubmitting } } = useForm<Form>({
      resolver: zodResolver(schema),
      defaultValues: {
        name: item?.name ?? "",
        lab_test_type_id: item?.lab_test_type_id ?? 0,
        unit: item?.unit ?? "",
        analyte_type: item?.analyte_type ?? "numeric",
        sort_order: item?.sort_order ?? 0,
      },
    });
    async function onSubmit(data: Form) {
      try {
        if (item) await updateLabAnalyte.mutateAsync({ id: item.id, data });
        else await createLabAnalyte.mutateAsync(data);
        onClose();
      } catch (e: unknown) {
        const msg = (e as { response?: { data?: { detail?: string } } })?.response?.data?.detail;
        toast.error(msg ?? "操作失敗");
      }
    }
    return (
      <form onSubmit={handleSubmit(onSubmit)} className="space-y-4 pt-2">
        <div className="space-y-1.5">
          <Label htmlFor="la-name">指標名稱</Label>
          <Input id="la-name" {...register("name")} />
          {errors.name && <p className="text-xs text-destructive">{errors.name.message}</p>}
        </div>
        <div className="space-y-1.5">
          <Label htmlFor="la-type">檢驗類型</Label>
          <select id="la-type" {...register("lab_test_type_id")} className="flex h-9 w-full rounded-md border border-input bg-transparent px-3 py-1 text-sm shadow-sm">
            <option value="">— 請選擇 —</option>
            {labTestTypes.filter((t) => t.is_active).map((t) => (
              <option key={t.id} value={t.id}>{t.name}</option>
            ))}
          </select>
          {errors.lab_test_type_id && <p className="text-xs text-destructive">{errors.lab_test_type_id.message}</p>}
        </div>
        <div className="grid grid-cols-3 gap-3">
          <div className="space-y-1.5">
            <Label htmlFor="la-unit">單位（選填）</Label>
            <Input id="la-unit" {...register("unit")} placeholder="mg/dL" />
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="la-analyte-type">類型</Label>
            <select id="la-analyte-type" {...register("analyte_type")} className="flex h-9 w-full rounded-md border border-input bg-transparent px-3 py-1 text-sm shadow-sm">
              <option value="numeric">數值</option>
              <option value="text">文字</option>
            </select>
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="la-sort">排序</Label>
            <Input id="la-sort" type="number" {...register("sort_order")} />
          </div>
        </div>
        <div className="flex justify-end gap-2">
          <Button type="button" variant="outline" onClick={onClose}>取消</Button>
          <Button type="submit" disabled={isSubmitting}>{item ? "儲存" : "新增"}</Button>
        </div>
      </form>
    );
  }

  return (
    <div className="space-y-8">
      <CatalogSection<LabCategoryRead>
        title="檢驗分類"
        items={labCats}
        isLoading={loadingLabCats}
        headers={["名稱"]}
        renderRow={(item) => <td className="px-4 py-2">{item.name}</td>}
        onToggleActive={(id) => toggleLabCat.mutate(id)}
        renderForm={(item, onClose) => (
          <SimpleNameForm
            item={item}
            onClose={onClose}
            onCreate={(d) => createLabCat.mutateAsync(d)}
            onUpdate={(id, d) => updateLabCat.mutateAsync({ id, data: d })}
          />
        )}
      />

      <CatalogSection<LabTestTypeRead>
        title="檢驗類型"
        items={labTestTypes}
        isLoading={loadingLabTypes}
        headers={["名稱", "分類"]}
        renderRow={(item) => (
          <>
            <td className="px-4 py-2">{item.name}</td>
            <td className="px-4 py-2 text-muted-foreground">
              {labCats.find((c) => c.id === item.lab_category_id)?.name ?? "—"}
            </td>
          </>
        )}
        onToggleActive={(id) => toggleLabType.mutate(id)}
        renderForm={(item, onClose) => <LabTestTypeForm item={item} onClose={onClose} />}
      />

      <CatalogSection<LabAnalyteRead>
        title="檢驗指標"
        items={labAnalytes}
        isLoading={loadingLabAnalytes}
        headers={["名稱", "所屬類型", "單位", "類型", "排序"]}
        renderRow={(item) => (
          <>
            <td className="px-4 py-2">{item.name}</td>
            <td className="px-4 py-2 text-muted-foreground">
              {labTestTypes.find((t) => t.id === item.lab_test_type_id)?.name ?? "—"}
            </td>
            <td className="px-4 py-2 text-muted-foreground">{item.unit ?? "—"}</td>
            <td className="px-4 py-2 text-muted-foreground">{item.analyte_type === "numeric" ? "數值" : "文字"}</td>
            <td className="px-4 py-2 text-muted-foreground">{item.sort_order}</td>
          </>
        )}
        onToggleActive={(id) => toggleLabAnalyte.mutate(id)}
        renderForm={(item, onClose) => <LabAnalyteForm item={item} onClose={onClose} />}
      />
    </div>
  );
}

// ══════════════════════════════════════════════════════════════════
// Tab 4：生物 & 其他
// ══════════════════════════════════════════════════════════════════

function BioTab() {
  const qc = useQueryClient();

  const { data: speciesList = [], isLoading: loadingSpecies } = useQuery({
    queryKey: ["species", true],
    queryFn: () => catalogsApi.species(true),
  });
  const createSpecies = useMutation({
    mutationFn: catalogsApi.createSpecies,
    onSuccess: () => { qc.invalidateQueries({ queryKey: ["species"] }); toast.success("已新增"); },
  });
  const updateSpecies = useMutation({
    mutationFn: ({ id, data }: { id: number; data: { name?: string } }) => catalogsApi.updateSpecies(id, data),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ["species"] }); toast.success("已更新"); },
  });
  const toggleSpecies = useMutation({
    mutationFn: catalogsApi.toggleSpeciesActive,
    onSuccess: () => qc.invalidateQueries({ queryKey: ["species"] }),
  });

  // Breeds — 展示所有品種（含所屬物種名）
  const allBreeds = speciesList.flatMap((s) => s.breeds.map((b) => ({ ...b, speciesName: s.name })));
  const createBreed = useMutation({
    mutationFn: catalogsApi.createBreed,
    onSuccess: () => { qc.invalidateQueries({ queryKey: ["species"] }); toast.success("已新增"); },
  });
  const updateBreed = useMutation({
    mutationFn: ({ id, data }: { id: number; data: { name?: string } }) => catalogsApi.updateBreed(id, data),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ["species"] }); toast.success("已更新"); },
  });
  const toggleBreed = useMutation({
    mutationFn: catalogsApi.toggleBreedActive,
    onSuccess: () => qc.invalidateQueries({ queryKey: ["species"] }),
  });

  const { data: bloodTypes = [], isLoading: loadingBloodTypes } = useQuery({
    queryKey: ["blood-types", true],
    queryFn: () => catalogsApi.bloodTypes(undefined, true),
  });
  const createBloodType = useMutation({
    mutationFn: catalogsApi.createBloodType,
    onSuccess: () => { qc.invalidateQueries({ queryKey: ["blood-types"] }); toast.success("已新增"); },
  });
  const updateBloodType = useMutation({
    mutationFn: ({ id, data }: { id: number; data: Parameters<typeof catalogsApi.updateBloodType>[1] }) =>
      catalogsApi.updateBloodType(id, data),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ["blood-types"] }); toast.success("已更新"); },
  });
  const toggleBloodType = useMutation({
    mutationFn: catalogsApi.toggleBloodTypeActive,
    onSuccess: () => qc.invalidateQueries({ queryKey: ["blood-types"] }),
  });

  const { data: contactTypes = [], isLoading: loadingContactTypes } = useQuery({
    queryKey: ["contact-types", true],
    queryFn: () => catalogsApi.contactTypes(true),
  });
  const createContactType = useMutation({
    mutationFn: catalogsApi.createContactType,
    onSuccess: () => { qc.invalidateQueries({ queryKey: ["contact-types"] }); toast.success("已新增"); },
  });
  const updateContactType = useMutation({
    mutationFn: ({ id, data }: { id: number; data: Parameters<typeof catalogsApi.updateContactType>[1] }) =>
      catalogsApi.updateContactType(id, data),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ["contact-types"] }); toast.success("已更新"); },
  });
  const toggleContactType = useMutation({
    mutationFn: catalogsApi.toggleContactTypeActive,
    onSuccess: () => qc.invalidateQueries({ queryKey: ["contact-types"] }),
  });

  function BreedForm({ item, onClose }: { item: (BreedRead & { speciesName: string }) | null; onClose: () => void }) {
    const schema = z.object({
      name: z.string().min(1, "請輸入品種名稱").max(100),
      species_id: z.preprocess((v) => Number(v), z.number().int().positive("請選擇物種")),
    });
    type Form = z.infer<typeof schema>;
    const { register, handleSubmit, formState: { errors, isSubmitting } } = useForm<Form>({
      resolver: zodResolver(schema),
      defaultValues: { name: item?.name ?? "", species_id: item?.species_id ?? 0 },
    });
    async function onSubmit(data: Form) {
      try {
        if (item) await updateBreed.mutateAsync({ id: item.id, data });
        else await createBreed.mutateAsync(data);
        onClose();
      } catch (e: unknown) {
        const msg = (e as { response?: { data?: { detail?: string } } })?.response?.data?.detail;
        toast.error(msg ?? "操作失敗");
      }
    }
    return (
      <form onSubmit={handleSubmit(onSubmit)} className="space-y-4 pt-2">
        <div className="space-y-1.5">
          <Label htmlFor="breed-name">品種名稱</Label>
          <Input id="breed-name" {...register("name")} />
          {errors.name && <p className="text-xs text-destructive">{errors.name.message}</p>}
        </div>
        <div className="space-y-1.5">
          <Label htmlFor="breed-sp">所屬物種</Label>
          <select id="breed-sp" {...register("species_id")} className="flex h-9 w-full rounded-md border border-input bg-transparent px-3 py-1 text-sm shadow-sm">
            <option value="">— 請選擇 —</option>
            {speciesList.filter((s) => s.is_active).map((s) => (
              <option key={s.id} value={s.id}>{s.name}</option>
            ))}
          </select>
          {errors.species_id && <p className="text-xs text-destructive">{errors.species_id.message}</p>}
        </div>
        <div className="flex justify-end gap-2">
          <Button type="button" variant="outline" onClick={onClose}>取消</Button>
          <Button type="submit" disabled={isSubmitting}>{item ? "儲存" : "新增"}</Button>
        </div>
      </form>
    );
  }

  function BloodTypeForm({ item, onClose }: { item: BloodTypeRead | null; onClose: () => void }) {
    const schema = z.object({
      code: z.string().min(1, "請輸入代碼").max(20),
      display_name: z.string().min(1, "請輸入顯示名稱").max(100),
      species_id: z.preprocess((v) => Number(v), z.number().int().positive("請選擇物種")),
    });
    type Form = z.infer<typeof schema>;
    const { register, handleSubmit, formState: { errors, isSubmitting } } = useForm<Form>({
      resolver: zodResolver(schema),
      defaultValues: {
        code: item?.code ?? "",
        display_name: item?.display_name ?? "",
        species_id: item?.species_id ?? 0,
      },
    });
    async function onSubmit(data: Form) {
      try {
        if (item) await updateBloodType.mutateAsync({ id: item.id, data: { display_name: data.display_name } });
        else await createBloodType.mutateAsync(data);
        onClose();
      } catch (e: unknown) {
        const msg = (e as { response?: { data?: { detail?: string } } })?.response?.data?.detail;
        toast.error(msg ?? "操作失敗");
      }
    }
    return (
      <form onSubmit={handleSubmit(onSubmit)} className="space-y-4 pt-2">
        <div className="space-y-1.5">
          <Label htmlFor="bt-species">物種</Label>
          <select id="bt-species" {...register("species_id")} disabled={!!item} className="flex h-9 w-full rounded-md border border-input bg-transparent px-3 py-1 text-sm shadow-sm disabled:opacity-50">
            <option value="">— 請選擇 —</option>
            {speciesList.filter((s) => s.is_active).map((s) => (
              <option key={s.id} value={s.id}>{s.name}</option>
            ))}
          </select>
          {errors.species_id && <p className="text-xs text-destructive">{errors.species_id.message}</p>}
        </div>
        <div className="grid grid-cols-2 gap-3">
          <div className="space-y-1.5">
            <Label htmlFor="bt-code">代碼</Label>
            <Input id="bt-code" {...register("code")} disabled={!!item} className="disabled:opacity-50" placeholder="A / DEA 1.1+" />
            {errors.code && <p className="text-xs text-destructive">{errors.code.message}</p>}
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="bt-display">顯示名稱</Label>
            <Input id="bt-display" {...register("display_name")} placeholder="A 型 / DEA 1.1 陽性" />
            {errors.display_name && <p className="text-xs text-destructive">{errors.display_name.message}</p>}
          </div>
        </div>
        <div className="flex justify-end gap-2">
          <Button type="button" variant="outline" onClick={onClose}>取消</Button>
          <Button type="submit" disabled={isSubmitting}>{item ? "儲存" : "新增"}</Button>
        </div>
      </form>
    );
  }

  function ContactTypeForm({ item, onClose }: { item: ContactTypeRead | null; onClose: () => void }) {
    const schema = z.object({
      type_key: z.string().min(1).max(30),
      display_name: z.string().min(1, "請輸入顯示名稱").max(50),
    });
    type Form = z.infer<typeof schema>;
    const { register, handleSubmit, formState: { errors, isSubmitting } } = useForm<Form>({
      resolver: zodResolver(schema),
      defaultValues: { type_key: item?.type_key ?? "", display_name: item?.display_name ?? "" },
    });
    async function onSubmit(data: Form) {
      try {
        if (item) await updateContactType.mutateAsync({ id: item.id, data: { display_name: data.display_name } });
        else await createContactType.mutateAsync(data);
        onClose();
      } catch (e: unknown) {
        const msg = (e as { response?: { data?: { detail?: string } } })?.response?.data?.detail;
        toast.error(msg ?? "操作失敗");
      }
    }
    return (
      <form onSubmit={handleSubmit(onSubmit)} className="space-y-4 pt-2">
        <div className="grid grid-cols-2 gap-3">
          <div className="space-y-1.5">
            <Label htmlFor="ct-key">識別碼（type_key）</Label>
            <Input id="ct-key" {...register("type_key")} disabled={!!item} className="disabled:opacity-50" placeholder="phone / line / email" />
            {errors.type_key && <p className="text-xs text-destructive">{errors.type_key.message}</p>}
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="ct-display">顯示名稱</Label>
            <Input id="ct-display" {...register("display_name")} placeholder="手機 / LINE / 電子郵件" />
            {errors.display_name && <p className="text-xs text-destructive">{errors.display_name.message}</p>}
          </div>
        </div>
        <div className="flex justify-end gap-2">
          <Button type="button" variant="outline" onClick={onClose}>取消</Button>
          <Button type="submit" disabled={isSubmitting}>{item ? "儲存" : "新增"}</Button>
        </div>
      </form>
    );
  }

  const breedItems = allBreeds as (BreedRead & { speciesName: string })[];

  return (
    <div className="space-y-8">
      <CatalogSection<SpeciesRead>
        title="物種"
        items={speciesList}
        isLoading={loadingSpecies}
        headers={["名稱"]}
        renderRow={(item) => <td className="px-4 py-2">{item.name}</td>}
        onToggleActive={(id) => toggleSpecies.mutate(id)}
        renderForm={(item, onClose) => (
          <SimpleNameForm
            item={item}
            onClose={onClose}
            onCreate={(d) => createSpecies.mutateAsync(d)}
            onUpdate={(id, d) => updateSpecies.mutateAsync({ id, data: d })}
          />
        )}
      />

      <CatalogSection<BreedRead & { speciesName: string }>
        title="品種"
        items={breedItems}
        headers={["品種名稱", "物種"]}
        renderRow={(item) => (
          <>
            <td className="px-4 py-2">{item.name}</td>
            <td className="px-4 py-2 text-muted-foreground">{item.speciesName}</td>
          </>
        )}
        onToggleActive={(id) => toggleBreed.mutate(id)}
        renderForm={(item, onClose) => <BreedForm item={item} onClose={onClose} />}
      />

      <CatalogSection<BloodTypeRead>
        title="血型"
        items={bloodTypes}
        isLoading={loadingBloodTypes}
        headers={["代碼", "顯示名稱", "物種"]}
        renderRow={(item) => (
          <>
            <td className="px-4 py-2">{item.code}</td>
            <td className="px-4 py-2">{item.display_name}</td>
            <td className="px-4 py-2 text-muted-foreground">
              {speciesList.find((s) => s.id === item.species_id)?.name ?? "—"}
            </td>
          </>
        )}
        onToggleActive={(id) => toggleBloodType.mutate(id)}
        renderForm={(item, onClose) => <BloodTypeForm item={item} onClose={onClose} />}
      />

      <CatalogSection<ContactTypeRead>
        title="聯絡方式類型"
        items={contactTypes}
        isLoading={loadingContactTypes}
        headers={["識別碼", "顯示名稱"]}
        renderRow={(item) => (
          <>
            <td className="px-4 py-2 font-mono text-xs">{item.type_key}</td>
            <td className="px-4 py-2">{item.display_name}</td>
          </>
        )}
        onToggleActive={(id) => toggleContactType.mutate(id)}
        renderForm={(item, onClose) => <ContactTypeForm item={item} onClose={onClose} />}
      />
    </div>
  );
}

// ══════════════════════════════════════════════════════════════════
// 主頁面
// ══════════════════════════════════════════════════════════════════

export default function TerminologyPage() {
  const [activeTab, setActiveTab] = useState("clinical");

  return (
    <div className="container py-8 space-y-6">
      <div>
        <h1 className="text-xl font-semibold">術語目錄管理</h1>
        <p className="text-sm text-muted-foreground mt-0.5">管理診所使用的臨床術語、藥品、處置項目與生物資料目錄</p>
      </div>

      <Tabs value={activeTab} onValueChange={setActiveTab}>
        <TabsList className="grid grid-cols-4 w-full max-w-lg">
          <TabsTrigger value="clinical">臨床術語</TabsTrigger>
          <TabsTrigger value="pharmacy">用藥 & 處置</TabsTrigger>
          <TabsTrigger value="lab">檢驗目錄</TabsTrigger>
          <TabsTrigger value="bio">生物 & 其他</TabsTrigger>
        </TabsList>

        <TabsContent value="clinical" className="mt-6">
          <ClinicalTab />
        </TabsContent>
        <TabsContent value="pharmacy" className="mt-6">
          <PharmacyTab />
        </TabsContent>
        <TabsContent value="lab" className="mt-6">
          <LabTab />
        </TabsContent>
        <TabsContent value="bio" className="mt-6">
          <BioTab />
        </TabsContent>
      </Tabs>
    </div>
  );
}
