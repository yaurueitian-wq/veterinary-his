import api from "@/api";

// ── 型別定義 ──────────────────────────────────────────────────

export interface VitalSignCreate {
  weight_kg?: number | null;
  temperature_c?: number | null;
  heart_rate_bpm?: number | null;
  respiratory_rate_bpm?: number | null;
  systolic_bp_mmhg?: number | null;
  capillary_refill_sec?: number | null;
  body_condition_score?: number | null;
  mucous_membrane_color_id?: number | null;
}

export interface VitalSignRead extends VitalSignCreate {
  id: number;
  visit_id: number;
  mucous_membrane_color_name: string | null;
  is_superseded: boolean;
  created_at: string;
  created_by_name: string | null;
}

export interface SoapDiagnosisCreate {
  free_text: string;
}

export interface SoapDiagnosisRead {
  id: number;
  free_text: string | null;
  is_superseded: boolean;
  created_at: string;
  created_by_name: string | null;
}

export interface SoapNoteCreate {
  subjective?: string | null;
  objective?: string | null;
  assessment?: string | null;
  plan?: string | null;
  diagnoses?: SoapDiagnosisCreate[];
}

export interface SoapNoteRead {
  id: number;
  visit_id: number;
  subjective: string | null;
  objective: string | null;
  assessment: string | null;
  plan: string | null;
  diagnoses: SoapDiagnosisRead[];
  is_superseded: boolean;
  created_at: string;
  created_by_name: string | null;
}

export interface NursingNoteCreate {
  note_text: string;
}

export interface NursingNoteRead {
  id: number;
  visit_id: number;
  note_text: string;
  is_superseded: boolean;
  created_at: string;
}

export interface ClinicalSummary {
  latest_weight_kg: number | null;
  latest_temperature_c: number | null;
  latest_heart_rate_bpm: number | null;
  latest_diagnosis: string | null;
  has_pending_lab: boolean;
}

// ── Lab 型別 ──────────────────────────────────────────────────

export interface LabAnalyteRead {
  id: number;
  name: string;
  unit: string | null;
  analyte_type: "numeric" | "text";
  sort_order: number;
}

export interface LabTestTypeRead {
  id: number;
  lab_category_id: number;
  name: string;
  analytes: LabAnalyteRead[];
}

export interface LabCategoryRead {
  id: number;
  name: string;
  test_types: LabTestTypeRead[];
}

export interface LabResultItemCreate {
  analyte_id: number;
  value_numeric?: number | null;
  value_text?: string | null;
  is_abnormal?: boolean | null;
  notes?: string | null;
}

export interface LabResultItemRead {
  id: number;
  analyte_id: number;
  analyte_name: string;
  unit: string | null;
  analyte_type: "numeric" | "text";
  value_numeric: number | null;
  value_text: string | null;
  is_abnormal: boolean | null;
  notes: string | null;
  is_superseded: boolean;
  created_at: string;
  created_by_name: string | null;
}

export interface LabOrderCreate {
  test_type_id: number;
  notes?: string | null;
}

export interface LabOrderRead {
  id: number;
  visit_id: number;
  test_type_id: number;
  test_type_name: string;
  status: "pending" | "resulted" | "cancelled";
  notes: string | null;
  resulted_at: string | null;
  resulted_by_name: string | null;
  is_superseded: boolean;
  created_at: string;
  created_by_name: string | null;
  result_items: LabResultItemRead[];
}

export interface LabResultSubmit {
  items: LabResultItemCreate[];
}

// ── API 函式 ──────────────────────────────────────────────────

export const clinicalApi = {
  // Vital Signs
  getVitalSigns: (visitId: number): Promise<VitalSignRead[]> =>
    api.get(`/visits/${visitId}/vital-signs`).then((r) => r.data),

  createVitalSign: (
    visitId: number,
    body: VitalSignCreate
  ): Promise<VitalSignRead> =>
    api.post(`/visits/${visitId}/vital-signs`, body).then((r) => r.data),

  // SOAP Notes
  getSoapNotes: (visitId: number): Promise<SoapNoteRead[]> =>
    api.get(`/visits/${visitId}/soap-notes`).then((r) => r.data),

  createSoapNote: (
    visitId: number,
    body: SoapNoteCreate
  ): Promise<SoapNoteRead> =>
    api.post(`/visits/${visitId}/soap-notes`, body).then((r) => r.data),

  // Nursing Notes
  getNursingNotes: (visitId: number): Promise<NursingNoteRead[]> =>
    api.get(`/visits/${visitId}/nursing-notes`).then((r) => r.data),

  createNursingNote: (
    visitId: number,
    body: NursingNoteCreate
  ): Promise<NursingNoteRead> =>
    api.post(`/visits/${visitId}/nursing-notes`, body).then((r) => r.data),

  getClinicalSummary: (visitId: number): Promise<ClinicalSummary> =>
    api.get(`/visits/${visitId}/clinical-summary`).then((r) => r.data),

  // Lab Orders
  getLabOrders: (visitId: number): Promise<LabOrderRead[]> =>
    api.get(`/visits/${visitId}/lab-orders`).then((r) => r.data),

  createLabOrder: (visitId: number, body: LabOrderCreate): Promise<LabOrderRead> =>
    api.post(`/visits/${visitId}/lab-orders`, body).then((r) => r.data),

  submitLabResults: (
    visitId: number,
    orderId: number,
    body: LabResultSubmit
  ): Promise<LabOrderRead> =>
    api
      .post(`/visits/${visitId}/lab-orders/${orderId}/results`, body)
      .then((r) => r.data),

  cancelLabOrder: (visitId: number, orderId: number): Promise<LabOrderRead> =>
    api.patch(`/visits/${visitId}/lab-orders/${orderId}`).then((r) => r.data),

  // Lab Catalog
  getLabCategories: (): Promise<LabCategoryRead[]> =>
    api.get("/catalogs/lab-categories").then((r) => r.data),
};
