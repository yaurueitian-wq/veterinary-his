import { BrowserRouter, Routes, Route, Navigate } from "react-router-dom";
import { Toaster } from "sonner";
import { ProtectedRoute } from "@/components/ProtectedRoute";
import MainLayout from "@/components/MainLayout";
import LoginPage from "@/pages/LoginPage";
import DashboardPage from "@/pages/DashboardPage";
import OwnerListPage from "@/pages/owners/OwnerListPage";
import OwnerFormPage from "@/pages/owners/OwnerFormPage";
import OwnerDetailPage from "@/pages/owners/OwnerDetailPage";
import AnimalFormPage from "@/pages/animals/AnimalFormPage";
import AnimalDetailPage from "@/pages/animals/AnimalDetailPage";
import KanbanPage from "@/pages/visits/KanbanPage";
import VisitCreatePage from "@/pages/visits/VisitCreatePage";
import MedicalRecordsPage from "@/pages/medical-records/MedicalRecordsPage";
import MedicalRecordDetailPage from "@/pages/medical-records/MedicalRecordDetailPage";
import TerminologyPage from "@/pages/terminology/TerminologyPage";

export default function App() {
  return (
    <BrowserRouter>
      <Routes>
        <Route path="/login" element={<LoginPage />} />

        {/* 需要登入才能存取的路由（含共用 sidebar Layout） */}
        <Route element={<ProtectedRoute />}>
          <Route element={<MainLayout />}>
            <Route path="/dashboard" element={<DashboardPage />} />

            {/* 飼主管理 */}
            <Route path="/owners" element={<OwnerListPage />} />
            <Route path="/owners/new" element={<OwnerFormPage />} />
            <Route path="/owners/:id" element={<OwnerDetailPage />} />
            <Route path="/owners/:id/edit" element={<OwnerFormPage />} />
            <Route
              path="/owners/:ownerId/animals/new"
              element={<AnimalFormPage />}
            />

            {/* 動物管理 */}
            <Route path="/animals/:animalId" element={<AnimalDetailPage />} />
            <Route path="/animals/:animalId/edit" element={<AnimalFormPage />} />

            {/* 掛號 & 候診 */}
            <Route path="/visits" element={<KanbanPage />} />
            <Route path="/visits/new" element={<VisitCreatePage />} />

            {/* 病歷 */}
            <Route path="/medical-records" element={<MedicalRecordsPage />} />
            <Route path="/medical-records/:visitId" element={<MedicalRecordDetailPage />} />

            {/* 術語目錄管理 */}
            <Route path="/terminology" element={<TerminologyPage />} />
          </Route>
        </Route>

        {/* 根路由重導向 */}
        <Route path="/" element={<Navigate to="/dashboard" replace />} />
        <Route path="*" element={<Navigate to="/dashboard" replace />} />
      </Routes>
      <Toaster richColors position="top-right" />
    </BrowserRouter>
  );
}
