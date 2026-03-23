import {
  createContext,
  useContext,
  useState,
  useEffect,
  type ReactNode,
} from "react";
import { jwtDecode } from "jwt-decode";
import type { ClinicInfo, TokenResponse, UserInfo } from "@/types/auth";

export type SessionStatus = "active" | "expiring" | "expired";

/** 不做驗證，只讀 JWT payload 的 exp（秒） */
function getTokenExp(token: string | null): number | null {
  if (!token) return null;
  try {
    const payload = jwtDecode<{ exp?: number }>(token);
    return typeof payload.exp === "number" ? payload.exp : null;
  } catch {
    return null;
  }
}

function calcStatus(token: string | null): { status: SessionStatus; remainingMs: number } {
  const exp = getTokenExp(token);
  if (exp === null) return { status: "expired", remainingMs: 0 };
  const remainingMs = exp * 1000 - Date.now();
  if (remainingMs <= 0) return { status: "expired", remainingMs: 0 };
  if (remainingMs <= 30 * 60 * 1000) return { status: "expiring", remainingMs }; // 30 分鐘內
  return { status: "active", remainingMs };
}

interface AuthState {
  token: string | null;
  user: UserInfo | null;
  activeClinicId: number | null;
  accessibleClinics: ClinicInfo[];
}

interface AuthContextValue extends AuthState {
  isAuthenticated: boolean;
  sessionStatus: SessionStatus;
  /** Token 剩餘毫秒數（0 = 已過期） */
  sessionRemainingMs: number;
  /** 成功取得 TokenResponse（含 active_clinic_id）後呼叫，寫入狀態與 localStorage */
  setAuth: (response: TokenResponse) => void;
  logout: () => void;
}

const AuthContext = createContext<AuthContextValue | null>(null);

const STORAGE_KEYS = {
  token: "access_token",
  user: "auth_user",
  activeClinicId: "active_clinic_id",
  accessibleClinics: "accessible_clinics",
};

function loadFromStorage(): AuthState {
  try {
    const token = localStorage.getItem(STORAGE_KEYS.token);
    const userRaw = localStorage.getItem(STORAGE_KEYS.user);
    const clinicIdRaw = localStorage.getItem(STORAGE_KEYS.activeClinicId);
    const clinicsRaw = localStorage.getItem(STORAGE_KEYS.accessibleClinics);
    return {
      token,
      user: userRaw ? JSON.parse(userRaw) : null,
      activeClinicId: clinicIdRaw ? Number(clinicIdRaw) : null,
      accessibleClinics: clinicsRaw ? JSON.parse(clinicsRaw) : [],
    };
  } catch {
    return { token: null, user: null, activeClinicId: null, accessibleClinics: [] };
  }
}

export function AuthProvider({ children }: { children: ReactNode }) {
  const [state, setState] = useState<AuthState>(loadFromStorage);
  const [sessionInfo, setSessionInfo] = useState(() => calcStatus(loadFromStorage().token));

  // 頁面重新整理時同步 localStorage → state（已在 loadFromStorage 處理）
  useEffect(() => {
    setState(loadFromStorage());
  }, []);

  // 每 30 秒重新計算 session 狀態
  useEffect(() => {
    setSessionInfo(calcStatus(state.token));
    const id = setInterval(() => setSessionInfo(calcStatus(state.token)), 30_000);
    return () => clearInterval(id);
  }, [state.token]);

  function setAuth(response: TokenResponse) {
    const next: AuthState = {
      token: response.access_token,
      user: response.user,
      activeClinicId: response.active_clinic_id,
      accessibleClinics: response.accessible_clinics,
    };
    localStorage.setItem(STORAGE_KEYS.token, next.token!);
    localStorage.setItem(STORAGE_KEYS.user, JSON.stringify(next.user));
    localStorage.setItem(
      STORAGE_KEYS.activeClinicId,
      next.activeClinicId != null ? String(next.activeClinicId) : ""
    );
    localStorage.setItem(
      STORAGE_KEYS.accessibleClinics,
      JSON.stringify(next.accessibleClinics)
    );
    setState(next);
  }

  function logout() {
    Object.values(STORAGE_KEYS).forEach((k) => localStorage.removeItem(k));
    setState({ token: null, user: null, activeClinicId: null, accessibleClinics: [] });
  }

  // isAuthenticated：有 token 且已選定分院
  const isAuthenticated = Boolean(state.token && state.activeClinicId != null);

  return (
    <AuthContext.Provider
      value={{
        ...state,
        isAuthenticated,
        sessionStatus: sessionInfo.status,
        sessionRemainingMs: sessionInfo.remainingMs,
        setAuth,
        logout,
      }}
    >
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth(): AuthContextValue {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error("useAuth must be used within AuthProvider");
  return ctx;
}
