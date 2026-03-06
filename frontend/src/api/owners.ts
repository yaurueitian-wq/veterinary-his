import api from "@/api";

// ── 型別定義 ─────────────────────────────────────────────

export interface ContactRead {
  id: number;
  contact_type_id: number;
  type_key: string;
  display_name: string;
  value: string;
  label: string;
  is_primary: boolean;
}

export interface AnimalBrief {
  id: number;
  name: string;
  species_name: string;
  breed_name: string | null;
  sex: string;
  microchip_number: string | null;
  blood_type_name: string | null;
}

export interface OwnerListItem {
  id: number;
  full_name: string;
  national_id: string | null;
  primary_phone: string | null;
  animal_count: number;
  animal_names: string;
}

export interface OwnerListResponse {
  items: OwnerListItem[];
  total: number;
  page: number;
  page_size: number;
}

export interface OwnerDetail {
  id: number;
  full_name: string;
  national_id: string | null;
  notes: string | null;
  is_active: boolean;
  created_at: string;
  contacts: ContactRead[];
  animals: AnimalBrief[];
}

export interface AnimalRead {
  id: number;
  owner_id: number;
  name: string;
  species_id: number;
  species_name: string;
  breed_id: number | null;
  breed_name: string | null;
  sex: string;
  date_of_birth: string | null;
  birth_year: number | null;
  microchip_number: string | null;
  color: string | null;
  is_deceased: boolean;
  deceased_date: string | null;
  notes: string | null;
  blood_type_id: number | null;
  blood_type_name: string | null;
  general_info: string | null;
  critical_info: string | null;
  neutered_date: string | null;
}

export interface AnimalDiseaseRead {
  id: number;
  animal_id: number;
  diagnosis_code_id: number | null;
  free_text: string | null;
  is_allergy: boolean;
  status: string;
  onset_date: string | null;
  notes: string | null;
  created_at: string;
}

export interface AnimalDiseaseCreate {
  diagnosis_code_id?: number;
  free_text?: string;
  is_allergy?: boolean;
  status?: string;
  onset_date?: string;
  notes?: string;
}

export interface AnimalMedicationRead {
  id: number;
  animal_id: number;
  medication_id: number | null;
  free_text: string | null;
  dose: number | null;
  dose_unit: string | null;
  administration_route_id: number | null;
  frequency: string | null;
  start_date: string | null;
  end_date: string | null;
  notes: string | null;
  created_at: string;
}

export interface AnimalMedicationCreate {
  medication_id?: number;
  free_text?: string;
  dose?: number;
  dose_unit?: string;
  administration_route_id?: number;
  frequency?: string;
  start_date?: string;
  end_date?: string;
  notes?: string;
}

// ── 搜尋參數 ─────────────────────────────────────────────

export interface OwnerListParams {
  name?: string;
  phone?: string;
  national_id?: string;
  animal?: string;
  species?: string;
  page?: number;
  page_size?: number;
}

// ── API 函式 ─────────────────────────────────────────────

export const ownersApi = {
  /** 多欄位搜尋 + 列表 */
  list: (params: OwnerListParams = {}): Promise<OwnerListResponse> =>
    api.get("/owners", { params }).then((r) => r.data),

  /** Combobox 即時建議 */
  suggest: (
    field: "name" | "phone" | "national_id" | "animal" | "species",
    q: string
  ): Promise<string[]> =>
    api.get("/owners/suggest", { params: { field, q } }).then((r) => r.data),

  /** 飼主詳細 */
  get: (id: number): Promise<OwnerDetail> =>
    api.get(`/owners/${id}`).then((r) => r.data),

  /** 新增飼主 */
  create: (body: {
    full_name: string;
    national_id?: string;
    notes?: string;
    contacts?: {
      contact_type_id: number;
      value: string;
      label?: string;
      is_primary: boolean;
    }[];
  }): Promise<OwnerDetail> =>
    api.post("/owners", body).then((r) => r.data),

  /** 更新飼主 */
  update: (
    id: number,
    body: { full_name?: string; national_id?: string; notes?: string }
  ): Promise<OwnerDetail> =>
    api.patch(`/owners/${id}`, body).then((r) => r.data),

  /** 刪除飼主（軟刪除） */
  delete: (id: number): Promise<void> =>
    api.delete(`/owners/${id}`).then(() => undefined),

  /** 為飼主新增動物 */
  createAnimal: (
    ownerId: number,
    body: Partial<AnimalRead>
  ): Promise<AnimalRead> =>
    api.post(`/owners/${ownerId}/animals`, body).then((r) => r.data),
};

export const animalsApi = {
  /** 動物詳細 */
  get: (id: number): Promise<AnimalRead> =>
    api.get(`/animals/${id}`).then((r) => r.data),

  /** 更新動物 */
  update: (id: number, body: Partial<AnimalRead>): Promise<AnimalRead> =>
    api.patch(`/animals/${id}`, body).then((r) => r.data),

  /** 刪除動物 */
  delete: (id: number): Promise<void> =>
    api.delete(`/animals/${id}`).then(() => undefined),

  /** 疾病史 */
  getDiseases: (id: number): Promise<AnimalDiseaseRead[]> =>
    api.get(`/animals/${id}/diseases`).then((r) => r.data),

  createDisease: (id: number, body: AnimalDiseaseCreate): Promise<AnimalDiseaseRead> =>
    api.post(`/animals/${id}/diseases`, body).then((r) => r.data),

  deleteDisease: (animalId: number, diseaseId: number): Promise<void> =>
    api.delete(`/animals/${animalId}/diseases/${diseaseId}`).then(() => undefined),

  /** 長期用藥 */
  getMedications: (id: number): Promise<AnimalMedicationRead[]> =>
    api.get(`/animals/${id}/medications`).then((r) => r.data),

  createMedication: (id: number, body: AnimalMedicationCreate): Promise<AnimalMedicationRead> =>
    api.post(`/animals/${id}/medications`, body).then((r) => r.data),

  deleteMedication: (animalId: number, medicationId: number): Promise<void> =>
    api.delete(`/animals/${animalId}/medications/${medicationId}`).then(() => undefined),
};

// ── 性別顯示對應 ─────────────────────────────────────────

export const SEX_LABELS: Record<string, string> = {
  intact_male: "公（未結紮）",
  intact_female: "母（未結紮）",
  neutered_male: "公（已結紮）",
  neutered_female: "母（已結紮）",
  unknown: "不明",
};

export const DISEASE_STATUS_LABELS: Record<string, string> = {
  active: "活動中",
  chronic: "慢性",
  in_remission: "緩解中",
  resolved: "已痊癒",
};
