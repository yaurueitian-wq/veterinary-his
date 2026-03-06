import { NavLink, Outlet, useNavigate } from "react-router-dom";
import {
  LayoutDashboard,
  ClipboardList,
  Users,
  FileText,
  LogOut,
  ChevronRight,
} from "lucide-react";
import { useAuth } from "@/contexts/AuthContext";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";

// ── 導覽項目定義 ──────────────────────────────────────────────

const NAV_ITEMS = [
  {
    icon: LayoutDashboard,
    label: "首頁",
    path: "/dashboard",
  },
  {
    icon: ClipboardList,
    label: "候診室",
    path: "/visits",
  },
  {
    icon: Users,
    label: "飼主管理",
    path: "/owners",
  },
  {
    icon: FileText,
    label: "病歷",
    path: "/medical-records",
  },
] as const;

// ── MainLayout ────────────────────────────────────────────────

export default function MainLayout() {
  const { user, activeClinicId, accessibleClinics, logout } = useAuth();
  const navigate = useNavigate();

  const activeClinic = accessibleClinics.find((c) => c.id === activeClinicId);

  function handleLogout() {
    logout();
    navigate("/login", { replace: true });
  }

  return (
    <div className="flex h-screen overflow-hidden bg-muted/30">
      {/* ── 側邊欄 ───────────────────────────────────────────── */}
      <aside className="w-52 flex-shrink-0 flex flex-col border-r bg-background">
        {/* 系統名稱 + 分院 */}
        <div className="px-4 py-4 border-b">
          <p className="font-semibold text-sm leading-tight">獸醫診所 HIS</p>
          {activeClinic && (
            <p className="text-xs text-muted-foreground mt-0.5 truncate">
              {activeClinic.name}
            </p>
          )}
        </div>

        {/* 導覽項目 */}
        <nav className="flex-1 px-2 py-3 space-y-0.5 overflow-y-auto">
          {NAV_ITEMS.map(({ icon: Icon, label, path }) => (
            <NavLink
              key={path}
              to={path}
              end={path === "/dashboard"}
              className={({ isActive }) =>
                cn(
                  "flex items-center gap-2.5 rounded-md px-3 py-2 text-sm font-medium transition-colors",
                  isActive
                    ? "bg-primary text-primary-foreground"
                    : "text-muted-foreground hover:bg-accent hover:text-accent-foreground"
                )
              }
            >
              <Icon className="h-4 w-4 flex-shrink-0" />
              <span>{label}</span>
              {/* active 時顯示右側小箭頭 */}
              <ChevronRight
                className={cn(
                  "h-3 w-3 ml-auto opacity-0 transition-opacity",
                  "group-[.active]:opacity-100"
                )}
              />
            </NavLink>
          ))}
        </nav>

        {/* 使用者資訊 + 登出 */}
        <div className="border-t px-4 py-3">
          <p className="text-xs font-medium truncate">{user?.full_name}</p>
          <p className="text-xs text-muted-foreground truncate">{user?.email}</p>
          <Button
            variant="ghost"
            size="sm"
            onClick={handleLogout}
            className="mt-2 w-full justify-start px-0 h-7 text-xs text-muted-foreground hover:text-foreground"
          >
            <LogOut className="h-3.5 w-3.5 mr-1.5" />
            登出
          </Button>
        </div>
      </aside>

      {/* ── 主內容區 ──────────────────────────────────────────── */}
      <main className="flex-1 overflow-y-auto">
        <Outlet />
      </main>
    </div>
  );
}
