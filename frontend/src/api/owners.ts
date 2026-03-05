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
    body: {
      name: string;
      species_id: number;
      breed_id?: number;
      sex: string;
      date_of_birth?: string;
      birth_year?: number;
      microchip_number?: string;
      color?: string;
      notes?: string;
    }
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
};

// ── 性別顯示對應 ─────────────────────────────────────────

export const SEX_LABELS: Record<string, string> = {
  intact_male: "公（未結紮）",
  intact_female: "母（未結紮）",
  neutered_male: "公（已結紮）",
  neutered_female: "母（已結紮）",
  unknown: "不明",
};
