import { useNavigate, useParams } from "react-router-dom";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Pencil, Plus, Trash2 } from "lucide-react";

import { animalsApi, ownersApi, SEX_LABELS } from "@/api/owners";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";

function calcAge(dob: string | null): string {
  if (!dob) return "不明";
  const diffMs = Date.now() - new Date(dob).getTime();
  const years = diffMs / (1000 * 60 * 60 * 24 * 365.25);
  return `${years.toFixed(1)} 歲`;
}

export default function OwnerDetailPage() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const queryClient = useQueryClient();

  const { data: owner, isLoading, isError } = useQuery({
    queryKey: ["owner", id],
    queryFn: () => ownersApi.get(Number(id)),
    enabled: Boolean(id),
  });

  const deleteOwnerMutation = useMutation({
    mutationFn: () => ownersApi.delete(Number(id)),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["owners"] });
      navigate("/owners");
    },
  });

  const deleteAnimalMutation = useMutation({
    mutationFn: (animalId: number) => animalsApi.delete(animalId),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["owner", id] });
    },
  });

  function handleDeleteOwner() {
    if (!window.confirm(`確定要刪除飼主「${owner?.full_name}」嗎？此操作無法復原。`)) return;
    deleteOwnerMutation.mutate();
  }

  function handleDeleteAnimal(animalId: number, animalName: string) {
    if (!window.confirm(`確定要刪除寵物「${animalName}」嗎？`)) return;
    deleteAnimalMutation.mutate(animalId);
  }

  if (isLoading) {
    return (
      <div className="container py-12 text-center text-sm text-muted-foreground">
        載入中…
      </div>
    );
  }

  if (isError || !owner) {
    return (
      <div className="container py-12 text-center text-sm text-destructive">
        無法載入飼主資料
      </div>
    );
  }

  return (
    <div className="container py-6 max-w-3xl space-y-4">
      {/* 返回 */}
      <div className="flex items-center gap-3">
        <Button variant="ghost" size="sm" onClick={() => navigate("/owners")}>
          ← 飼主清單
        </Button>
      </div>

      {/* 飼主基本資料 */}
      <Card>
        <CardHeader className="flex flex-row items-center justify-between">
          <CardTitle>{owner.full_name}</CardTitle>
          <div className="flex gap-2">
            <Button
              variant="outline"
              size="sm"
              onClick={() => navigate(`/owners/${owner.id}/edit`)}
            >
              <Pencil className="h-3.5 w-3.5" />
              編輯
            </Button>
            <Button
              variant="outline"
              size="sm"
              className="text-destructive hover:text-destructive"
              onClick={handleDeleteOwner}
              disabled={deleteOwnerMutation.isPending}
            >
              <Trash2 className="h-3.5 w-3.5" />
              刪除飼主
            </Button>
          </div>
        </CardHeader>
        <CardContent className="space-y-1 text-sm">
          <div className="flex gap-2">
            <span className="text-muted-foreground w-28">身分證字號</span>
            <span>{owner.national_id ?? "—"}</span>
          </div>
          {owner.notes && (
            <div className="flex gap-2">
              <span className="text-muted-foreground w-28">備註</span>
              <span>{owner.notes}</span>
            </div>
          )}
        </CardContent>
      </Card>

      {/* 聯絡方式 */}
      <Card>
        <CardHeader>
          <CardTitle className="text-base">聯絡方式</CardTitle>
        </CardHeader>
        <CardContent>
          {owner.contacts.length === 0 ? (
            <p className="text-sm text-muted-foreground">尚無聯絡方式</p>
          ) : (
            <div className="space-y-2">
              {owner.contacts.map((c) => (
                <div key={c.id} className="flex items-center gap-3 text-sm">
                  <span className="inline-flex items-center rounded-full border px-2.5 py-0.5 text-xs font-medium">
                    {c.display_name}
                  </span>
                  <span>{c.value}</span>
                  {c.is_primary && (
                    <span className="text-xs text-muted-foreground">（主要）</span>
                  )}
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>

      {/* 寵物清單 */}
      <Card>
        <CardHeader className="flex flex-row items-center justify-between">
          <CardTitle className="text-base">
            寵物（{owner.animals.length}）
          </CardTitle>
          <Button
            variant="outline"
            size="sm"
            onClick={() => navigate(`/owners/${owner.id}/animals/new`)}
          >
            <Plus className="h-3.5 w-3.5" />
            新增寵物
          </Button>
        </CardHeader>
        <CardContent className="p-0">
          {owner.animals.length === 0 ? (
            <p className="px-6 pb-4 text-sm text-muted-foreground">尚無寵物資料</p>
          ) : (
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b bg-muted/50">
                  <th className="px-4 py-3 text-left font-medium">名字</th>
                  <th className="px-4 py-3 text-left font-medium">物種</th>
                  <th className="px-4 py-3 text-left font-medium">品種</th>
                  <th className="px-4 py-3 text-left font-medium">性別</th>
                  <th className="px-4 py-3 text-left font-medium">年齡</th>
                  <th className="px-4 py-3 text-left font-medium">血型</th>
                  <th className="px-4 py-3 text-left font-medium">晶片號碼</th>
                  <th className="px-4 py-3 text-right font-medium"></th>
                </tr>
              </thead>
              <tbody>
                {owner.animals.map((a, idx) => (
                  <tr key={a.id} className={idx % 2 === 1 ? "bg-muted/20" : ""}>
                    <td className="px-4 py-3 font-medium">
                      <button
                        className="hover:underline text-left"
                        onClick={() => navigate(`/animals/${a.id}`)}
                      >
                        {a.name}
                      </button>
                    </td>
                    <td className="px-4 py-3 text-muted-foreground">
                      {a.species_name}
                    </td>
                    <td className="px-4 py-3 text-muted-foreground">
                      {a.breed_name ?? "—"}
                    </td>
                    <td className="px-4 py-3 text-muted-foreground">
                      {SEX_LABELS[a.sex] ?? a.sex}
                    </td>
                    <td className="px-4 py-3 text-muted-foreground">
                      {calcAge(a.date_of_birth)}
                    </td>
                    <td className="px-4 py-3 text-muted-foreground">
                      {a.blood_type_name ?? "不明"}
                    </td>
                    <td className="px-4 py-3 text-muted-foreground font-mono text-xs">
                      {a.microchip_number ?? "—"}
                    </td>
                    <td className="px-4 py-3 text-right">
                      <div className="flex justify-end gap-1">
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => navigate(`/animals/${a.id}/edit`)}
                        >
                          編輯
                        </Button>
                        <Button
                          variant="ghost"
                          size="sm"
                          className="text-destructive hover:text-destructive"
                          onClick={() => handleDeleteAnimal(a.id, a.name)}
                          disabled={deleteAnimalMutation.isPending}
                        >
                          <Trash2 className="h-3.5 w-3.5" />
                        </Button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
