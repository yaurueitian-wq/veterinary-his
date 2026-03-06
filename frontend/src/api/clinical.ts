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
}

export interface VitalSignRead extends VitalSignCreate {
  id: number;
  visit_id: number;
  is_superseded: boolean;
  created_at: string;
  created_by_name: string | null;
}

export interface SoapDiagnosisCreate {
  free_text: string;
  is_primary?: boolean;
}

export interface SoapDiagnosisRead {
  id: number;
  free_text: string | null;
  is_primary: boolean;
  is_superseded: boolean;
  created_at: string;
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
};
