import api from "@/api";

// ── 型別定義 ─────────────────────────────────────────────

export type VisitStatus =
  | "registered"
  | "triaged"
  | "in_consultation"
  | "pending_results"
  | "completed"
  | "admitted"
  | "cancelled";

export type VisitPriority = "normal" | "urgent";

export interface VisitListItem {
  id: number;
  animal_id: number | null;
  animal_name: string | null;
  species_name: string | null;
  owner_id: number | null;
  owner_name: string | null;
  attending_vet_id: number | null;
  attending_vet_name: string | null;
  status: VisitStatus;
  priority: VisitPriority;
  chief_complaint: string;
  is_emergency: boolean;
  registered_at: string;
  admitted_at: string | null;
  completed_at: string | null;
}

export interface VisitListResponse {
  items: VisitListItem[];
  total: number;
}

// ── 狀態中文顯示 ─────────────────────────────────────────

export const STATUS_LABELS: Record<VisitStatus, string> = {
  registered:       "候診中",
  triaged:          "已初診",
  in_consultation:  "診療中",
  pending_results:  "待檢驗結果",
  completed:        "已完成",
  admitted:         "住院",
  cancelled:        "已取消",
};

export const STATUS_COLORS: Record<VisitStatus, string> = {
  registered:       "bg-blue-100 text-blue-800",
  triaged:          "bg-yellow-100 text-yellow-800",
  in_consultation:  "bg-green-100 text-green-800",
  pending_results:  "bg-purple-100 text-purple-800",
  completed:        "bg-gray-100 text-gray-600",
  admitted:         "bg-orange-100 text-orange-800",
  cancelled:        "bg-red-100 text-red-600",
};


export const NEXT_STATUS_LABELS: Partial<Record<VisitStatus, string>> = {
  triaged:         "初診完成",
  in_consultation: "開始診療",
  pending_results: "等待檢驗",
  completed:       "完成診療",
  admitted:        "轉住院",
  cancelled:       "取消",
};

// ── API 函式 ─────────────────────────────────────────────

export const visitsApi = {
  /** 取得候診清單 */
  list: (params?: {
    visit_date?: string;
    all_dates?: boolean;
    status?: string;
    animal_name?: string;
    owner_name?: string;
    species_id?: number;
  }): Promise<VisitListResponse> =>
    api.get("/visits", { params }).then((r) => r.data),

  /** 取得單筆就診 */
  get: (id: number): Promise<VisitListItem> =>
    api.get(`/visits/${id}`).then((r) => r.data),

  /** 新增掛號 */
  create: (body: {
    animal_id: number;
    chief_complaint: string;
    priority?: VisitPriority;
  }): Promise<VisitListItem> =>
    api.post("/visits", body).then((r) => r.data),

  /** 更新掛號（狀態轉換 / 優先度） */
  update: (
    id: number,
    body: {
      status?: VisitStatus;
      priority?: VisitPriority;
      attending_vet_id?: number;
      chief_complaint?: string;
    }
  ): Promise<VisitListItem> =>
    api.patch(`/visits/${id}`, body).then((r) => r.data),
};
