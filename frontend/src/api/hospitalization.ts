import api from "@/api";

// ── 型別定義 ──────────────────────────────────────────────────

export interface WardRead {
  id: number;
  clinic_id: number;
  ward_type_id: number;
  ward_type_name: string;
  name: string;
  code: string;
  is_active: boolean;
  total_beds: number;
  available_beds: number;
}

export interface BedRead {
  id: number;
  ward_id: number;
  bed_type_id: number;
  bed_type_name: string;
  bed_number: string;
  status: string;
  is_active: boolean;
}

export interface WardDetailRead extends WardRead {
  beds: BedRead[];
  default_equipment: { id: number; name: string }[];
}

export interface AdmissionCreate {
  bed_id: number;
  admission_reason_id: number;
  reason_notes?: string | null;
  attending_vet_id: number;
  equipment_item_ids: number[];
}

export interface AdmissionRead {
  id: number;
  visit_id: number;
  clinic_id: number;
  bed_id: number;
  bed_number: string;
  ward_name: string;
  admission_reason_id: number;
  admission_reason_name: string;
  reason_notes: string | null;
  attending_vet_id: number;
  attending_vet_name: string;
  status: string;
  admitted_at: string;
  discharged_at: string | null;
  created_at: string;
  created_by_name: string;
  equipment: { id: number; name: string; notes: string | null }[];
}

export interface DailyRoundCreate {
  round_date: string;
  assessment?: string | null;
  plan?: string | null;
}

export interface DailyRoundRead {
  id: number;
  admission_id: number;
  round_date: string;
  assessment: string | null;
  plan: string | null;
  is_superseded: boolean;
  created_at: string;
  created_by_name: string | null;
}

export interface NursingLogCreate {
  action_item_ids: number[];
  notes?: string | null;
}

export interface NursingLogRead {
  id: number;
  admission_id: number;
  notes: string | null;
  actions: { id: number; name: string }[];
  is_superseded: boolean;
  created_at: string;
  created_by_name: string | null;
}

export interface InpatientOrderCreate {
  order_type_id: number;
  description: string;
  frequency_id?: number | null;
  end_at?: string | null;
}

export interface InpatientOrderRead {
  id: number;
  admission_id: number;
  order_type_id: number;
  order_type_name: string;
  description: string;
  frequency_id: number | null;
  frequency_code: string | null;
  frequency_name: string | null;
  start_at: string;
  end_at: string | null;
  status: string;
  is_superseded: boolean;
  created_at: string;
  created_by_name: string | null;
  executions: OrderExecutionRead[];
}

export interface OrderExecutionRead {
  id: number;
  order_id: number;
  executed_at: string;
  notes: string | null;
  created_by_name: string | null;
}

export interface BedTransferCreate {
  to_bed_id: number;
  reason_id: number;
  reason_notes?: string | null;
}

export interface BedTransferRead {
  id: number;
  admission_id: number;
  from_bed_id: number;
  from_bed_number: string;
  to_bed_id: number;
  to_bed_number: string;
  reason_id: number;
  reason_name: string;
  reason_notes: string | null;
  transferred_at: string;
  transferred_by_name: string;
}

export interface DischargeCreate {
  discharge_reason_id: number;
  discharge_condition_id: number;
  discharge_notes?: string | null;
  follow_up_plan?: string | null;
}

export interface DischargeRead {
  id: number;
  admission_id: number;
  discharge_reason_id: number;
  discharge_reason_name: string;
  discharge_condition_id: number;
  discharge_condition_name: string;
  discharge_notes: string | null;
  follow_up_plan: string | null;
  discharged_at: string;
  discharged_by_name: string;
}

export interface HospitalizationCatalogs {
  admission_reasons: { id: number; name: string }[];
  equipment_items: { id: number; name: string }[];
  nursing_actions: { id: number; name: string }[];
  order_types: { id: number; name: string }[];
  frequencies: { id: number; code: string; name: string }[];
  transfer_reasons: { id: number; name: string }[];
  discharge_reasons: { id: number; name: string }[];
  discharge_conditions: { id: number; name: string }[];
}

// ── API 函式 ──────────────────────────────────────────────────

export const hospitalizationApi = {
  // Catalogs（所有住院相關下拉選項一次取得）
  getCatalogs: (): Promise<HospitalizationCatalogs> =>
    api.get("/hospitalization/catalogs").then((r) => r.data),
  // 病房 & 病床
  listWards: (): Promise<WardRead[]> =>
    api.get("/wards").then((r) => r.data),

  getWard: (wardId: number): Promise<WardDetailRead> =>
    api.get(`/wards/${wardId}`).then((r) => r.data),

  getWardOccupancy: (wardId: number): Promise<{
    bed_id: number;
    bed_number: string;
    admission_id: number;
    visit_id: number;
    animal_name: string;
    owner_name: string;
    admitted_at: string | null;
    days: number;
  }[]> =>
    api.get(`/wards/${wardId}/occupancy`).then((r) => r.data),

  // 入院
  createAdmission: (visitId: number, body: AdmissionCreate): Promise<AdmissionRead> =>
    api.post(`/visits/${visitId}/admission`, body).then((r) => r.data),

  getAdmission: (admissionId: number): Promise<AdmissionRead> =>
    api.get(`/admissions/${admissionId}`).then((r) => r.data),

  // 透過 visit_id 查詢住院紀錄（前端用：先查有無 admission）
  getAdmissionByVisit: (visitId: number): Promise<AdmissionRead | null> =>
    api.get(`/visits/${visitId}/admission`).then((r) => r.data).catch(() => null),

  // 巡房紀錄
  listDailyRounds: (admissionId: number): Promise<DailyRoundRead[]> =>
    api.get(`/admissions/${admissionId}/daily-rounds`).then((r) => r.data),

  createDailyRound: (admissionId: number, body: DailyRoundCreate): Promise<DailyRoundRead> =>
    api.post(`/admissions/${admissionId}/daily-rounds`, body).then((r) => r.data),

  // 護理紀錄
  listNursingLogs: (admissionId: number): Promise<NursingLogRead[]> =>
    api.get(`/admissions/${admissionId}/nursing-logs`).then((r) => r.data),

  createNursingLog: (admissionId: number, body: NursingLogCreate): Promise<NursingLogRead> =>
    api.post(`/admissions/${admissionId}/nursing-logs`, body).then((r) => r.data),

  // 住院醫囑
  listOrders: (admissionId: number): Promise<InpatientOrderRead[]> =>
    api.get(`/admissions/${admissionId}/orders`).then((r) => r.data),

  createOrder: (admissionId: number, body: InpatientOrderCreate): Promise<InpatientOrderRead> =>
    api.post(`/admissions/${admissionId}/orders`, body).then((r) => r.data),

  executeOrder: (orderId: number, notes?: string): Promise<OrderExecutionRead> =>
    api.post(`/inpatient-orders/${orderId}/execute`, { notes }).then((r) => r.data),

  cancelOrder: (orderId: number): Promise<InpatientOrderRead> =>
    api.patch(`/inpatient-orders/${orderId}/cancel`).then((r) => r.data),

  // 轉床
  transfer: (admissionId: number, body: BedTransferCreate): Promise<BedTransferRead> =>
    api.post(`/admissions/${admissionId}/transfer`, body).then((r) => r.data),

  // 出院
  discharge: (admissionId: number, body: DischargeCreate): Promise<DischargeRead> =>
    api.post(`/admissions/${admissionId}/discharge`, body).then((r) => r.data),
};
