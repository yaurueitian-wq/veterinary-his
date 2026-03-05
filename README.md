# GNU Health HIS — 資料庫結構完整分析報告

> **來源 1**：`gnuhealth-36-demo.sql`（PostgreSQL 10.6 pg_dump，逆向工程分析）
> **來源 2**：[GNU Health HIS 官方文件](https://docs.gnuhealth.org/his/)（子頁面爬取）
> **分析日期**：2026-03-03
> **系統版本**：GNU Health HIS 3.6 / Tryton 5.x

---

## 目錄

1. [系統概覽](#一系統概覽)
2. [技術架構](#二技術架構)
3. [資料庫規模](#三資料庫規模)
4. [核心設計哲學](#四核心設計哲學)
5. [模組詳細說明](#五模組詳細說明)
6. [核心資料表 Schema](#六核心資料表-schema)
7. [業務流程資料流](#七業務流程資料流)
8. [Demo 資料說明](#八demo-資料說明)
9. [本地復刻需求](#九本地復刻需求)
10. [後續開發參考](#十後續開發參考)

---

## 一、系統概覽

GNU Health 是一套開源的醫院資訊系統（HIS），由 GNU Solidario 維護，強調公共衛生與社會醫學視角。系統涵蓋五大功能領域：

| 功能領域 | 說明 |
|---------|------|
| **人口統計與社區** | 個人、家庭、戶籍單元、社會經濟資料管理 |
| **病患管理** | 健康評估、住院、電子病歷（EMR） |
| **健康中心** | 財務、藥局、人員、設施管理 |
| **檢驗與醫學影像** | 檢驗申請、DICOM 影像工作流程 |
| **健康資訊系統** | 統計、流行病學報表 |

**核心理念**："People before Patients" — 先建立社區人口普查，再進行病患管理。

---

## 二、技術架構

```
┌─────────────────────────────────────────────┐
│            GNU Health HIS 3.6               │
│  (Python 模組，運行於 Tryton 5.x 框架上)      │
├─────────────────────────────────────────────┤
│              Tryton ERP Framework            │
│  (ORM、業務邏輯、State Machine 全在應用層)    │
├─────────────────────────────────────────────┤
│           PostgreSQL >= 10 (15+ 建議)        │
│  (純資料儲存，無自訂 Trigger/Stored Proc)    │
└─────────────────────────────────────────────┘

對外整合：
  - GNU Health Federation（跨院所資料交換）
  - Orthanc PACS（DICOM 影像，REST API）
  - HL7 FHIR REST（開發中）
  - gnuhealth-data-import（CSV/ODS 自動匯入）
  - GNU Privacy Guard（文件數位簽章）
```

**安裝方式**：Vanilla（gnuhealth-control）、Ansible、虛擬機映像、嵌入式（Raspberry Pi）

---

## 三、資料庫規模

| 項目 | 數量 |
|------|------|
| 資料表總數 | **364 張** |
| 有資料的資料表 | **221 張** |
| 總資料筆數 | **312,232 筆** |
| 外鍵約束（FK） | **913 個** |
| 索引 | **369 個** |
| Sequence | **393 個** |
| PostgreSQL 擴充套件 | `plpgsql`（僅此一個） |
| 自訂 Function / Trigger / View | **無**（邏輯全在應用層） |

---

## 四、核心設計哲學

### Party Pattern（萬用實體模型）

> "A party is an abstract entity, which attributes will differentiate a health center from a person, or a person that is a doctor, a patient or both."

所有「人」與「機構」統一使用 `party_party` 作為基底，透過 boolean 旗標區分角色，再以 1:1 擴充表加入各角色專屬欄位。同一個人可同時是醫生也是病患。

```
party_party（基底）
├── is_person = true  →  gnuhealth_patient（病患擴充）
│                    →  gnuhealth_healthprofessional（醫療人員擴充）
├── is_institution = true  →  gnuhealth_institution（機構擴充）
└── is_pharmacy / is_insurance_company / ...
```

### Tryton 標準審計欄位

每張表都包含：`create_date`, `write_date`, `create_uid`, `write_uid`，提供完整的操作稽核追蹤。

### State Machine

狀態欄位使用 `character varying` 儲存（如 `appointment.state`：`confirmed`, `checked_in`, `no_show` 等），狀態轉換邏輯全在 Tryton 應用層實作。

### 多院所架構

幾乎所有業務表都有 `institution` FK，天然支援多院所部署。

---

## 五、模組詳細說明

### 5.1 Tryton 框架模組（底層基礎）

| 前綴 | 張數 | 用途 |
|------|------|------|
| `ir_*` | ~30 | 框架核心：模型定義、菜單、動作、權限規則、序號 |
| `res_*` | ~5 | 使用者、群組、公司管理 |
| `party_*` | ~10 | 通用實體模型（所有人與機構的共用基底） |
| `account_*` | ~30 | 會計科目、發票、日記帳、稅務、財政年度 |
| `product_*` | ~5 | 產品與庫存品項（藥品、床位費用的基底） |
| `stock_*` | ~10 | 庫存移動、倉儲位置 |
| `country_*` | 3 | 國家、行政區、郵遞區號 |
| `currency_*` | 2 | 幣別與匯率 |
| `purchase_*` | ~10 | 採購管理 |
| `calendar_*` | ~10 | 日曆與事件排程（預約整合） |
| `webdav_*` | 2 | WebDAV 檔案分享 |
| `company_*` | 2 | 機構與員工 |

---

### 5.2 GNU Health 業務模組

#### 核心模組（`health`）

系統最底層的醫療模組，所有其他模組的基礎。包含：

| 子系統 | 主要資料表 | 說明 |
|--------|-----------|------|
| 醫療機構 | `gnuhealth_institution`, `gnuhealth_hospital_building`, `gnuhealth_hospital_ward`, `gnuhealth_hospital_unit`, `gnuhealth_hospital_bed` | 建築物 → 病房 → 病床三層架構；床位以 `product_product` 為基底計算費用 |
| 個人 | `party_party`, `gnuhealth_person_name` | PUID（人員唯一識別碼）、別名、替代ID（護照等） |
| 戶籍單元 | `gnuhealth_du`, `gnuhealth_operational_area`, `gnuhealth_operational_sector` | 家戶地址單元，公衛調查基礎 |
| 家庭 | `gnuhealth_family`, `gnuhealth_family_member` | 家庭 APGAR 評估 |
| 醫療人員 | `gnuhealth_healthprofessional`, `gnuhealth_hp_specialty`, `gnuhealth_specialty` | 執照號、主科別、所屬機構 |
| 疾病分類 | `gnuhealth_pathology`, `gnuhealth_pathology_category`, `gnuhealth_pathology_group` | **完整 ICD-10**（14,333 筆） |
| 藥品 | `gnuhealth_medicament`, `gnuhealth_medicament_category`, `gnuhealth_drug_form`, `gnuhealth_drug_route`, `gnuhealth_dose_unit` | 以 `product_template` 為基底 |
| 處方 | `gnuhealth_prescription_order`, `gnuhealth_prescription_line` | 支援 GPG 數位簽章 |
| 疫苗 | `gnuhealth_vaccination`, `gnuhealth_immunization_schedule`, `gnuhealth_immunization_schedule_dose` | 免疫接種計畫 |
| 醫療處置 | `gnuhealth_procedure` | ICD-10-PCS 手術處置代碼（4,706 筆） |

---

#### 病患管理（`health` 核心）

**欄位來源：官方文件 + SQL Schema**

`gnuhealth_patient`（擴充自 `party_party`）：

| 欄位群 | 欄位 | 說明 |
|--------|------|------|
| 醫療基本 | `blood_type`, `rh` | 血型與 Rh 因子 |
| | `primary_care_doctor` | 主治醫師 FK → `gnuhealth_healthprofessional` |
| | `current_insurance` | 現行保險 FK → `gnuhealth_insurance` |
| | `deceased`, `dod` | 死亡狀態與死亡時間 |
| | `cod` | 死因 FK → `gnuhealth_pathology`（ICD-10） |
| 社會經濟 | `income`, `ses_notes` | 收入等級與社會經濟注記 |
| | `domestic_violence`, `hostile_area`, `single_parent` | 社會風險因子 |
| | `prison_current`, `prison_past` | 監禁史 |
| | `school_withdrawal`, `working_children` | 輟學、童工 |
| 婦科史 | `gravida`, `full_term`, `premature`, `abortions`, `stillbirths` | 孕產史 OB Summary |
| | `menarche`, `menopausal`, `menopause` | 月經史 |
| | `pap_test`, `colposcopy`, `mammography` | 篩檢記錄開關 |
| 生活習慣 | `smoking_number`, `alcohol`, `coffee`, `soft_drinks` | 生活習慣 |
| | `exercise_minutes_day` | 每日運動分鐘數 |
| | `sexual_preferences`, `sexual_practices`, `sexual_partners` | 性健康 |
| 其他 | `general_info`, `critical_info` | 一般與重要備註 |

---

#### 門診與預約（`health` 核心）

`gnuhealth_appointment`：

| 欄位 | 說明 |
|------|------|
| `patient` | FK → `gnuhealth_patient` |
| `healthprof` | FK → `gnuhealth_healthprofessional` |
| `institution` | FK → `gnuhealth_institution` |
| `speciality` | FK → `gnuhealth_specialty` |
| `appointment_date` / `appointment_date_end` | 預約時段 |
| `appointment_type` | 就診類型 |
| `visit_type` | 住院(I) / 門診(O) |
| `state` | `confirmed` / `checked_in` / `no_show` 等 |
| `urgency` | 緊急程度 |
| `inpatient_registration_code` | FK → 住院登記（若為住院病患） |
| `event` | FK → `calendar_event`（日曆整合） |
| `checked_in_date` | 報到時間 |

`gnuhealth_patient_evaluation`（問診評估，SOAP 基礎）：

| 標籤 | 說明 |
|------|------|
| 主要資訊 | 主訴、症狀、現病史、治療計畫 |
| 臨床 | 生命徵象（體溫、血壓）、人體測量、體徵與症狀 |
| 精神狀態 | Glasgow Coma Scale 評分 |
| 資訊診斷 | 初步診斷 FK → `gnuhealth_pathology` |

---

#### 住院管理（`health_inpatient`）

`gnuhealth_inpatient_registration`：

| 標籤 | 必填欄位 | 其他欄位 |
|------|---------|---------|
| 行政 | `patient`, `bed`, `hospitalization_date`, `discharge_date`, `admission_type` | `attending_physician`, `operating_physician`, `admission_reason`, `discharge_reason`, `discharge_dx` |
| 營養 | - | 飲食信仰、素食類型、餐飲計畫、`nutrition_notes` |
| 用藥計畫 | - | → `gnuhealth_inpatient_medication`（含給藥方式、劑量、時間、給藥日誌） |
| 護理計畫 | - | `nursing_plan`, `discharge_plan` |

**床位管理**：`gnuhealth_hospital_bed` → `gnuhealth_hospital_ward`（含性別、病床數、設施） → `gnuhealth_hospital_building`

---

#### ICU 重症監護（`health_icu`）

`gnuhealth_inpatient_icu`（連結住院登記，非病患）：

| 功能 | 資料表 | 說明 |
|------|--------|------|
| APACHE II 評分 | `gnuhealth_icu_apache2` | 0-71 分；入院 24 小時內；含生理測量值與實驗室數值 |
| Glasgow 昏迷 | `gnuhealth_icu_glasgow` | 3-15 分；眼睛/語言/運動三項加總 |
| ECG | `gnuhealth_patient_ecg` | 導程選擇、心律、ST 段分析、影像附件 |
| 呼吸器 | `gnuhealth_icu_ventilation` | 呼吸器參數 |
| 胸腔引流 | `gnuhealth_icu_chest_drainage` | 引流管理 |
| 護理查房 | `gnuhealth_patient_rounding` | 神經/呼吸/循環/腸胃/皮膚 多系統評估 |

---

#### 手術（`health_surgery`）

`gnuhealth_surgery`：

| 欄位群 | 欄位 | 說明 |
|--------|------|------|
| 基本 | `patient`, `date`, `institution` | 核心關聯 |
| 臨床評估 | `admission_reason`, `urgency` | Optional / Required / Urgent / Emergency |
| 風險評估 | `asa_ps` | ASA PS 分級（PS1-PS6） |
| | `rcri` | FK → `gnuhealth_rcri`（修訂心臟風險指數） |
| | `mallampati` | 插管難度分級（Class 1-4） |
| 術前確認 | 大出血風險、脈搏血氧計、部位標記、預防性抗生素等清單 | boolean 欄位 |
| 手術團隊 | → `gnuhealth_surgery_team` | 外科醫師、麻醉師 |
| 手術室 | `gnuhealth_hospital_or` | 手術室 |
| 耗材 | → `gnuhealth_surgery_supply` | 術中耗材記錄 |

---

#### 檢驗（`health_lab` — LIMS Occhiolino）

| 資料表 | 說明 |
|--------|------|
| `gnuhealth_lab` | 檢驗申請（patient, requestor, date, state） |
| `gnuhealth_lab_test_type` | 檢驗類型（27 種） |
| `gnuhealth_lab_test_critearea` | 檢驗項目判讀標準（243 筆；含警告旗標、參考值上下限、單位） |
| `gnuhealth_lab_test_units` | 單位（24 種） |
| `gnuhealth_patient_lab_test` | 病患-申請關聯 |

**自動化**：支援 `gnuhealth-data-import` 工具匯入 CSV/ODS 格式結果（欄位：檢驗ID、分析物代碼、數值、文字結果）

---

#### 醫學影像（`health_imaging` / `health_orthanc`）

| 模組 | 資料表 | 說明 |
|------|--------|------|
| 基礎影像 | `gnuhealth_imaging_test`, `gnuhealth_imaging_test_type`, `gnuhealth_imaging_test_request`, `gnuhealth_imaging_test_result` | 不含 DICOM 檔案 |
| Orthanc 整合 | （Orthanc 側儲存） | REST API 同步；不在 GNU Health DB 儲存影像；每 15 分鐘自動同步 |

---

#### 婦科（`health_gynecology`）

OB/GYN 標籤（儲存於 `gnuhealth_patient`）：
- **一般**：生育狀態、孕產史（OB Summary）、月經史
- **篩檢**：乳房自我檢查、乳房攝影史（`gnuhealth_patient_mammography_history`）、子宮頸抹片史（`gnuhealth_patient_pap_history`，結果含 Negative/ASC-US/LSIL/HSIL 等）、陰道鏡史（`gnuhealth_patient_colposcopy_history`）

---

#### 產科（`health_obstetrics`）

| 資料表 | 說明 |
|--------|------|
| `gnuhealth_patient_pregnancy` | 懷孕主記錄（LMP、預產期自動計算、胎兒數、妊娠結果） |
| `gnuhealth_patient_prenatal_evaluation` | 產前評估（孕週、高血壓/子癇/糖尿病、胎位、胎兒測量） |
| `gnuhealth_perinatal` | 分娩記錄（分娩方式：自然/吸引/剖腹、胎位、母胎生命徵象、併發症） |
| `gnuhealth_perinatal_monitor` | 分娩監測 |
| `gnuhealth_puerperium_monitor` | 產後追蹤（約 6 週；惡露量/色/氣味、子宮底高度） |
| `gnuhealth_newborn` | 新生兒記錄（APGAR 分數、反射、先天性疾病、QR Code 手環） |
| `gnuhealth_neonatal_apgar` | APGAR 評分細項 |

---

#### 基因遺傳（`health_genetics`）

| 資料表 | 筆數 | 說明 |
|--------|------|------|
| `gnuhealth_gene_variant` | 29,361 | 基因變異（含 HGNC ID、官方符號、染色體位置、類型） |
| `gnuhealth_gene_variant_phenotype` | 30,004 | 基因表現型關聯（臨床意義：benign / likely benign / pathogenic / likely pathogenic） |
| `gnuhealth_disease_gene` | 5,913 | 疾病-基因關聯 |
| `gnuhealth_protein_disease` | 4,912 | 蛋白質-疾病關聯 |
| `gnuhealth_patient_genetic_risk` | - | 個人遺傳風險（連結基因變異與表現型） |

> **注意**：基因相關資料來自 OMIM / UniProt，為參考資料庫，非病患個人資料。

---

#### 兒科（`health_pediatrics`）

| 資料表 | 說明 |
|--------|------|
| `gnuhealth_pediatrics_growth_charts_who` | WHO 兒童生長曲線（3,700 筆） |
| `gnuhealth_patient_psc` | 兒科症狀量表（PSC）；自動計算分數並旗標心理社會問題 |

---

#### 護理（`health_nursing`）

**住院查房**（`gnuhealth_patient_rounding`）五個標籤：主要、ICU、處置、用藥、庫存移動

**門診護理**（`gnuhealth_patient_ambulatory_care`）四個標籤：主要（患者、醫師、基礎病症、處置）、其他（生命徵象、血糖、演變狀態）、用藥、庫存移動

---

#### 社會經濟（`health_socioeconomics`）

儲存於 `gnuhealth_patient` 中，含三個評估面向：

| 標籤 | 內容 |
|------|------|
| 主要 | 住房、教育、職業、工作環境 |
| 基礎設施 | 下水道、燃氣、電話、網路（反向邏輯：勾選「缺少」） |
| 家庭 | 家庭 APGAR 指數、藥物濫用、家庭暴力、童工 |

---

#### 忽略熱帶病（`health_ntd`, `health_ntd_chagas`, `health_ntd_dengue`）

| 資料表 | 說明 |
|--------|------|
| `gnuhealth_chagas_du_survey` | 查加氏病戶籍調查（屋頂/牆面/地板品質、捕蟲器、燻蒸） |
| `gnuhealth_dengue_du_survey` | 登革熱調查（積水容器：輪胎、花瓶、植物、樹洞）；4 種實驗室檢驗 |

---

#### 聯邦架構（`health_federation`）

| 資料表 | 說明 |
|--------|------|
| `gnuhealth_federation_config` | 聯邦節點設定 |
| `gnuhealth_federation_country_config` | 各國節點設定 |
| `gnuhealth_federation_object` | 可同步的物件類型 |
| `gnuhealth_federation_queue` | 非同步同步佇列 |

**架構**：節點（各自主 HIS）→ Thalamus（訊息中介）→ GNU Health Information System（文件型 DB）

目前支援同步：人口統計資料、生活事件記錄（Book of Life）

---

## 六、核心資料表 Schema

### 最常被引用的表（FK 引用次數）

| 資料表 | 被引用次數 | 角色 |
|--------|-----------|------|
| `res_user` | 75 | 每筆資料的稽核（create/write uid） |
| `gnuhealth_healthprofessional` | 63 | 每個醫療行為都關聯醫生 |
| `company_company` | 48 | 多院所基礎 |
| `party_party` | 45 | 萬用實體基底 |
| `gnuhealth_patient` | 35 | 病患中心 |
| `gnuhealth_institution` | 31 | 醫療機構 |
| `account_account` | 29 | 會計科目 |
| `product_product` | 28 | 產品（藥品、床位） |
| `ir_sequence` | 28 | 流水號 |
| `gnuhealth_pathology` | 21 | ICD-10 疾病（診斷基底） |

### `party_party` 關鍵欄位

```sql
party_party (
  id, code,              -- 唯一識別
  name, lastname,        -- 姓名（西方格式）
  dob,                   -- 出生日期
  gender,                -- 性別
  photo,                 -- 大頭照（bytea）
  marital_status,        -- 婚姻狀況
  citizenship,           -- 國籍
  occupation,            -- 職業
  education,             -- 教育程度
  du,                    -- FK → gnuhealth_du（戶籍單元）
  -- 角色旗標：
  is_person, is_patient, is_healthprof,
  is_institution, is_pharmacy, is_insurance_company,
  -- 聯邦：
  federation_account, fed_country, fsync,
  -- 其他：
  internal_user,         -- FK → res_user（登入帳號）
  unidentified,          -- 身份不明（急診）
  deceased, death_certificate, birth_certificate
)
```

### `gnuhealth_healthprofessional` 關鍵欄位

```sql
gnuhealth_healthprofessional (
  id,
  name,          -- FK → party_party（1:1）
  code,          -- 執照號
  institution,   -- FK → party_party（機構）
  main_specialty -- FK → gnuhealth_hp_specialty
)
```

---

## 七、業務流程資料流

### 門診就診流程

```
[建立個人] party_party (is_person=true)
    ↓
[啟用病患] gnuhealth_patient (name → party_party)
    ↓
[預約掛號] gnuhealth_appointment
    (patient, healthprof, institution, speciality, date, state)
    ↓ state: confirmed → checked_in
[問診評估] gnuhealth_patient_evaluation
    ├── 生命徵象、主訴、症狀
    ├── [診斷] gnuhealth_diagnostic_hypothesis → gnuhealth_pathology (ICD-10)
    └── [處方] gnuhealth_prescription_order → gnuhealth_prescription_line → gnuhealth_medicament

[申請檢驗] gnuhealth_lab (patient, requestor)
    └── gnuhealth_lab_test_critearea (結果判讀，含警告旗標)

[申請影像] gnuhealth_imaging_test_request
    └── gnuhealth_imaging_test_result
```

### 住院流程

```
gnuhealth_appointment (inpatient_registration_code 填入)
    ↓
gnuhealth_inpatient_registration
    (patient, bed, hospitalization_date, discharge_date, admission_type, state)
    ├── [行政] 主治醫師、入院原因、診斷
    ├── [營養] gnuhealth_inpatient_diet, gnuhealth_inpatient_meal
    ├── [用藥] gnuhealth_inpatient_medication
    │         └── gnuhealth_inpatient_medication_log (給藥記錄)
    ├── [護理查房] gnuhealth_patient_rounding
    │         └── gnuhealth_rounding_procedure
    └── [ICU] gnuhealth_inpatient_icu
              ├── gnuhealth_icu_apache2 (APACHE II 評分)
              ├── gnuhealth_icu_glasgow (GCS 評分)
              └── gnuhealth_icu_ventilation (呼吸器)

[手術] gnuhealth_surgery
    (patient, date, surgeon, anesthetist, or, asa_ps, rcri, mallampati)
    ├── gnuhealth_surgery_team
    └── gnuhealth_surgery_supply

[出院] discharge_date, discharge_reason, discharge_dx, discharged_by
```

### 公衛社區調查流程

```
gnuhealth_operational_area → gnuhealth_operational_sector
    └── gnuhealth_du (戶籍單元)
          └── party_party (du → 戶籍) → gnuhealth_family
                └── gnuhealth_patient
                      ├── gnuhealth_chagas_du_survey (查加氏病調查)
                      └── gnuhealth_dengue_du_survey (登革熱調查)
```

---

## 八、Demo 資料說明

### 主要虛構人物：Ana Betz

| 項目 | 資料 |
|------|------|
| Federation ID | ESPGNU777ORG |
| 出生日期 | 1985-10-04 |
| 職業 | 小學教師 |
| 健康中心 | GNU Solidario Hospital, Las Palmas, Spain |
| 主要病史 | 第一型糖尿病（1993 年診斷，胰島素治療中） |
| 遺傳風險 | BRCA1 基因（乳癌早發） |
| 家族史 | 馬凡氏症（外祖父）、高血壓（父親） |
| 過敏 | β-lactam 過敏 |
| 家庭 | 已婚，夫 John Zenon，子 Matt（2010-03-15） |

### 資料量 Top 20

| 資料表 | 筆數 | 說明 |
|--------|------|------|
| `ir_model_data` | 185,375 | 框架元資料 |
| `gnuhealth_gene_variant_phenotype` | 30,004 | OMIM 基因表現型資料庫 |
| `gnuhealth_gene_variant` | 29,361 | 基因變異資料庫（UniProt） |
| `gnuhealth_pathology` | 14,333 | **完整 ICD-10 疾病分類** |
| `gnuhealth_disease_group_members` | 7,416 | 疾病分組關係 |
| `gnuhealth_disease_gene` | 5,913 | 疾病-基因關聯 |
| `ir_model_field` | 5,797 | 框架欄位定義 |
| `gnuhealth_protein_disease` | 4,912 | 蛋白質-疾病關聯 |
| `country_subdivision` | 4,837 | 全球行政區資料 |
| `gnuhealth_procedure` | 4,706 | ICD-10-PCS 醫療處置代碼 |
| `gnuhealth_pediatrics_growth_charts_who` | 3,700 | WHO 兒童生長曲線 |
| `gnuhealth_appointment` | 3,501 | **示範預約掛號資料** |
| `gnuhealth_occupation` | 636 | 職業代碼 |
| `gnuhealth_medicament` | 451 | 藥品目錄 |
| `gnuhealth_pathology_category` | 284 | ICD-10 章節分類 |
| `gnuhealth_lab_test_critearea` | 243 | 檢驗項目判讀標準 |
| `gnuhealth_medicament_category` | 172 | 藥品分類 |
| `gnuhealth_specialty` | 73 | 醫療科別 |

### 線上 Demo 環境

| 項目 | 值 |
|------|-----|
| 伺服器 | federation.gnuhealth.org:443 |
| 資料庫 | health50 |
| 帳號 | admin |
| 密碼 | gnusolidario |
| 協定 | SSL（port 443） |

> 注意：線上 Demo 定期重置，僅供測試用途。

---

## 九、本地復刻需求

### 方案比較

| 方案 | 難度 | 說明 |
|------|------|------|
| **A. 完整系統還原** | 高 | 安裝 Tryton 7.x + GNU Health 應用層，再匯入 DB；需配合最新版 Tryton（DB 結構可能差異） |
| **B. 僅匯入 DB（純查詢分析）** | 低 | 只需 PostgreSQL，一行指令完成 |
| **C. 部分 Schema 移植** | 中 | 選取特定模組移植到其他技術棧 |

### 方案 B 指令（最快驗證）

```bash
# 安裝 PostgreSQL（macOS）
brew install postgresql@15

# 啟動服務
brew services start postgresql@15

# 建立使用者與資料庫
createuser gnuhealth
createdb gnuhealth_demo -O gnuhealth

# 匯入（約需 3-10 分鐘）
psql -U gnuhealth gnuhealth_demo < gnuhealth-36-demo.sql

# 驗證
psql -U gnuhealth gnuhealth_demo -c "SELECT COUNT(*) FROM gnuhealth_patient;"
```

### 最新版系統需求（參考官方文件）

| 項目 | 需求 |
|------|------|
| OS | GNU/Linux 或 BSD（Debian 12、Ubuntu 22.04、FreeBSD 14） |
| PostgreSQL | **>= 15.x**（官方文件最新需求） |
| Python | >= 3.10 |
| Tryton | 7.0 |
| Gunicorn | 23.0 |
| 磁碟空間（Demo DB） | ~500 MB（含索引） |
| Web 伺服器 | Nginx + uWSGI（正式環境） |

> **注意**：Demo SQL 為 PostgreSQL 10.6 格式，在 PG 14/15 上匯入**可能有相容性問題**，匯入前建議測試。

---

## 十、後續開發參考

### 值得移植的設計模式

1. **Party Pattern**：單一 `party` 表 + boolean 旗標 + 角色擴充表，避免複雜繼承結構，同一個人可多角色。

2. **People Before Patients**：先建立社區人口（`party`, `du`, `family`），再啟用病患屬性，利於公衛視角。

3. **標準審計欄位**：每張表的 `create_date`, `write_date`, `create_uid`, `write_uid` 設計，可直接採用。

4. **多院所 FK**：每張業務表都有 `institution` FK，多院所擴展不需改 Schema。

5. **State Machine via String**：狀態以字串儲存，轉換在應用層控制，Schema 保持簡單。

6. **參考資料庫內建**：ICD-10、ICD-10-PCS、OMIM 基因資料、WHO 生長曲線直接預載，不依賴外部 API。

### 建議優先研究的模組 Schema

- [ ] `party_party` + `gnuhealth_patient` — 病患資料模型的基礎
- [ ] `gnuhealth_appointment` — 掛號排程設計
- [ ] `gnuhealth_patient_evaluation` — 門診評估（含 SOAP 四標籤結構）
- [ ] `gnuhealth_inpatient_registration` + `gnuhealth_hospital_bed/ward` — 住院與病床管理
- [ ] `gnuhealth_pathology` — ICD-10 整合方式（14,333 筆疾病代碼）
- [ ] `gnuhealth_prescription_order` / `gnuhealth_lab` — 處方與檢驗申請流程

### 安全性考量

- 正式環境建議 Nginx + uWSGI（非 Tryton 內建開發伺服器）
- 全程 HTTPS/TLS
- SSH Key 驗證（停用密碼登入）
- `health_crypto` 模組支援 GPG 數位簽章（處方、出生/死亡證明）
- 弱點回報：security@gnuhealth.org

### 參考文件

| 資源 | 連結 |
|------|------|
| GNU Health HIS 官方文件 | https://docs.gnuhealth.org/his/ |
| GNU Health 原始碼 | https://codeberg.org/gnuhealth/ |
| Tryton 框架文件 | https://docs.tryton.org/ |
| GNU Health 社群伺服器 | federation.gnuhealth.org |
