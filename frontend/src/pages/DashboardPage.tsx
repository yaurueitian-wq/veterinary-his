import { useAuth } from "@/contexts/AuthContext";
import { useNavigate } from "react-router-dom";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import {
  ClipboardList,
  Users,
  FileText,
  CalendarDays,
  BedDouble,
  Pill,
  Receipt,
  Syringe,
  BarChart2,
  Settings,
} from "lucide-react";

// ── 已上線模組 ─────────────────────────────────────────────────

const ACTIVE_MODULES = [
  {
    icon: ClipboardList,
    title: "掛號 & 候診室",
    description: "新增掛號、管理候診流程",
    features: ["新增掛號（搜尋飼主 → 選動物）", "候診清單 / 狀態流程管理"],
    path: "/visits",
  },
  {
    icon: Users,
    title: "飼主 & 動物管理",
    description: "查詢、新增飼主與動物資料",
    features: ["飼主查詢 / 建檔", "動物建檔（物種、品種、晶片）"],
    path: "/owners",
  },
  {
    icon: FileText,
    title: "病歷",
    description: "查詢就診紀錄與病歷內容",
    features: ["依動物 / 飼主 / 日期搜尋", "SOAP 病歷、生命徵象、檢驗報告"],
    path: "/medical-records",
  },
] as const;

// ── 規劃中模組 ─────────────────────────────────────────────────

const PLANNED_MODULES = [
  {
    icon: CalendarDays,
    title: "預約排程",
    description: "線上與電話預約管理",
    features: ["醫師 / 診間時段管理", "預約提醒通知"],
  },
  {
    icon: BedDouble,
    title: "住院管理",
    description: "住院動物追蹤與護理排程",
    features: ["住院狀態追蹤", "住院期間生命徵象紀錄"],
  },
  {
    icon: Pill,
    title: "用藥管理",
    description: "就診處方與長期維持用藥",
    features: ["就診處方開立", "動物長期用藥清單"],
  },
  {
    icon: Receipt,
    title: "結帳 & 收費",
    description: "批價、帳單開立與收款",
    features: ["處置 / 藥品費用批價", "帳單列印 / 收款紀錄"],
  },
  {
    icon: Syringe,
    title: "疫苗 & 提醒",
    description: "疫苗接種紀錄與到期提醒",
    features: ["疫苗施打紀錄", "自動到期提醒（SMS / LINE）"],
  },
  {
    icon: BarChart2,
    title: "報表 & 統計",
    description: "跨院所查詢與營運報表",
    features: ["就診量 / 收費統計", "跨分院資料彙整"],
  },
  {
    icon: Settings,
    title: "系統管理",
    description: "使用者、角色與目錄設定",
    features: ["使用者帳號 / 角色指派", "物種、品種、診斷碼目錄維護"],
  },
] as const;

// ── 主頁面 ────────────────────────────────────────────────────

export default function DashboardPage() {
  const { user, activeClinicId, accessibleClinics } = useAuth();
  const navigate = useNavigate();

  const activeClinic = accessibleClinics.find((c) => c.id === activeClinicId);

  return (
    <div className="container py-8 space-y-8">
      {/* 歡迎列 */}
      <div>
        <h1 className="text-xl font-semibold">歡迎回來，{user?.full_name}</h1>
        {activeClinic && (
          <p className="text-sm text-muted-foreground mt-0.5">
            目前分院：{activeClinic.name}
          </p>
        )}
      </div>

      {/* 已上線功能 */}
      <section className="space-y-3">
        <div className="flex items-center gap-2">
          <h2 className="text-sm font-semibold text-foreground">已上線功能</h2>
          <span className="inline-block h-px flex-1 bg-border" />
        </div>
        <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
          {/* 帳號資訊 */}
          <Card>
            <CardHeader>
              <CardTitle className="text-base">帳號資訊</CardTitle>
              <CardDescription>目前的登入帳號</CardDescription>
            </CardHeader>
            <CardContent className="space-y-1 text-sm">
              <div className="flex justify-between">
                <span className="text-muted-foreground">電子郵件</span>
                <span>{user?.email}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-muted-foreground">可存取分院</span>
                <span>{accessibleClinics.length} 間</span>
              </div>
            </CardContent>
          </Card>

          {ACTIVE_MODULES.map(({ icon: Icon, title, description, features, path }) => (
            <Card
              key={path}
              className="cursor-pointer hover:bg-accent/50 transition-colors"
              onClick={() => navigate(path)}
            >
              <CardHeader>
                <CardTitle className="text-base flex items-center gap-2">
                  <Icon className="h-4 w-4 text-muted-foreground" />
                  {title}
                </CardTitle>
                <CardDescription>{description}</CardDescription>
              </CardHeader>
              <CardContent className="space-y-1 text-sm text-muted-foreground">
                {features.map((f) => <p key={f}>{f}</p>)}
              </CardContent>
            </Card>
          ))}
        </div>
      </section>

      {/* 規劃中功能 */}
      <section className="space-y-3">
        <div className="flex items-center gap-2">
          <h2 className="text-sm font-semibold text-muted-foreground">規劃中功能</h2>
          <span className="inline-block h-px flex-1 bg-border" />
        </div>
        <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
          {PLANNED_MODULES.map(({ icon: Icon, title, description, features }) => (
            <Card
              key={title}
              className="border-dashed opacity-60"
            >
              <CardHeader className="pb-2">
                <CardTitle className="text-base flex items-center gap-2 text-muted-foreground">
                  <Icon className="h-4 w-4" />
                  {title}
                  <span className="ml-auto text-[10px] font-normal border border-muted-foreground/30 rounded px-1.5 py-px leading-tight">
                    規劃中
                  </span>
                </CardTitle>
                <CardDescription>{description}</CardDescription>
              </CardHeader>
              <CardContent className="space-y-1 text-sm text-muted-foreground">
                {features.map((f) => <p key={f}>{f}</p>)}
              </CardContent>
            </Card>
          ))}
        </div>
      </section>
    </div>
  );
}
