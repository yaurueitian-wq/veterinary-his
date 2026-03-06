import { useAuth } from "@/contexts/AuthContext";
import { useNavigate } from "react-router-dom";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";

export default function DashboardPage() {
  const { user, activeClinicId, accessibleClinics } = useAuth();
  const navigate = useNavigate();

  const activeClinic = accessibleClinics.find((c) => c.id === activeClinicId);

  return (
    <div className="container py-8 space-y-6">
      <div>
        <h1 className="text-xl font-semibold">歡迎回來，{user?.full_name}</h1>
        {activeClinic && (
          <p className="text-sm text-muted-foreground mt-0.5">
            目前分院：{activeClinic.name}
          </p>
        )}
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

        {/* 掛號 & 候診室 */}
        <Card
          className="cursor-pointer hover:bg-accent/50 transition-colors"
          onClick={() => navigate("/visits")}
        >
          <CardHeader>
            <CardTitle className="text-base">掛號 & 候診室</CardTitle>
            <CardDescription>新增掛號、管理候診流程</CardDescription>
          </CardHeader>
          <CardContent className="space-y-1 text-sm text-muted-foreground">
            <p>新增掛號（搜尋飼主 → 選動物）</p>
            <p>候診清單 / 狀態流程管理</p>
          </CardContent>
        </Card>

        {/* 飼主管理 */}
        <Card
          className="cursor-pointer hover:bg-accent/50 transition-colors"
          onClick={() => navigate("/owners")}
        >
          <CardHeader>
            <CardTitle className="text-base">飼主 & 動物管理</CardTitle>
            <CardDescription>查詢、新增飼主與動物資料</CardDescription>
          </CardHeader>
          <CardContent className="space-y-1 text-sm text-muted-foreground">
            <p>飼主查詢 / 建檔</p>
            <p>動物建檔（物種、品種、晶片）</p>
          </CardContent>
        </Card>

        {/* 病歷 */}
        <Card
          className="cursor-pointer hover:bg-accent/50 transition-colors"
          onClick={() => navigate("/medical-records")}
        >
          <CardHeader>
            <CardTitle className="text-base">病歷</CardTitle>
            <CardDescription>查詢就診紀錄與病歷內容</CardDescription>
          </CardHeader>
          <CardContent className="space-y-1 text-sm text-muted-foreground">
            <p>依動物 / 飼主 / 日期搜尋</p>
            <p>SOAP 病歷、生命徵象、檢驗報告</p>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
