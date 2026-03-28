# 獸醫診所 HIS 系統 — 資料模型

> **建立日期**：2026-03-05
> **設計方法**：流程驅動，由基礎表開始，逐模組展開
> **參考基準**：GNU Health HIS 3.6（`docs/GNU_HEALTH_ANALYSIS.md`）、架構決策見 `DECISIONS.md`

---

## 設計慣例

| 慣例 | 說明 |
|------|------|
| `organization_id` | 所有業務表必含，對應集團（MVP 只有一筆） |
| `clinic_id` | 所有業務流程表必含，對應分院 |
| `created_by` | 所有業務資料必含，外鍵至 `users.id`，不允許 NULL |
| `created_at` | 所有表必含，`TIMESTAMPTZ NOT NULL DEFAULT now()` |
| `is_active` | 目錄類資料用 `is_active` 停用而非刪除，保留歷史完整性 |
| Append-only | 醫療紀錄（vital signs、SOAP、醫囑）不直接修改，以 `is_superseded` / `superseded_by` 標記舊版 |
| CHECK 約束 | 狀態機值、生物性別等由程式邏輯驅動的有限集合 |
| 目錄表（Catalog） | 管理員可增減的詞彙集（物種、品種、診斷碼、檢驗項目等） |
| 無規範字串 | 盡量避免；不可避免的自由文字限於臨床敘述（SOAP narrative）、動物名稱 |

---

## 基礎表（Foundation）

### `organizations`（集團）

```sql
CREATE TABLE organizations (
  id          SERIAL PRIMARY KEY,
  name        VARCHAR(200) NOT NULL,
  created_at  TIMESTAMPTZ NOT NULL DEFAULT now()
);
-- MVP 只有一筆資料；organization_id 預留多租戶擴充（ADR-004）
```

### `clinics`（分院）

```sql
CREATE TABLE clinics (
  id               SERIAL PRIMARY KEY,
  organization_id  INTEGER NOT NULL REFERENCES organizations(id),
  name             VARCHAR(200) NOT NULL,
  address          TEXT,
  phone            VARCHAR(50),
  is_active        BOOLEAN NOT NULL DEFAULT TRUE,
  created_at       TIMESTAMPTZ NOT NULL DEFAULT now()
);
```

### `role_definitions`（角色目錄）

```sql
CREATE TABLE role_definitions (
  id               SERIAL PRIMARY KEY,
  organization_id  INTEGER NOT NULL REFERENCES organizations(id),
  role_key         VARCHAR(50) NOT NULL,    -- 程式使用的識別碼（vet / nurse / technician / receptionist / admin）
  display_name     VARCHAR(100) NOT NULL,   -- 介面顯示名稱（獸醫師 / 護理人員 ...）
  is_active        BOOLEAN NOT NULL DEFAULT TRUE,
  CONSTRAINT role_definitions_unique UNIQUE (organization_id, role_key)
);
-- 初始資料：vet / nurse / technician / receptionist / admin
-- 新增角色由 admin 在系統介面操作，無需改程式碼
```

### `users`（系統使用者）

```sql
CREATE TABLE users (
  id               SERIAL PRIMARY KEY,
  organization_id  INTEGER NOT NULL REFERENCES organizations(id),
  full_name        VARCHAR(200) NOT NULL,
  email            VARCHAR(200) NOT NULL,
  hashed_password  VARCHAR NOT NULL,
  is_active        BOOLEAN NOT NULL DEFAULT TRUE,
  created_at       TIMESTAMPTZ NOT NULL DEFAULT now(),
  created_by       INTEGER REFERENCES users(id),  -- 第一個 admin 為 NULL
  CONSTRAINT users_email_org_unique UNIQUE (organization_id, email)
);
```

### `user_roles`（角色指派）

```sql
CREATE TABLE user_roles (
  id                   SERIAL PRIMARY KEY,
  user_id              INTEGER NOT NULL REFERENCES users(id),
  role_definition_id   INTEGER NOT NULL REFERENCES role_definitions(id),
  clinic_id            INTEGER REFERENCES clinics(id),
  -- NULL = 全集團授權（admin 使用）
  -- 非 NULL = 僅限特定分院
  -- 同一人在不同分院可有不同角色
  granted_at           TIMESTAMPTZ NOT NULL DEFAULT now(),
  granted_by           INTEGER NOT NULL REFERENCES users(id),
  revoked_at           TIMESTAMPTZ    -- NULL 表示仍有效；不刪除資料
);
-- PostgreSQL NULL 不視為相等，inline UNIQUE 無法正確處理 clinic_id IS NULL 的情況
-- 改用兩個 partial index，各自涵蓋「有指定分院」與「全集團授權」的情境
CREATE UNIQUE INDEX user_roles_clinic_active_idx
  ON user_roles (user_id, role_definition_id, clinic_id)
  WHERE clinic_id IS NOT NULL AND revoked_at IS NULL;
CREATE UNIQUE INDEX user_roles_org_active_idx
  ON user_roles (user_id, role_definition_id)
  WHERE clinic_id IS NULL AND revoked_at IS NULL;
-- 登入邏輯（應用層）：
--   1. 登入後查詢 user_roles（revoked_at IS NULL）得到可存取分院清單
--   2. 使用者選擇分院，active_clinic_id 存入 session/JWT
--   3. 無授權的分院 → 拒絕選擇
```

---

## 共用目錄表（Reference Catalogs）

### `contact_types`（聯絡方式類型）

```sql
CREATE TABLE contact_types (
  id               SERIAL PRIMARY KEY,
  organization_id  INTEGER NOT NULL REFERENCES organizations(id),
  type_key         VARCHAR(30) NOT NULL,    -- phone / email / line / other
  display_name     VARCHAR(50) NOT NULL,
  is_active        BOOLEAN NOT NULL DEFAULT TRUE,
  CONSTRAINT contact_types_unique UNIQUE (organization_id, type_key)
);
```

### `species`（物種）

```sql
CREATE TABLE species (
  id               SERIAL PRIMARY KEY,
  organization_id  INTEGER NOT NULL REFERENCES organizations(id),
  name             VARCHAR(100) NOT NULL,   -- 犬、貓、兔、鳥類、爬蟲類、牛、馬、其他
  is_active        BOOLEAN NOT NULL DEFAULT TRUE,
  CONSTRAINT species_name_unique UNIQUE (organization_id, name)
);
```

### `breeds`（品種）

```sql
CREATE TABLE breeds (
  id          SERIAL PRIMARY KEY,
  species_id  INTEGER NOT NULL REFERENCES species(id),
  name        VARCHAR(100) NOT NULL,
  is_active   BOOLEAN NOT NULL DEFAULT TRUE,
  CONSTRAINT breeds_name_unique UNIQUE (species_id, name)
);
```

### `blood_types`（血型，物種特定）

```sql
-- migration 0005
CREATE TABLE blood_types (
  id          SERIAL PRIMARY KEY,
  species_id  INTEGER NOT NULL REFERENCES species(id),
  -- 犬: "DEA 1.1+", "DEA 1.1-"；貓: "A", "B", "AB"
  code        VARCHAR(20) NOT NULL,
  display_name VARCHAR(100) NOT NULL,
  is_active   BOOLEAN NOT NULL DEFAULT TRUE,
  CONSTRAINT blood_types_unique UNIQUE (species_id, code)
);
-- 物種特定，無 organization_id（血型是生物事實，如同品種）
```

### `mucous_membrane_colors`（黏膜顏色，vital signs 用）

```sql
CREATE TABLE mucous_membrane_colors (
  id               SERIAL PRIMARY KEY,
  organization_id  INTEGER NOT NULL REFERENCES organizations(id),
  name             VARCHAR(50) NOT NULL,    -- 粉紅（正常）/ 蒼白 / 黃疸 / 發紺 / 充血
  is_active        BOOLEAN NOT NULL DEFAULT TRUE,
  created_at       TIMESTAMPTZ NOT NULL DEFAULT now()  -- M7：補齊 created_at
);
```

### `diagnosis_categories`（診斷分類目錄）

```sql
CREATE TABLE diagnosis_categories (
  id               SERIAL PRIMARY KEY,
  organization_id  INTEGER NOT NULL REFERENCES organizations(id),
  name             VARCHAR(100) NOT NULL,   -- 消化 / 骨科 / 皮膚 / 心臟 / 傳染病 ...
  is_active        BOOLEAN NOT NULL DEFAULT TRUE,
  CONSTRAINT diagnosis_categories_unique UNIQUE (organization_id, name)
);
```

### `diagnosis_codes`（診斷碼目錄）

```sql
CREATE TABLE diagnosis_codes (
  id               SERIAL PRIMARY KEY,
  organization_id  INTEGER NOT NULL REFERENCES organizations(id),
  code             VARCHAR(50),             -- 外部編碼系統的代碼；內部自訂時可為 NULL
  name             VARCHAR(200) NOT NULL,   -- 診斷名稱（顯示用）
  coding_system    VARCHAR(30),
  CONSTRAINT diagnosis_coding_system_check
    CHECK (coding_system IN ('internal', 'venomcode', 'snomed') OR coding_system IS NULL),
  category_id      INTEGER REFERENCES diagnosis_categories(id),  -- 診斷分類（NULL = 未分類）
  species_id       INTEGER REFERENCES species(id),  -- NULL = 跨物種通用
  is_active        BOOLEAN NOT NULL DEFAULT TRUE
  -- MVP：用內部自訂項目（coding_system = 'internal'）
  -- 未來：決定採用 VeNom 後，批次匯入，coding_system = 'venomcode'，無需改 schema
);
-- M3：code 在同 org + coding_system 下必須唯一（code IS NOT NULL 時）
CREATE UNIQUE INDEX diagnosis_codes_code_unique_idx
  ON diagnosis_codes (organization_id, coding_system, code)
  WHERE code IS NOT NULL;
```

### `lab_categories`（檢驗分類目錄）

```sql
CREATE TABLE lab_categories (
  id               SERIAL PRIMARY KEY,
  organization_id  INTEGER NOT NULL REFERENCES organizations(id),
  name             VARCHAR(100) NOT NULL,   -- 血液 / 尿液 / 影像 / 心臟 / 病理 / 其他
  is_active        BOOLEAN NOT NULL DEFAULT TRUE,
  CONSTRAINT lab_categories_unique UNIQUE (organization_id, name)  -- M6
);
```

### `lab_test_types`（檢驗項目目錄）

```sql
CREATE TABLE lab_test_types (
  id               SERIAL PRIMARY KEY,
  organization_id  INTEGER NOT NULL REFERENCES organizations(id),
  lab_category_id  INTEGER NOT NULL REFERENCES lab_categories(id),
  name             VARCHAR(200) NOT NULL,   -- 全血計數（CBC）/ X-ray 胸腔 / 心電圖 ...
  is_active        BOOLEAN NOT NULL DEFAULT TRUE,
  CONSTRAINT lab_test_types_unique UNIQUE (organization_id, name)  -- M6
);
```

### `administration_routes`（給藥途徑目錄）

```sql
CREATE TABLE administration_routes (
  id               SERIAL PRIMARY KEY,
  organization_id  INTEGER NOT NULL REFERENCES organizations(id),
  name             VARCHAR(50) NOT NULL,    -- 口服 / 皮下注射 / 肌肉注射 / 靜脈注射 / 外用 / 眼用 / 耳用 / 吸入
  is_active        BOOLEAN NOT NULL DEFAULT TRUE,
  CONSTRAINT administration_routes_unique UNIQUE (organization_id, name)
);
```

### `dose_units`（劑量單位目錄）

```sql
-- H2：集中管理劑量單位，取代各表的 dose_unit VARCHAR(30) 自由字串
CREATE TABLE dose_units (
  id               SERIAL PRIMARY KEY,
  organization_id  INTEGER NOT NULL REFERENCES organizations(id),
  symbol           VARCHAR(20) NOT NULL,    -- mg / mL / tablet / IU / μg / g / mcg / drop
  display_name     VARCHAR(50) NOT NULL,    -- 毫克 / 毫升 / 錠 / 國際單位 ...
  is_active        BOOLEAN NOT NULL DEFAULT TRUE,
  created_at       TIMESTAMPTZ NOT NULL DEFAULT now(),
  CONSTRAINT dose_units_unique UNIQUE (organization_id, symbol)
);
-- 初始 seed：mg / mL / tablet / IU / μg / g / drop（各院通用）
```

### `prescription_frequencies`（給藥頻率目錄）

```sql
-- H1：集中管理給藥頻率，取代 prescription_orders.frequency VARCHAR(50) 自由字串
CREATE TABLE prescription_frequencies (
  id               SERIAL PRIMARY KEY,
  organization_id  INTEGER NOT NULL REFERENCES organizations(id),
  code             VARCHAR(10) NOT NULL,    -- SID / BID / TID / QID / EOD / PRN / Q8H ...
  display_name     VARCHAR(50) NOT NULL,    -- 每日一次 / 每日兩次 / 需要時使用 ...
  is_active        BOOLEAN NOT NULL DEFAULT TRUE,
  created_at       TIMESTAMPTZ NOT NULL DEFAULT now(),
  CONSTRAINT prescription_frequencies_unique UNIQUE (organization_id, code)
);
-- 初始 seed：SID / BID / TID / QID / EOD / PRN / Q8H / Q12H
```

### `medication_categories`（藥品分類目錄）

```sql
CREATE TABLE medication_categories (
  id               SERIAL PRIMARY KEY,
  organization_id  INTEGER NOT NULL REFERENCES organizations(id),
  name             VARCHAR(100) NOT NULL,   -- 抗生素 / 消炎止痛 / 驅蟲 / 疫苗 / 外用藥 / 點眼耳藥 / 靜脈輸液 / 其他
  is_active        BOOLEAN NOT NULL DEFAULT TRUE,
  CONSTRAINT medication_categories_unique UNIQUE (organization_id, name)
);
```

### `medications`（藥品目錄）

```sql
CREATE TABLE medications (
  id                      SERIAL PRIMARY KEY,
  organization_id         INTEGER NOT NULL REFERENCES organizations(id),
  medication_category_id  INTEGER REFERENCES medication_categories(id),
  name                    VARCHAR(200) NOT NULL,
  default_dose_unit_id    INTEGER REFERENCES dose_units(id),  -- H2：FK 取代 VARCHAR(30)（建議值，可於開立時覆蓋）
  is_active               BOOLEAN NOT NULL DEFAULT TRUE,
  CONSTRAINT medications_unique UNIQUE (organization_id, name)
);
-- MVP 不 seed 藥品（各院品項不同）；由 admin 在系統介面維護
```

### `procedure_categories`（處置/手術分類目錄）

```sql
CREATE TABLE procedure_categories (
  id               SERIAL PRIMARY KEY,
  organization_id  INTEGER NOT NULL REFERENCES organizations(id),
  name             VARCHAR(100) NOT NULL,  -- 外科手術 / 牙科處置 / 影像診斷 / 一般處置 / 其他
  is_active        BOOLEAN NOT NULL DEFAULT TRUE,
  CONSTRAINT procedure_categories_unique UNIQUE (organization_id, name)
);
```

### `procedure_types`（處置/手術項目目錄）

```sql
CREATE TABLE procedure_types (
  id                     SERIAL PRIMARY KEY,
  organization_id        INTEGER NOT NULL REFERENCES organizations(id),
  procedure_category_id  INTEGER REFERENCES procedure_categories(id),
  name                   VARCHAR(200) NOT NULL,
  species_id             INTEGER REFERENCES species(id),  -- NULL = 跨物種通用
  is_active              BOOLEAN NOT NULL DEFAULT TRUE,
  CONSTRAINT procedure_types_unique UNIQUE (organization_id, name)
);
-- MVP 不 seed 手術項目（各院不同）；由 admin 在系統介面維護
```

---

## 模組一：飼主 & 動物建檔

### `owners`（飼主）

```sql
CREATE TABLE owners (
  id               SERIAL PRIMARY KEY,
  organization_id  INTEGER NOT NULL REFERENCES organizations(id),
  -- 跨院所共用，不加 clinic_id（ADR-002）
  full_name        VARCHAR(200) NOT NULL,
  national_id      VARCHAR(20),             -- 身分證字號 / 護照號；nullable，未來串接政府動物登記時重要
  notes            TEXT,
  is_active        BOOLEAN NOT NULL DEFAULT TRUE,
  created_at       TIMESTAMPTZ NOT NULL DEFAULT now(),
  created_by       INTEGER NOT NULL REFERENCES users(id)
);
-- national_id 有值時才需唯一（允許多筆 null，inline UNIQUE 無法處理此情境）
CREATE UNIQUE INDEX owners_national_id_idx
  ON owners (organization_id, national_id)
  WHERE national_id IS NOT NULL;
```

### `owner_contacts`（飼主聯絡方式，複數）

```sql
CREATE TABLE owner_contacts (
  id               SERIAL PRIMARY KEY,
  owner_id         INTEGER NOT NULL REFERENCES owners(id),
  contact_type_id  INTEGER NOT NULL REFERENCES contact_types(id),
  value            VARCHAR(200) NOT NULL,   -- 實際聯絡值（電話號碼 / email / LINE ID ...）
  label            VARCHAR(20) NOT NULL DEFAULT 'personal'
    CHECK (label IN ('personal', 'work', 'other')),
  is_primary       BOOLEAN NOT NULL DEFAULT FALSE,
  is_active        BOOLEAN NOT NULL DEFAULT TRUE,
  created_at       TIMESTAMPTZ NOT NULL DEFAULT now(),
  created_by       INTEGER NOT NULL REFERENCES users(id)
);
```

### `owner_addresses`（飼主地址，複數）

```sql
CREATE TABLE owner_addresses (
  id           SERIAL PRIMARY KEY,
  owner_id     INTEGER NOT NULL REFERENCES owners(id),
  label        VARCHAR(20) NOT NULL DEFAULT 'home'
    CHECK (label IN ('home', 'work', 'other')),
  postal_code  VARCHAR(10),
  county       VARCHAR(50) NOT NULL,        -- 縣市（例：台北市）
  district     VARCHAR(50),                 -- 鄉鎮市區（例：中正區）
  street       VARCHAR(200),                -- 路段（例：忠孝東路五段 100 號）
  detail       VARCHAR(100),                -- 樓層 / 室（例：3 樓之 1）
  is_primary   BOOLEAN NOT NULL DEFAULT FALSE,
  is_active    BOOLEAN NOT NULL DEFAULT TRUE,
  created_at   TIMESTAMPTZ NOT NULL DEFAULT now(),
  created_by   INTEGER NOT NULL REFERENCES users(id)
);
```

### `animals`（動物）

```sql
CREATE TABLE animals (
  id               SERIAL PRIMARY KEY,
  organization_id  INTEGER NOT NULL REFERENCES organizations(id),
  -- 跨院所共用，不加 clinic_id（ADR-002）
  owner_id         INTEGER NOT NULL REFERENCES owners(id),
  name             VARCHAR(100) NOT NULL,   -- 動物名稱（例：小白）
  species_id       INTEGER NOT NULL REFERENCES species(id),
  breed_id         INTEGER REFERENCES breeds(id),   -- nullable：品種不明或混種
  sex              VARCHAR(20) NOT NULL
    CHECK (sex IN ('intact_male', 'intact_female', 'neutered_male', 'neutered_female', 'unknown')),
  date_of_birth    DATE,                   -- 生日（精確）；不明時為 NULL
  birth_year       SMALLINT,               -- 僅知出生年份時填寫；date_of_birth 已知時可 NULL
  microchip_number VARCHAR(20),            -- 晶片號碼；nullable（並非所有動物都有晶片）
  tag_number       VARCHAR(50),            -- 耳標號碼（大型動物用）
  tattoo_number    VARCHAR(50),            -- 刺青識別碼
  color            VARCHAR(100),           -- 毛色 / 外觀描述（MVP 保留自由文字）
  is_deceased      BOOLEAN NOT NULL DEFAULT FALSE,
  deceased_date    DATE,
  notes            TEXT,
  created_at       TIMESTAMPTZ NOT NULL DEFAULT now(),
  created_by       INTEGER NOT NULL REFERENCES users(id)
);

-- 晶片號碼唯一（有值時）
CREATE UNIQUE INDEX animals_microchip_idx
  ON animals (organization_id, microchip_number)
  WHERE microchip_number IS NOT NULL;
-- 去重邏輯（應用層）：
--   有晶片時 → DB 唯一約束自動防止重複建檔
--   無晶片時 → 以 (owner_id + species_id + name) 做模糊比對，由工作人員確認
```

---

## 模組二：掛號 & 候診

### `visits`（就診紀錄，狀態機核心）

```sql
CREATE TABLE visits (
  id               SERIAL PRIMARY KEY,
  organization_id  INTEGER NOT NULL REFERENCES organizations(id),
  clinic_id        INTEGER NOT NULL REFERENCES clinics(id),
  animal_id        INTEGER REFERENCES animals(id),
  -- nullable：預留緊急通道（MVP 永遠非 null，ADR-006）
  owner_id         INTEGER REFERENCES owners(id),
  -- 歷史快照語義（ADR-015）：記錄就診當時的飼主，動物轉讓後不更新；查詢效能用
  attending_vet_id INTEGER REFERENCES users(id),
  -- 當前負責獸醫師；輪班制允許轉交，不鎖定原始醫師
  related_visit_id INTEGER REFERENCES visits(id),
  -- 同一病程的延續掛號（ADR-023）；NULL = 非延續；用於住院出院後再掛號的病程串聯
  status           VARCHAR(30) NOT NULL DEFAULT 'registered'
    CHECK (status IN (
      'registered',       -- 已掛號，待診
      'triaged',          -- 已初步評估
      'in_consultation',  -- 看診中
      'pending_results',  -- 等待檢驗結果
      'completed',        -- 就診結束
      'admitted',         -- 轉住院（ADR-023）
      'cancelled'         -- 取消
    )),
  priority         VARCHAR(20) NOT NULL DEFAULT 'normal'
    CHECK (priority IN ('normal', 'urgent')),
  chief_complaint  TEXT NOT NULL,           -- 主訴（掛號時填寫）
  registered_at    TIMESTAMPTZ NOT NULL DEFAULT now(),
  -- 掛號時間（排序依據之一）
  admitted_at      TIMESTAMPTZ,   -- M5：進入看診/住院時間（由 registered → in_consultation 轉換時設定）
  completed_at     TIMESTAMPTZ,
  created_at       TIMESTAMPTZ NOT NULL DEFAULT now(),
  created_by       INTEGER NOT NULL REFERENCES users(id)
);
```

---

## 模組三：門診

### `vital_signs`（生命徵象，append-only）

```sql
CREATE TABLE vital_signs (
  id                         SERIAL PRIMARY KEY,
  visit_id                   INTEGER NOT NULL REFERENCES visits(id),
  weight_kg                  NUMERIC(6,3),
  temperature_c              NUMERIC(4,2),
  heart_rate_bpm             SMALLINT,
  respiratory_rate_bpm       SMALLINT,
  systolic_bp_mmhg           SMALLINT,          -- 收縮壓（部分動物測量）
  capillary_refill_sec       NUMERIC(3,1),       -- 微血管充填時間
  mucous_membrane_color_id   INTEGER REFERENCES mucous_membrane_colors(id),
  body_condition_score       SMALLINT
    CHECK (body_condition_score BETWEEN 1 AND 9),
  -- BCS：犬貓 1-9；大型動物 1-5，沿用 1-9 欄位並以 1-5 填寫
  -- append-only（ADR-007）
  is_superseded              BOOLEAN NOT NULL DEFAULT FALSE,
  superseded_by              INTEGER REFERENCES vital_signs(id),
  created_at                 TIMESTAMPTZ NOT NULL DEFAULT now(),
  created_by                 INTEGER NOT NULL REFERENCES users(id)
  -- 允許 nurse 或 vet 角色建立
);
```

### `soap_notes`（SOAP 病歷，append-only，僅 vet 可建立）

```sql
CREATE TABLE soap_notes (
  id              SERIAL PRIMARY KEY,
  visit_id        INTEGER NOT NULL REFERENCES visits(id),
  -- S — Subjective（主觀）
  subjective      TEXT,   -- 飼主主訴、病史、症狀描述（臨床敘述，不可避免的自由文字）
  -- O — Objective（客觀）
  -- 量化數值已移至 vital_signs 表
  objective       TEXT,   -- 理學檢查發現、儀器數值敘述（non-vital-sign findings）
  -- A — Assessment（評估）
  assessment      TEXT,   -- 獸醫師臨床推理與判斷（narrative）
  -- 結構化診斷另見 soap_diagnoses 表
  -- P — Plan（計畫）
  plan            TEXT,   -- 處置計畫、衛教指示、追蹤建議
  -- append-only（ADR-007）
  is_superseded   BOOLEAN NOT NULL DEFAULT FALSE,
  superseded_by   INTEGER REFERENCES soap_notes(id),
  created_at      TIMESTAMPTZ NOT NULL DEFAULT now(),
  created_by      INTEGER NOT NULL REFERENCES users(id)
  -- 僅 vet 角色可建立（應用層權限控制）
);
```

### `soap_diagnoses`（結構化診斷，append-only，多對多）

```sql
CREATE TABLE soap_diagnoses (
  id            SERIAL PRIMARY KEY,
  soap_note_id  INTEGER NOT NULL REFERENCES soap_notes(id),
  code_id       INTEGER REFERENCES diagnosis_codes(id),
  -- NULL = 純自由文字診斷（無對應碼時）
  free_text     VARCHAR(500),
  -- code_id 非 null 時可補充說明；code_id 為 null 時必填
  CONSTRAINT soap_diagnoses_code_or_text
    CHECK (code_id IS NOT NULL OR free_text IS NOT NULL),
  -- is_primary 已移除：MVP 診斷為平等列表，無主副之分；帳單/報表模組實作時再評估
  -- append-only（ADR-007）
  is_superseded BOOLEAN NOT NULL DEFAULT FALSE,
  superseded_by INTEGER REFERENCES soap_diagnoses(id),
  created_at    TIMESTAMPTZ NOT NULL DEFAULT now(),
  created_by    INTEGER NOT NULL REFERENCES users(id)
);
```

### `nursing_notes`（護理備註，append-only，nurse / vet 可建立）

```sql
CREATE TABLE nursing_notes (
  id            SERIAL PRIMARY KEY,
  visit_id      INTEGER NOT NULL REFERENCES visits(id),
  note_text     TEXT NOT NULL,             -- 護理觀察、處置說明、交班備忘（臨床敘述，不可避免的自由文字）
  -- append-only（ADR-007）
  is_superseded BOOLEAN NOT NULL DEFAULT FALSE,
  superseded_by INTEGER REFERENCES nursing_notes(id),
  created_at    TIMESTAMPTZ NOT NULL DEFAULT now(),
  created_by    INTEGER NOT NULL REFERENCES users(id)
  -- 允許 nurse 或 vet 角色建立（應用層權限控制）
);
```

### `prescription_orders`（處方醫囑，append-only，掛在 soap_note 下）

```sql
CREATE TABLE prescription_orders (
  id                       SERIAL PRIMARY KEY,
  soap_note_id             INTEGER NOT NULL REFERENCES soap_notes(id),
  medication_id            INTEGER REFERENCES medications(id),
  free_text                VARCHAR(500),  -- 目錄無對應項目時使用；medication_id IS NULL 時必填
  CONSTRAINT prescription_orders_med_or_text
    CHECK (medication_id IS NOT NULL OR free_text IS NOT NULL),
  dose                     NUMERIC(8,3),
  dose_unit_id             INTEGER REFERENCES dose_units(id),              -- H2：FK 取代 VARCHAR(30)
  administration_route_id  INTEGER REFERENCES administration_routes(id),
  frequency_id             INTEGER REFERENCES prescription_frequencies(id), -- H1：FK 取代 VARCHAR(50)
  frequency_override       VARCHAR(50),  -- H1：目錄無對應時的補充描述（e.g., "Q8H with food"）
  CONSTRAINT prescription_frequency_check
    CHECK (frequency_id IS NOT NULL OR frequency_override IS NOT NULL),
  duration_days            SMALLINT,
  instructions             TEXT,          -- 服藥注意事項（衛教）
  -- append-only（ADR-007）
  is_superseded            BOOLEAN NOT NULL DEFAULT FALSE,
  superseded_by            INTEGER REFERENCES prescription_orders(id),
  created_at               TIMESTAMPTZ NOT NULL DEFAULT now(),
  created_by               INTEGER NOT NULL REFERENCES users(id)
  -- 僅 vet 角色可建立（應用層權限控制）
);
```

### `medication_administrations`（實際給藥紀錄，append-only）

```sql
CREATE TABLE medication_administrations (
  id                       SERIAL PRIMARY KEY,
  soap_note_id             INTEGER NOT NULL REFERENCES soap_notes(id),
  prescription_order_id    INTEGER REFERENCES prescription_orders(id),  -- NULL = 未依處方的臨時給藥
  medication_id            INTEGER REFERENCES medications(id),
  free_text                VARCHAR(500),
  CONSTRAINT medication_administrations_med_or_text
    CHECK (medication_id IS NOT NULL OR free_text IS NOT NULL),
  dose                     NUMERIC(8,3),
  dose_unit_id             INTEGER REFERENCES dose_units(id),  -- H2：FK 取代 VARCHAR(30)
  administration_route_id  INTEGER REFERENCES administration_routes(id),
  administered_at          TIMESTAMPTZ NOT NULL DEFAULT now(),
  -- append-only（ADR-007）
  is_superseded            BOOLEAN NOT NULL DEFAULT FALSE,
  superseded_by            INTEGER REFERENCES medication_administrations(id),
  created_at               TIMESTAMPTZ NOT NULL DEFAULT now(),
  created_by               INTEGER NOT NULL REFERENCES users(id)
  -- 允許 nurse 或 vet 角色建立（應用層權限控制）
);
```

### `procedure_records`（處置/手術紀錄，append-only）

```sql
CREATE TABLE procedure_records (
  id                   SERIAL PRIMARY KEY,
  soap_note_id         INTEGER NOT NULL REFERENCES soap_notes(id),
  procedure_type_id    INTEGER REFERENCES procedure_types(id),
  free_text            VARCHAR(500),  -- 目錄無對應項目時使用；procedure_type_id IS NULL 時必填
  CONSTRAINT procedure_records_type_or_text
    CHECK (procedure_type_id IS NOT NULL OR free_text IS NOT NULL),
  notes                TEXT,
  -- append-only（ADR-007）
  is_superseded        BOOLEAN NOT NULL DEFAULT FALSE,
  superseded_by        INTEGER REFERENCES procedure_records(id),
  created_at           TIMESTAMPTZ NOT NULL DEFAULT now(),
  created_by           INTEGER NOT NULL REFERENCES users(id)
  -- 允許 vet 角色建立（應用層權限控制）
);
```

---

## 模組四：檢驗

### `lab_orders`（檢驗醫囑，append-only）

```sql
CREATE TABLE lab_orders (
  id             SERIAL PRIMARY KEY,
  visit_id       INTEGER NOT NULL REFERENCES visits(id),
  clinic_id      INTEGER NOT NULL REFERENCES clinics(id),
  organization_id INTEGER NOT NULL REFERENCES organizations(id),
  test_type_id   INTEGER NOT NULL REFERENCES lab_test_types(id),
  ordered_by     INTEGER NOT NULL REFERENCES users(id),   -- 下醫囑的獸醫師
  status         VARCHAR(20) NOT NULL DEFAULT 'pending'
    CHECK (status IN ('pending', 'resulted', 'cancelled')),
  -- H3：result_text 已移除，由 lab_result_items 取代（結構化分析值）
  resulted_at    TIMESTAMPTZ,
  resulted_by    INTEGER REFERENCES users(id),   -- 輸入結果的人員（technician / nurse）
  notes          TEXT,          -- 醫囑備註或特殊說明
  -- append-only（ADR-007）
  is_superseded  BOOLEAN NOT NULL DEFAULT FALSE,
  superseded_by  INTEGER REFERENCES lab_orders(id),
  created_at     TIMESTAMPTZ NOT NULL DEFAULT now(),
  created_by     INTEGER NOT NULL REFERENCES users(id)
);
```

### `lab_analytes`（檢驗分析項目目錄）

```sql
-- H3：定義每個 lab_test_type 含有哪些分析指標（不隨就診改變的結構性知識）
CREATE TABLE lab_analytes (
  id               SERIAL PRIMARY KEY,
  organization_id  INTEGER NOT NULL REFERENCES organizations(id),
  lab_test_type_id INTEGER NOT NULL REFERENCES lab_test_types(id),
  name             VARCHAR(100) NOT NULL,  -- RBC / WBC / ALT / Creatinine / Glucose ...
  unit             VARCHAR(30),            -- 10^6/μL / U/L / mg/dL / g/dL（NULL = 無單位）
  analyte_type     VARCHAR(10) NOT NULL DEFAULT 'numeric'
    CHECK (analyte_type IN ('numeric', 'text')),
  sort_order       SMALLINT NOT NULL DEFAULT 0,
  is_active        BOOLEAN NOT NULL DEFAULT TRUE,
  loinc_code       VARCHAR(20),            -- LOINC 國際標準編碼（ADR-025，NULL = 未對應）
  created_at       TIMESTAMPTZ NOT NULL DEFAULT now(),
  CONSTRAINT lab_analytes_unique UNIQUE (lab_test_type_id, name)
);
```

### `lab_analyte_references`（分析指標參考範圍，物種特定）

```sql
-- H3：參考範圍依物種而異（犬/貓正常值不同），1NF 要求獨立存放
CREATE TABLE lab_analyte_references (
  id          SERIAL PRIMARY KEY,
  analyte_id  INTEGER NOT NULL REFERENCES lab_analytes(id),
  species_id  INTEGER REFERENCES species(id),   -- NULL = 跨物種通用
  ref_low     NUMERIC(12,4),   -- 參考下限（numeric 指標）
  ref_high    NUMERIC(12,4),   -- 參考上限（numeric 指標）
  ref_text    VARCHAR(100),    -- 文字說明（text 指標，e.g., "Negative"）
  CONSTRAINT lab_analyte_references_unique UNIQUE (analyte_id, species_id)
);
```

### `lab_result_items`（就診檢驗結果明細，append-only）

```sql
-- H3：每筆 lab_order 的各項指標測量值，取代 lab_orders.result_text
CREATE TABLE lab_result_items (
  id             SERIAL PRIMARY KEY,
  lab_order_id   INTEGER NOT NULL REFERENCES lab_orders(id),
  analyte_id     INTEGER NOT NULL REFERENCES lab_analytes(id),
  value_numeric  NUMERIC(12,4),   -- 數值型指標的測量值
  value_text     VARCHAR(200),    -- 文字型指標或備註說明
  is_abnormal    BOOLEAN,         -- 超出參考範圍時由應用層設為 TRUE
  notes          TEXT,
  created_at     TIMESTAMPTZ NOT NULL DEFAULT now(),
  created_by     INTEGER NOT NULL REFERENCES users(id),
  -- append-only（ADR-007）
  is_superseded  BOOLEAN NOT NULL DEFAULT FALSE,
  superseded_by  INTEGER REFERENCES lab_result_items(id),
  CONSTRAINT lab_result_items_unique UNIQUE (lab_order_id, analyte_id)
);
-- 設計說明：
--   lab_test_types → lab_analytes：目錄結構（哪些指標屬於哪個檢驗項目）
--   lab_analytes → lab_analyte_references：物種特定參考範圍
--   lab_orders → lab_result_items：就診當次的實際量測值
```

---

## 住院目錄表（ADR-023）

### `ward_types`（病房類型目錄）

```sql
CREATE TABLE ward_types (
  id               SERIAL PRIMARY KEY,
  organization_id  INTEGER NOT NULL REFERENCES organizations(id),
  name             VARCHAR(100) NOT NULL,   -- ICU / 一般 / 隔離 / 術後恢復
  is_active        BOOLEAN NOT NULL DEFAULT TRUE,
  created_at       TIMESTAMPTZ NOT NULL DEFAULT now(),
  CONSTRAINT ward_types_unique UNIQUE (organization_id, name)
);
```

### `bed_types`（床位類型目錄）

```sql
CREATE TABLE bed_types (
  id               SERIAL PRIMARY KEY,
  organization_id  INTEGER NOT NULL REFERENCES organizations(id),
  name             VARCHAR(100) NOT NULL,   -- 大型犬籠 / 中型犬籠 / 小型犬貓籠 / 氧氣籠 / 保溫箱 / ICU 專用籠
  is_active        BOOLEAN NOT NULL DEFAULT TRUE,
  created_at       TIMESTAMPTZ NOT NULL DEFAULT now(),
  CONSTRAINT bed_types_unique UNIQUE (organization_id, name)
);
```

### `equipment_items`（設備品項目錄）

```sql
CREATE TABLE equipment_items (
  id               SERIAL PRIMARY KEY,
  organization_id  INTEGER NOT NULL REFERENCES organizations(id),
  name             VARCHAR(100) NOT NULL,   -- 氧氣供應 / 輸液幫浦 / 心電監護 / 噴霧治療機 / 保溫燈
  is_active        BOOLEAN NOT NULL DEFAULT TRUE,
  created_at       TIMESTAMPTZ NOT NULL DEFAULT now(),
  CONSTRAINT equipment_items_unique UNIQUE (organization_id, name)
);
```

### `admission_reasons`（入院原因目錄）

```sql
CREATE TABLE admission_reasons (
  id               SERIAL PRIMARY KEY,
  organization_id  INTEGER NOT NULL REFERENCES organizations(id),
  name             VARCHAR(100) NOT NULL,   -- 術後觀察 / 重症監護 / 輸液治療 / 傳染病隔離
  is_active        BOOLEAN NOT NULL DEFAULT TRUE,
  created_at       TIMESTAMPTZ NOT NULL DEFAULT now(),
  CONSTRAINT admission_reasons_unique UNIQUE (organization_id, name)
);
```

### `nursing_action_items`（護理動作項目目錄）

```sql
CREATE TABLE nursing_action_items (
  id               SERIAL PRIMARY KEY,
  organization_id  INTEGER NOT NULL REFERENCES organizations(id),
  name             VARCHAR(100) NOT NULL,   -- 已餵食 / 已排尿 / 已排便 / 傷口換藥 / 翻身 / 清潔籠舍
  is_active        BOOLEAN NOT NULL DEFAULT TRUE,
  created_at       TIMESTAMPTZ NOT NULL DEFAULT now(),
  CONSTRAINT nursing_action_items_unique UNIQUE (organization_id, name)
);
```

### `order_types`（醫囑類型目錄）

```sql
CREATE TABLE order_types (
  id               SERIAL PRIMARY KEY,
  organization_id  INTEGER NOT NULL REFERENCES organizations(id),
  name             VARCHAR(100) NOT NULL,   -- 用藥 / 處置 / 飲食 / 監測 / 活動限制
  is_active        BOOLEAN NOT NULL DEFAULT TRUE,
  created_at       TIMESTAMPTZ NOT NULL DEFAULT now(),
  CONSTRAINT order_types_unique UNIQUE (organization_id, name)
);
```

### `frequencies`（執行頻率目錄）

```sql
CREATE TABLE frequencies (
  id               SERIAL PRIMARY KEY,
  organization_id  INTEGER NOT NULL REFERENCES organizations(id),
  code             VARCHAR(20) NOT NULL,    -- SID / BID / TID / QID / Q4H / Q6H / Q8H / Q12H / PRN / STAT / AC / PC
  name             VARCHAR(100) NOT NULL,   -- 每日一次 / 每日兩次 / ...
  is_active        BOOLEAN NOT NULL DEFAULT TRUE,
  created_at       TIMESTAMPTZ NOT NULL DEFAULT now(),
  CONSTRAINT frequencies_unique UNIQUE (organization_id, code)
);
```

### `discharge_reasons`（出院原因目錄）

```sql
CREATE TABLE discharge_reasons (
  id               SERIAL PRIMARY KEY,
  organization_id  INTEGER NOT NULL REFERENCES organizations(id),
  name             VARCHAR(100) NOT NULL,   -- 康復出院 / 病情穩定出院 / 飼主要求出院 / 轉院 / 死亡
  is_active        BOOLEAN NOT NULL DEFAULT TRUE,
  created_at       TIMESTAMPTZ NOT NULL DEFAULT now(),
  CONSTRAINT discharge_reasons_unique UNIQUE (organization_id, name)
);
```

### `discharge_conditions`（出院時狀態目錄）

```sql
CREATE TABLE discharge_conditions (
  id               SERIAL PRIMARY KEY,
  organization_id  INTEGER NOT NULL REFERENCES organizations(id),
  name             VARCHAR(100) NOT NULL,   -- 痊癒 / 改善 / 穩定 / 未改善 / 死亡
  is_active        BOOLEAN NOT NULL DEFAULT TRUE,
  created_at       TIMESTAMPTZ NOT NULL DEFAULT now(),
  CONSTRAINT discharge_conditions_unique UNIQUE (organization_id, name)
);
```

---

## 模組五：住院管理（ADR-023）

### `wards`（病房）

```sql
CREATE TABLE wards (
  id               SERIAL PRIMARY KEY,
  organization_id  INTEGER NOT NULL REFERENCES organizations(id),
  clinic_id        INTEGER NOT NULL REFERENCES clinics(id),
  ward_type_id     INTEGER NOT NULL REFERENCES ward_types(id),
  name             VARCHAR(100) NOT NULL,   -- 一般住院區 / ICU / 隔離區 / 術後恢復區
  code             VARCHAR(20) NOT NULL,    -- GEN / ICU / ISO / REC（用於床位編號前綴）
  is_active        BOOLEAN NOT NULL DEFAULT TRUE,
  created_at       TIMESTAMPTZ NOT NULL DEFAULT now(),
  CONSTRAINT wards_unique UNIQUE (clinic_id, code)
);
```

### `beds`（病床）

```sql
CREATE TABLE beds (
  id               SERIAL PRIMARY KEY,
  ward_id          INTEGER NOT NULL REFERENCES wards(id),
  bed_type_id      INTEGER NOT NULL REFERENCES bed_types(id),
  bed_number       VARCHAR(20) NOT NULL,    -- GEN-01 / ICU-03（類型縮寫 + 流水號）
  status           VARCHAR(20) NOT NULL DEFAULT 'available'
    CHECK (status IN ('available', 'occupied', 'maintenance', 'inactive')),
  is_active        BOOLEAN NOT NULL DEFAULT TRUE,
  created_at       TIMESTAMPTZ NOT NULL DEFAULT now(),
  CONSTRAINT beds_number_unique UNIQUE (ward_id, bed_number)
);
```

### `ward_default_equipment`（病房預設設備）

```sql
-- 建立住院紀錄時，依病房帶出預設勾選的設備
CREATE TABLE ward_default_equipment (
  id               SERIAL PRIMARY KEY,
  ward_id          INTEGER NOT NULL REFERENCES wards(id),
  equipment_item_id INTEGER NOT NULL REFERENCES equipment_items(id),
  CONSTRAINT ward_default_equipment_unique UNIQUE (ward_id, equipment_item_id)
);
```

### `admissions`（住院登記）

```sql
CREATE TABLE admissions (
  id               SERIAL PRIMARY KEY,
  organization_id  INTEGER NOT NULL REFERENCES organizations(id),
  clinic_id        INTEGER NOT NULL REFERENCES clinics(id),
  visit_id         INTEGER NOT NULL REFERENCES visits(id),
  -- 1:1 with visit（ADR-023）；住院一定有掛號
  bed_id           INTEGER NOT NULL REFERENCES beds(id),
  -- 語義：「當前」床位，轉床時隨之更新；入院時的原始床位從 bed_transfers 第一筆或入院時間推導
  admission_reason_id INTEGER NOT NULL REFERENCES admission_reasons(id),
  reason_notes     TEXT,                    -- 入院原因補充說明
  attending_vet_id INTEGER NOT NULL REFERENCES users(id),
  status           VARCHAR(20) NOT NULL DEFAULT 'active'
    CHECK (status IN ('active', 'discharged')),
  admitted_at      TIMESTAMPTZ NOT NULL DEFAULT now(),
  discharged_at    TIMESTAMPTZ,
  created_at       TIMESTAMPTZ NOT NULL DEFAULT now(),
  created_by       INTEGER NOT NULL REFERENCES users(id),
  CONSTRAINT admissions_visit_unique UNIQUE (visit_id)
);
```

### `admission_equipment`（住院實際使用設備）

```sql
-- 入院時由護理師勾選（病房預設帶出，可調整）
CREATE TABLE admission_equipment (
  id               SERIAL PRIMARY KEY,
  admission_id     INTEGER NOT NULL REFERENCES admissions(id),
  equipment_item_id INTEGER NOT NULL REFERENCES equipment_items(id),
  notes            VARCHAR(200),            -- 備註（如「第二台輸液幫浦」）
  CONSTRAINT admission_equipment_unique UNIQUE (admission_id, equipment_item_id)
);
```

### `daily_rounds`（每日巡房紀錄）

```sql
CREATE TABLE daily_rounds (
  id               SERIAL PRIMARY KEY,
  admission_id     INTEGER NOT NULL REFERENCES admissions(id),
  round_date       DATE NOT NULL,
  assessment       TEXT,                    -- 獸醫評估（精神狀態、治療反應）
  plan             TEXT,                    -- 今日治療計畫調整
  created_at       TIMESTAMPTZ NOT NULL DEFAULT now(),
  created_by       INTEGER NOT NULL REFERENCES users(id),
  -- append-only（ADR-007）
  is_superseded    BOOLEAN NOT NULL DEFAULT FALSE,
  superseded_by    INTEGER REFERENCES daily_rounds(id)
);
```

### `inpatient_nursing_logs`（住院護理紀錄）

```sql
CREATE TABLE inpatient_nursing_logs (
  id               SERIAL PRIMARY KEY,
  admission_id     INTEGER NOT NULL REFERENCES admissions(id),
  notes            TEXT,                    -- 補充說明
  created_at       TIMESTAMPTZ NOT NULL DEFAULT now(),
  created_by       INTEGER NOT NULL REFERENCES users(id),
  -- append-only（ADR-007）
  is_superseded    BOOLEAN NOT NULL DEFAULT FALSE,
  superseded_by    INTEGER REFERENCES inpatient_nursing_logs(id)
);
```

### `inpatient_nursing_log_actions`（護理紀錄勾選項）

```sql
CREATE TABLE inpatient_nursing_log_actions (
  id               SERIAL PRIMARY KEY,
  nursing_log_id   INTEGER NOT NULL REFERENCES inpatient_nursing_logs(id),
  action_item_id   INTEGER NOT NULL REFERENCES nursing_action_items(id),
  CONSTRAINT nursing_log_actions_unique UNIQUE (nursing_log_id, action_item_id)
);
```

### `inpatient_orders`（住院醫囑）

```sql
CREATE TABLE inpatient_orders (
  id               SERIAL PRIMARY KEY,
  admission_id     INTEGER NOT NULL REFERENCES admissions(id),
  order_type_id    INTEGER NOT NULL REFERENCES order_types(id),
  description      TEXT NOT NULL,           -- 醫囑內容（藥名+劑量、處置說明、飲食指示等）
  frequency_id     INTEGER REFERENCES frequencies(id),  -- NULL = 一次性醫囑（如 STAT）
  start_at         TIMESTAMPTZ NOT NULL DEFAULT now(),
  end_at           TIMESTAMPTZ,             -- NULL = 持續到出院或手動結束
  status           VARCHAR(20) NOT NULL DEFAULT 'active'
    CHECK (status IN ('active', 'completed', 'cancelled')),
  created_at       TIMESTAMPTZ NOT NULL DEFAULT now(),
  created_by       INTEGER NOT NULL REFERENCES users(id),
  -- append-only（ADR-007）
  is_superseded    BOOLEAN NOT NULL DEFAULT FALSE,
  superseded_by    INTEGER REFERENCES inpatient_orders(id)
);
```

### `inpatient_order_executions`（醫囑執行紀錄）

```sql
-- 護理師按醫囑逐次打勾記錄
CREATE TABLE inpatient_order_executions (
  id               SERIAL PRIMARY KEY,
  order_id         INTEGER NOT NULL REFERENCES inpatient_orders(id),
  executed_at      TIMESTAMPTZ NOT NULL DEFAULT now(),
  notes            TEXT,                    -- 執行備註
  created_at       TIMESTAMPTZ NOT NULL DEFAULT now(),
  created_by       INTEGER NOT NULL REFERENCES users(id)
);
```

### `bed_transfers`（轉床紀錄）

```sql
CREATE TABLE bed_transfers (
  id               SERIAL PRIMARY KEY,
  admission_id     INTEGER NOT NULL REFERENCES admissions(id),
  from_bed_id      INTEGER NOT NULL REFERENCES beds(id),
  to_bed_id        INTEGER NOT NULL REFERENCES beds(id),
  transferred_at   TIMESTAMPTZ NOT NULL DEFAULT now(),
  transferred_by   INTEGER NOT NULL REFERENCES users(id)
);
```

### `discharge_records`（出院紀錄，1:1 with admission）

```sql
CREATE TABLE discharge_records (
  id                     SERIAL PRIMARY KEY,
  admission_id           INTEGER NOT NULL REFERENCES admissions(id),
  discharge_reason_id    INTEGER NOT NULL REFERENCES discharge_reasons(id),
  discharge_condition_id INTEGER NOT NULL REFERENCES discharge_conditions(id),
  discharge_notes        TEXT,              -- 補充說明
  follow_up_plan         TEXT,              -- 回診安排
  discharged_at          TIMESTAMPTZ NOT NULL DEFAULT now(),
  discharged_by          INTEGER NOT NULL REFERENCES users(id),
  CONSTRAINT discharge_records_admission_unique UNIQUE (admission_id)
);
```

---

## 分析模組

### `insight_dismissals`（流程探勘評估的「已知」標記）

```sql
-- migration 0015
CREATE TABLE insight_dismissals (
  id            SERIAL PRIMARY KEY,
  insight_key   VARCHAR(200) NOT NULL UNIQUE,   -- 如 "skipped_step:2:triaged"
  dismissed_at  TIMESTAMPTZ NOT NULL DEFAULT now()
);
-- 非醫療紀錄，僅為研究員的閱讀進度標記，不需追溯
```

---

## 欄位速查：跨模組共用外鍵

| 欄位名 | 型別 | 參照 | 出現於 |
|--------|------|------|--------|
| `organization_id` | INTEGER NOT NULL | `organizations.id` | 所有業務表 |
| `clinic_id` | INTEGER NOT NULL | `clinics.id` | 業務流程表（visits、lab_orders） |
| `created_by` | INTEGER NOT NULL | `users.id` | 所有業務資料表 |
| `owner_id` | INTEGER NOT NULL | `owners.id` | `animals`、`visits` |
| `animal_id` | INTEGER | `animals.id` | `visits`（nullable 預留緊急路徑） |
| `attending_vet_id` | INTEGER | `users.id` | `visits` |
| `visit_id` | INTEGER NOT NULL | `visits.id` | `vital_signs`、`nursing_notes`、`soap_notes`、`lab_orders`、`admissions` |
| `related_visit_id` | INTEGER | `visits.id` | `visits`（同一病程延續掛號，ADR-023） |
| `admission_id` | INTEGER NOT NULL | `admissions.id` | `admission_equipment`、`daily_rounds`、`inpatient_nursing_logs`、`inpatient_orders`、`bed_transfers`、`discharge_records` |
| `is_superseded` + `superseded_by` | BOOLEAN + INTEGER | 自表 id | 所有 append-only 醫療紀錄表 |

---

## 表依賴圖（建立順序）

```
organizations
  └── clinics
  └── role_definitions
  └── users
        └── user_roles (→ clinics, role_definitions)
  └── contact_types
  └── species
        └── breeds
        └── blood_types (→ species)               ← migration 0005
  └── mucous_membrane_colors
  └── lab_categories
        └── lab_test_types
              └── lab_analytes (→ lab_test_types)  ← H3
                    └── lab_analyte_references (→ species)
  └── diagnosis_categories
        └── diagnosis_codes (→ diagnosis_categories, species)
  └── administration_routes
  └── dose_units                                    ← H2
  └── prescription_frequencies                      ← H1
  └── medication_categories
        └── medications (→ medication_categories, dose_units)
  └── procedure_categories
        └── procedure_types (→ procedure_categories, species)
  └── owners
        └── owner_contacts (→ contact_types)
        └── owner_addresses
        └── animals (→ species, breeds, blood_types)     ← 0005 / M4
              └── animal_diseases (→ diagnosis_codes)    ← 0005
              └── animal_medications (→ medications, administration_routes, dose_units) ← 0005
              └── visits (→ clinics, users)
                    └── vital_signs (→ mucous_membrane_colors)
                    └── nursing_notes
                    └── soap_notes
                          └── soap_diagnoses (→ diagnosis_codes)
                          └── prescription_orders (→ medications, administration_routes, dose_units, prescription_frequencies)
                                └── medication_administrations (→ medications, administration_routes, dose_units)
                          └── procedure_records (→ procedure_types)
                    └── lab_orders (→ lab_test_types)
                          └── lab_result_items (→ lab_analytes)  ← H3
  └── ward_types                                                  ← ADR-023
  └── bed_types                                                   ← ADR-023
  └── equipment_items                                             ← ADR-023
  └── admission_reasons                                           ← ADR-023
  └── nursing_action_items                                        ← ADR-023
  └── order_types                                                 ← ADR-023
  └── frequencies                                                 ← ADR-023
  └── discharge_reasons                                           ← ADR-023
  └── discharge_conditions                                        ← ADR-023
  └── wards (→ clinics, ward_types)                               ← ADR-023
        └── beds (→ bed_types)
        └── ward_default_equipment (→ equipment_items)
              └── admissions (→ visits, beds, admission_reasons)
                    └── admission_equipment (→ equipment_items)
                    └── daily_rounds
                    └── inpatient_nursing_logs
                          └── inpatient_nursing_log_actions (→ nursing_action_items)
                    └── inpatient_orders (→ order_types, frequencies)
                          └── inpatient_order_executions
                    └── bed_transfers (→ beds)
                    └── discharge_records (→ discharge_reasons, discharge_conditions)
```
