import { NavLink, Outlet, useNavigate } from "react-router-dom";
import {
  LayoutDashboard,
  ClipboardList,
  Users,
  FileText,
  LogOut,
  CalendarDays,
  BedDouble,
  Pill,
  Receipt,
  Syringe,
  BarChart2,
  Settings,
} from "lucide-react";
import { useAuth } from "@/contexts/AuthContext";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";

// ── 導覽項目定義 ──────────────────────────────────────────────

type NavItem = {
  icon: React.ElementType;
  label: string;
  path: string;
  comingSoon?: boolean;
};

type NavGroup = {
  label?: string;
  items: NavItem[];
};

const NAV_GROUPS: NavGroup[] = [
  {
    items: [
      { icon: LayoutDashboard, label: "首頁", path: "/dashboard" },
    ],
  },
  {
    label: "診療",
    items: [
      { icon: ClipboardList, label: "掛號 & 候診室", path: "/visits" },
      { icon: Users,          label: "飼主 & 動物管理", path: "/owners" },
      { icon: FileText,       label: "病歷", path: "/medical-records" },
    ],
  },
  {
    label: "規劃中",
    items: [
      { icon: CalendarDays, label: "預約排程",   path: "/appointments",  comingSoon: true },
      { icon: BedDouble,    label: "住院管理",   path: "/inpatient",     comingSoon: true },
      { icon: Pill,         label: "用藥管理",   path: "/medications",   comingSoon: true },
      { icon: Receipt,      label: "結帳 & 收費", path: "/billing",       comingSoon: true },
      { icon: Syringe,      label: "疫苗 & 提醒", path: "/vaccines",      comingSoon: true },
      { icon: BarChart2,    label: "報表 & 統計", path: "/reports",       comingSoon: true },
      { icon: Settings,     label: "系統管理",   path: "/admin",         comingSoon: true },
    ],
  },
];

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
        <nav className="flex-1 px-2 py-3 space-y-3 overflow-y-auto">
          {NAV_GROUPS.map((group, gi) => (
            <div key={gi}>
              {group.label && (
                <p className="px-3 mb-1 text-xs font-medium text-muted-foreground/60 uppercase tracking-wider">
                  {group.label}
                </p>
              )}
              <div className="space-y-0.5">
                {group.items.map(({ icon: Icon, label, path, comingSoon }) =>
                  comingSoon ? (
                    <div
                      key={path}
                      className="flex items-center gap-2.5 rounded-md px-3 py-2 text-sm font-medium text-muted-foreground/40 cursor-default select-none"
                    >
                      <Icon className="h-4 w-4 flex-shrink-0" />
                      <span>{label}</span>
                      <span className="ml-auto text-[10px] font-normal text-muted-foreground/40 border border-muted-foreground/20 rounded px-1 py-px leading-tight">
                        soon
                      </span>
                    </div>
                  ) : (
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
                    </NavLink>
                  )
                )}
              </div>
            </div>
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
