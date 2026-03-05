import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { Loader2 } from "lucide-react";

import api from "@/api";
import { useAuth } from "@/contexts/AuthContext";
import type { ClinicInfo, TokenResponse } from "@/types/auth";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Alert, AlertDescription } from "@/components/ui/alert";

// ── 表單 schema ───────────────────────────────────────────
const credentialSchema = z.object({
  email: z.string().min(1, "請輸入電子郵件"),
  password: z.string().min(1, "請輸入密碼"),
});
type CredentialForm = z.infer<typeof credentialSchema>;

// ── 分院選擇階段的臨時狀態 ──────────────────────────────────
interface PendingClinicState {
  email: string;
  password: string;
  clinics: ClinicInfo[];
}

export default function LoginPage() {
  const navigate = useNavigate();
  const { setAuth } = useAuth();

  // 錯誤訊息
  const [error, setError] = useState<string | null>(null);
  // 等待分院選擇時的暫存狀態（不寫進 Context / localStorage）
  const [pending, setPending] = useState<PendingClinicState | null>(null);
  // 分院選擇中的 loading（哪個 clinic_id 正在等待）
  const [selectingClinicId, setSelectingClinicId] = useState<number | null>(null);

  const {
    register,
    handleSubmit,
    formState: { errors, isSubmitting },
  } = useForm<CredentialForm>({
    resolver: zodResolver(credentialSchema),
  });

  // ── Step 1：帳號密碼登入 ─────────────────────────────────
  async function onCredentialSubmit(data: CredentialForm) {
    setError(null);
    try {
      const res = await api.post<TokenResponse>("/auth/login", {
        email: data.email,
        password: data.password,
      });
      const response = res.data;

      if (response.active_clinic_id !== null) {
        // 只有一間分院（或已帶 clinic_id）→ 直接完成登入
        setAuth(response);
        navigate("/dashboard", { replace: true });
      } else {
        // 多間分院 → 進入選擇步驟
        setPending({
          email: data.email,
          password: data.password,
          clinics: response.accessible_clinics,
        });
      }
    } catch (err: unknown) {
      const msg = extractApiError(err);
      setError(msg);
    }
  }

  // ── Step 2：選定分院後以 clinic_id 重新登入 ────────────────
  async function onSelectClinic(clinicId: number) {
    if (!pending) return;
    setError(null);
    setSelectingClinicId(clinicId);
    try {
      const res = await api.post<TokenResponse>("/auth/login", {
        email: pending.email,
        password: pending.password,
        clinic_id: clinicId,
      });
      setAuth(res.data);
      navigate("/dashboard", { replace: true });
    } catch (err: unknown) {
      setError(extractApiError(err));
    } finally {
      setSelectingClinicId(null);
    }
  }

  // ── 渲染：分院選擇頁 ─────────────────────────────────────
  if (pending) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-muted/40 p-4">
        <Card className="w-full max-w-md">
          <CardHeader className="text-center">
            <CardTitle>請選擇登入分院</CardTitle>
            <CardDescription>
              您的帳號擁有多個分院存取權，請選擇本次要操作的分院
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-3">
            {error && (
              <Alert variant="destructive">
                <AlertDescription>{error}</AlertDescription>
              </Alert>
            )}
            <div className="grid grid-cols-2 gap-3">
              {pending.clinics.map((clinic) => (
                <Button
                  key={clinic.id}
                  variant="outline"
                  className="h-16 text-base"
                  disabled={selectingClinicId !== null}
                  onClick={() => onSelectClinic(clinic.id)}
                >
                  {selectingClinicId === clinic.id ? (
                    <Loader2 className="h-4 w-4 animate-spin" />
                  ) : (
                    clinic.name
                  )}
                </Button>
              ))}
            </div>
            <Button
              variant="ghost"
              className="w-full mt-2"
              onClick={() => {
                setPending(null);
                setError(null);
              }}
            >
              重新輸入帳號密碼
            </Button>
          </CardContent>
        </Card>
      </div>
    );
  }

  // ── 渲染：帳號密碼表單 ────────────────────────────────────
  return (
    <div className="min-h-screen flex items-center justify-center bg-muted/40 p-4">
      <Card className="w-full max-w-sm">
        <CardHeader className="text-center space-y-1">
          <CardTitle className="text-2xl">獸醫診所 HIS</CardTitle>
          <CardDescription>請登入以繼續</CardDescription>
        </CardHeader>
        <CardContent>
          <form onSubmit={handleSubmit(onCredentialSubmit)} className="space-y-4">
            {error && (
              <Alert variant="destructive">
                <AlertDescription>{error}</AlertDescription>
              </Alert>
            )}

            <div className="space-y-2">
              <Label htmlFor="email">電子郵件</Label>
              <Input
                id="email"
                type="text"
                autoComplete="email"
                placeholder="admin@his.local"
                {...register("email")}
              />
              {errors.email && (
                <p className="text-sm text-destructive">{errors.email.message}</p>
              )}
            </div>

            <div className="space-y-2">
              <Label htmlFor="password">密碼</Label>
              <Input
                id="password"
                type="password"
                autoComplete="current-password"
                {...register("password")}
              />
              {errors.password && (
                <p className="text-sm text-destructive">{errors.password.message}</p>
              )}
            </div>

            <Button type="submit" className="w-full" disabled={isSubmitting}>
              {isSubmitting ? (
                <>
                  <Loader2 className="h-4 w-4 animate-spin" />
                  登入中…
                </>
              ) : (
                "登入"
              )}
            </Button>
          </form>
        </CardContent>
      </Card>
    </div>
  );
}

// ── 工具函式：從 axios error 提取訊息 ──────────────────────
function extractApiError(err: unknown): string {
  if (
    err &&
    typeof err === "object" &&
    "response" in err &&
    err.response &&
    typeof err.response === "object" &&
    "data" in err.response
  ) {
    const data = (err as { response: { data: unknown } }).response.data;
    if (data && typeof data === "object" && "detail" in data) {
      return String((data as { detail: unknown }).detail);
    }
  }
  return "登入失敗，請檢查網路連線";
}
