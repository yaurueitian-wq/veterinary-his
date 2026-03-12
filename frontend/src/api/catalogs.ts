import api from "@/api";

// ══════════════════════════════════════════════════════════════════
// Read 型別
// ══════════════════════════════════════════════════════════════════

export interface BreedRead {
  id: number;
  species_id: number;
  name: string;
  is_active: boolean;
}

export interface SpeciesRead {
  id: number;
  name: string;
  is_active: boolean;
  breeds: BreedRead[];
}

export interface BloodTypeRead {
  id: number;
  species_id: number;
  code: string;
  display_name: string;
  is_active: boolean;
}

export interface ContactTypeRead {
  id: number;
  type_key: string;
  display_name: string;
  is_active: boolean;
}

export interface MucousMembraneColorRead {
  id: number;
  name: string;
  is_active: boolean;
}

export interface AdministrationRouteRead {
  id: number;
  name: string;
  is_active: boolean;
}

export interface MedicationRead {
  id: number;
  name: string;
  medication_category_id: number | null;
  default_dose_unit: string | null;
  is_active: boolean;
}

export interface MedicationCategoryRead {
  id: number;
  name: string;
  is_active: boolean;
  medications: MedicationRead[];
}

export interface ProcedureTypeRead {
  id: number;
  name: string;
  procedure_category_id: number | null;
  species_id: number | null;
  is_active: boolean;
}

export interface ProcedureCategoryRead {
  id: number;
  name: string;
  is_active: boolean;
  procedure_types: ProcedureTypeRead[];
}

export interface DiagnosisCategoryRead {
  id: number;
  organization_id: number;
  name: string;
  is_active: boolean;
}

export interface DiagnosisCodeRead {
  id: number;
  organization_id: number;
  name: string;
  code: string | null;
  coding_system: string | null;
  category_id: number | null;
  species_id: number | null;
  is_active: boolean;
}

export interface LabAnalyteRead {
  id: number;
  lab_test_type_id: number;
  name: string;
  unit: string | null;
  analyte_type: "numeric" | "text";
  sort_order: number;
  is_active: boolean;
}

export interface LabTestTypeRead {
  id: number;
  lab_category_id: number;
  name: string;
  is_active: boolean;
  analytes: LabAnalyteRead[];
}

export interface LabCategoryRead {
  id: number;
  name: string;
  is_active: boolean;
  test_types: LabTestTypeRead[];
}

// ══════════════════════════════════════════════════════════════════
// Create / Update 型別
// ══════════════════════════════════════════════════════════════════

export interface SpeciesCreate { name: string }
export interface SpeciesUpdate { name?: string; is_active?: boolean }

export interface BreedCreate { species_id: number; name: string }
export interface BreedUpdate { name?: string; is_active?: boolean }

export interface BloodTypeCreate { species_id: number; code: string; display_name: string }
export interface BloodTypeUpdate { display_name?: string; is_active?: boolean }

export interface ContactTypeCreate { type_key: string; display_name: string }
export interface ContactTypeUpdate { display_name?: string; is_active?: boolean }

export interface MucousMembraneColorCreate { name: string }
export interface MucousMembraneColorUpdate { name?: string; is_active?: boolean }

export interface AdministrationRouteCreate { name: string }
export interface AdministrationRouteUpdate { name?: string; is_active?: boolean }

export interface MedicationCategoryCreate { name: string }
export interface MedicationCategoryUpdate { name?: string; is_active?: boolean }

export interface MedicationCreate {
  name: string;
  medication_category_id?: number | null;
  default_dose_unit?: string | null;
}
export interface MedicationUpdate {
  name?: string;
  medication_category_id?: number | null;
  default_dose_unit?: string | null;
  is_active?: boolean;
}

export interface ProcedureCategoryCreate { name: string }
export interface ProcedureCategoryUpdate { name?: string; is_active?: boolean }

export interface ProcedureTypeCreate {
  name: string;
  procedure_category_id?: number | null;
  species_id?: number | null;
}
export interface ProcedureTypeUpdate {
  name?: string;
  procedure_category_id?: number | null;
  species_id?: number | null;
  is_active?: boolean;
}

export interface DiagnosisCategoryCreate { name: string }
export interface DiagnosisCategoryUpdate { name?: string; is_active?: boolean }

export interface DiagnosisCodeCreate {
  name: string;
  category_id?: number | null;
  species_id?: number | null;
  code?: string | null;
  coding_system?: "internal" | "venomcode" | "snomed";
}
export interface DiagnosisCodeUpdate {
  name?: string;
  category_id?: number | null;
  species_id?: number | null;
  code?: string | null;
  coding_system?: "internal" | "venomcode" | "snomed";
  is_active?: boolean;
}

export interface LabCategoryCreate { name: string }
export interface LabCategoryUpdate { name?: string; is_active?: boolean }

export interface LabTestTypeCreate { name: string; lab_category_id: number }
export interface LabTestTypeUpdate { name?: string; lab_category_id?: number; is_active?: boolean }

export interface LabAnalyteCreate {
  name: string;
  lab_test_type_id: number;
  unit?: string | null;
  analyte_type?: "numeric" | "text";
  sort_order?: number;
}
export interface LabAnalyteUpdate {
  name?: string;
  unit?: string | null;
  analyte_type?: "numeric" | "text";
  sort_order?: number;
  is_active?: boolean;
}

// ══════════════════════════════════════════════════════════════════
// API 函式
// ══════════════════════════════════════════════════════════════════

export const catalogsApi = {
  // ── Species ─────────────────────────────────────────────────────
  species: (includeInactive = false): Promise<SpeciesRead[]> =>
    api.get("/catalogs/species", { params: { include_inactive: includeInactive } }).then((r) => r.data),
  createSpecies: (data: SpeciesCreate): Promise<SpeciesRead> =>
    api.post("/catalogs/species", data).then((r) => r.data),
  updateSpecies: (id: number, data: SpeciesUpdate): Promise<SpeciesRead> =>
    api.put(`/catalogs/species/${id}`, data).then((r) => r.data),
  toggleSpeciesActive: (id: number): Promise<SpeciesRead> =>
    api.patch(`/catalogs/species/${id}/active`).then((r) => r.data),

  // ── Breeds ──────────────────────────────────────────────────────
  createBreed: (data: BreedCreate): Promise<BreedRead> =>
    api.post("/catalogs/breeds", data).then((r) => r.data),
  updateBreed: (id: number, data: BreedUpdate): Promise<BreedRead> =>
    api.put(`/catalogs/breeds/${id}`, data).then((r) => r.data),
  toggleBreedActive: (id: number): Promise<BreedRead> =>
    api.patch(`/catalogs/breeds/${id}/active`).then((r) => r.data),

  // ── Blood Types ─────────────────────────────────────────────────
  bloodTypes: (speciesId?: number, includeInactive = false): Promise<BloodTypeRead[]> =>
    api
      .get("/catalogs/blood-types", {
        params: { ...(speciesId ? { species_id: speciesId } : {}), include_inactive: includeInactive },
      })
      .then((r) => r.data),
  createBloodType: (data: BloodTypeCreate): Promise<BloodTypeRead> =>
    api.post("/catalogs/blood-types", data).then((r) => r.data),
  updateBloodType: (id: number, data: BloodTypeUpdate): Promise<BloodTypeRead> =>
    api.put(`/catalogs/blood-types/${id}`, data).then((r) => r.data),
  toggleBloodTypeActive: (id: number): Promise<BloodTypeRead> =>
    api.patch(`/catalogs/blood-types/${id}/active`).then((r) => r.data),

  // ── Contact Types ───────────────────────────────────────────────
  contactTypes: (includeInactive = false): Promise<ContactTypeRead[]> =>
    api.get("/catalogs/contact-types", { params: { include_inactive: includeInactive } }).then((r) => r.data),
  createContactType: (data: ContactTypeCreate): Promise<ContactTypeRead> =>
    api.post("/catalogs/contact-types", data).then((r) => r.data),
  updateContactType: (id: number, data: ContactTypeUpdate): Promise<ContactTypeRead> =>
    api.put(`/catalogs/contact-types/${id}`, data).then((r) => r.data),
  toggleContactTypeActive: (id: number): Promise<ContactTypeRead> =>
    api.patch(`/catalogs/contact-types/${id}/active`).then((r) => r.data),

  // ── Mucous Membrane Colors ──────────────────────────────────────
  mucousMembraneColors: (includeInactive = false): Promise<MucousMembraneColorRead[]> =>
    api.get("/catalogs/mucous-membrane-colors", { params: { include_inactive: includeInactive } }).then((r) => r.data),
  createMucousMembraneColor: (data: MucousMembraneColorCreate): Promise<MucousMembraneColorRead> =>
    api.post("/catalogs/mucous-membrane-colors", data).then((r) => r.data),
  updateMucousMembraneColor: (id: number, data: MucousMembraneColorUpdate): Promise<MucousMembraneColorRead> =>
    api.put(`/catalogs/mucous-membrane-colors/${id}`, data).then((r) => r.data),
  toggleMucousMembraneColorActive: (id: number): Promise<MucousMembraneColorRead> =>
    api.patch(`/catalogs/mucous-membrane-colors/${id}/active`).then((r) => r.data),

  // ── Administration Routes ────────────────────────────────────────
  administrationRoutes: (includeInactive = false): Promise<AdministrationRouteRead[]> =>
    api.get("/catalogs/administration-routes", { params: { include_inactive: includeInactive } }).then((r) => r.data),
  createAdministrationRoute: (data: AdministrationRouteCreate): Promise<AdministrationRouteRead> =>
    api.post("/catalogs/administration-routes", data).then((r) => r.data),
  updateAdministrationRoute: (id: number, data: AdministrationRouteUpdate): Promise<AdministrationRouteRead> =>
    api.put(`/catalogs/administration-routes/${id}`, data).then((r) => r.data),
  toggleAdministrationRouteActive: (id: number): Promise<AdministrationRouteRead> =>
    api.patch(`/catalogs/administration-routes/${id}/active`).then((r) => r.data),

  // ── Medication Categories ────────────────────────────────────────
  medicationCategories: (includeInactive = false): Promise<MedicationCategoryRead[]> =>
    api.get("/catalogs/medication-categories", { params: { include_inactive: includeInactive } }).then((r) => r.data),
  createMedicationCategory: (data: MedicationCategoryCreate): Promise<MedicationCategoryRead> =>
    api.post("/catalogs/medication-categories", data).then((r) => r.data),
  updateMedicationCategory: (id: number, data: MedicationCategoryUpdate): Promise<MedicationCategoryRead> =>
    api.put(`/catalogs/medication-categories/${id}`, data).then((r) => r.data),
  toggleMedicationCategoryActive: (id: number): Promise<MedicationCategoryRead> =>
    api.patch(`/catalogs/medication-categories/${id}/active`).then((r) => r.data),

  // ── Medications ──────────────────────────────────────────────────
  medications: (categoryId?: number, includeInactive = false): Promise<MedicationRead[]> =>
    api
      .get("/catalogs/medications", {
        params: { ...(categoryId ? { category_id: categoryId } : {}), include_inactive: includeInactive },
      })
      .then((r) => r.data),
  createMedication: (data: MedicationCreate): Promise<MedicationRead> =>
    api.post("/catalogs/medications", data).then((r) => r.data),
  updateMedication: (id: number, data: MedicationUpdate): Promise<MedicationRead> =>
    api.put(`/catalogs/medications/${id}`, data).then((r) => r.data),
  toggleMedicationActive: (id: number): Promise<MedicationRead> =>
    api.patch(`/catalogs/medications/${id}/active`).then((r) => r.data),

  // ── Procedure Categories ─────────────────────────────────────────
  procedureCategories: (includeInactive = false): Promise<ProcedureCategoryRead[]> =>
    api.get("/catalogs/procedure-categories", { params: { include_inactive: includeInactive } }).then((r) => r.data),
  createProcedureCategory: (data: ProcedureCategoryCreate): Promise<ProcedureCategoryRead> =>
    api.post("/catalogs/procedure-categories", data).then((r) => r.data),
  updateProcedureCategory: (id: number, data: ProcedureCategoryUpdate): Promise<ProcedureCategoryRead> =>
    api.put(`/catalogs/procedure-categories/${id}`, data).then((r) => r.data),
  toggleProcedureCategoryActive: (id: number): Promise<ProcedureCategoryRead> =>
    api.patch(`/catalogs/procedure-categories/${id}/active`).then((r) => r.data),

  // ── Procedure Types ──────────────────────────────────────────────
  procedureTypes: (categoryId?: number, speciesId?: number, includeInactive = false): Promise<ProcedureTypeRead[]> =>
    api
      .get("/catalogs/procedure-types", {
        params: {
          ...(categoryId ? { category_id: categoryId } : {}),
          ...(speciesId ? { species_id: speciesId } : {}),
          include_inactive: includeInactive,
        },
      })
      .then((r) => r.data),
  createProcedureType: (data: ProcedureTypeCreate): Promise<ProcedureTypeRead> =>
    api.post("/catalogs/procedure-types", data).then((r) => r.data),
  updateProcedureType: (id: number, data: ProcedureTypeUpdate): Promise<ProcedureTypeRead> =>
    api.put(`/catalogs/procedure-types/${id}`, data).then((r) => r.data),
  toggleProcedureTypeActive: (id: number): Promise<ProcedureTypeRead> =>
    api.patch(`/catalogs/procedure-types/${id}/active`).then((r) => r.data),

  // ── Diagnosis Categories ─────────────────────────────────────────
  diagnosisCategories: (includeInactive = false): Promise<DiagnosisCategoryRead[]> =>
    api.get("/catalogs/diagnosis-categories", { params: { include_inactive: includeInactive } }).then((r) => r.data),
  createDiagnosisCategory: (data: DiagnosisCategoryCreate): Promise<DiagnosisCategoryRead> =>
    api.post("/catalogs/diagnosis-categories", data).then((r) => r.data),
  updateDiagnosisCategory: (id: number, data: DiagnosisCategoryUpdate): Promise<DiagnosisCategoryRead> =>
    api.put(`/catalogs/diagnosis-categories/${id}`, data).then((r) => r.data),
  toggleDiagnosisCategoryActive: (id: number): Promise<DiagnosisCategoryRead> =>
    api.patch(`/catalogs/diagnosis-categories/${id}/active`).then((r) => r.data),

  // ── Diagnosis Codes ──────────────────────────────────────────────
  diagnosisCodes: (categoryId?: number, speciesId?: number, includeInactive = false): Promise<DiagnosisCodeRead[]> =>
    api
      .get("/catalogs/diagnosis-codes", {
        params: {
          ...(categoryId ? { category_id: categoryId } : {}),
          ...(speciesId ? { species_id: speciesId } : {}),
          include_inactive: includeInactive,
        },
      })
      .then((r) => r.data),
  createDiagnosisCode: (data: DiagnosisCodeCreate): Promise<DiagnosisCodeRead> =>
    api.post("/catalogs/diagnosis-codes", data).then((r) => r.data),
  updateDiagnosisCode: (id: number, data: DiagnosisCodeUpdate): Promise<DiagnosisCodeRead> =>
    api.put(`/catalogs/diagnosis-codes/${id}`, data).then((r) => r.data),
  toggleDiagnosisCodeActive: (id: number): Promise<DiagnosisCodeRead> =>
    api.patch(`/catalogs/diagnosis-codes/${id}/active`).then((r) => r.data),

  // ── Lab Categories ───────────────────────────────────────────────
  labCategories: (includeInactive = false): Promise<LabCategoryRead[]> =>
    api.get("/catalogs/lab-categories", { params: { include_inactive: includeInactive } }).then((r) => r.data),
  createLabCategory: (data: LabCategoryCreate): Promise<LabCategoryRead> =>
    api.post("/catalogs/lab-categories", data).then((r) => r.data),
  updateLabCategory: (id: number, data: LabCategoryUpdate): Promise<LabCategoryRead> =>
    api.put(`/catalogs/lab-categories/${id}`, data).then((r) => r.data),
  toggleLabCategoryActive: (id: number): Promise<LabCategoryRead> =>
    api.patch(`/catalogs/lab-categories/${id}/active`).then((r) => r.data),

  // ── Lab Test Types ───────────────────────────────────────────────
  labTestTypes: (categoryId?: number, includeInactive = false): Promise<LabTestTypeRead[]> =>
    api
      .get("/catalogs/lab-test-types", {
        params: { ...(categoryId ? { category_id: categoryId } : {}), include_inactive: includeInactive },
      })
      .then((r) => r.data),
  createLabTestType: (data: LabTestTypeCreate): Promise<LabTestTypeRead> =>
    api.post("/catalogs/lab-test-types", data).then((r) => r.data),
  updateLabTestType: (id: number, data: LabTestTypeUpdate): Promise<LabTestTypeRead> =>
    api.put(`/catalogs/lab-test-types/${id}`, data).then((r) => r.data),
  toggleLabTestTypeActive: (id: number): Promise<LabTestTypeRead> =>
    api.patch(`/catalogs/lab-test-types/${id}/active`).then((r) => r.data),

  // ── Lab Analytes ─────────────────────────────────────────────────
  labAnalytes: (testTypeId?: number, includeInactive = false): Promise<LabAnalyteRead[]> =>
    api
      .get("/catalogs/lab-analytes", {
        params: { ...(testTypeId ? { test_type_id: testTypeId } : {}), include_inactive: includeInactive },
      })
      .then((r) => r.data),
  createLabAnalyte: (data: LabAnalyteCreate): Promise<LabAnalyteRead> =>
    api.post("/catalogs/lab-analytes", data).then((r) => r.data),
  updateLabAnalyte: (id: number, data: LabAnalyteUpdate): Promise<LabAnalyteRead> =>
    api.put(`/catalogs/lab-analytes/${id}`, data).then((r) => r.data),
  toggleLabAnalyteActive: (id: number): Promise<LabAnalyteRead> =>
    api.patch(`/catalogs/lab-analytes/${id}/active`).then((r) => r.data),
};
