# Veterinary HIS — 獸醫診所資訊系統

> 為連鎖動物醫院設計的 Hospital Information System，以 GNU Health HIS 3.6 為架構參考，針對獸醫場景進行適配與重新設計。

---

## 專案定位

| 項目 | 說明 |
|------|------|
| 適用場景 | 5–10 間連鎖分院的中型動物醫院 |
| 動物類型 | 全類型（伴侶動物、特殊寵物、大型動物） |
| 部署模式 | 集中式地端（單一主機，各分院連線存取） |
| 跨院共享 | 同一動物可在不同分院就診，病歷全域共享 |
| 設計參考 | [GNU Health HIS 3.6 逆向分析](docs/GNU_HEALTH_ANALYSIS.md)（364 張表、913 FK 約束） |

---

## 系統架構

```
┌─────────────────────────────────────────────────────────┐
│  Frontend — React 18 + TypeScript + Vite + shadcn/ui    │
│  TanStack Table · React Hook Form · Zod · dnd-kit       │
├─────────────────────────────────────────────────────────┤
│  Backend — FastAPI + SQLAlchemy 2.0 + Alembic            │
│  JWT 認證 · RBAC 角色控制 · append-only 醫療紀錄         │
├─────────────────────────────────────────────────────────┤
│  Database — PostgreSQL 16                                │
│  Partial indexes · CHECK 約束狀態機 · Catalog 目錄表      │
├─────────────────────────────────────────────────────────┤
│  Infra — Docker Compose + Nginx reverse proxy            │
└─────────────────────────────────────────────────────────┘
```

---

## 如何了解這個專案

本專案以文件驅動開發，每份文件有明確的職責。建議按以下順序閱讀：

### 閱讀路徑

```
SPEC.md → DECISIONS.md → SCHEMA.md → CLAUDE.md
 做什麼      為什麼         怎麼做      怎麼協作
```

### 文件定位

| 文件 | 定位 | 原則 |
|------|------|------|
| [`SPEC.md`](SPEC.md) | **需求規格** — 系統要做什麼、功能範疇、待確認事項 | 每次需求討論有共識就立即更新；未決事項統一列在「待確認」區 |
| [`DECISIONS.md`](DECISIONS.md) | **架構決策紀錄（ADR）** — 重要決策的背景、選項、決定、理由 | 只記錄重大/影響架構/抽象需求的決策；實作細節從程式碼即可理解，不需記錄 |
| [`SCHEMA.md`](SCHEMA.md) | **資料庫 Schema** — 所有表定義、約束、索引的 source of truth | 每次新增或修改資料表時同步更新 |
| [`CLAUDE.md`](CLAUDE.md) | **AI 協作規則** — 工作流程、程式碼風格、環境設定、Git 慣例 | 協作過程中建立的新原則應及時整理至此 |
| [`COMPLIANCE.md`](COMPLIANCE.md) | **法規合規研究** — 台灣 HIS 相關法規（個資法、動物診療業、管制藥品等） | 各模組的合規要點嵌入 SPEC.md 對應章節 |
| [`docs/GNU_HEALTH_ANALYSIS.md`](docs/GNU_HEALTH_ANALYSIS.md) | **設計參考** — GNU Health HIS 3.6 完整逆向分析 | 新增資料表前先查閱對應的 GNU Health 表結構，再決定沿用或改寫 |

---

## 功能總覽

### 已完成（Phase 1–4）

| 模組 | 功能 | 角色 |
|------|------|------|
| **飼主 & 動物管理** | 飼主 CRUD、動物建檔（物種/品種/血型/晶片）、跨院共用 | 全角色 |
| **掛號 & 候診** | 現場掛號、看板拖曳排序（dnd-kit）、重複掛號防護、狀態推進 | receptionist, vet |
| **門診病歷** | SOAP 病歷、生命徵象、護理備註、Tab 切換介面 | vet, nurse |
| **檢驗醫囑** | 開立/取消/回填結果、analyte 層級結構化結果、待檢狀態連動 | vet, nurse, technician |
| **術語目錄管理** | 物種/品種/診斷碼/檢驗項目等 catalog 表的 CRUD | admin |
| **AI 小幫手** | 自然語言查詢業務資料（Ollama LLM）、唯讀白名單、稽核記錄 | 全角色 |
| **住院管理** | 病房/病床管理、入院/出院流程、巡房紀錄、住院醫囑+執行、拖曳轉床（[ADR-023](DECISIONS.md)） | vet, nurse |

### 規劃中

預約掛號 · 藥品處方 · 結帳收費 · 疫苗接種 · 手術麻醉（[ADR-017](DECISIONS.md)） · 檢驗儀器串接 · 跨院報表

---

## 核心設計決策

本專案以 Architecture Decision Records（ADR）驅動設計，共 20 篇決策紀錄，完整內容見 [DECISIONS.md](DECISIONS.md)。以下摘錄關鍵設計：

### Domain Model

```
Organization (集團)
 └── Clinic (分院)
       └── Visit (就診) ──→ VitalSign, SOAPNote, NursingNote, LabOrder
                                                                  └── LabResultItem

Owner (飼主，跨院共用，無 clinic_id)
 └── Animal (動物，跨院共用)
       ├── Species / Breed (catalog)
       ├── BloodType (catalog)
       └── AnimalDisease / AnimalMedication (長期紀錄)
```

- **Owner & Animal 跨院共用**（[ADR-002](DECISIONS.md#adr-002-部署架構)）：飼主與動物無 `clinic_id`，任何分院皆可存取
- **Visit 綁定分院**（[ADR-014](DECISIONS.md)）：臨床紀錄依 `clinic_id` 隔離，跨院查詢透過 animal_id 串接

### 就診狀態機（ADR-006）

```
registered → triaged → in_consultation ⇄ pending_results → completed
                                                           → admitted (住院，後續)
                         任何狀態 → cancelled
```

- 狀態轉換以 `VALID_TRANSITIONS` dict 控制，應用層強制驗證
- `in_consultation ⇄ pending_results`：獸醫開檢驗單後動物移交技術員，醫師繼續看診
- 所有狀態變更都有測試覆蓋

### 醫療紀錄不可變性（ADR-007）

- 所有臨床表（vital_signs, soap_notes, nursing_notes, lab_orders）採 **append-only** 設計
- 修正以新版取代：`is_superseded` + `superseded_by` 鏈結
- 符合動物診療業管理辦法病歷保存要求（≥ 3 年）

### 無規範字串原則（ADR-008）

| 層次 | 適用情境 | 實作 |
|------|---------|------|
| CHECK 約束 | 固定集合（狀態機、性別） | `VARCHAR + CHECK (value IN (...))` |
| Catalog 目錄表 | 管理員可增減（物種、品種、診斷碼） | 獨立表 + FK + `is_active` |
| 自由文字 | 不可避免的臨床敘述 | `TEXT`，文件中說明原因 |

### 片語優先原則（ADR-019）

遇到 `TEXT` 自由文字欄位的設計，優先評估能否以 catalog 表 + 片語選擇取代，降低資料碎片化。

### Catalog 分類策略（ADR-020）

| 分類 | 說明 | 管理方式 |
|------|------|---------|
| 內部管理型 | 院所自訂（物種、品種、院內診斷碼） | UI 完整 CRUD |
| 外部匯入型 | 外部標準（VeNom、VetSCT） | 唯讀 + `source_ref` 標記來源 |

---

## 角色與權限（RBAC）

| 角色 | 職責 | 臨床寫入權限 |
|------|------|-------------|
| `admin` | 系統管理、術語維護、使用者管理 | — |
| `vet` | 門診、開立 SOAP/檢驗/處方 | SOAP, vital signs, nursing notes, lab orders |
| `nurse` | 護理、生命徵象、檢驗結果回填 | vital signs, nursing notes, lab results |
| `technician` | 檢驗執行與結果回填 | lab results |
| `receptionist` | 掛號、飼主/動物建檔 | — |

- JWT token 含 `{sub, org_id, clinic_id, roles}`
- 登入後選擇分院，所有 API 操作自動綁定 `clinic_id`
- 臨床 endpoint 以 `require_roles` 裝飾器強制角色檢查

---

## 法規合規

完整分析見 [COMPLIANCE.md](COMPLIANCE.md)，涵蓋 5 部法規、13 項合規要求：

| 法規 | 核心影響 |
|------|---------|
| 個人資料保護法 | 飼主個資同意記錄、存取稽核、外洩通報 |
| 動物診療業管理辦法 | 病歷保存 ≥ 3 年、獸醫師執照字號、角色強制 |
| 管制藥品管理條例 | append-only 帳本、雙月報備（後續階段） |
| 電子發票實施作業要點 | B2C 電子化（後續階段） |
| 放射線安全法 | X-ray 操作人員記錄（後續階段） |

---

## 專案文件

| 文件 | 內容 | 行數 |
|------|------|------|
| [DECISIONS.md](DECISIONS.md) | 22 篇 Architecture Decision Records | 1,250+ |
| [SCHEMA.md](SCHEMA.md) | 完整 SQL schema（source of truth） | 767 |
| [SPEC.md](SPEC.md) | 功能規格、待確認事項 | 150+ |
| [COMPLIANCE.md](COMPLIANCE.md) | 台灣法規合規分析 | 493 |
| [docs/ER_DIAGRAM.md](docs/ER_DIAGRAM.md) | ER Diagram + 狀態機圖（Mermaid） | — |
| [docs/GNU_HEALTH_ANALYSIS.md](docs/GNU_HEALTH_ANALYSIS.md) | GNU Health HIS 3.6 逆向分析參考 | — |

---

## 畫面截圖

| 登入 | 分院選擇 |
|:----:|:--------:|
| ![登入](screenshots/01_login.png) | ![分院選擇](screenshots/02_clinic_select.png) |

| Dashboard | 飼主列表 |
|:---------:|:--------:|
| ![Dashboard](screenshots/03_dashboard.png) | ![飼主列表](screenshots/04_owner_list.png) |

| 飼主詳情 | 候診看板 |
|:--------:|:--------:|
| ![飼主詳情](screenshots/05_owner_detail.png) | ![候診看板](screenshots/06_kanban.png) |

| 病歷列表 | 病歷詳情 |
|:--------:|:--------:|
| ![病歷列表](screenshots/07_medical_records.png) | ![病歷詳情](screenshots/08_medical_record_detail.png) |

| 術語目錄管理 |
|:------------:|
| ![術語管理](screenshots/09_terminology.png) |

---

## 測試

```bash
make test          # pytest — 142 tests
make lint          # ruff (backend) + tsc (frontend)
make install-hooks # pre-commit hook（每次 commit 自動跑全套）
```

測試分類：
- **Model metadata**（93）：ORM 模型與 migration SQL 的一致性驗證
- **Schema validation**（31）：Pydantic schema 欄位與約束
- **Business logic**（16）：狀態機轉換、重複掛號防護、角色驗證
- **Migration**（2）：Alembic revision 完整性

---

## 快速啟動

```bash
git clone https://github.com/yaurueitian-wq/veterinary-his.git
cd veterinary-his
cp .env.example .env   # 修改 POSTGRES_PASSWORD 和 SECRET_KEY
make up                # docker compose up -d --build
make migrate           # alembic upgrade head + seed data
```

預設管理員帳號：`admin@his.local`（詳見 `.env.example`）

---

## 技術棧選型理由

詳見 [ADR-003](DECISIONS.md#adr-003-技術棧)

| 選型 | 理由 |
|------|------|
| **React + shadcn/ui** | 元件原始碼自有、Tailwind 基底、避免被第三方設計綁架 |
| **FastAPI** | 非同步、自動 OpenAPI 文件、Python 生態利於 ETL/數據處理 |
| **PostgreSQL** | ACID 保障醫療資料完整性、JSONB 支援物種差異化、partial index |
| **Docker Compose** | 地端一鍵部署、未來擴充 Redis/worker 無縫加入 |

---

## License

Private — 未公開授權
