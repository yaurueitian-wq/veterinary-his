import {
  createContext,
  useContext,
  useState,
  useEffect,
  type ReactNode,
} from "react";
import type { ClinicInfo, TokenResponse, UserInfo } from "@/types/auth";

interface AuthState {
  token: string | null;
  user: UserInfo | null;
  activeClinicId: number | null;
  accessibleClinics: ClinicInfo[];
}

interface AuthContextValue extends AuthState {
  isAuthenticated: boolean;
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

  // 頁面重新整理時同步 localStorage → state（已在 loadFromStorage 處理）
  useEffect(() => {
    setState(loadFromStorage());
  }, []);

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
    <AuthContext.Provider value={{ ...state, isAuthenticated, setAuth, logout }}>
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth(): AuthContextValue {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error("useAuth must be used within AuthProvider");
  return ctx;
}
