# 獸醫診所 HIS 系統 — 決策紀錄

> **格式**：ADR（Architecture Decision Record）
> **建立日期**：2026-03-03

每筆決策包含：背景、考慮的選項、最終決定、決定理由。

---

## 決策索引

| # | 主題 | 狀態 | 日期 |
|---|------|------|------|
| [ADR-001](#adr-001-系統參考基準) | 系統參考基準 | ✅ 決定 | 2026-03-03 |
| [ADR-002](#adr-002-部署架構) | 部署架構 | ✅ 決定 | 2026-03-03 |
| [ADR-003](#adr-003-技術棧) | 技術棧 | ✅ 決定 | 2026-03-03 |
| [ADR-004](#adr-004-擴充性策略) | 擴充性策略 | ✅ 決定 | 2026-03-03 |
| [ADR-005](#adr-005-資料移轉策略) | 資料移轉策略 | ✅ 決定 | 2026-03-03 |
| [ADR-006](#adr-006-就診狀態機與緊急通道) | 就診狀態機與緊急通道 | ✅ 決定 | 2026-03-04 |
| [ADR-007](#adr-007-角色權限模型與稽核追蹤) | 角色權限模型與稽核追蹤 | ✅ 決定 | 2026-03-04 |
| [ADR-008](#adr-008-資料結構化原則) | 資料結構化原則 | ✅ 決定 | 2026-03-05 |
| [ADR-009](#adr-009-動物識別策略) | 動物識別策略 | ✅ 決定 | 2026-03-05 |
| [ADR-010](#adr-010-檔案附件架構) | 檔案附件架構 | 📋 設計備忘（後續階段） | 2026-03-05 |
| [ADR-011](#adr-011-分院自動識別機制) | 分院自動識別機制 | 📋 設計備忘（後續階段） | 2026-03-06 |
| [ADR-012](#adr-012-就診狀態轉換歷史) | 就診狀態轉換歷史 | 📋 設計備忘（後續階段） | 2026-03-06 |
| [ADR-013](#adr-013-病歷號碼編碼原則) | 病歷號碼編碼原則 | ⏳ 待定（MVP 暫代方案已實作） | 2026-03-06 |
| [ADR-014](#adr-014-臨床記錄的多院所隔離策略) | 臨床記錄的多院所隔離策略 | ✅ 已決定 | 2026-03-06 |
| [ADR-015](#adr-015-visitsowner_id-非正規化設計) | visits.owner_id 非正規化設計 | ✅ 已決定 | 2026-03-06 |
| [ADR-016](#adr-016-系統小幫手-ai-assistant-架構) | 系統小幫手（AI Assistant）架構 | 📋 設計備忘（後續階段） | 2026-03-07 |
| [ADR-017](#adr-017-手術--麻醉模組架構) | 手術 & 麻醉模組架構 | 📋 設計備忘（後續階段） | 2026-03-08 |
| [ADR-018](#adr-018-法規合規設計策略) | 法規合規設計策略 | ✅ 決定 | 2026-03-09 |
| [ADR-019](#adr-019-獸醫資料編碼標準與結構化策略) | 獸醫資料編碼標準與結構化策略 | ✅ 決定 | 2026-03-11 |
| [ADR-020](#adr-020-catalog-資料來源分類策略) | Catalog 資料來源分類策略 | ✅ 決定 | 2026-03-12 |
| [ADR-021](#adr-021-就診重複掛號的併發控制策略) | 就診重複掛號的併發控制策略 | ⏳ 待定（已識別，待討論） | 2026-03-20 |
| [ADR-022](#adr-022-臨床紀錄不可變性保障層級) | 臨床紀錄不可變性保障層級 | ⏳ 待定（已識別，待討論） | 2026-03-20 |

---

## ADR-001 系統參考基準

**狀態**：✅ 決定

**背景**：
需要一個設計參考，避免從零發想資料模型與流程。

**考慮選項**：
- GNU Health HIS 3.6（開源人類醫療系統，已有完整 SQL schema 分析）
- 市場上現有獸醫診所軟體（VETport、Cornerstone 等，黑箱）
- 完全自行設計

**決定**：
以 GNU Health HIS 3.6 作為架構參考基準，進行獸醫場景的適配與改寫。

**理由**：
- 已有完整的 schema 逆向分析（詳見 `docs/GNU_HEALTH_ANALYSIS.md`）
- GNU Health 的 Party Pattern、掛號、病歷、藥品等模組邏輯可直接借鑑
- 需要改寫的核心差異：Patient → Animal、新增 Owner（飼主）層、物種/品種欄位

---

## ADR-002 部署架構

**狀態**：✅ 決定

**背景**：
連鎖規模約 5 間分院，需決定資料如何存放與各院所如何存取。

**考慮選項**：

| 選項 | 說明 | 優點 | 缺點 |
|------|------|------|------|
| A. 集中式地端 | 總院一台主機，5間連線存取 | 資料統一、易維護、支援跨院查詢 | 主機故障或斷線影響所有院所 |
| B. 分散式地端 | 每間各自一台伺服器 | 各自獨立、斷線不互相影響 | 跨院所資料共享需額外同步機制，維護成本高 |
| C. 雲端 SaaS | 資料放雲端，院所連網使用 | 免維護主機、擴充彈性高 | 月費成本、需穩定網路、資料在外部 |

**決定**：選項 A（集中式地端）

**理由**：
- 確認跨院所就診為必要情境（同一動物可能在不同分院就診，病歷須共享）
- 集中式架構是支援跨院查詢最直接的方案，不需額外同步機制
- 5 間規模下維護一台主機的成本遠低於分散式的複雜度

**後續注意事項**：
- 主機需考慮 HA（High Availability）或備援機制，避免單點故障影響全院所
- 各分院連線需評估網路穩定性（VPN 或專線）
- 斷線降級策略：MVP 階段不支援離線功能，以紙本作業為降級方案；後續視實際斷線頻率再評估是否導入本機暫存 + 同步機制

---

## ADR-003 技術棧

**狀態**：✅ 決定

**背景**：
系統為 Web 瀏覽器桌機操作、自建團隊開發、地端部署、複雜業務邏輯（掛號流程、病歷狀態機）、需支援資料移轉腳本、長期模組擴充。

**考慮選項**：

| 方案 | Frontend | Backend | DB | 適合情境 |
|------|---------|---------|-----|---------|
| A（選定） | React + TypeScript + shadcn/ui | FastAPI (Python) | PostgreSQL | 現代 Web、長期擴充、資料處理能力強 |
| B | Next.js + TypeScript | FastAPI (Python) | PostgreSQL | SSR 無明顯效益，過度 |
| C | — | Laravel (PHP) / Rails (Ruby) | MySQL | 快速開發但長期擴充彈性低 |
| D | — | Tryton (Python ERP) | PostgreSQL | 客製化困難，不採用 |

**決定**：

| 層次 | 選型 | 搭配工具 |
|------|------|---------|
| Frontend | React + TypeScript | shadcn/ui、TanStack Table、React Hook Form、Zod |
| Backend | FastAPI (Python) | SQLAlchemy（ORM）、Alembic（migration） |
| Database | PostgreSQL | — |
| 部署 | Docker + Docker Compose | Nginx（reverse proxy） |

**理由**：
- shadcn/ui 取代 Ant Design：元件原始碼自有、Tailwind 基底、客製化彈性高，避免長期被設計風格綁架
- FastAPI：現代非同步 Python 框架，自動產生 OpenAPI 文件，Python 生態對資料移轉腳本支援優異
- PostgreSQL：資料高度關聯（飼主→動物→就診→處方），ACID 事務保障醫療資料完整性，JSONB 支援物種差異化欄位
- Docker Compose：地端部署一鍵啟動，未來擴充服務（Redis、worker）無縫加入

---

## ADR-004 擴充性策略

**狀態**：✅ 決定

**背景**：
預期自家診所 2 年內從 5 間翻倍至約 10 間。對外銷售 HIS 為樂觀長期願景，非明確中期計畫。

**決定**：
- **短期（MVP）**：針對自家連鎖診所設計，不實作多租戶架構
- **預留措施**：所有業務資料表加入 `organization_id` 欄位（對應集團 / 未來租戶），現階段只有一筆資料，不做任何多租戶邏輯
- **規模翻倍**：PostgreSQL 集中式架構可透過垂直擴充（升級硬體）應對 10 間規模，無需改架構

**理由**：
- `organization_id` 欄位代價極低（一個欄位），但日後若需多租戶，schema 無需大改
- 過早實作多租戶基礎設施（認證隔離、計費、客戶管理）會拖慢 MVP 開發速度
- 10 間診所的資料量對 PostgreSQL 單機仍游刃有餘

---

## ADR-005 資料移轉策略

**狀態**：✅ 決定

**背景**：
各院所有舊系統既存資料需移轉，但新系統設計不應受舊資料結構限制。

**決定**：
- 新系統 schema 依領域最佳實踐獨立設計，完全不參考舊系統結構
- 移轉採 **ETL 中介暫存表**方式：舊資料 → staging table → 轉換邏輯 → 新系統正式表
- 資料移轉**不是 MVP 上線前提**，新舊系統可並行運作一段時間
- 移轉腳本作為獨立工具開發，不耦合進主系統

**理由**：
- 避免「被舊系統綁架」：若以舊結構為設計出發點，會繼承舊系統的設計缺陷
- ETL 中介表提供清洗、驗證、對應的緩衝層，移轉品質更可控
- 解耦移轉時程，讓團隊可以專注先把新系統做對

---

## ADR-006 就診狀態機與緊急通道

**狀態**：✅ 決定

**背景**：
就診（visit）記錄在不同階段由不同角色操作，需要明確的狀態機。同時存在緊急就診場景（動物危急，需跳過標準掛號流程直接進入處置），但此功能不在 MVP 範疇。另外，獸醫師在診間可能下達檢驗醫囑，動物移交技術員或護理人員接手，而原獸醫師繼續接診下一隻動物（同人類就醫流程）。

**就診標準狀態機（MVP）**：
```
registered → triaged → in_consultation ⇄ pending_results → completed
                                                          → admitted（轉住院，後續實作）
                                       → cancelled（掛號取消）
```

說明：
- `in_consultation → pending_results`：獸醫師下達檢驗醫囑，動物移交技術員/護理人員，visit 與原醫師脫鉤
- `pending_results → in_consultation`：檢驗結果回傳後，visit 重新進入問診階段
- `pending_results → completed`：若結果確認不需再次問診，可直接結案
- `cancelled`：任何狀態均可取消（飼主未到、動物突發意外等）；保留資料不刪除

**候診排序與優先順序**：
- 候診清單依 `(priority DESC, registered_at ASC)` 排序
- `priority` 欄位：`normal`（一般）/ `urgent`（急診插隊）
- 排序邏輯在應用層管理，工作人員可手動調整 priority（例如急診到院時設為 urgent）
- 設計依據：診所有 24 小時急診服務，輪班制下醫師需能快速識別急診動物

**緊急通道（未來）**：
```
emergency_admitted → in_consultation → completed / admitted
```
緊急路徑允許 `animal_id` 暫時為 null，資料事後補填。

**決定**：
- MVP 實作標準路徑（含 `pending_results` 狀態）
- 緊急通道為明確的未來必要功能，但 MVP 不實作
- Schema 採「設計縫隙，不預建功能」原則：預留結構，不實作邏輯
- 掛號前的口頭初評（非正式檢傷）屬於操作行為，**不進系統**
- 檢驗結果 MVP 採人工輸入；未來再與儀器系統串接

**Schema 預留設計**：
```sql
visits (
  animal_id        INTEGER,           -- 允許 null（緊急時可先建 visit 再補）
  status           VARCHAR(30),       -- varchar 而非 enum，新增狀態無需 migration
  is_emergency     BOOLEAN DEFAULT FALSE,  -- 緊急標記，MVP 永遠為 false
  attending_vet_id INTEGER            -- 當前負責獸醫師；輪班制下允許轉交，不鎖定原始醫師
)

lab_test_types (                      -- 檢驗項目目錄（管理員可增減）
  id               SERIAL PRIMARY KEY,
  name             VARCHAR(200) NOT NULL,  -- 例：全血計數、X-ray 胸腔、心電圖
  category         VARCHAR(100),           -- 例：血液、影像、心臟
  is_active        BOOLEAN DEFAULT TRUE,   -- 停用而非刪除，保留歷史紀錄完整性
  organization_id  INTEGER NOT NULL
)

lab_orders (
  visit_id         INTEGER NOT NULL,
  test_type_id     INTEGER NOT NULL REFERENCES lab_test_types(id),
  ordered_by       INTEGER NOT NULL,  -- 下醫囑的獸醫師
  status           VARCHAR(30),       -- pending / resulted / cancelled
  result_text      TEXT,              -- MVP 人工輸入結果
  resulted_at      TIMESTAMPTZ,
  resulted_by      INTEGER            -- 輸入結果的人員（技術員或護理人員）
)
```

**理由**：
- 狀態機必須明確：不同狀態決定不同角色看到的介面與可執行操作
- `pending_results` 是已確認的常見臨床流程，非邊緣情境
- `attending_vet_id` 允許輪班轉交：24hr 急診、輪班制下結果可由任何有空醫師接手
- 事後將 `animal_id NOT NULL` 改為 nullable 成本極高（影響全應用層驗證邏輯）
- 預留 `is_emergency` 和 nullable `animal_id` 的代價極低，避免未來破壞性 migration
- `lab_test_types` 目錄表支援項目增減；`is_active` 停用而非刪除，確保歷史醫囑仍可追溯
- `lab_orders` 在 MVP 以人工輸入結果為主；結構設計支援未來儀器串接（新增欄位即可）

---

## ADR-007 角色權限模型與稽核追蹤

**狀態**：✅ 決定

**背景**：
護理人員在不同時段可能身兼多種職責（協助記錄、暫代櫃台、支援檢查），單一固定角色無法反映實務分工。同時，醫療紀錄的責任歸屬有法律意義，每筆操作必須可追溯至執行者。

**考慮的張力**：
- 過度嚴格的角色限制 → 操作摩擦、影響效率
- 過度寬鬆的權限 → 責任歸屬模糊、資料完整性風險

**決定**：

**1. 多角色指派（User-Role 多對多）**
- 預定義角色：`vet`、`nurse`、`technician`、`receptionist`、`admin`
- 每個使用者可被管理員指派一或多個角色
- 每個角色對應一組允許的操作（API 層級的權限檢查）
- 此設計解決「護理人員暫代櫃台」等兼任情境，而不需要臨時帳號切換

**2. 資料區塊依角色分工**
- 問診內容分為職責區塊，例如：
  - 生命徵象 / 護理備註 → 需要 `nurse` 或 `vet` 角色
  - SOAP 病歷主體 → 僅 `vet` 角色可建立與最終確認
  - 掛號資料 → 需要 `receptionist` 或 `nurse` 角色
- 各區塊個別記錄 `created_by`，不混用

**3. 稽核追蹤（Append-only，不可竄改）**
- 醫療紀錄（SOAP、檢驗醫囑、處方）採 **append-only** 原則：
  - 不允許直接修改原始紀錄
  - 需更正時，新增一筆修正紀錄，並標記原始紀錄為 `superseded`
  - 原始紀錄永遠可查閱，不刪除
- 所有業務操作記錄 `performed_by`（使用者 ID）與 `performed_at`（時間戳）
- 角色指派變更本身也留有稽核紀錄

**Schema 模式**：
```sql
-- 角色指派
user_roles (
  user_id   INTEGER NOT NULL,
  role      VARCHAR(50) NOT NULL,   -- vet / nurse / technician / receptionist / admin
  granted_at TIMESTAMPTZ NOT NULL,
  granted_by INTEGER NOT NULL
)

-- SOAP 病歷（append-only 示例）
soap_notes (
  id            SERIAL PRIMARY KEY,
  visit_id      INTEGER NOT NULL,
  subjective    TEXT,
  objective     TEXT,
  assessment    TEXT,
  plan          TEXT,
  created_by    INTEGER NOT NULL,   -- 必填，不允許匿名記錄
  created_at    TIMESTAMPTZ NOT NULL DEFAULT now(),
  is_superseded BOOLEAN DEFAULT FALSE,  -- true 表示已被更新版本取代
  superseded_by INTEGER               -- 指向新版紀錄的 id
)
```

**4. 登入時分院選擇**
- 使用者登入後，系統查詢 `user_roles`（`revoked_at IS NULL`）得到該使用者有授權的分院清單
- 使用者選擇當前工作分院，`active_clinic_id` 存入 session / JWT（不寫回 DB）
- 若使用者僅有一間分院授權 → 自動選擇，不顯示選擇畫面
- 若使用者嘗試存取未授權的分院 → API 層拒絕，回傳 403
- `clinic_id IS NULL` 的角色授權（`admin`）= 全集團存取，不限分院

**理由**：
- 多角色指派是業界 RBAC 標準做法，彈性與安全兼顧
- Append-only 是醫療系統的最佳實踐：避免「事後竄改紀錄」的法律風險，優於 soft-edit + history table
- `superseded` 標記而非刪除：確保稽核人員可還原任一時間點的完整紀錄
- `created_by` 強制非空（應用層 + DB 層雙重保障）：責任歸屬不可缺失
- 分院選擇存 session 而非 DB：分院是「工作狀態」（session-scoped），非使用者屬性，不應存於 DB

---

## ADR-008 資料結構化原則

**狀態**：✅ 決定

**背景**：
設計資料庫時，部分欄位容易被設計成無規範的自由字串（如 `VARCHAR` 欄位無任何 CHECK 或外鍵約束），導致資料品質低落、查詢困難、未來資料交換障礙。

**決定：三層結構化策略**

| 類型 | 適用情境 | 實作方式 | 範例 |
|------|---------|---------|------|
| **CHECK 約束** | 開發者定義、值集合固定、與程式邏輯耦合 | `VARCHAR + CHECK (... IN (...))` | `status`, `sex`, `priority`, `label` |
| **目錄表（Catalog）** | 管理員可增減、值集合業務驅動、可能隨時間擴充 | 獨立目錄表 + FK + `is_active` | `species`, `breeds`, `lab_test_types`, `diagnosis_categories`, `diagnosis_codes` |
| **自由文字（Free text）** | 無法結構化的臨床敘述 | `TEXT`（不加 CHECK） | SOAP narrative、nursing notes、動物名稱 |

**判斷流程**：
1. 這個值集合由誰控制？
   - 開發者控制（固定語義）→ CHECK 約束
   - 管理員 / 業務控制（可增減）→ 目錄表
2. 這個值的改變是否需要 migration？
   - 是 → 應改用目錄表
   - 否（程式碼一起改）→ CHECK 約束可接受
3. 無法避免自由文字時 → 限縮到最小範圍，在 Schema 文件中明確說明原因

**理由**：
- 明確的結構化策略是資料品質的基礎，也是未來與外部系統（政府動物登記、檢驗儀器、第三方 API）交換資料的前提
- `VARCHAR` 無約束 = 技術債：資料清洗成本高、報表準確性低
- 目錄表兼顧彈性（管理員可操作）與品質（FK 保障參照完整性）

---

## ADR-009 動物識別策略

**狀態**：✅ 決定

**背景**：
動物身份識別是防止重複建檔、確保病歷正確歸屬的關鍵。不同於人類病患有統一身份證字號，動物的識別方式多樣（晶片、耳標、刺青、外觀描述），且不一定都有晶片。

**考慮選項**：

| 選項 | 說明 | 問題 |
|------|------|------|
| A. 晶片號碼為主鍵（強制必填） | 最簡單 | 大型動物、特殊寵物常無晶片；強制必填會阻擋合法就診 |
| B. 晶片號碼為唯一索引（nullable） | 有晶片時自動防重複；無晶片時人工確認 | 無晶片的重複建檔需人工判斷 |
| C. 複合唯一（owner + species + name） | 無需晶片也能唯一 | 動物同名、飼主有多隻同品種動物時誤判率高 |

**決定**：選項 B + 模糊比對輔助

- `microchip_number` 設為 nullable `VARCHAR(20)`
- 建立 partial UNIQUE index：`WHERE microchip_number IS NOT NULL`（組織層級唯一）
- 備用識別欄位：`tag_number`（耳標，大型動物）、`tattoo_number`（刺青識別）
- 無晶片時的去重邏輯：應用層以 `(owner_id, species_id, name)` 做模糊比對，由工作人員確認是否為同一隻動物
- `color`（毛色/外觀）保留自由文字，輔助人工識別，不作為唯一識別依據

**Schema 設計**：
```sql
animals (
  microchip_number VARCHAR(20),   -- nullable
  tag_number       VARCHAR(50),   -- 耳標（大型動物）
  tattoo_number    VARCHAR(50),   -- 刺青識別
  color            VARCHAR(100)   -- 毛色外觀（自由文字，輔助識別）
)

CREATE UNIQUE INDEX animals_microchip_idx
  ON animals (organization_id, microchip_number)
  WHERE microchip_number IS NOT NULL;
```

**理由**：
- 強制晶片會阻擋合法業務（許多動物確實沒有晶片）
- Partial UNIQUE index 在有晶片時提供 DB 層硬保障，避免晶片重複建檔
- 無晶片的模糊比對是業界常見做法（提示 + 人工確認），不需要 DB 層約束
- 未來若政府動物登記 API 上線，可優先以晶片號碼對應，schema 無需改動

---

## ADR-010 檔案附件架構

**狀態**：📋 設計備忘（後續階段，MVP 不實作）

**背景**：
系統中有多種二進位檔案需求：動物識別照片（輔助識別，避免認錯動物）、醫療影像與報告（ECG、X-ray、PDF 檢驗報告等）。二進位資料不應儲存於 PostgreSQL，須規劃獨立的檔案儲存方案。

**使用情境確認**：

| 檔案類型 | 操作角色 | 操作時機 |
|---------|---------|---------|
| 動物識別照片 | `receptionist`、`nurse` | 建檔時或候診時上傳 |
| 就診附件（ECG、X-ray、報告） | `technician`、`nurse` | 執行檢驗後上傳 |

獸醫師在診療過程中**不是**檔案上傳的主要操作者。

**架構決定**：

**1. 檔案儲存層**
- 部署 **MinIO**（自托管 S3 相容物件儲存）
- 整合進現有 Docker Compose 基礎設施（新增一個 service）
- DB 只存儲路徑參照（`storage_path` = MinIO object key），不存二進位資料

**2. 資料庫層（純加法，不影響現有表）**

```sql
-- 通用附件參照表
media_files (
  id               SERIAL PRIMARY KEY,
  organization_id  INTEGER NOT NULL REFERENCES organizations(id),
  storage_path     VARCHAR(500) NOT NULL,  -- MinIO object key
  mime_type        VARCHAR(100) NOT NULL,
  file_size_bytes  INTEGER,
  original_name    VARCHAR(255),
  uploaded_by      INTEGER NOT NULL REFERENCES users(id),
  created_at       TIMESTAMPTZ NOT NULL DEFAULT now()
)

-- 動物照片（1:N，多張）
animal_photos (
  id            SERIAL PRIMARY KEY,
  animal_id     INTEGER NOT NULL REFERENCES animals(id),
  media_file_id INTEGER NOT NULL REFERENCES media_files(id),
  label         VARCHAR(20) NOT NULL DEFAULT 'other'
    CHECK (label IN ('profile', 'marking', 'other')),
  is_primary    BOOLEAN NOT NULL DEFAULT FALSE,
  created_at    TIMESTAMPTZ NOT NULL DEFAULT now(),
  created_by    INTEGER NOT NULL REFERENCES users(id)
  -- 僅 receptionist 或 nurse 角色可上傳（應用層控制）
)

-- 就診附件（ECG、X-ray 報告、手術照片等）
visit_attachments (
  id              SERIAL PRIMARY KEY,
  visit_id        INTEGER NOT NULL REFERENCES visits(id),
  lab_order_id    INTEGER REFERENCES lab_orders(id),  -- nullable：關聯特定檢驗醫囑
  media_file_id   INTEGER NOT NULL REFERENCES media_files(id),
  attachment_type VARCHAR(20) NOT NULL DEFAULT 'other'
    CHECK (attachment_type IN ('ecg', 'xray', 'report', 'photo', 'other')),
  created_at      TIMESTAMPTZ NOT NULL DEFAULT now(),
  created_by      INTEGER NOT NULL REFERENCES users(id)
  -- 僅 technician 或 nurse 角色可上傳（應用層控制）
)
```

**設計縫隙分析**：
- 上述三張表均為**純加法**，與現有任何表無依賴衝突
- 現有表**不需要**預留任何欄位
- 實作時機：照片功能確認排期後再加入，成本低

**理由**：
- 二進位資料存 DB 是反模式：嚴重影響查詢效能、備份體積膨脹
- MinIO 與 Docker Compose 整合簡單，地端部署無需依賴外部雲服務
- `media_files` 通用設計：照片、ECG、X-ray、PDF 報告全部共用同一套基礎設施，不需為每種類型重複設計
- `visit_attachments.lab_order_id` nullable FK：支援「附件關聯到特定檢驗醫囑」的精確追溯，同時允許與醫囑無關的附件（如手術照片）

---

## ADR-011 分院自動識別機制

**狀態**：📋 設計備忘（後續階段）— 方向已定：URL/Subdomain，實作時機待定

**背景**：
診所電腦通常固定在特定院所，使用者每次登入都手動選擇分院是多餘的步驟。目前的兩步驟登入（輸入帳密 → 選擇分院）適合多院所 admin，但對於固定在某院所工作的一般員工（護理、獸醫、櫃台）是不必要的摩擦。

**目前行為**：
- 若使用者只有一間分院授權 → 後端自動選擇，不顯示選擇畫面（已實作）
- 若使用者有多間分院授權（如 admin）→ 顯示分院選擇器（已實作）

**考慮的方案**：

| 方案 | 說明 | 優點 | 缺點 |
|------|------|------|------|
| **URL / Subdomain** | 每個分院有獨立入口（`north.his.local`），前端從 `window.location.hostname` 讀取，自動帶入 `clinic_id` | 最乾淨、最可靠；後端可從 `Host` header 判斷；與裝置或使用者無關 | 需要 Nginx 多虛擬主機設定 + 各分院 DNS 設定 |
| **IP 位址判斷** | 後端根據 request IP 比對院所已知 IP 段，自動選定分院 | 院所電腦 IP 通常固定，不需使用者操作 | 遠端工作、VPN 會誤判；需維護 IP 對照表 |
| **裝置登記** | 在 DB 新增 `registered_devices` 表，電腦首次使用時由 admin 登記所屬分院 | 精確，可追蹤哪台電腦屬於哪個院所 | 需額外裝置管理 UI + 首次設定流程；維護成本高 |
| **瀏覽器記憶** | 選過分院後寫入 `localStorage`，下次自動帶入 | 實作最簡單，可立即疊加在現有流程上 | 清除 cache / 換瀏覽器就失效；安全性較弱 |

**決定**：採用 **URL/Subdomain** 方案。各分院使用獨立入口網址（如 `north.his.local`），前端從 `window.location.hostname` 自動帶入對應的 `clinic_id`，不再顯示分院選擇器。實作時機：部署環境確認、Nginx 虛擬主機設定完成後。

**對現有程式碼的影響**：
- 後端 `POST /auth/login` 已接受 `clinic_id` 參數，無論哪種方案都不需要改 API
- 前端 `LoginPage.tsx` 可在取得 response 之前注入 `clinic_id`，改動範圍極小
- DB schema 無需修改（除裝置登記方案外）

---

## ADR-012 就診狀態轉換歷史

**狀態**：📋 設計備忘（後續階段）— 與病歷模組一起實作

**背景**：
就診狀態機目前允許所有活躍狀態自由互轉（ADR-006 延伸決策）。因此同一次就診可能發生多次狀態來回（如 `in_consultation → admitted → in_consultation → completed`），現有 `visits` 表只記錄 `registered_at` 與 `completed_at`，無法重建完整的狀態時序。

**決定**：新增 `visit_status_history` append-only 稽核表，在每次狀態轉換時寫入一筆記錄。

**Schema 設計**：

```sql
CREATE TABLE visit_status_history (
    id           SERIAL PRIMARY KEY,
    visit_id     INTEGER NOT NULL REFERENCES visits(id),
    from_status  VARCHAR(30),               -- NULL = 初始掛號
    to_status    VARCHAR(30) NOT NULL,
    changed_at   TIMESTAMPTZ NOT NULL DEFAULT now(),
    changed_by   INTEGER REFERENCES users(id)
);

CREATE INDEX ON visit_status_history (visit_id, changed_at);
```

**實作範圍（待辦）**：
- Alembic migration：新增上述表與 index
- SQLAlchemy model：`VisitStatusHistory`
- Backend router：`PATCH /visits/{id}` 狀態變更時同步 `INSERT` 一筆歷史記錄
- Backend API（選擇性）：`GET /visits/{id}/history` 供病歷頁面顯示狀態時間軸

**實作時機**：病歷模組（SOAP note、就診詳情頁面）開發時一併加入。

---

## ADR-013 病歷號碼編碼原則

**狀態**：⏳ 業務待定（MVP 前端暫代方案已實作）— 前端 `formatRecordNo()` in `MedicalRecordDetailPage.tsx`

**背景**：
病歷模組 UI 需顯示可識別的病歷號碼供工作人員快速參照，但業務端尚未決定正式的編碼原則（如：號碼層級、格式、是否含分院前綴、是否含日期）。

**考慮選項**：

| 選項 | 說明 | 問題 |
|------|------|------|
| A. 動物層級號碼（`animals.record_number`） | 每隻動物一個固定號碼，所有就診共用 | 編碼原則未定；跨院所同動物在不同院是否共用號碼尚未確認 |
| B. 就診層級號碼（`visits.visit_number`） | 每次就診獨立流水號 | 編碼原則未定；與動物病歷號的概念有別 |
| C. 直接使用系統 ID（`visit.id`，格式化顯示） | 無需新增欄位，MVP 最簡方案 | 非業務友善格式；正式上線前需替換 |

**MVP 暫代決定**：採用選項 C — 前端格式化顯示 `V-{id:06d}`（例：`V-000042`）
- 不新增任何 DB 欄位
- 不寫 Alembic migration
- 純前端 UI 呈現，隨時可替換

**待確認事項（正式實作前需決定）**：
1. 號碼層級：動物層級（一隻動物一個號）or 就診層級（每次就診一個號）？
2. 是否需要含分院前綴（如 `A001-`）？
3. 是否需要含日期（如 `20260306-001`）？
4. 號碼由系統自動產生，還是支援手動輸入（舊系統移轉時）？

**設計縫隙**：
- 若決定動物層級 → 在 `animals` 加 nullable `VARCHAR(30) record_number`，成本低（一次 migration）
- 若決定就診層級 → 在 `visits` 加 nullable `VARCHAR(30) visit_number`，成本低（一次 migration）
- 現有 schema 無需預留，事後加欄位影響範圍極小

**實作時機**：業務端確認編碼原則後，由 admin 統一實作。


---

## ADR-014 臨床記錄的多院所隔離策略

**狀態**：✅ 已決定

**背景**：
`CLAUDE.md` 規定「所有業務資料表須包含 `clinic_id` 欄位」，但 `vital_signs`、`soap_notes`、`soap_diagnoses`、`nursing_notes` 等臨床記錄表均未直接存放 `clinic_id`。

**問題**：
臨床記錄表是否違反多院所隔離原則？

**決定**：
臨床記錄透過 **FK chain** 隱性滿足院所隔離，不直接存 `clinic_id`：

```
vital_signs.visit_id → visits.clinic_id
soap_notes.visit_id  → visits.clinic_id
nursing_notes.visit_id → visits.clinic_id
```

所有 API 存取臨床記錄前，都必須先以 `(visit_id, clinic_id)` 驗證就診所屬（見 `_get_visit()` helper），確保跨院資料不會洩漏。

**理由**：
1. `clinic_id` 已存於 `visits`，重複存於子表屬於冗餘 denormalization
2. 透過 JOIN / subquery 可等效查詢出同一院所所有臨床記錄
3. 在 `visits` 層做院所邊界驗證，比在每張子表加欄位更集中且易維護

**CLAUDE.md 規則修正**：
`clinic_id` 規則適用於「頂層業務實體」（owners、animals、visits 等），臨床記錄作為 visit 的子表，透過 visit 間接滿足院所隔離，視為豁免。


---

## ADR-015 visits.owner_id 非正規化設計

**狀態**：✅ 已決定（正規化審查 M1，2026-03-06）

**背景**：
`visits.owner_id` 是冗餘欄位（denormalization）。`animals.owner_id` 已可推導出飼主，`visits.animal_id → animals.owner_id` 即可取得。

**問題**：
此欄位是否應移除以符合 3NF（消除傳遞依賴）？

**決定**：
保留 `visits.owner_id`，並定義為**歷史快照（historical snapshot）語義**：

- 建立 visit 時，由應用層填入 `animals.owner_id` 的當下值
- 若動物日後轉讓（飼主異動），`visits.owner_id` **不隨之更新**
- 查詢歷史就診記錄時，顯示的是「當時的飼主」而非「現在的飼主」

**理由**：
1. **業務語義正確**：獸醫紀錄的責任歸屬應指向「就診時的飼主」，不應因動物轉讓而溯改
2. **查詢效能**：搜尋「某飼主的就診記錄」可直接 `WHERE owner_id = ?`，不需 JOIN `animals`
3. **緊急路徑預留**：`visits.animal_id` 可為 NULL（ADR-006），若無 animal 資訊，仍需 `owner_id` 作為就診歸屬

**應用層約束**：
- 建立 visit 時必須同步設定 `owner_id = animal.owner_id`（不允許 NULL，除非 animal_id 也為 NULL）
- 動物轉讓時，**不觸發**既有 visits 的 owner_id 更新

**Schema 標記**（SCHEMA.md 已更新）：
```sql
owner_id  INTEGER REFERENCES owners(id),
-- 歷史快照語義（ADR-015）：記錄就診當時的飼主，不隨動物轉讓更新
-- 對應 animal.owner_id 的當下值；允許 NULL（animal_id 亦為 NULL 的緊急路徑）
```

---

## ADR-016 系統小幫手（AI Assistant）架構

**狀態**：📋 設計備忘（後續階段，MVP 不實作）

**背景**：
診所工作人員在操作 HIS 系統時，常有查詢業務資料或確認操作方式的需求（例如：「今天還有幾隻動物在等候？」、「這隻狗上次的血液報告有沒有異常？」）。透過嵌入自然語言介面，可降低操作門檻並提升工作效率。由於系統包含動物健康資料、飼主個資等敏感資訊，此功能的資安設計需特別謹慎。

**功能等級定義**：

| 等級 | 能力 | 風險 |
|------|------|------|
| L1 | 僅回答操作說明，不接觸業務資料 | 低 |
| L2 | 可讀取當前分院業務資料，唯讀 | 中 |
| L3 | 可代使用者執行新增 / 修改操作 | 高 |

**決定**：實作 **L2**，不實作 L3。

---

**架構：Backend Proxy + Tool Use（唯讀工具）**

```
使用者輸入
  → 前端 POST /assistant/chat（附 JWT）
  → Backend proxy（驗證 JWT，取得 clinic_id）
  → 組合 system prompt（角色定義 + 禁止清單）
  → LLM（帶唯讀工具定義）
      ↓ 若需要資料，呼叫工具
    工具層（read-only，以 clinic_id 過濾）
      例：search_visits / get_animal_info / get_lab_results
  → LLM 生成回應 → 返回前端
```

- 前端**不直接**呼叫 LLM API，API key 僅存於後端
- LLM 只能透過後端定義的工具取得資料，無法直接查詢 DB
- 所有工具均為唯讀（`SELECT` only），不存在任何寫入工具

---

**LLM 選型（分階段決定）**：

| 階段 | 選型 | 理由 |
|------|------|------|
| **Demo / 開發期** | 雲端 API（Claude API 或 OpenAI API） | 用量極低、無需額外硬體、可快速驗證功能 |
| **正式上線後** | 地端自建（Ollama + 開源模型，如 Llama 3.1 / Qwen 2.5） | 資料不離境、無 per-token 費用、符合醫療資料隱私需求 |

地端正式部署需伺服器具備 GPU（≥8GB VRAM）；開源模型具備 Tool Use 能力的選項：Llama 3.1 8B/70B、Qwen 2.5 7B/72B。

架構設計已預留切換彈性：後端統一使用 OpenAI-compatible API 介面（Ollama 提供相容端點），從雲端切換至地端只需修改 `base_url` 與 `model` 兩個設定值，應用層程式碼無需改動。

---

**資料存取邊界（白名單原則）**：

| 可存取（報表層級資料） | 不可存取（敏感個資 / 系統資料） |
|----------------------|-------------------------------|
| visits（狀態、日期、主訴） | users（密碼 hash、token） |
| animals（名稱、物種、品種） | user_roles、role_definitions |
| owners（full_name）| owners.national_id（身分證字號）|
| vital_signs、soap_notes、nursing_notes | owner_contacts（電話、email） |
| lab_orders、lab_result_items | alembic 版本表、系統設定表 |

工具層在 SQL 層明確列舉允許回傳的欄位（SELECT 白名單），不使用 `SELECT *`，確保 LLM 永遠無法接觸到不在白名單內的欄位。

---

**對話紀錄 Schema**（稽核與預警）：

```sql
-- 一次登入期間的對話 session
CREATE TABLE assistant_sessions (
  id           SERIAL PRIMARY KEY,
  user_id      INTEGER NOT NULL REFERENCES users(id),
  clinic_id    INTEGER NOT NULL REFERENCES clinics(id),
  ip_address   VARCHAR(45),
  started_at   TIMESTAMPTZ NOT NULL DEFAULT now(),
  ended_at     TIMESTAMPTZ
);

-- 每一則訊息（含工具呼叫紀錄）
CREATE TABLE assistant_messages (
  id            SERIAL PRIMARY KEY,
  session_id    INTEGER NOT NULL REFERENCES assistant_sessions(id),
  role          VARCHAR(10) NOT NULL CHECK (role IN ('user', 'assistant')),
  content       TEXT NOT NULL,
  tools_called  JSONB,   -- LLM 呼叫了哪些工具、帶入哪些參數
  data_accessed JSONB,   -- 工具實際回傳的資料摘要（不儲存完整病歷內容）
  created_at    TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- 異常行為標記（人工或自動標記，供資安審查）
CREATE TABLE assistant_risk_flags (
  id          SERIAL PRIMARY KEY,
  message_id  INTEGER NOT NULL REFERENCES assistant_messages(id),
  flag_type   VARCHAR(50) NOT NULL,  -- 如：prompt_injection / bulk_query / off_hours
  detail      TEXT,
  flagged_at  TIMESTAMPTZ NOT NULL DEFAULT now(),
  reviewed_by INTEGER REFERENCES users(id),
  reviewed_at TIMESTAMPTZ
);
```

所有對話強制寫入 `assistant_messages`，不可關閉、不可由使用者刪除。

---

**資安防護措施**：

| 威脅 | 防護措施 |
|------|---------|
| Prompt Injection | system prompt 嚴格定義角色與禁止行為；使用者輸入長度限制；輸入不直接拼入 system prompt |
| 資料竊取（大量查詢） | 單次工具呼叫結果筆數上限（例如最多 20 筆）；短時間大量跨飼主查詢觸發 risk flag |
| 越權存取 | 所有工具以 JWT 的 `clinic_id` 過濾；工具無寫入能力 |
| 個資外洩（雲端 API） | 優先本地模型；使用雲端 API 時需評估個資傳輸合規性，並在使用者同意書中告知 |
| 非工作時段異常 | 深夜大量查詢自動標記 risk flag，供次日 admin 審閱 |

---

**未實作項目（L3，明確排除）**：
- 透過小幫手新增掛號、修改病歷、刪除資料等任何寫入操作
- 小幫手直接存取其他分院資料（跨 clinic_id）

**實作時機**：LLM 選型確認（視伺服器 GPU 規格）後開始規劃。

---

## ADR-017 手術 & 麻醉模組架構

**狀態**：📋 設計備忘（後續階段）

**背景**：
透過對市場主流獸醫軟體（Instinct Science、Digitail、Provet Cloud）及台灣手術排程系統（iMOR-ISS）的逆向分析，整理出手術 & 麻醉模組的設計要點。手術管理在臨床流程中涉及「排程」、「術中」、「術後」三個階段，且麻醉記錄因含術中時序監測資料（每 5–15 分鐘一筆），其複雜度與純文字的手術記錄有本質差異，需分層設計。

---

### 市場逆向分析摘要

| 系統 | 手術/麻醉功能定位 |
|------|-----------------|
| **Instinct Science** | 最完整：Anesthesia Mode 覆蓋術前用藥→術中監測→甦醒全流程 |
| **Digitail** | 一般化：Flowboard 看板追蹤手術病患，無獨立術中監測模組 |
| **Provet Cloud** | 中等：以治療計畫和白板為主，術中監測依整合第三方 |
| **iMOR-ISS（台灣）** | 純刀房排程：排班、健保碼、月/週/日行事曆，不含術中記錄 |

**關鍵洞察**：業界最大的功能差異點在於「是否含術中麻醉時序監測」。高階系統（如 Instinct）視此為核心競爭力；一般系統僅記錄術前/術後靜態欄位。

---

### 核心設計決策

**決策 1：手術記錄的關聯對象**

- **選項 A**：`surgery_records.visit_id FK`（手術掛在就診下）
- **選項 B**：`surgery_records.animal_id FK`，可選 `visit_id`（手術獨立存在）
- **決定**：選項 A（MVP 階段）
- **理由**：
  - 門診手術（最常見情境）必定有對應的 visit
  - 選項 B 的複雜度（獨立手術入口、無 visit 情境）在 MVP 不需要
  - visit 狀態機已有 `admitted`（住院手術的轉介路徑）
  - 未來若需選項 B，只需在 `surgery_records` 加上 `nullable visit_id` 並放寬 FK 約束，遷移成本低

**決策 2：麻醉記錄是否獨立表**

- **選項 A**：麻醉欄位直接內嵌於 `surgery_records`
- **選項 B**：`anesthesia_records` 獨立表（1:1 對應 surgery）
- **決定**：選項 B
- **理由**：
  - 麻醉師通常獨立填表，職責分離
  - 第二版若加入術中時序監測，`anesthesia_monitoring_events` 自然掛在 `anesthesia_records` 下
  - 內嵌在 surgery_records 日後拆分遷移成本高

**決策 3：術式目錄層次**

- **決定**：兩層（類別 → 術式），不加第三層
- **理由**：
  - 檢驗有三層（類別 → 項目 → 指標）是因為指標需要「數值 + 參考範圍」的結構化紀錄
  - 手術術式的「結果」是敘述性文字（術中發現、併發症），不需要指標層
  - 未來若有「手術步驟清單」需求，再以獨立 `surgery_steps` 表擴充

**決策 4：術中麻醉監測（時序資料）的處理**

- **決定**：MVP 不實作，列為第二版
- **理由**：
  - 術中監測（HR / RR / SpO₂ / EtCO₂ / 血壓 / 體溫 / 麻醉深度）為**時序資料**（time-series），一場手術可產生 20–40 筆，設計上需獨立的 `anesthesia_monitoring_events` 子表與折線圖 UI
  - 此複雜度與其他模組不同量級，開發成本高，且 MVP 目標診所紙本記錄仍可作業
  - 預留方式：`anesthesia_records` 建立時不加 `monitoring_events`，留空間未來擴充

---

### 資料表規劃（備忘）

```sql
-- 術式目錄（兩層）
CREATE TABLE procedure_categories (
  id              SERIAL PRIMARY KEY,
  organization_id INTEGER NOT NULL REFERENCES organizations(id),
  name            VARCHAR(100) NOT NULL,    -- 例：骨科、軟組織、眼科
  is_active       BOOLEAN NOT NULL DEFAULT TRUE,
  sort_order      SMALLINT DEFAULT 0
);

CREATE TABLE procedure_types (
  id                   SERIAL PRIMARY KEY,
  organization_id      INTEGER NOT NULL REFERENCES organizations(id),
  procedure_category_id INTEGER NOT NULL REFERENCES procedure_categories(id),
  name                 VARCHAR(100) NOT NULL,   -- 例：骨折固定術、卵巢子宮切除術
  default_duration_min SMALLINT,               -- 預估手術時間（分鐘）
  is_active            BOOLEAN NOT NULL DEFAULT TRUE,
  sort_order           SMALLINT DEFAULT 0,
  UNIQUE (procedure_category_id, name)
);

-- 手術記錄（每次手術一筆）
CREATE TABLE surgery_records (
  id                  SERIAL PRIMARY KEY,
  visit_id            INTEGER NOT NULL REFERENCES visits(id),
  organization_id     INTEGER NOT NULL REFERENCES organizations(id),
  procedure_type_id   INTEGER NOT NULL REFERENCES procedure_types(id),
  status              VARCHAR(20) NOT NULL DEFAULT 'scheduled'
    CHECK (status IN ('scheduled', 'in_progress', 'completed', 'cancelled')),
  surgeon_id          INTEGER REFERENCES users(id),
  assistant_ids       INTEGER[],              -- PostgreSQL 陣列，多位助手
  scheduled_at        TIMESTAMPTZ,
  started_at          TIMESTAMPTZ,
  ended_at            TIMESTAMPTZ,
  surgical_site       VARCHAR(200),           -- 手術部位
  surgical_findings   TEXT,                   -- 術中發現
  complications       TEXT,                   -- 併發症
  implants_notes      TEXT,                   -- 植入物 / 特殊材料備註
  is_superseded       BOOLEAN NOT NULL DEFAULT FALSE,  -- append-only 修正機制
  created_at          TIMESTAMPTZ NOT NULL DEFAULT now(),
  created_by          INTEGER NOT NULL REFERENCES users(id)
);
CREATE INDEX surgery_records_visit_idx ON surgery_records(visit_id);

-- 麻醉記錄（1:1 對應 surgery，由麻醉師填寫）
CREATE TABLE anesthesia_records (
  id                  SERIAL PRIMARY KEY,
  surgery_id          INTEGER NOT NULL REFERENCES surgery_records(id),
  asa_grade           SMALLINT CHECK (asa_grade BETWEEN 1 AND 5),  -- ASA 體況分級
  body_weight_kg      NUMERIC(6,2),           -- 手術當時體重
  fasting_hours       SMALLINT,               -- 術前禁食時間
  premedication       TEXT,                   -- 術前用藥（藥物 + 劑量 + 時間，自由文字 MVP）
  induction_agent     TEXT,                   -- 誘導藥物 + 劑量
  maintenance_agent   TEXT,                   -- 維持麻醉藥（吸入 / 靜注）
  tube_size_mm        NUMERIC(4,1),           -- 氣管插管管徑（mm）
  intubation_at       TIMESTAMPTZ,
  extubation_at       TIMESTAMPTZ,
  iv_fluid_type       VARCHAR(50),            -- 輸液種類
  iv_fluid_rate_ml_hr NUMERIC(6,1),
  recovery_quality    VARCHAR(10)
    CHECK (recovery_quality IN ('excellent', 'good', 'fair', 'poor')),
  anesthetist_id      INTEGER REFERENCES users(id),
  notes               TEXT,
  created_at          TIMESTAMPTZ NOT NULL DEFAULT now(),
  created_by          INTEGER NOT NULL REFERENCES users(id),
  UNIQUE (surgery_id)
);

-- 【第二版】術中麻醉時序監測（每 5–15 分鐘一筆，MVP 不建立）
-- CREATE TABLE anesthesia_monitoring_events ( ... );
```

---

### 關鍵設計考量（對照 ADR-008 無規範字串原則）

| 欄位 | 處理方式 | 理由 |
|------|---------|------|
| `status` | CHECK 約束（4 個值） | 固定集合，適合 CHECK |
| `procedure_type_id` | FK → 目錄表 | 管理員可增減 |
| `asa_grade` | SMALLINT + CHECK (1–5) | 國際標準，固定集合 |
| `recovery_quality` | VARCHAR + CHECK | 固定四級評分 |
| `premedication` / `induction_agent` | TEXT（自由文字）| MVP 藥物開立未實作，暫以文字記錄；未來串接 `medications` 目錄時可加 FK |
| `assistant_ids` | INTEGER[]（PostgreSQL 陣列）| 助手人數不定，避免過多關聯表；若需要查詢可建 GIN 索引 |

---

**實作時機**：住院管理模組完成後（兩者共用病患追蹤流程）。
麻醉術中監測（第二版）待評估是否整合 IoT 監測儀器自動推送，避免人工輸入誤差。

---

## ADR-018 法規合規設計策略

**狀態**：✅ 決定

**背景**：

HIS 系統儲存大量飼主個資與動物病歷，且未來各功能模組（用藥、結帳、影像）各有專屬法規要求。需在設計階段確立合規策略，避免模組上線時才發現架構不符規定。完整研究見 `COMPLIANCE.md`。

**適用法規範圍**：

| 面向 | 法規 | 主管機關 |
|------|------|---------|
| 個資保護 | 個人資料保護法 | 國發會 |
| 病歷管理 | 動物診療業管理辦法、獸醫師法 | 農業部 |
| 管制藥品 | 管制藥品管理條例 | 衛福部食藥署 |
| 動物用藥品 | 動物用藥品管理辦法 | 農業部 |
| 食用動物 | 動物用藥殘留標準 | 農業部 / 衛福部 |
| 稅務 | 統一發票使用辦法、電子發票 | 財政部 |
| 放射線 | 游離輻射防護法 | 核安會 |

**核心決定**：

1. **個資 & 資安面（MVP 後即補）**
   - 新增 `privacy_consents` 表記錄飼主告知同意（列為 P1）
   - 規劃 `audit_logs` 全域稽核日誌（僅允許 INSERT，保存 5 年）
   - 規劃 `security_incidents` 資安事件記錄 + 書面 SOP
   - 病歷保存至少 3 年（以動物診療業管理辦法為準）
   - 不做正式 ISO 27001 認證，但以其框架為技術設計參考

2. **用藥模組（上線前必須）**
   - 管制藥品須有獨立 append-only 流水帳（批號、劑量、餘量），此為法律義務，風險最高
   - 兩個月彙整申報匯出功能（衛福部食藥署格式）
   - 處方箋需可列印 / 匯出 PDF，格式符合動物用藥品管理辦法
   - 若服務食用動物，開藥時顯示休藥期並記錄到期日

3. **結帳模組（上線前必須）**
   - 電子發票為法律義務，不可上線後才補；需串接財政部 EINVOICE API
   - 支援 B2C 雲端發票、作廢與折讓
   - 建議優先確認診所是否已有電子發票服務廠商，評估套件 vs 自建

4. **影像模組**
   - X-ray 每次操作需記錄操作人員與時間（配合核安會稽查要求）
   - 操作人員資格標記（有輻射安全訓練者）列為 P2

5. **電子病歷格式**
   - 不套用衛福部醫療法（不適用），採自訂結構（SOAP + 生命徵象 + 護理備註）
   - 以 `created_by` 欄位取代電子簽章（農業部無強制 PKI 要求）

**理由**：

- 個資法要求「適當安全措施」，缺乏強制技術標準，設計有彈性；但管制藥品與電子發票是硬性法律義務，模組上線前不可迴避
- 管制藥品帳面不符可導致負責獸醫師執照撤銷，是所有合規項目中風險最高的一項，設計時須特別強化 append-only 與不可修改性
- 食用動物（大型動物）是否有休藥期需求，須向診所業主確認後決定是否實作

**待確認（影響模組設計）**：
- 診所是否已有管制藥品使用執照及申報格式（C6）
- 是否已有電子發票服務廠商（C7）
- 是否有食用動物客戶（C9）

詳見 `COMPLIANCE.md § 十三`。

---

## ADR-019 獸醫資料編碼標準與結構化策略

**狀態**：✅ 決定（MVP 採內部編碼；schema 已預留外部標準擴充路徑）

**背景**：

HIS 系統中有多類「受控詞彙」欄位，若不參照業界標準，將產生三個問題：

1. **欄位約束鬆散**：診斷名稱、檢驗項目任意輸入，跨院所資料不一致
2. **資料格式不可交換**：未來與 LIS、PACS、ERP 串接時需大量人工映射
3. **UI 設計無依據**：搜尋、自動完成、異常值範圍等 UX 缺乏結構支撐

更根本的問題是：**自由文字是資料結構化的最大障礙**。資料標準的核心功能之一，正是以「結構化片語庫（controlled phrase vocabulary）」取代任意輸入的自由敘述，讓臨床資料可計算、可比較、可匯出。本 ADR 同時決定編碼標準的選擇，以及「片語優先」的設計方向（對 ADR-008 的深化）。

**研究的標準**：

| 標準 | 定位 | 適用範疇 | 備註 |
|------|------|---------|------|
| **VeNom Coding** | 實務向 | 主訴、臨床發現、診斷、手術 | 提供片語庫供臨床人員選擇；歐洲獸醫 HIS 主流（EasyVet、Provet Cloud 等採用）；貓狗覆蓋最完整 |
| **VetSCT（SNOMED CT Veterinary Extension）** | 標準向 | 完整臨床術語體系（含診斷、手術、症狀、藥物） | 走正式 SNOMED 授權體系；適合跨系統互通或國際合規場景；需 NRC 成員授權；台灣尚無推廣 |
| **LOINC** | 觀測值向 | 實驗室檢驗項目、生命徵象代碼 | 國際 LIS 標準；獸醫版覆蓋部分；串接外部 LIS 時才需正式 mapping |
| **DICOM SR** | 影像向 | 影像附屬結構化報告欄位 | 已納入 ADR-010，不在此討論 |
| **ICD-11 / ICD-10** | 人醫診斷 | — | 不適用：無獸醫版本 |

> **VeNom vs VetSCT 定位說明**：兩者並非競爭關係，而是層次差異。VeNom 以「實務可用的片語庫」為目標，獸醫師直接從清單選術語；VetSCT 以「正式可授權的術語本體論」為目標，注重語義精確性與系統互通。MVP 若要引入外部標準，VeNom 門檻較低；長期若有跨系統交換需求，VetSCT 是更嚴謹的路線。

**設計原則：片語優先（Phrase-First），自由文字為後備**

本原則為 ADR-008「目錄表 > 自由文字」在語義層的延伸：不只是「欄位要有 FK 約束」，而是「欄位的值本身也要從結構化詞彙庫選取」。

### 術語表（Terminology Catalog）結構

片語詞彙以獨立 catalog 表儲存，結構類似 `diagnosis_codes`，管理員可新增/停用術語。每個臨床領域有其對應術語表：

| 術語表 | 適用欄位 | 對應標準（未來）|
|--------|---------|---------------|
| `diagnosis_codes` | `soap_diagnoses.code_id` | VeNom Diagnosis / VetSCT |
| `presenting_problems`（P2）| `visits.chief_complaint_code_id` | VeNom Presenting Problem |
| `exam_finding_terms`（P2）| `soap_notes.objective` 結構化部分 | VeNom Clinical Finding |
| `procedure_types`（已存在）| `procedure_records.procedure_type_id` | VeNom Procedure |

術語表共同欄位：`id`, `organization_id`, `name`, `coding_system`, `code`（外部代碼，nullable）, `is_active`, `sort_order`

### 「其他」選項：臨時出口 + 資料回饋機制

所有片語選擇欄位均提供「其他」選項，設計如下：

**Schema 模式**（已在 `soap_diagnoses` 實作，推廣至其他術語表）：
```sql
term_id   INTEGER REFERENCES <terminology_table>(id),  -- NULL = 選「其他」
free_text VARCHAR(500),                                 -- 「其他」時必填
CHECK (term_id IS NOT NULL OR free_text IS NOT NULL)
```

**雙重用途**：
1. **臨時出口**：詞彙表未覆蓋的術語，獸醫師仍能完成記錄，不阻斷工作流程
2. **詞彙擴充 Feedback Loop**：`term_id IS NULL` 的記錄即為「其他」累積資料，定期統計高頻 `free_text`，協助管理員決定哪些術語應升格進入詞彙表

> 實作備註：管理後台（P3）統計「其他」使用頻率並顯示前 N 名 `free_text`，一鍵新增至術語表。

臨床欄位依結構化程度分三層：

| 層次 | 欄位類型 | 輸入方式 | 範例 |
|------|---------|---------|------|
| **已結構化** | 數值 / 目錄 FK | Select / Number input | 生命徵象、診斷碼、黏膜顏色、檢驗結果 |
| **可片語化（中期目標）** | 現為 TEXT，有標準可映射 | Combobox（術語選擇 + 「其他」自由補充）| 主訴、理學檢查發現、診斷評估（Assessment）|
| **不可避免的自由文字** | 本質敘事性 | Textarea | 病史描述（Subjective）、護理備忘 |

**各欄位片語化評估**：

| 欄位 | 現況 | 片語化潛力 | 對應標準 | 優先級 |
|------|------|-----------|---------|--------|
| `visits.chief_complaint` | `TEXT NOT NULL` | 高 | VeNom Presenting Problem | P2 |
| `soap_notes.objective`（理學檢查） | `TEXT` | 高 | VeNom Clinical Findings | P2 |
| `soap_notes.assessment`（評估） | `TEXT` + `soap_diagnoses` FK | 高 | VeNom Diagnosis（`soap_diagnoses` 已走此路） | P1（已部分實作）|
| `soap_notes.plan`（計畫） | `TEXT` | 中 | VeNom Procedure（未來處置計畫模板）| P3 |
| `soap_notes.subjective`（主訴描述） | `TEXT` | 低 | 本質敘事性，保留自由文字 | — |
| `nursing_notes.note_text` | `TEXT NOT NULL` | 低 | 本質敘事性，保留自由文字 | — |
| `prescription_orders.instructions` | `TEXT` | 中 | 衛教模板庫（未來功能） | P3 |

**各模組標準決定**：

### 診斷碼（`diagnosis_codes`）

- **MVP**：`coding_system = 'internal'`，由各診所自行維護詞彙表
- **Schema 預留**：`coding_system CHECK ('internal', 'venomcode', 'snomed')`
  - 未來採用 VeNom：批次匯入 `coding_system = 'venomcode'`，**schema 不變**
  - 未來採用 VetSCT：同上，`coding_system = 'snomed'`
- **UI**：Combobox（搜尋 `name`）；採外部標準後可加 `code` 搜尋

### 主訴（`visits.chief_complaint`）

- **MVP**：自由文字（`TEXT NOT NULL`）
- **P2 方向**：新增 `chief_complaint_codes` 目錄表（類 VeNom Presenting Problem）；`chief_complaint` 轉為補充說明欄；schema 預留方向——新增 `chief_complaint_code_id` nullable FK，不移除 `TEXT` 欄
- **UI**：Combobox（選片語）+ 可選 Textarea（自由補充）

### 理學檢查（`soap_notes.objective`）

- **MVP**：自由文字
- **P2 方向**：部分結構化（體況評分 BCS 1–9、疼痛評分 0–4、各系統檢查 Pass/Abnormal），以 JSON sub-document 或獨立表實作
- **黏膜顏色**：已結構化（`mucous_membrane_colors` catalog）

### 檢驗項目（`lab_test_types` / `lab_analytes`）

- **MVP**：中文名稱 + LOINC code（`loinc_code VARCHAR(20) NULL`，migration 0014，詳見 ADR-025）
- 28 項常用獸醫檢驗指標已對應 LOINC 2.82，對應表見 `docs/loinc_mapping.md`
- **UI**：Analyte 數值 → Number input，範圍參照 `lab_analyte_references`（物種特定）

### 生命徵象、物種/品種

- 生命徵象欄位名稱已對應 LOINC 概念，不做正式 mapping
- 物種/品種：俗名優先（不採 ITIS/NCBI Taxonomy），學名不影響業務邏輯

**理由**：

- VeNom 為歐洲主流獸醫 HIS 採用，且 schema 已設計為可無痛切換；台灣目前無政府強制標準
- VetSCT 正式授權成本高，短期效益有限；預留為長期選項
- LOINC 對 LIS 串接有潛在價值，但 MVP 不接 LIS
- 「片語優先」方向：MVP 以 `soap_diagnoses` FK（已實作）為基礎，逐步擴展至 chief_complaint 和 objective；不求一步到位

**對 UI 設計的影響（MVP）**：

| 欄位 | 輸入控件 | 驗證策略 |
|------|---------|---------|
| 診斷 | Combobox（搜尋診斷碼目錄）+ free_text fallback | FK 或 free_text 至少一個非 null |
| 主訴 | Textarea（MVP）→ Combobox + Textarea（P2） | NOT NULL |
| 理學檢查 | Textarea（MVP）→ 結構化表單（P2） | 可 null |
| 檢驗項目 | Combobox（搜尋 lab_test_types） | FK NOT NULL |
| Analyte 數值 | Number / Text input（依 analyte_type） | 數值型：NUMERIC |
| 物種 | Select | FK NOT NULL |
| 品種 | Combobox（依物種過濾） | FK nullable |

**未來擴充路徑**：

- 採 VeNom：批次 INSERT `diagnosis_codes`（`coding_system='venomcode'`）；新增 `chief_complaint_code_id` FK；schema 均無破壞性變更
- 採 VetSCT：同上，`coding_system='snomed'`；視授權需求決定是否做術語本體論 mapping
- 接 LIS（HL7/FHIR）：`lab_analytes` 加 `loinc_code` + HL7 mapping layer

**待確認**：

- 診所是否已有診斷碼習慣（ICD-10 沿用人醫？自訂中文名？）→ 影響 seed 初始詞彙量與 coding_system 預設值
- 是否有轉診或保險理賠需求 → 若有，VeNom/VetSCT mapping 優先級須提升
- 診所是否有意願讓獸醫師從片語庫選主訴 vs. 直接打字 → 影響 P2 功能的推動時機


---

## ADR-020 Catalog 資料來源分類策略

**狀態**：✅ 決定

**背景**：

術語目錄管理模組完成後，系統中 14 張 catalog 表均可透過 UI 進行 CRUD。然而部分 catalog 的資料性質上應來自外部標準或資料庫（如 VeNom、SNOMED CT），由管理員手動輸入並不合適，需要釐清哪些 catalog 屬於「內部管理型」、哪些屬於「外部匯入型」，並確立各自的管理策略。

**考慮選項**：

1. 全部統一由管理員在 UI 手動 CRUD（忽略資料來源差異）
2. 設計時分類，UI 依分類決定是否開放 CRUD，外部匯入型僅唯讀瀏覽
3. 提供 UI 切換機制，允許管理員在「內部管理」與「外部匯入」之間動態切換

**決定**：

採選項 2。**Catalog 分類在設計階段決定，不提供 UI 切換**。若需調整分類，透過資料遷移（migration）處理並在本文件補記原因。

外部匯入型 catalog 在術語目錄管理 UI 中標示為唯讀，未來透過獨立的「匯入管理」功能維護；內部管理型提供完整 CRUD。

**分類表**：

| 分類 | Catalog 表 | 說明 |
|------|-----------|------|
| **內部管理型** | `species`, `breeds`, `blood_types`, `contact_types` | 院所自行定義的生物與聯絡分類 |
| **內部管理型** | `mucous_membrane_colors`, `administration_routes` | 院所自行維護的臨床詞彙 |
| **內部管理型** | `medication_categories`, `medications` | 院所用藥目錄 |
| **內部管理型** | `procedure_categories`, `procedure_types` | 院所處置項目目錄 |
| **內部管理型** | `lab_categories`, `lab_test_types`, `lab_analytes` | 院所檢驗項目目錄 |
| **內部管理型** | `diagnosis_categories` | 診斷分類，由院所自定 |
| **內部管理型** | `diagnosis_codes`（`coding_system = 'internal'`） | 院所自訂診斷碼 |
| **外部匯入型** | `diagnosis_codes`（`coding_system = 'venomcode'` / `'snomed'`） | 來自 VeNom 或 VetSCT 標準，批次匯入 |

**`source_ref` 欄位**：

外部匯入型條目需追蹤資料來源，在 `diagnosis_codes` 新增 `source_ref VARCHAR(255) NULL`：

```
NULL              → 內部自訂（coding_system = 'internal'）
'VeNom 2023'      → VeNom 版本標記
'SNOMED CT 2024-01-01' → SNOMED 版本標記
'https://venomcoding.org/term/12345' → 來源 URL
```

切換規則：
- 分類為**設計時決定**，UI 不提供切換
- 若未來需變更某條目的 `coding_system`（如將內部碼對應到 VeNom），透過 migration 處理並補記決策原因

**理由**：

- UI 切換機制會造成「誰負責維護這筆資料」的職責模糊，設計時明確分類可避免此問題
- 外部標準資料量大（VeNom 數千條）且需定期同步，不適合手動 UI 操作
- `source_ref` 不影響業務邏輯，僅作管理稽查用途，nullable 即可
- MVP 階段全為 `coding_system = 'internal'`，此決策為未來匯入外部標準預鋪路

**對 UI 的影響**：

術語目錄管理頁的診斷碼 section，未來可依 `coding_system` 過濾：
- 預設只顯示 `internal` 條目，供管理員 CRUD
- `venomcode` / `snomed` 條目顯示為唯讀列表（帶來源標籤），待獨立匯入功能實作

---

## ADR-021 就診重複掛號的併發控制策略

**狀態**：⏳ 待定（已識別，待討論）

**背景**：

目前的重複掛號防護是 application-level 的 check-then-act 模式（`visits.py`）：先 SELECT 檢查該動物是否有 active visit，沒有才 INSERT。在 PostgreSQL 預設的 `READ_COMMITTED` 隔離級別下，兩個 concurrent request 可能同時通過檢查，導致同一隻動物在同一間診所產生兩筆 active visit。

```
Thread A: SELECT → 無 active visit → 準備 INSERT
Thread B: SELECT → 無 active visit → 準備 INSERT  ← 讀到相同狀態
Thread A: INSERT + COMMIT ✓
Thread B: INSERT + COMMIT ✓  ← 違反業務規則
```

**風險評估**：

- 目前 5 間分院，每間每天約 20–40 隻動物，同一隻動物同時被兩個櫃台掛號的機率極低
- 但隨規模擴充（10 間分院、線上預約系統）或未來開放 API 整合，風險會上升
- 醫療系統對資料正確性要求高，即使機率低，結構性弱點仍應記錄

**考慮選項**：

| 選項 | 做法 | 優點 | 缺點 |
|------|------|------|------|
| A. Partial Unique Index | `CREATE UNIQUE INDEX ON visits (animal_id, clinic_id) WHERE status NOT IN ('completed', 'cancelled')` | DB 層保證、零 performance penalty、最乾淨 | 需決定約束範圍（跨院所 or 單院所） |
| B. SELECT FOR UPDATE | 查詢時加悲觀鎖 | 明確的鎖語義 | 增加鎖競爭、影響吞吐量 |
| C. SERIALIZABLE isolation | 提升交易隔離級別 | 最嚴格保證 | 全域影響、retry 邏輯複雜、overkill |
| D. 維持現狀 | 不做變更 | 零開發成本 | 結構性弱點持續存在 |

**傾向**：選項 A（Partial Unique Index），與現有 `animals_microchip_idx`、`owners_national_id_idx` 一致的設計 pattern。

**待討論事項**：

1. **約束範圍**：目前 application-level 檢查是 `(animal_id, clinic_id)` 粒度（同院所）。是否應擴大為 `(animal_id)` 粒度（跨院所）？即：同一隻動物是否允許同時在 A 院掛號候診、B 院也掛號？
   - 支持跨院限制：避免飼主同時帶動物去兩間看診的混亂
   - 支持單院限制：轉院場景可能需要先在 B 院掛號再從 A 院結案
2. **對既有資料的影響**：加 index 前需確認現有資料無違反（雖然目前機率極低）
3. **錯誤處理**：若 DB 層 reject（unique violation），應用層需 catch `IntegrityError` 並轉為 409 回應，與現有 application-level 的錯誤訊息保持一致
4. **時程考量**：此問題在目前規模下不會實際發生，是否排入近期 sprint 或等到預約系統 / API 開放時再實作？

---

## ADR-022 臨床紀錄不可變性保障層級

**狀態**：⏳ 待定（已識別，待討論）

**背景**：

系統的臨床紀錄（vital_signs、soap_notes、nursing_notes、lab_orders 等 9 張表）採 append-only 設計（ADR-007），透過應用層的 `is_superseded` 機制保障不可變性。然而，此保障僅限於「經由 API 操作」的正常路徑。若具備資料庫直連權限的人員（DBA、維運人員）直接執行 `UPDATE` 或 `DELETE`，現有機制無法偵測或阻止。

在合規層面，動物診療業管理辦法要求病歷保存 ≥ 3 年（第 22 條），個資法要求存取操作可追蹤（第 27 條）。需決定系統對不可變性的保障應做到哪一層。

**核心問題**：

應用層保障 vs DB 層保障不是「越多越好」，而是要在**安全性、維運成本、系統複雜度**之間取捨。

**考慮選項**：

| 層級 | 做法 | 防護範圍 | 代價 |
|------|------|---------|------|
| L1. 應用層（現狀） | `is_superseded` + append-only 邏輯，所有 GET 過濾 `is_superseded = FALSE` | 防止正常使用者透過 API 竄改 | 零額外成本；DBA 直連可繞過 |
| L2. DB 權限隔離 | 應用程式帳號僅授予 `INSERT` / `SELECT` 權限，禁止 `UPDATE` / `DELETE`；migration 使用獨立的高權限帳號 | 防止 DBA 誤操作或應用層 bug 意外執行 UPDATE | 需分離 DB 帳號（app_user vs migration_user）；部署流程調整 |
| L3. DB Trigger 稽核 | row-level `AFTER UPDATE OR DELETE` trigger，將變更前後的值寫入 `audit_logs` 表（JSONB 格式：who / when / old_value / new_value） | 不阻止竄改，但事後可完整追查 | 與 ADR-001「邏輯全在應用層」原則衝突；每次寫入多一次 trigger 開銷；audit_logs 表會快速成長 |

**選項組合分析**：

- **L1 only（現狀）**：MVP 階段足夠，但上線後若需通過合規稽核可能被質疑
- **L1 + L2**：最務實的組合。應用層保障 + DB 權限隔離，覆蓋 95% 場景，無 trigger 複雜度
- **L1 + L2 + L3**：最完整，但 trigger 維護成本高，且與現有「DB 只做儲存」的架構風格不一致
- **L1 + L3（跳過 L2）**：不建議。L3 是偵測機制（事後追查），L2 是預防機制（事前阻止），兩者互補而非替代

**傾向**：L1 + L2（應用層 + DB 權限隔離）

**理由**：
- L2 的實作成本低（一次性 DB 設定），維運負擔小
- 與現有架構風格一致（不引入 trigger）
- 覆蓋最常見的風險場景（誤操作、應用層 bug）
- 惡意 DBA 竄改的場景在自建團隊中機率極低，L3 的投入產出比不划算

**待討論事項**：

1. **帳號分離策略**：部署環境中 `docker-compose.yml` 目前只有一個 DB 帳號。是否在上線前分離為 `his_app`（INSERT/SELECT）+ `his_migration`（全權限）？
2. **哪些表需要限制**：是否僅限 9 張臨床表，還是擴大到所有業務表（包含 visits、owners、animals）？
3. **Seed 腳本的帳號**：`seed.py` 需要 INSERT 權限，但也需要某些表的 UPDATE（如 `is_active` 切換）。是否歸類為 migration 帳號？
4. **L3 的觸發條件**：如果未來合規稽核明確要求「可追溯所有變更」，是否升級至 L1 + L2 + L3？觸發條件是什麼？
5. **時程**：L2 不影響應用層程式碼，可在部署上線前作為基礎設施配置實施，不需排入功能開發 sprint

---

## ADR-023 住院管理模組設計

**狀態**：✅ 決定

**背景**：

系統需要支援動物住院管理，包含病房/病床管理、入院/出院流程、住院期間的醫囑與紀錄。目前 visit 狀態機已有 `admitted` 狀態（ADR-006），但住院的完整生命週期尚未設計。

### 決定一：實體架構（三層）

```
Clinic（分院）
  └── Ward（病房/區域）
        └── Bed（病床）
```

- **Ward**：輕量化，代表病床的分群（物種隔離、感染控制、照護強度、設備需求）
- Ward 類型用 catalog 表（`ward_types`，內部管理型），各院可自訂
- 不設「建築物」層級——動物醫院規模不需要

### 決定二：Visit 與 Admission 的關係（1:1）

```
Visit (1) ──→ (0..1) Admission
```

- **掛號是所有流程的必要入口**，住院一定有掛號（`visit_id NOT NULL`）
- 一次掛號至多對應一次住院
- 允許兩種路徑：
  - 掛號 → 門診 → 住院（門診轉入）
  - 掛號 → 直接住院（跳過門診）
- 同一病程的延續用 `related_visit_id`（nullable FK）串聯
- 掛號費減免由未來結帳模組的商業邏輯處理，不由資料結構決定

**Visit 狀態機維持不變**：
```
registered → triaged → in_consultation → completed
                     → admitted → completed
           → cancelled
```
- `admitted` = 走住院路徑
- `completed` = 掛號結案（不管走哪條路徑）

**Admission 狀態機**（獨立）：
```
active → discharged
```
未來可擴充 `transferred`（轉院）。

### 決定三：病床管理

**Bed 類型**：`bed_types`（內部管理型 catalog），名稱自帶籠體固有能力描述（如「氧氣籠」「ICU 監護籠」「保溫箱」）。

**設備追蹤**：採「綁在流程節點」策略（方案 B）。
- `equipment_items`（內部管理型 catalog）：可用設備清單
- `ward_default_equipment`：病房預設設備，建立住院紀錄時自動帶出預設勾選
- `admission_equipment`：住院實際使用設備（護理師在入院時調整勾選）
- 可移動設備不在床位層級即時追蹤，避免維護紀律成本過高

**費率**：不預留 `daily_rate`，等結帳模組再加（事後加 nullable 欄位成本低）。

### 決定四：住院期間的記錄

**生命徵象**：複用現有 `vital_signs` 表（掛在 visit_id 上）。住院期間量測仍寫入同一張表，前端透過查詢條件在不同頁面顯示：
- 病歷頁面：`WHERE animal_id = ? ORDER BY created_at`（完整時序）
- 巡房紀錄：`WHERE visit_id = ?`（僅住院期間）

**每日巡房紀錄**（`daily_rounds`）：
- admission_id, round_date, assessment (TEXT), plan (TEXT), created_by
- 不存生命徵象，前端組合同日 vital_signs 一起顯示

**護理紀錄**（`inpatient_nursing_logs` + `inpatient_nursing_log_actions`）：
- 片語勾選 + 備註模式
- `nursing_action_items`（內部管理型 catalog）：已餵食、已排尿、已排便、傷口換藥、翻身、清潔籠舍...

**住院醫囑**（`inpatient_orders`）：
- 醫囑 + 執行紀錄模式
- `order_types`（內部管理型 catalog）：用藥、處置、飲食、監測、活動限制
- `frequencies`（內部管理型 catalog）：SID、BID、TID、QID、Q4H、Q6H、Q8H、Q12H、PRN、STAT、AC、PC
- 醫囑含 start_at / end_at / status (active / completed / cancelled)
- 執行紀錄（`inpatient_order_executions`）：護理師按醫囑逐次打勾

**轉床紀錄**（`bed_transfers`）：
- from_bed_id, to_bed_id, transferred_at, transferred_by
- 不設獨立的轉床原因欄位——轉移方向本身即原因（一般→ICU = 病情惡化）
- 同類型轉床（同 ward_type）：拖曳即完成
- 跨類型轉床（不同 ward_type）：強制填寫巡房紀錄（`daily_rounds`），作為臨床決策記錄
- 轉床時同步更新床位狀態

**出院紀錄**（`discharge_records`，1:1 with admission）：
- `discharge_reasons`（內部管理型 catalog）：康復出院、病情穩定出院、飼主要求出院、轉院、死亡
- `discharge_conditions`（內部管理型 catalog）：痊癒、改善、穩定、未改善、死亡
- discharge_notes (TEXT NULL), follow_up_plan (TEXT NULL)
- 出院後 visit 狀態由操作人員選擇：
  - `completed`（結案，回家）
  - `in_consultation`（轉回門診留觀）
- 出院時同步：admission → discharged、床位 → 空床、visit → 依選擇
- 住院中的 visit 不允許透過狀態按鈕直接變更，須走出院流程

### 決定五：病歷內頁整合

- 病歷內頁加入狀態切換按鈕（依當前狀態顯示合法的下一步）
- 獸醫在病歷內頁按「轉住院」→ 彈出住院表單 → 一次完成狀態切換 + 入院登記
- 看板拖曳操作保留（給櫃檯/護理師用），獸醫主要操作動線在病歷內頁
- 病歷 Tab 新增「住院」頁籤，含入院資訊、住院醫囑、巡房紀錄、住院護理紀錄

### 新增 Catalog 表彙總（全部為內部管理型）

| Catalog 表 | 初始 Seed |
|------------|----------|
| `ward_types` | ICU、一般、隔離、術後恢復 |
| `bed_types` | 大型犬籠、中型犬籠、小型犬/貓籠、氧氣籠、保溫箱、ICU 專用籠 |
| `equipment_items` | 氧氣供應、輸液幫浦、心電監護、噴霧治療機、保溫燈 |
| `admission_reasons` | 術後觀察、重症監護、輸液治療、傳染病隔離（+ 補充說明 TEXT NULL） |
| `nursing_action_items` | 已餵食、已排尿、已排便、傷口換藥、翻身、清潔籠舍 |
| `order_types` | 用藥、處置、飲食、監測、活動限制 |
| `frequencies` | SID、BID、TID、QID、Q4H、Q6H、Q8H、Q12H、PRN、STAT、AC、PC |
| `discharge_reasons` | 康復出院、病情穩定出院、飼主要求出院、轉院、死亡 |
| `discharge_conditions` | 痊癒、改善、穩定、未改善、死亡 |

### 對術語目錄管理 UI 的影響

隨著 catalog 表增多，術語目錄管理頁面需加入頁籤分類（如「基礎」「臨床」「住院」），後續迭代處理。

---

## ADR-025 採用 LOINC 作為檢驗項目標準編碼

**狀態**：✅ 決定

**背景**：

`lab_analytes` 目前使用中文名稱作為識別（如「WBC（白血球）」），無國際標準編碼。未來若需串接 LIS（檢驗儀器）、跨院資料交換、或建構 CDSS，需要一套通用的檢驗項目編碼系統。

**考慮選項**：

| 標準 | 說明 | 優缺點 |
|------|------|--------|
| **LOINC** | Logical Observation Identifiers Names and Codes，Regenstrief Institute 開發，10 萬+筆觀測項目代碼 | 國際主流、免費開源、HL7/FHIR 標準指定；獸醫覆蓋部分但核心檢驗項目齊全 |
| SNOMED CT | 臨床術語系統 | 覆蓋面更廣但授權費用高；與 LOINC 互補而非替代 |
| 自訂編碼 | 院內自訂代碼 | 零成本但無法與外部系統互通 |

**決定**：

採用 LOINC 2.82 作為檢驗項目的標準編碼系統。

- `lab_analytes` 新增 `loinc_code VARCHAR(20) NULL`（migration 0014）
- MVP 階段為 28 項常用獸醫檢驗指標對應 LOINC code（詳見 `docs/loinc_mapping.md`）
- LOINC code 為 nullable，未對應的項目不影響系統運作
- LOINC 原始資料庫（10 萬+筆 CSV）保留在本機參考，不入 git

**理由**：

- LOINC 是 HL7/FHIR 的指定觀測值編碼系統，未來接 LIS 時為必要條件
- 現在加欄位成本極低（nullable），但等 production 有大量資料後回填成本高
- 為 CDSS（臨床決策輔助）和流程探勘的 analyte 標準化鋪路
- 台灣衛福部正在推動 LOINC 應用（2025 年 LOINC 大會）

**擴充路徑**：

- 新增 analyte 時一併查找 LOINC code
- 接 LIS 時：儀器吐出 LOINC code → 系統自動對應到 analyte
- 接 FHIR 時：Observation.code 直接使用 LOINC
