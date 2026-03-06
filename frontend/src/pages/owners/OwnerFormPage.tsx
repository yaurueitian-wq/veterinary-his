import { useEffect } from "react";
import { useNavigate, useParams } from "react-router-dom";
import { useFieldArray, useForm, useWatch } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Plus, Trash2 } from "lucide-react";

import { ownersApi, SEX_LABELS } from "@/api/owners";
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

// ── 聯絡方式格式設定（依 type_key）────────────────────────

const CONTACT_CONFIG: Record<string, {
  placeholder: string;
  inputType: string;
  validate: (v: string) => true | string;
}> = {
  phone: {
    placeholder: "例：0912-345-678",
    inputType: "tel",
    validate: (v) =>
      /^(\+?886|0)[0-9\s\-]{7,13}$/.test(v)
        ? true
        : "請輸入有效的電話號碼（如：0912-345-678）",
  },
  email: {
    placeholder: "例：owner@example.com",
    inputType: "email",
    validate: (v) =>
      /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(v)
        ? true
        : "請輸入有效的 Email 格式",
  },
  line: {
    placeholder: "例：line_id_123",
    inputType: "text",
    validate: (v) =>
      /^[a-zA-Z0-9._-]{4,20}$/.test(v)
        ? true
        : "LINE ID 為 4–20 位英數字（可含 . _ -）",
  },
  other: {
    placeholder: "例：Facebook 帳號、地址…",
    inputType: "text",
    validate: () => true,
  },
};

// ── Zod Schema ────────────────────────────────────────────

const contactSchema = z.object({
  contact_type_id: z.number({ required_error: "請選擇類型" }),
  value: z.string().min(1, "請輸入聯絡資料"),
  is_primary: z.boolean(),
});

const animalSchema = z.object({
  name: z.string().min(1, "請輸入寵物名稱"),
  species_id: z.number({ required_error: "請選擇物種" }),
  breed_id: z.number().nullable().optional(),
  sex: z.string().min(1),
  date_of_birth: z.string().optional(),
  microchip_number: z.string().optional(),
});

const formSchema = z.object({
  full_name: z.string().min(1, "請輸入姓名"),
  national_id: z.string().optional(),
  notes: z.string().optional(),
  contacts: z.array(contactSchema),
  animals: z.array(animalSchema),
});

type FormValues = z.infer<typeof formSchema>;

export default function OwnerFormPage() {
  const { id } = useParams<{ id: string }>();
  const isEdit = Boolean(id);
  const navigate = useNavigate();
  const queryClient = useQueryClient();

  // 編輯模式：載入現有資料
  const { data: existing } = useQuery({
    queryKey: ["owner", id],
    queryFn: () => ownersApi.get(Number(id)),
    enabled: isEdit,
  });

  // 聯絡方式類型清單
  const { data: contactTypes = [] } = useQuery({
    queryKey: ["contactTypes"],
    queryFn: catalogsApi.contactTypes,
  });

  // 物種清單（新增模式用）
  const { data: speciesList = [] } = useQuery({
    queryKey: ["species"],
    queryFn: catalogsApi.species,
    enabled: !isEdit,
  });

  const {
    register,
    handleSubmit,
    control,
    reset,
    formState: { errors, isSubmitting },
  } = useForm<FormValues>({
    resolver: zodResolver(formSchema),
    defaultValues: { contacts: [], animals: [] },
  });

  // 聯絡方式
  const {
    fields: contactFields,
    append: appendContact,
    remove: removeContact,
  } = useFieldArray({ control, name: "contacts" });

  // 寵物（新增模式）
  const {
    fields: animalFields,
    append: appendAnimal,
    remove: removeAnimal,
  } = useFieldArray({ control, name: "animals" });

  // 監看各聯絡方式的類型，用於動態 placeholder / 驗證
  const watchedContacts = useWatch({ control, name: "contacts" });

  // 監看各寵物的物種，用於動態載入品種下拉
  const watchedAnimals = useWatch({ control, name: "animals" });

  // 編輯模式：資料載入後填入
  useEffect(() => {
    if (existing) {
      reset({
        full_name: existing.full_name,
        national_id: existing.national_id ?? "",
        notes: existing.notes ?? "",
        contacts: existing.contacts.map((c) => ({
          contact_type_id: c.contact_type_id,
          value: c.value,
          is_primary: c.is_primary,
        })),
        animals: [],
      });
    }
  }, [existing, reset]);

  const mutation = useMutation({
    mutationFn: async (data: FormValues) => {
      if (isEdit) {
        return ownersApi.update(Number(id), {
          full_name: data.full_name,
          national_id: data.national_id || undefined,
          notes: data.notes || undefined,
        });
      }

      // 新增：先建飼主，再逐一建寵物
      const owner = await ownersApi.create({
        full_name: data.full_name,
        national_id: data.national_id || undefined,
        notes: data.notes || undefined,
        contacts: data.contacts.map((c) => ({
          contact_type_id: c.contact_type_id,
          value: c.value,
          is_primary: c.is_primary,
        })),
      });

      for (const animal of data.animals) {
        await ownersApi.createAnimal(owner.id, {
          name: animal.name,
          species_id: animal.species_id,
          breed_id: animal.breed_id ?? undefined,
          sex: animal.sex,
          date_of_birth: animal.date_of_birth || undefined,
          microchip_number: animal.microchip_number || undefined,
        });
      }

      return owner;
    },
    onSuccess: (owner) => {
      queryClient.invalidateQueries({ queryKey: ["owners"] });
      queryClient.invalidateQueries({ queryKey: ["owner", String(owner.id)] });
      navigate(`/owners/${owner.id}`);
    },
  });

  function addContact() {
    const defaultTypeId =
      contactTypes.find((t) => t.type_key === "phone")?.id ??
      contactTypes[0]?.id;
    if (!defaultTypeId) return;
    appendContact({
      contact_type_id: defaultTypeId,
      value: "",
      is_primary: contactFields.length === 0,
    });
  }

  function addAnimal() {
    appendAnimal({
      name: "",
      species_id: 0 as unknown as number,
      breed_id: null,
      sex: "unknown",
      date_of_birth: "",
      microchip_number: "",
    });
  }

  return (
    <div className="container py-6 max-w-2xl space-y-4">
      <div className="flex items-center gap-3">
        <Button variant="ghost" size="sm" onClick={() => navigate(-1)}>
          ← 返回
        </Button>
        <h1 className="text-xl font-semibold">
          {isEdit ? "編輯飼主" : "新增飼主"}
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

        {/* 基本資料 */}
        <Card>
          <CardHeader>
            <CardTitle className="text-base">基本資料</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="full_name">姓名 *</Label>
              <Input id="full_name" placeholder="例：王小明" {...register("full_name")} />
              {errors.full_name && (
                <p className="text-sm text-destructive">
                  {errors.full_name.message}
                </p>
              )}
            </div>
            <div className="space-y-2">
              <Label htmlFor="national_id">身分證字號 / 護照號（選填）</Label>
              <Input id="national_id" placeholder="例：A123456789" {...register("national_id")} />
            </div>
            <div className="space-y-2">
              <Label htmlFor="notes">備註（選填）</Label>
              <Input id="notes" placeholder="例：偏好晚間門診、聯繫時段限制…" {...register("notes")} />
            </div>
          </CardContent>
        </Card>

        {/* 聯絡方式 */}
        <Card>
          <CardHeader className="flex flex-row items-center justify-between">
            <CardTitle className="text-base">聯絡方式</CardTitle>
            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={addContact}
              disabled={contactTypes.length === 0}
            >
              <Plus className="h-3.5 w-3.5" />
              新增
            </Button>
          </CardHeader>
          <CardContent className="space-y-3">
            {contactFields.length === 0 && (
              <p className="text-sm text-muted-foreground">尚無聯絡方式</p>
            )}
            {contactFields.map((field, idx) => {
              const typeId = watchedContacts?.[idx]?.contact_type_id;
              const typeKey = contactTypes.find((t) => t.id === typeId)?.type_key ?? "other";
              const cfg = CONTACT_CONFIG[typeKey] ?? CONTACT_CONFIG.other;
              return (
                <div key={field.id} className="flex items-start gap-2">
                  {/* 類型（電話 / Email…）*/}
                  <select
                    className="h-9 rounded-md border border-input bg-background px-2 text-sm"
                    {...register(`contacts.${idx}.contact_type_id`, {
                      valueAsNumber: true,
                    })}
                  >
                    {contactTypes.map((t) => (
                      <option key={t.id} value={t.id}>
                        {t.display_name}
                      </option>
                    ))}
                  </select>

                  {/* 值 */}
                  <div className="flex-1 space-y-1">
                    <Input
                      type={cfg.inputType}
                      placeholder={cfg.placeholder}
                      {...register(`contacts.${idx}.value`, {
                        validate: cfg.validate,
                      })}
                    />
                    {errors.contacts?.[idx]?.value && (
                      <p className="text-xs text-destructive">
                        {errors.contacts[idx]?.value?.message}
                      </p>
                    )}
                  </div>

                  {/* 主要 */}
                  <label className="flex items-center gap-1 text-xs text-muted-foreground whitespace-nowrap h-9 pt-1">
                    <input
                      type="checkbox"
                      {...register(`contacts.${idx}.is_primary`)}
                    />
                    主要
                  </label>

                  <Button
                    type="button"
                    variant="ghost"
                    size="icon"
                    onClick={() => removeContact(idx)}
                  >
                    <Trash2 className="h-4 w-4 text-muted-foreground" />
                  </Button>
                </div>
              );
            })}
          </CardContent>
        </Card>

        {/* 寵物（新增模式才顯示） */}
        {!isEdit && (
          <Card>
            <CardHeader className="flex flex-row items-center justify-between">
              <CardTitle className="text-base">寵物</CardTitle>
              <Button
                type="button"
                variant="outline"
                size="sm"
                onClick={addAnimal}
                disabled={speciesList.length === 0}
              >
                <Plus className="h-3.5 w-3.5" />
                新增寵物
              </Button>
            </CardHeader>
            <CardContent className="space-y-4">
              {animalFields.length === 0 ? (
                <p className="text-sm text-muted-foreground">
                  可儲存後再從詳細頁新增，或點「新增寵物」立即填寫
                </p>
              ) : (
                animalFields.map((field, idx) => {
                  const selectedSpeciesId = watchedAnimals?.[idx]?.species_id;
                  const availableBreeds =
                    speciesList.find((s) => s.id === selectedSpeciesId)
                      ?.breeds ?? [];

                  return (
                    <div
                      key={field.id}
                      className="space-y-3 border rounded-md p-4 relative"
                    >
                      <Button
                        type="button"
                        variant="ghost"
                        size="icon"
                        className="absolute top-2 right-2"
                        onClick={() => removeAnimal(idx)}
                      >
                        <Trash2 className="h-4 w-4 text-muted-foreground" />
                      </Button>

                      <p className="text-sm font-medium text-muted-foreground">
                        寵物 {idx + 1}
                      </p>

                      {/* 名字 */}
                      <div className="space-y-1">
                        <Label>名字 *</Label>
                        <Input {...register(`animals.${idx}.name`)} />
                        {errors.animals?.[idx]?.name && (
                          <p className="text-xs text-destructive">
                            {errors.animals[idx]?.name?.message}
                          </p>
                        )}
                      </div>

                      {/* 物種 + 品種 */}
                      <div className="grid grid-cols-2 gap-3">
                        <div className="space-y-1">
                          <Label>物種 *</Label>
                          <select
                            className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm"
                            {...register(`animals.${idx}.species_id`, {
                              valueAsNumber: true,
                            })}
                          >
                            <option value="">請選擇…</option>
                            {speciesList.map((s) => (
                              <option key={s.id} value={s.id}>
                                {s.name}
                              </option>
                            ))}
                          </select>
                          {errors.animals?.[idx]?.species_id && (
                            <p className="text-xs text-destructive">
                              請選擇物種
                            </p>
                          )}
                        </div>
                        <div className="space-y-1">
                          <Label>
                            品種
                            {availableBreeds.length === 0 && (
                              <span className="text-xs text-muted-foreground ml-1">
                                （無資料）
                              </span>
                            )}
                          </Label>
                          <select
                            className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm disabled:opacity-50"
                            disabled={availableBreeds.length === 0}
                            {...register(`animals.${idx}.breed_id`, {
                              valueAsNumber: true,
                            })}
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
                      <div className="space-y-1">
                        <Label>性別 *</Label>
                        <select
                          className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm"
                          {...register(`animals.${idx}.sex`)}
                        >
                          {Object.entries(SEX_LABELS).map(([val, label]) => (
                            <option key={val} value={val}>
                              {label}
                            </option>
                          ))}
                        </select>
                      </div>

                      {/* 生日 + 晶片 */}
                      <div className="grid grid-cols-2 gap-3">
                        <div className="space-y-1">
                          <Label>生日（選填）</Label>
                          <Input
                            type="date"
                            {...register(`animals.${idx}.date_of_birth`)}
                          />
                        </div>
                        <div className="space-y-1">
                          <Label>晶片號碼（選填）</Label>
                          <Input
                            className="font-mono"
                            {...register(`animals.${idx}.microchip_number`)}
                          />
                        </div>
                      </div>
                    </div>
                  );
                })
              )}
            </CardContent>
          </Card>
        )}

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
