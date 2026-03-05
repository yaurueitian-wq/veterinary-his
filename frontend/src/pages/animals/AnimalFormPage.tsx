import { useEffect } from "react";
import { useNavigate, useParams } from "react-router-dom";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";

import { animalsApi, ownersApi, SEX_LABELS } from "@/api/owners";
import { catalogsApi } from "@/api/catalogs";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Alert, AlertDescription } from "@/components/ui/alert";

// ── Zod Schema ────────────────────────────────────────────

const formSchema = z.object({
  name: z.string().min(1, "請輸入動物名稱"),
  species_id: z.number({ required_error: "請選擇物種" }),
  breed_id: z.number().nullable().optional(),
  sex: z.string().min(1, "請選擇性別"),
  date_of_birth: z.string().optional(),
  birth_year: z.number().int().min(1900).max(2100).nullable().optional(),
  microchip_number: z.string().optional(),
  color: z.string().optional(),
  notes: z.string().optional(),
});

type FormValues = z.infer<typeof formSchema>;

export default function AnimalFormPage() {
  // ownerId：新增模式；animalId：編輯模式
  const { ownerId, animalId } = useParams<{
    ownerId?: string;
    animalId?: string;
  }>();
  const isEdit = Boolean(animalId);
  const navigate = useNavigate();
  const queryClient = useQueryClient();

  // 編輯模式：載入現有動物資料
  const { data: existing } = useQuery({
    queryKey: ["animal", animalId],
    queryFn: () => animalsApi.get(Number(animalId)),
    enabled: isEdit,
  });

  // 物種 + 品種清單
  const { data: speciesList = [] } = useQuery({
    queryKey: ["species"],
    queryFn: catalogsApi.species,
  });

  const {
    register,
    handleSubmit,
    watch,
    reset,
    setValue,
    formState: { errors, isSubmitting },
  } = useForm<FormValues>({
    resolver: zodResolver(formSchema),
    defaultValues: { sex: "unknown" },
  });

  const selectedSpeciesId = watch("species_id");
  const availableBreeds =
    speciesList.find((s) => s.id === selectedSpeciesId)?.breeds ?? [];

  // 換物種時清空品種
  useEffect(() => {
    setValue("breed_id", null);
  }, [selectedSpeciesId, setValue]);

  // 編輯模式：資料載入後填入
  useEffect(() => {
    if (existing) {
      reset({
        name: existing.name,
        species_id: existing.species_id,
        breed_id: existing.breed_id ?? null,
        sex: existing.sex,
        date_of_birth: existing.date_of_birth ?? "",
        birth_year: existing.birth_year ?? null,
        microchip_number: existing.microchip_number ?? "",
        color: existing.color ?? "",
        notes: existing.notes ?? "",
      });
    }
  }, [existing, reset]);

  const mutation = useMutation({
    mutationFn: (data: FormValues) => {
      const payload = {
        name: data.name,
        species_id: data.species_id,
        breed_id: data.breed_id ?? undefined,
        sex: data.sex,
        date_of_birth: data.date_of_birth || undefined,
        birth_year: data.birth_year ?? undefined,
        microchip_number: data.microchip_number || undefined,
        color: data.color || undefined,
        notes: data.notes || undefined,
      };
      return isEdit
        ? animalsApi.update(Number(animalId), payload)
        : ownersApi.createAnimal(Number(ownerId), payload);
    },
    onSuccess: (animal) => {
      const targetOwnerId = isEdit ? animal.owner_id : Number(ownerId);
      queryClient.invalidateQueries({ queryKey: ["owner", String(targetOwnerId)] });
      navigate(`/owners/${targetOwnerId}`);
    },
  });

  return (
    <div className="container py-6 max-w-2xl space-y-4">
      <div className="flex items-center gap-3">
        <Button variant="ghost" size="sm" onClick={() => navigate(-1)}>
          ← 返回
        </Button>
        <h1 className="text-xl font-semibold">
          {isEdit ? "編輯動物" : "新增動物"}
        </h1>
      </div>

      <form
        onSubmit={handleSubmit((data) => mutation.mutate(data))}
        className="space-y-4"
      >
        {mutation.isError && (
          <Alert variant="destructive">
            <AlertDescription>儲存失敗，請再試一次</AlertDescription>
          </Alert>
        )}

        <Card>
          <CardHeader>
            <CardTitle className="text-base">基本資料</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            {/* 名字 */}
            <div className="space-y-2">
              <Label htmlFor="name">名字 *</Label>
              <Input id="name" {...register("name")} />
              {errors.name && (
                <p className="text-sm text-destructive">{errors.name.message}</p>
              )}
            </div>

            {/* 物種 + 品種 */}
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-2">
                <Label htmlFor="species_id">物種 *</Label>
                <select
                  id="species_id"
                  className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm"
                  {...register("species_id", { valueAsNumber: true })}
                >
                  <option value="">請選擇…</option>
                  {speciesList.map((s) => (
                    <option key={s.id} value={s.id}>
                      {s.name}
                    </option>
                  ))}
                </select>
                {errors.species_id && (
                  <p className="text-sm text-destructive">
                    {errors.species_id.message}
                  </p>
                )}
              </div>

              <div className="space-y-2">
                <Label htmlFor="breed_id">
                  品種
                  {availableBreeds.length === 0 && (
                    <span className="text-xs text-muted-foreground ml-1">
                      （無資料）
                    </span>
                  )}
                </Label>
                <select
                  id="breed_id"
                  disabled={availableBreeds.length === 0}
                  className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm disabled:opacity-50"
                  {...register("breed_id", { valueAsNumber: true })}
                >
                  <option value="">不指定</option>
                  {availableBreeds.map((b) => (
                    <option key={b.id} value={b.id}>
                      {b.name}
                    </option>
                  ))}
                </select>
              </div>
            </div>

            {/* 性別 */}
            <div className="space-y-2">
              <Label htmlFor="sex">性別 *</Label>
              <select
                id="sex"
                className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm"
                {...register("sex")}
              >
                {Object.entries(SEX_LABELS).map(([val, label]) => (
                  <option key={val} value={val}>
                    {label}
                  </option>
                ))}
              </select>
            </div>

            {/* 生日 / 出生年份 */}
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-2">
                <Label htmlFor="date_of_birth">生日（精確）</Label>
                <Input
                  id="date_of_birth"
                  type="date"
                  {...register("date_of_birth")}
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="birth_year">出生年份（僅知年份）</Label>
                <Input
                  id="birth_year"
                  type="number"
                  placeholder="例：2020"
                  {...register("birth_year", { valueAsNumber: true })}
                />
              </div>
            </div>

            {/* 晶片 + 毛色 */}
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-2">
                <Label htmlFor="microchip_number">晶片號碼</Label>
                <Input
                  id="microchip_number"
                  {...register("microchip_number")}
                  className="font-mono"
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="color">毛色 / 外觀</Label>
                <Input id="color" {...register("color")} />
              </div>
            </div>

            {/* 備註 */}
            <div className="space-y-2">
              <Label htmlFor="notes">備註</Label>
              <Input id="notes" {...register("notes")} />
            </div>
          </CardContent>
        </Card>

        <div className="flex gap-2 justify-end">
          <Button type="button" variant="outline" onClick={() => navigate(-1)}>
            取消
          </Button>
          <Button type="submit" disabled={isSubmitting || mutation.isPending}>
            {mutation.isPending ? "儲存中…" : "儲存"}
          </Button>
        </div>
      </form>
    </div>
  );
}
